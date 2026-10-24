package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class ShipOrderResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("order_id")
    val orderId: String,

    @SerializedName("shipment_id")
    val shipmentId: String? = null,

    @SerializedName("tracking_number")
    val trackingNumber: String? = null,

    @SerializedName("label_url")
    val labelUrl: String? = null,

    @SerializedName("message")
    val message: String? = null
) : Serializable
