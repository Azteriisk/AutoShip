package com.autoship.clover.ui.shipping

import android.content.Context
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.autoship.clover.clover.CloverConnectorManager
import com.autoship.clover.data.model.Address
import com.autoship.clover.data.model.CartItem
import com.autoship.clover.data.model.ShipOrderRequest
import com.autoship.clover.data.model.ShippingRate
import com.autoship.clover.data.repository.ShippingRepository
import com.autoship.clover.ui.settings.SettingsManager
import com.autoship.clover.util.Result
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

class ShippingViewModel(
    private val context: Context,
    private val cloverManager: CloverConnectorManager,
    private val shippingRepository: ShippingRepository,
    private val settingsManager: SettingsManager
) : ViewModel() {

    private val tag = "ShippingViewModel"

    companion object {
        const val NETWORK_TIMEOUT_MS = 2500L
        const val OFFLINE_STANDARD_RATE_CENTS = 895L   // Standard Ground $8.95
        const val OFFLINE_PRIORITY_RATE_CENTS = 1450L  // Priority $14.50
        const val OFFLINE_EXPRESS_RATE_CENTS = 2850L   // Express $28.50
        private const val APPLY_DEBOUNCE_MS = 1000L
    }

    private val applyMutex = Mutex()
    private var lastApplyTimestamp = 0L

    private val _orderId = MutableLiveData<String>()
    val orderId: LiveData<String> = _orderId

    private val _orderSubtotalCents = MutableLiveData<Long>(0L)
    val orderSubtotalCents: LiveData<Long> = _orderSubtotalCents

    private val _cartItems = MutableLiveData<List<CartItem>>(emptyList())
    val cartItems: LiveData<List<CartItem>> = _cartItems

    private val _destinationAddress = MutableLiveData<Address?>()
    val destinationAddress: LiveData<Address?> = _destinationAddress

    private val _rates = MutableLiveData<List<ShippingRate>>(emptyList())
    val rates: LiveData<List<ShippingRate>> = _rates

    private val _selectedRate = MutableLiveData<ShippingRate?>()
    val selectedRate: LiveData<ShippingRate?> = _selectedRate

    private val _isInsuranceSelected = MutableLiveData<Boolean>(false)
    val isInsuranceSelected: LiveData<Boolean> = _isInsuranceSelected

    private val _isFreeShippingQualified = MutableLiveData<Boolean>(false)
    val isFreeShippingQualified: LiveData<Boolean> = _isFreeShippingQualified

    private val _waivedAmountCents = MutableLiveData<Long>(0L)
    val waivedAmountCents: LiveData<Long> = _waivedAmountCents

    private val _isLoadingRates = MutableLiveData<Boolean>(false)
    val isLoadingRates: LiveData<Boolean> = _isLoadingRates

    private val _ratesErrorMessage = MutableLiveData<String?>()
    val ratesErrorMessage: LiveData<String?> = _ratesErrorMessage

    private val _isApplyingShipping = MutableLiveData<Boolean>(false)
    val isApplyingShipping: LiveData<Boolean> = _isApplyingShipping

    private val _applyResult = MutableLiveData<Result<Boolean>?>()
    val applyResult: LiveData<Result<Boolean>?> = _applyResult

    // Visual feedback for offline fallback rate table
    private val _isOfflineRatesActive = MutableLiveData<Boolean>(false)
    val isOfflineRatesActive: LiveData<Boolean> = _isOfflineRatesActive

    private val _offlineNoticeMessage = MutableLiveData<String?>()
    val offlineNoticeMessage: LiveData<String?> = _offlineNoticeMessage

    /**
     * Initializes order details from Clover OrderConnector.
     * When opened standalone without an order ID, initializes a clean manual fulfillment state.
     */
    fun initOrder(incomingOrderId: String?) {
        val targetId = incomingOrderId?.ifBlank { null }
        _orderId.value = targetId ?: ""

        if (targetId.isNullOrBlank()) {
            _cartItems.value = emptyList()
            _orderSubtotalCents.value = 0L
            _destinationAddress.value = null
            _rates.value = emptyList()
            _selectedRate.value = null
            _isOfflineRatesActive.value = false
            _offlineNoticeMessage.value = null
            return
        }

        viewModelScope.launch {
            if (cloverManager.isCloverDevice()) {
                val items = cloverManager.getCartItems(targetId)
                // Auto-detect heavy / uncataloged items from names
                val processedItems = items.map { item ->
                    val lower = item.name.lowercase()
                    val isHeavyKeyword = lower.contains("heavy") ||
                        lower.contains("oversized") ||
                        lower.contains("freight") ||
                        lower.contains("crate")
                    if (isHeavyKeyword) item.copy(isHeavyOverride = true, weightOz = 320.0) else item
                }

                val cloverOrder = cloverManager.getOrder(targetId)
                val subtotal = processedItems.sumOf { it.priceCents }

                _cartItems.value = processedItems
                _orderSubtotalCents.value = if (subtotal > 0) subtotal else (cloverOrder?.total ?: 0L)

                // Query customer shipping address from Clover order
                val customerAddress = cloverManager.getCustomerAddressForOrder(targetId)
                _destinationAddress.value = customerAddress
            } else {
                _cartItems.value = emptyList()
                _orderSubtotalCents.value = 0L
                _destinationAddress.value = null
            }

            // Auto-insurance rule: if cart subtotal is >= $100 and auto-insurance is configured
            if (settingsManager.isAutoInsuranceEnabled && (_orderSubtotalCents.value ?: 0L) >= 10000L) {
                _isInsuranceSelected.value = true
            }

            // Fetch carrier rates if address is populated
            if (_destinationAddress.value?.isValid() == true) {
                fetchRates()
            }
        }
    }

    /**
     * Updates the shipping destination address and refetches rates.
     */
    fun setDestinationAddress(address: Address) {
        _destinationAddress.value = address
        fetchRates()
    }

    /**
     * Toggles optional transit insurance.
     */
    fun setInsuranceSelected(enabled: Boolean) {
        _isInsuranceSelected.value = enabled
    }

    /**
     * Selects a specific carrier service rate.
     */
    fun selectRate(rate: ShippingRate) {
        _selectedRate.value = rate
    }

    /**
     * Cashier dimension override for a specific cart line item.
     * Allows cashiers to input custom dimensions, weight, or flag heavy freight items.
     */
    fun updateItemDimensions(
        itemId: String,
        weightOz: Double,
        lengthIn: Double,
        widthIn: Double,
        heightIn: Double,
        isHeavy: Boolean
    ) {
        val currentItems = _cartItems.value?.toMutableList() ?: mutableListOf()
        val index = currentItems.indexOfFirst { it.id == itemId }

        if (index >= 0) {
            val old = currentItems[index]
            currentItems[index] = old.copy(
                weightOz = weightOz.coerceAtLeast(1.0),
                lengthIn = lengthIn.coerceAtLeast(1.0),
                widthIn = widthIn.coerceAtLeast(1.0),
                heightIn = heightIn.coerceAtLeast(1.0),
                isHeavyOverride = isHeavy
            )
        } else {
            // New uncataloged line item created manually at POS
            currentItems.add(
                CartItem(
                    id = itemId.ifBlank { "uncataloged_${System.currentTimeMillis()}" },
                    name = if (isHeavy) "Uncataloged Heavy Item" else "Uncataloged Item",
                    priceCents = 0L,
                    quantity = 1,
                    weightOz = weightOz.coerceAtLeast(1.0),
                    lengthIn = lengthIn.coerceAtLeast(1.0),
                    widthIn = widthIn.coerceAtLeast(1.0),
                    heightIn = heightIn.coerceAtLeast(1.0),
                    isHeavyOverride = isHeavy
                )
            )
        }

        _cartItems.value = currentItems
        if (_destinationAddress.value?.isValid() == true) {
            fetchRates()
        }
    }

    /**
     * Overrides dimensions for the overall package / all items.
     */
    fun updatePackageOverrides(
        weightOz: Double,
        lengthIn: Double,
        widthIn: Double,
        heightIn: Double,
        isHeavy: Boolean
    ) {
        val currentItems = _cartItems.value
        if (currentItems.isNullOrEmpty()) {
            updateItemDimensions("pkg_override", weightOz, lengthIn, widthIn, heightIn, isHeavy)
        } else {
            // Update primary item or distribute across items
            val primary = currentItems[0]
            updateItemDimensions(primary.id, weightOz, lengthIn, widthIn, heightIn, isHeavy)
        }
    }

    /**
     * Generates estimated tiered fallback rates so register checkout never stalls.
     * Tier 1: Standard Ground $8.95
     * Tier 2: Priority $14.50
     * Tier 3: Express $28.50
     * Includes heavy item freight handling if items are uncataloged heavy items.
     */
    fun generateOfflineFallbackRates(
        items: List<CartItem>,
        subtotalCents: Long,
        destination: Address
    ): List<ShippingRate> {
        val totalWeightOz = items.sumOf { it.totalWeightOz }.coerceAtLeast(16.0)
        val hasHeavyItem = items.any { it.isHeavy } || totalWeightOz > 160.0 // >10 lbs

        // Heavy item surcharge if oversized or heavy
        val heavySurchargeCents = if (hasHeavyItem) {
            val extraWeightLbs = ((totalWeightOz - 80.0).coerceAtLeast(0.0) / 16.0).toInt()
            800L + (extraWeightLbs * 150L) // $8.00 base heavy surcharge + $1.50/extra lb
        } else 0L

        val standardBase = OFFLINE_STANDARD_RATE_CENTS + heavySurchargeCents
        val priorityBase = OFFLINE_PRIORITY_RATE_CENTS + (heavySurchargeCents * 1.2).toLong()
        val expressBase = OFFLINE_EXPRESS_RATE_CENTS + (heavySurchargeCents * 1.5).toLong()

        val badgeStandard = if (hasHeavyItem) "HEAVY FREIGHT" else "BEST VALUE"
        val badgePriority = if (hasHeavyItem) "HEAVY PRIORITY" else "RECOMMENDED"
        val badgeExpress = "FASTEST"

        return listOf(
            ShippingRate(
                id = "offline_standard_ground",
                carrier = "USPS",
                serviceName = if (hasHeavyItem) "Ground Heavy Freight" else "Standard Ground",
                estimatedDelivery = "3-5 business days (Offline Est.)",
                estimatedDays = 4,
                baseRateCents = standardBase,
                insuranceCostCents = 150L,
                isFreeShippingEligible = !hasHeavyItem,
                isOfflineFallback = true,
                badge = badgeStandard
            ),
            ShippingRate(
                id = "offline_priority_mail",
                carrier = "USPS",
                serviceName = if (hasHeavyItem) "Priority Mail Heavy" else "Priority Mail",
                estimatedDelivery = "2-3 business days (Offline Est.)",
                estimatedDays = 2,
                baseRateCents = priorityBase,
                insuranceCostCents = 200L,
                isFreeShippingEligible = false,
                isOfflineFallback = true,
                badge = badgePriority
            ),
            ShippingRate(
                id = "offline_express_overnight",
                carrier = "UPS",
                serviceName = if (hasHeavyItem) "Next Day Freight" else "Next Day Air",
                estimatedDelivery = "1-2 business days (Offline Est.)",
                estimatedDays = 1,
                baseRateCents = expressBase,
                insuranceCostCents = 350L,
                isFreeShippingEligible = false,
                isOfflineFallback = true,
                badge = badgeExpress
            )
        )
    }

    private fun populateOfflineFallback(
        items: List<CartItem>,
        subtotal: Long,
        dest: Address,
        notice: String
    ) {
        val fallbackRates = generateOfflineFallbackRates(items, subtotal, dest)
        _isOfflineRatesActive.value = true
        _offlineNoticeMessage.value = notice
        _rates.value = fallbackRates
        _ratesErrorMessage.value = null // Clear any blocking network error banner

        // Maintain selection if previously matching, or select first available
        val prevSelection = _selectedRate.value
        val newSelection = fallbackRates.firstOrNull { it.id == prevSelection?.id }
            ?: fallbackRates.firstOrNull()
        _selectedRate.value = newSelection

        // Local free shipping evaluation using merchant threshold in SettingsManager
        val thresholdCents = settingsManager.freeShippingThresholdCents
        val qualifiesForFreeShipping = thresholdCents > 0L && subtotal >= thresholdCents
        val selected = newSelection
        val waived = if (qualifiesForFreeShipping && selected != null && selected.isFreeShippingEligible) {
            selected.baseRateCents
        } else 0L

        _isFreeShippingQualified.value = qualifiesForFreeShipping
        _waivedAmountCents.value = waived
        _isLoadingRates.value = false
    }

    /**
     * Queries carrier rates with an enforced 2500ms timeout.
     * If the backend times out, is unreachable, or encounters an error,
     * immediately populates estimated tiered fallback rates so the register never hangs.
     */
    fun fetchRates() {
        val dest = _destinationAddress.value ?: return
        val currentOrderId = _orderId.value ?: "UNKNOWN"
        val subtotal = _orderSubtotalCents.value ?: 0L
        val items = _cartItems.value ?: emptyList()
        val insurance = _isInsuranceSelected.value ?: false

        _isLoadingRates.value = true
        _ratesErrorMessage.value = null

        viewModelScope.launch {
            try {
                // Enforce 2500ms timeout
                val result = withTimeoutOrNull(NETWORK_TIMEOUT_MS) {
                    shippingRepository.fetchRates(
                        orderId = currentOrderId,
                        orderTotalCents = subtotal,
                        destination = dest,
                        items = items,
                        includeInsurance = insurance
                    )
                }

                if (result == null) {
                    // 2.5s Timeout exceeded -> seamless offline fallback
                    Log.w(tag, "Rates fetch timed out after ${NETWORK_TIMEOUT_MS}ms. Switching to offline tiered fallback.")
                    populateOfflineFallback(
                        items = items,
                        subtotal = subtotal,
                        dest = dest,
                        notice = "⚡ Offline Mode / Local Estimated Rates active"
                    )
                } else {
                    when (result) {
                        is Result.Success -> {
                            val response = result.data
                            _isOfflineRatesActive.value = false
                            _offlineNoticeMessage.value = null
                            _rates.value = response.rates

                            val prevSelection = _selectedRate.value
                            val newSelection = response.rates.firstOrNull { it.id == prevSelection?.id }
                                ?: response.rates.firstOrNull()
                            _selectedRate.value = newSelection

                            _isFreeShippingQualified.value = response.isFreeShippingQualified
                            _waivedAmountCents.value = response.waivedAmountCents ?: 0L
                            _isLoadingRates.value = false
                        }
                        is Result.Error -> {
                            // Network failure / unreachable host -> seamless offline fallback
                            Log.w(tag, "Rates fetch failed (${result.message}). Switching to offline tiered fallback.")
                            populateOfflineFallback(
                                items = items,
                                subtotal = subtotal,
                                dest = dest,
                                notice = "⚡ Offline Mode / Local Estimated Rates active"
                            )
                        }
                        is Result.Loading -> {
                            _isLoadingRates.value = true
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(tag, "Unexpected exception fetching rates. Activating offline fallback.", e)
                populateOfflineFallback(
                    items = items,
                    subtotal = subtotal,
                    dest = dest,
                    notice = "⚡ Offline Mode / Local Estimated Rates active"
                )
            }
        }
    }

    /**
     * Applies the selected rate as a line item on the active Clover order.
     * Incorporates debounce mutation locking and atomic Mutex protection
     * to eliminate duplicate line items and race conditions.
     */
    fun applyShippingToOrder() {
        val rate = _selectedRate.value ?: return
        val currentOrderId = _orderId.value ?: return
        val dest = _destinationAddress.value ?: return
        val insurance = _isInsuranceSelected.value ?: false
        val isFreeShipping = (_isFreeShippingQualified.value == true) && rate.isFreeShippingEligible

        val grossCents = rate.grossRateCents(insurance)
        val waivedCents = if (isFreeShipping) rate.waivedAmountCents(true) else 0L
        val netChargedCents = rate.netChargedCents(insurance, isFreeShipping)

        // Debounce check: block rapid double-tap within 1000ms or while already mutating
        val now = System.currentTimeMillis()
        if (_isApplyingShipping.value == true || (now - lastApplyTimestamp) < APPLY_DEBOUNCE_MS) {
            Log.w(tag, "applyShippingToOrder ignored: debounce mutation lock active.")
            return
        }
        lastApplyTimestamp = now
        _isApplyingShipping.value = true

        viewModelScope.launch {
            applyMutex.withLock {
                try {
                    // 1. Mutate Clover order via OrderConnector (Atomic Mutex protected in CloverConnectorManager)
                    if (cloverManager.isCloverDevice()) {
                        val applied = cloverManager.applyShippingToOrder(
                            orderId = currentOrderId,
                            carrier = rate.carrier,
                            serviceName = rate.serviceName,
                            grossRateCents = grossCents,
                            waivedAmountCents = waivedCents
                        )
                        if (!applied) {
                            _applyResult.value = Result.Error(
                                Exception("Clover OrderConnector failed to add line item"),
                                "Could not update Clover order with shipping line item."
                            )
                            return@withLock
                        }
                    }

                    // 2. Notify AutoShip backend (with 2500ms safety timeout so register checkout is never blocked)
                    val shipRequest = ShipOrderRequest(
                        orderId = currentOrderId,
                        selectedRateId = rate.id,
                        carrier = rate.carrier,
                        serviceName = rate.serviceName,
                        chargedCostCents = netChargedCents,
                        insuranceIncluded = insurance,
                        insuranceCostCents = if (insurance) rate.insuranceCostCents else 0L,
                        destination = dest,
                        items = _cartItems.value ?: emptyList()
                    )

                    withTimeoutOrNull(NETWORK_TIMEOUT_MS) {
                        try {
                            shippingRepository.shipOrder(shipRequest)
                        } catch (e: Exception) {
                            Log.w(tag, "Backend shipment notification failed or offline", e)
                            null
                        }
                    }

                    // Clover line item was added successfully: notify cashier and proceed to payment
                    _applyResult.value = Result.Success(true)
                } finally {
                    _isApplyingShipping.value = false
                }
            }
        }
    }

    fun resetApplyResult() {
        _applyResult.value = null
    }

    override fun onCleared() {
        super.onCleared()
        cloverManager.disconnect()
    }
}
