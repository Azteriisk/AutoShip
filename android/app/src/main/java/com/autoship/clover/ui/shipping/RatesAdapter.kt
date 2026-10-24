package com.autoship.clover.ui.shipping

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.autoship.clover.R
import com.autoship.clover.data.model.ShippingRate
import com.autoship.clover.databinding.ItemShippingRateBinding
import com.autoship.clover.util.CurrencyUtils

class RatesAdapter(
    private val onRateSelected: (ShippingRate) -> Unit
) : RecyclerView.Adapter<RatesAdapter.RateViewHolder>() {

    private val rates = mutableListOf<ShippingRate>()
    private var selectedRateId: String? = null
    private var isInsuranceEnabled: Boolean = false
    private var isFreeShippingPromotionActive: Boolean = false

    fun submitData(
        newRates: List<ShippingRate>,
        selectedId: String?,
        insuranceEnabled: Boolean,
        freeShippingActive: Boolean
    ) {
        rates.clear()
        rates.addAll(newRates)
        selectedRateId = selectedId ?: newRates.firstOrNull()?.id
        isInsuranceEnabled = insuranceEnabled
        isFreeShippingPromotionActive = freeShippingActive
        notifyDataSetChanged()
    }

    fun updateSelection(selectedId: String) {
        selectedRateId = selectedId
        notifyDataSetChanged()
    }

    fun updateInsurance(enabled: Boolean) {
        isInsuranceEnabled = enabled
        notifyDataSetChanged()
    }

    fun updateFreeShipping(active: Boolean) {
        isFreeShippingPromotionActive = active
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RateViewHolder {
        val binding = ItemShippingRateBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return RateViewHolder(binding)
    }

    override fun onBindViewHolder(holder: RateViewHolder, position: Int) {
        holder.bind(rates[position])
    }

    override fun getItemCount(): Int = rates.size

    inner class RateViewHolder(private val binding: ItemShippingRateBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(rate: ShippingRate) {
            val context = binding.root.context
            val isSelected = rate.id == selectedRateId
            val isRateFree = isFreeShippingPromotionActive && rate.isFreeShippingEligible

            // Carrier Icon
            val carrierIconRes = when (rate.carrier.uppercase()) {
                "USPS" -> R.drawable.ic_carrier_usps
                "UPS" -> R.drawable.ic_carrier_ups
                "FEDEX" -> R.drawable.ic_carrier_fedex
                else -> R.drawable.ic_shipping_box
            }
            binding.ivCarrierIcon.setImageResource(carrierIconRes)

            // Service Name & Delivery
            binding.tvServiceName.text = "${rate.carrier} ${rate.serviceName}"
            binding.tvDeliveryEstimate.text = context.getString(
                R.string.est_delivery_format,
                rate.estimatedDelivery
            )

            // Badge (e.g. BEST VALUE, FASTEST)
            if (!rate.badge.isNullOrBlank()) {
                binding.tvBadge.text = rate.badge
                binding.tvBadge.visibility = View.VISIBLE
            } else {
                binding.tvBadge.visibility = View.GONE
            }

            // Radio / Selection State
            binding.rbSelected.isChecked = isSelected
            if (isSelected) {
                binding.cardRate.strokeColor = ContextCompat.getColor(context, R.color.border_selected)
                binding.cardRate.strokeWidth = 4
                binding.cardRate.setCardBackgroundColor(ContextCompat.getColor(context, R.color.primary_light))
            } else {
                binding.cardRate.strokeColor = ContextCompat.getColor(context, R.color.border_unselected)
                binding.cardRate.strokeWidth = 2
                binding.cardRate.setCardBackgroundColor(ContextCompat.getColor(context, R.color.surface))
            }

            // Price Calculation & Strike-through Display
            val gross = rate.grossRateCents(isInsuranceEnabled)
            val netCharged = rate.netChargedCents(isInsuranceEnabled, isRateFree)

            if (isRateFree) {
                binding.tvStrikethroughPrice.visibility = View.VISIBLE
                binding.tvStrikethroughPrice.text = CurrencyUtils.formatCents(gross)
                binding.tvStrikethroughPrice.paint.isStrikeThruText = true

                if (netCharged == 0L) {
                    binding.tvRatePrice.text = "FREE"
                    binding.tvRatePrice.setTextColor(ContextCompat.getColor(context, R.color.badge_free_shipping_text))
                } else {
                    binding.tvRatePrice.text = CurrencyUtils.formatCents(netCharged)
                    binding.tvRatePrice.setTextColor(ContextCompat.getColor(context, R.color.text_primary))
                }
            } else {
                binding.tvStrikethroughPrice.visibility = View.GONE
                binding.tvRatePrice.text = CurrencyUtils.formatCents(netCharged)
                binding.tvRatePrice.setTextColor(ContextCompat.getColor(context, R.color.text_primary))
            }

            // Click handling
            binding.root.setOnClickListener {
                onRateSelected(rate)
            }
        }
    }
}
