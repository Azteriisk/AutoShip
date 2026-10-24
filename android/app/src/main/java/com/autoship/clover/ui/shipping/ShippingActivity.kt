package com.autoship.clover.ui.shipping

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.autoship.clover.R
import com.autoship.clover.data.model.Address
import com.autoship.clover.databinding.ActivityShippingBinding
import com.autoship.clover.ui.settings.SettingsActivity
import com.autoship.clover.util.CurrencyUtils
import com.autoship.clover.util.Result
import com.clover.sdk.v1.Intents

class ShippingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityShippingBinding
    private val viewModel: ShippingViewModel by viewModels {
        ShippingViewModelFactory(this)
    }

    private lateinit var ratesAdapter: RatesAdapter

    private val settingsLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            viewModel.fetchRates()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShippingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupListeners()
        observeViewModel()

        val incomingOrderId = extractOrderId(intent)
        viewModel.initOrder(incomingOrderId)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val incomingOrderId = extractOrderId(intent)
        viewModel.initOrder(incomingOrderId)
    }

    private fun extractOrderId(intent: Intent?): String? {
        if (intent == null) return null
        return intent.getStringExtra(Intents.EXTRA_ORDER_ID)
            ?: intent.getStringExtra("clover.intent.extra.ORDER_ID")
            ?: intent.getStringExtra("com.clover.intent.extra.ORDER_ID")
            ?: intent.getStringExtra("orderId")
    }

    private fun setupRecyclerView() {
        ratesAdapter = RatesAdapter { selectedRate ->
            viewModel.selectRate(selectedRate)
        }
        binding.rvShippingRates.apply {
            layoutManager = LinearLayoutManager(this@ShippingActivity)
            adapter = ratesAdapter
        }
    }

    private fun setupListeners() {
        // Address Edit / Add Modal Button
        binding.btnEditAddress.setOnClickListener {
            showAddressDialog(viewModel.destinationAddress.value)
        }

        // Insurance Toggle
        binding.switchInsurance.setOnCheckedChangeListener { _, isChecked ->
            viewModel.setInsuranceSelected(isChecked)
            updateBottomPriceDisplay()
            ratesAdapter.updateInsurance(isChecked)
        }

        // Adjust Dimensions & Weight / Uncataloged Heavy Item Override
        binding.btnAdjustDimensions.setOnClickListener {
            showDimensionsDialog()
        }

        // Apply Shipping Button (Clover LineItem creation)
        binding.btnApplyShipping.setOnClickListener {
            viewModel.applyShippingToOrder()
        }

        // Refresh Rates
        binding.btnRefresh.setOnClickListener {
            viewModel.fetchRates()
        }
        binding.btnRetryRates.setOnClickListener {
            viewModel.fetchRates()
        }

        // Settings Button
        binding.btnSettings.setOnClickListener {
            val intent = Intent(this, SettingsActivity::class.java)
            settingsLauncher.launch(intent)
        }
    }

    private fun observeViewModel() {
        // Order Title & Subtotal Header
        viewModel.orderId.observe(this) { id ->
            binding.tvOrderTitle.text = getString(R.string.order_number_format, id)
        }

        viewModel.orderSubtotalCents.observe(this) { subtotalCents ->
            val itemCount = viewModel.cartItems.value?.size ?: 0
            val subtotalFormatted = CurrencyUtils.formatCents(subtotalCents)
            binding.tvOrderSummary.text = getString(
                R.string.order_summary_format,
                itemCount,
                subtotalFormatted
            )
        }

        viewModel.cartItems.observe(this) { items ->
            val subtotalFormatted = CurrencyUtils.formatCents(viewModel.orderSubtotalCents.value ?: 0L)
            binding.tvOrderSummary.text = getString(
                R.string.order_summary_format,
                items.size,
                subtotalFormatted
            )

            // Update parcel & dimensions summary card
            if (items.isEmpty()) {
                binding.tvParcelSummary.text = "1 pkg • 1.0 lb (10 x 7 x 5 in)"
                binding.tvHeavyBadge.visibility = View.GONE
            } else {
                val totalWeightOz = items.sumOf { it.totalWeightOz }
                val totalLbs = totalWeightOz / 16.0
                val weightStr = if (totalLbs == totalLbs.toLong().toDouble()) {
                    "${totalLbs.toLong()} lb"
                } else {
                    String.format(java.util.Locale.US, "%.1f lbs", totalLbs)
                }
                val primaryDim = items.first().formattedDimensions()
                binding.tvParcelSummary.text = getString(
                    R.string.order_summary_format,
                    items.size,
                    "$weightStr ($primaryDim)"
                )
                val hasHeavy = items.any { it.isHeavy }
                binding.tvHeavyBadge.visibility = if (hasHeavy) View.VISIBLE else View.GONE
            }
        }

        // Offline Mode Fallback Banner Observer
        viewModel.isOfflineRatesActive.observe(this) { isOffline ->
            binding.cardOfflineBanner.visibility = if (isOffline) View.VISIBLE else View.GONE
            if (isOffline) {
                val notice = viewModel.offlineNoticeMessage.value
                if (!notice.isNullOrBlank()) {
                    binding.tvOfflineBannerTitle.text = notice
                }
            }
        }

        viewModel.offlineNoticeMessage.observe(this) { notice ->
            if (viewModel.isOfflineRatesActive.value == true && !notice.isNullOrBlank()) {
                binding.tvOfflineBannerTitle.text = notice
            }
        }

        // Destination Address Observer
        viewModel.destinationAddress.observe(this) { address ->
            if (address != null && address.isValid()) {
                binding.tvCustomerName.visibility = View.VISIBLE
                binding.tvCustomerName.text = address.recipientName
                binding.tvCustomerAddress.text = address.fullSummary().substringAfter("\n")
                binding.btnEditAddress.text = getString(R.string.btn_edit_address)
            } else {
                binding.tvCustomerName.visibility = View.GONE
                binding.tvCustomerAddress.text = getString(R.string.address_placeholder)
                binding.btnEditAddress.text = getString(R.string.btn_add_address)
            }
        }

        // Insurance State
        viewModel.isInsuranceSelected.observe(this) { enabled ->
            if (binding.switchInsurance.isChecked != enabled) {
                binding.switchInsurance.isChecked = enabled
            }
            ratesAdapter.updateInsurance(enabled)
            updateBottomPriceDisplay()
        }

        // Free Shipping Promotion Banner
        viewModel.isFreeShippingQualified.observe(this) { qualified ->
            binding.cardFreeShippingBanner.visibility = if (qualified) View.VISIBLE else View.GONE
            val waivedCents = viewModel.waivedAmountCents.value ?: 0L
            binding.tvFreeShippingSubtitle.text = getString(
                R.string.free_shipping_banner_desc,
                CurrencyUtils.formatCents(waivedCents)
            )
            ratesAdapter.updateFreeShipping(qualified)
            updateBottomPriceDisplay()
        }

        viewModel.waivedAmountCents.observe(this) { waivedCents ->
            if (viewModel.isFreeShippingQualified.value == true) {
                binding.tvFreeShippingSubtitle.text = getString(
                    R.string.free_shipping_banner_desc,
                    CurrencyUtils.formatCents(waivedCents)
                )
            }
            updateBottomPriceDisplay()
        }

        // Rates List
        viewModel.rates.observe(this) { ratesList ->
            val selected = viewModel.selectedRate.value
            val isIns = viewModel.isInsuranceSelected.value ?: false
            val isFree = viewModel.isFreeShippingQualified.value ?: false

            ratesAdapter.submitData(ratesList, selected?.id, isIns, isFree)

            if (ratesList.isEmpty() && viewModel.isLoadingRates.value != true && viewModel.ratesErrorMessage.value == null) {
                binding.rvShippingRates.visibility = View.GONE
            } else {
                binding.rvShippingRates.visibility = View.VISIBLE
            }

            updateBottomPriceDisplay()
        }

        // Selected Rate
        viewModel.selectedRate.observe(this) { rate ->
            rate?.let {
                ratesAdapter.updateSelection(it.id)
                binding.tvInsuranceCost.text = getString(
                    R.string.insurance_cost_format,
                    CurrencyUtils.formatCents(it.insuranceCostCents)
                )
            }
            updateBottomPriceDisplay()
        }

        // Loading Indicators
        viewModel.isLoadingRates.observe(this) { loading ->
            binding.layoutRatesLoading.visibility = if (loading) View.VISIBLE else View.GONE
            if (loading) {
                binding.layoutRatesError.visibility = View.GONE
                binding.btnApplyShipping.isEnabled = false
            } else {
                binding.btnApplyShipping.isEnabled = viewModel.selectedRate.value != null
            }
        }

        // Error Message
        viewModel.ratesErrorMessage.observe(this) { errorMsg ->
            if (!errorMsg.isNullOrBlank()) {
                binding.layoutRatesError.visibility = View.VISIBLE
                binding.tvRatesErrorMessage.text = errorMsg
                binding.rvShippingRates.visibility = View.GONE
            } else {
                binding.layoutRatesError.visibility = View.GONE
            }
        }

        // Applying Shipping to Order
        viewModel.isApplyingShipping.observe(this) { applying ->
            binding.btnApplyShipping.isEnabled = !applying
            binding.btnApplyShipping.text = if (applying) {
                getString(R.string.applying_shipping_progress)
            } else {
                getString(R.string.btn_apply_shipping)
            }
        }

        // Apply Result (Returns back to Clover Register)
        viewModel.applyResult.observe(this) { result ->
            if (result == null) return@observe

            when (result) {
                is Result.Success -> {
                    Toast.makeText(this, R.string.shipping_applied_success, Toast.LENGTH_SHORT).show()
                    viewModel.resetApplyResult()
                    val resultIntent = Intent().apply {
                        putExtra(Intents.EXTRA_ORDER_ID, viewModel.orderId.value)
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                }
                is Result.Error -> {
                    Toast.makeText(this, result.message, Toast.LENGTH_LONG).show()
                    viewModel.resetApplyResult()
                }
                is Result.Loading -> {}
            }
        }
    }

    private fun updateBottomPriceDisplay() {
        val selected = viewModel.selectedRate.value
        if (selected == null) {
            binding.tvOriginalShippingPrice.visibility = View.GONE
            binding.tvFinalShippingPrice.text = "$0.00"
            binding.btnApplyShipping.isEnabled = false
            return
        }

        binding.btnApplyShipping.isEnabled = true
        val isIns = viewModel.isInsuranceSelected.value ?: false
        val isFree = (viewModel.isFreeShippingQualified.value == true) && selected.isFreeShippingEligible

        val grossCents = selected.grossRateCents(isIns)
        val netChargedCents = selected.netChargedCents(isIns, isFree)

        if (isFree) {
            binding.tvOriginalShippingPrice.visibility = View.VISIBLE
            binding.tvOriginalShippingPrice.text = CurrencyUtils.formatCents(grossCents)
            binding.tvOriginalShippingPrice.paint.isStrikeThruText = true

            if (netChargedCents == 0L) {
                binding.tvFinalShippingPrice.text = "FREE"
            } else {
                binding.tvFinalShippingPrice.text = CurrencyUtils.formatCents(netChargedCents)
            }
        } else {
            binding.tvOriginalShippingPrice.visibility = View.GONE
            binding.tvFinalShippingPrice.text = CurrencyUtils.formatCents(netChargedCents)
        }
    }

    private fun showAddressDialog(currentAddress: Address?) {
        val dialog = AddressDialog.newInstance(currentAddress)
        dialog.setOnAddressSavedListener { newAddress ->
            viewModel.setDestinationAddress(newAddress)
        }
        dialog.show(supportFragmentManager, "AddressDialog")
    }

    private fun showDimensionsDialog() {
        val items = viewModel.cartItems.value
        val primary = items?.firstOrNull()
        val dialog = DimensionOverrideDialog.newInstance(
            weightOz = primary?.weightOz ?: 16.0,
            lengthIn = primary?.lengthIn ?: 10.0,
            widthIn = primary?.widthIn ?: 7.0,
            heightIn = primary?.heightIn ?: 5.0,
            isHeavy = primary?.isHeavyOverride ?: false
        )
        dialog.setOnDimensionsAppliedListener { weightOz, lengthIn, widthIn, heightIn, isHeavy ->
            viewModel.updatePackageOverrides(weightOz, lengthIn, widthIn, heightIn, isHeavy)
        }
        dialog.show(supportFragmentManager, "DimensionOverrideDialog")
    }
}
