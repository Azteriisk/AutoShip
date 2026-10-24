package com.autoship.clover.ui.shipping

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.autoship.clover.clover.CloverConnectorManager
import com.autoship.clover.data.repository.ShippingRepository
import com.autoship.clover.ui.settings.SettingsManager

class ShippingViewModelFactory(
    private val context: Context
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ShippingViewModel::class.java)) {
            val cloverManager = CloverConnectorManager(context.applicationContext)
            val shippingRepo = ShippingRepository(context.applicationContext)
            val settingsManager = SettingsManager.getInstance(context.applicationContext)
            return ShippingViewModel(
                context = context.applicationContext,
                cloverManager = cloverManager,
                shippingRepository = shippingRepo,
                settingsManager = settingsManager
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
