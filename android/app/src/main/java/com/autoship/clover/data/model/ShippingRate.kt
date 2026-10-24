package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class ShippingRate(
    @SerializedName("id")
    val id: String,

    @SerializedName("carrier")
    val carrier: String, // USPS, UPS, FedEx

    @SerializedName("service_name")
    val serviceName: String, // e.g. Priority Mail, Ground Advantage, UPS Ground

    @SerializedName("estimated_delivery")
    val estimatedDelivery: String, // e.g. "Oct 27 (2 business days)"

    @SerializedName("estimated_days")
    val estimatedDays: Int = 3,

    @SerializedName("base_rate_cents")
    val baseRateCents: Long, // in cents, e.g. 850L for $8.50

    @SerializedName("insurance_cost_cents")
    val insuranceCostCents: Long = 150L, // in cents, e.g. 150L for $1.50

    @SerializedName("is_free_shipping_eligible")
    val isFreeShippingEligible: Boolean = false,

    @SerializedName("is_offline_fallback")
    val isOfflineFallback: Boolean = false,

    @SerializedName("badge")
    val badge: String? = null // e.g. "BEST VALUE", "FASTEST", "OFFLINE ESTIMATE"
) : Serializable {

    /**
     * Calculates the subtotal cost before any free-shipping discount waiver.
     */
    fun grossRateCents(includeInsurance: Boolean): Long {
        return baseRateCents + if (includeInsurance) insuranceCostCents else 0L
    }

    /**
     * Calculates the net cost charged to the customer.
     * When free shipping is granted, the base shipping fee is waived ($0),
     * while insurance (if opted-in) may remain or be billed.
     */
    fun netChargedCents(includeInsurance: Boolean, isFreeShippingGranted: Boolean): Long {
        val insurance = if (includeInsurance) insuranceCostCents else 0L
        return if (isFreeShippingGranted) {
            insurance
        } else {
            baseRateCents + insurance
        }
    }

    /**
     * Returns the dollar amount waived for display in discounts or promotional banners.
     */
    fun waivedAmountCents(isFreeShippingGranted: Boolean): Long {
        return if (isFreeShippingGranted) baseRateCents else 0L
    }
}
