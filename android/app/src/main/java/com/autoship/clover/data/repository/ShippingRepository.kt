package com.autoship.clover.data.repository

import android.content.Context
import android.util.Log
import com.autoship.clover.data.api.RetrofitClient
import com.autoship.clover.data.model.Address
import com.autoship.clover.data.model.CartItem
import com.autoship.clover.data.model.RatesRequest
import com.autoship.clover.data.model.RatesResponse
import com.autoship.clover.data.model.ShipOrderRequest
import com.autoship.clover.data.model.ShipOrderResponse
import com.autoship.clover.ui.settings.SettingsManager
import com.autoship.clover.util.Result
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ShippingRepository(context: Context) {

    private val tag = "ShippingRepository"
    private val settingsManager = SettingsManager.getInstance(context)
    private val retrofitClient = RetrofitClient.getInstance(context)

    suspend fun fetchRates(
        orderId: String,
        orderTotalCents: Long,
        destination: Address,
        items: List<CartItem>,
        includeInsurance: Boolean
    ): Result<RatesResponse> = withContext(Dispatchers.IO) {
        try {
            val api = retrofitClient.getApiService()
            val request = RatesRequest(
                orderId = orderId,
                orderTotalCents = orderTotalCents,
                destination = destination,
                items = items,
                includeInsurance = includeInsurance
            )
            val response = api.getShippingRates(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Log.w(tag, "Backend returned error ${response.code()}: ${response.message()}")
                Result.Error(
                    exception = Exception("Server error ${response.code()}: ${response.message()}"),
                    message = "Could not fetch rates from AutoShip server (${response.code()}). Check Settings."
                )
            }
        } catch (e: Exception) {
            Log.e(tag, "Network exception communicating with AutoShip backend", e)
            Result.Error(
                exception = e,
                message = "Unable to connect to AutoShip backend (${settingsManager.backendUrl}). Please check network connection."
            )
        }
    }

    suspend fun shipOrder(request: ShipOrderRequest): Result<ShipOrderResponse> = withContext(Dispatchers.IO) {
        try {
            val api = retrofitClient.getApiService()
            val response = api.createShipment(request)
            if (response.isSuccessful && response.body() != null) {
                Result.Success(response.body()!!)
            } else {
                Result.Error(
                    exception = Exception("Failed to confirm shipment (${response.code()})"),
                    message = "Error creating shipment on AutoShip backend."
                )
            }
        } catch (e: Exception) {
            Log.e(tag, "Network exception creating shipment", e)
            Result.Error(
                exception = e,
                message = "Unable to reach server to confirm shipment: ${e.localizedMessage}"
            )
        }
    }
}
