package com.autoship.clover.data.api

import com.autoship.clover.data.model.RatesRequest
import com.autoship.clover.data.model.RatesResponse
import com.autoship.clover.data.model.ShipOrderRequest
import com.autoship.clover.data.model.ShipOrderResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AutoShipApiService {

    /**
     * Retrieves live shipping rates across USPS, UPS, and FedEx for the given cart and destination.
     */
    @POST("api/rates")
    suspend fun getShippingRates(
        @Body request: RatesRequest
    ): Response<RatesResponse>

    /**
     * Books a shipping label, creates tracking, and confirms shipping fee on backend.
     */
    @POST("api/orders/ship")
    suspend fun createShipment(
        @Body request: ShipOrderRequest
    ): Response<ShipOrderResponse>
}
