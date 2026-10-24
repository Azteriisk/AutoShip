package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class Address(
    @SerializedName("recipient_name")
    val recipientName: String,

    @SerializedName("street1")
    val street1: String,

    @SerializedName("street2")
    val street2: String? = null,

    @SerializedName("city")
    val city: String,

    @SerializedName("state")
    val state: String,

    @SerializedName("zip_code")
    val zipCode: String,

    @SerializedName("country")
    val country: String = "US",

    @SerializedName("phone")
    val phone: String? = null
) : Serializable {

    fun isValid(): Boolean {
        return recipientName.isNotBlank() &&
                street1.isNotBlank() &&
                city.isNotBlank() &&
                state.trim().length == 2 &&
                zipCode.trim().length >= 5
    }

    fun formattedStreet(): String {
        return if (!street2.isNullOrBlank()) {
            "$street1, $street2"
        } else {
            street1
        }
    }

    fun formattedCityStateZip(): String {
        return "$city, ${state.uppercase()} $zipCode"
    }

    fun fullSummary(): String {
        val streetPart = formattedStreet()
        val cszPart = formattedCityStateZip()
        return "$recipientName\n$streetPart\n$cszPart"
    }
}
