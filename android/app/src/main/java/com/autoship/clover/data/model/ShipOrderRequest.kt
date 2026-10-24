package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class ShipOrderRequest(
    @SerializedName("order_id")
    val orderId: String,

    @SerializedName("selected_rate_id")
    val selectedRateId: String,

    @SerializedName("carrier")
    val carrier: String,

    @SerializedName("service_name")
    val serviceName: String,

    @SerializedName("charged_cost_cents")
    val chargedCostCents: Long,

    @SerializedName("insurance_included")
    val insuranceIncluded: Boolean,

    @SerializedName("insurance_cost_cents")
    val insuranceCostCents: Long,

    @SerializedName("destination")
    val destination: Address,

    @SerializedName("items")
    val items: List<CartItem>
) : Serializable
