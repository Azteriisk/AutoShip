package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class RatesRequest(
    @SerializedName("order_id")
    val orderId: String,

    @SerializedName("order_total_cents")
    val orderTotalCents: Long,

    @SerializedName("destination")
    val destination: Address,

    @SerializedName("items")
    val items: List<CartItem>,

    @SerializedName("include_insurance")
    val includeInsurance: Boolean = false
) : Serializable
