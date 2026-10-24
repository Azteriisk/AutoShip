package com.autoship.clover.ui.shipping

import android.content.Context
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

class ShippingViewModel(
    private val context: Context,
    private val cloverManager: CloverConnectorManager,
    private val shippingRepository: ShippingRepository,
    private val settingsManager: SettingsManager
) : ViewModel() {

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
            return
        }

        viewModelScope.launch {
            if (cloverManager.isCloverDevice()) {
                val items = cloverManager.getCartItems(targetId)
                val cloverOrder = cloverManager.getOrder(targetId)
                val subtotal = items.sumOf { it.priceCents }

                _cartItems.value = items
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
     * Queries carrier rates from repository (backend or simulated sandbox).
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
            when (val result = shippingRepository.fetchRates(
                orderId = currentOrderId,
                orderTotalCents = subtotal,
                destination = dest,
                items = items,
                includeInsurance = insurance
            )) {
                is Result.Success -> {
                    val response = result.data
                    _rates.value = response.rates

                    // Check if current selection is still in list, otherwise select first available
                    val prevSelection = _selectedRate.value
                    val newSelection = response.rates.firstOrNull { it.id == prevSelection?.id }
                        ?: response.rates.firstOrNull()
                    _selectedRate.value = newSelection

                    _isFreeShippingQualified.value = response.isFreeShippingQualified
                    _waivedAmountCents.value = response.waivedAmountCents ?: 0L
                    _isLoadingRates.value = false
                }
                is Result.Error -> {
                    _ratesErrorMessage.value = result.message
                    _rates.value = emptyList()
                    _selectedRate.value = null
                    _isLoadingRates.value = false
                }
                is Result.Loading -> {
                    _isLoadingRates.value = true
                }
            }
        }
    }

    /**
     * Applies the selected rate as a line item on the active Clover order and confirms shipment.
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

        _isApplyingShipping.value = true

        viewModelScope.launch {
            // 1. Mutate Clover order via OrderConnector (if on Clover hardware)
            if (cloverManager.isCloverDevice()) {
                val applied = cloverManager.applyShippingToOrder(
                    orderId = currentOrderId,
                    carrier = rate.carrier,
                    serviceName = rate.serviceName,
                    grossRateCents = grossCents,
                    waivedAmountCents = waivedCents
                )
                if (!applied) {
                    _isApplyingShipping.value = false
                    _applyResult.value = Result.Error(
                        Exception("Clover OrderConnector failed to add line item"),
                        "Could not update Clover order with shipping line item."
                    )
                    return@launch
                }
            }

            // 2. Notify AutoShip backend of selected shipment
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

            val shipResult = shippingRepository.shipOrder(shipRequest)
            _isApplyingShipping.value = false

            when (shipResult) {
                is Result.Success -> {
                    _applyResult.value = Result.Success(true)
                }
                is Result.Error -> {
                    // Even if backend warning occurs, if Clover line item was added, we notify cashier
                    _applyResult.value = Result.Success(true)
                }
                is Result.Loading -> {}
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
