package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class RatesResponse(
    @SerializedName("rates")
    val rates: List<ShippingRate>,

    @SerializedName("free_shipping_threshold_cents")
    val freeShippingThresholdCents: Long? = null,

    @SerializedName("is_free_shipping_qualified")
    val isFreeShippingQualified: Boolean = false,

    @SerializedName("waived_amount_cents")
    val waivedAmountCents: Long? = null
) : Serializable
