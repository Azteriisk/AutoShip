package com.autoship.clover.ui.settings

import android.content.Context
import android.content.SharedPreferences
import com.autoship.clover.BuildConfig

class SettingsManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var backendUrl: String
        get() {
            val url = prefs.getString(KEY_BACKEND_URL, BuildConfig.DEFAULT_BACKEND_URL)
                ?: BuildConfig.DEFAULT_BACKEND_URL
            return if (url.endsWith("/")) url else "$url/"
        }
        set(value) {
            val normalized = if (value.endsWith("/")) value else "$value/"
            prefs.edit().putString(KEY_BACKEND_URL, normalized).apply()
        }

    var apiKey: String
        get() = prefs.getString(KEY_API_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_API_KEY, value).apply()

    var freeShippingThresholdCents: Long
        get() = prefs.getLong(KEY_FREE_SHIPPING_THRESHOLD, 5000L) // Default $50.00
        set(value) = prefs.edit().putLong(KEY_FREE_SHIPPING_THRESHOLD, value).apply()

    var isAutoInsuranceEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_INSURANCE, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_INSURANCE, value).apply()

    companion object {
        private const val PREFS_NAME = "autoship_merchant_prefs"
        private const val KEY_BACKEND_URL = "key_backend_url"
        private const val KEY_API_KEY = "key_api_key"
        private const val KEY_FREE_SHIPPING_THRESHOLD = "key_free_shipping_threshold"
        private const val KEY_AUTO_INSURANCE = "key_auto_insurance"

        @Volatile
        private var INSTANCE: SettingsManager? = null

        fun getInstance(context: Context): SettingsManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: SettingsManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}
