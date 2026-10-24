package com.autoship.clover

import android.app.Application
import android.util.Log
import com.autoship.clover.ui.settings.SettingsManager

class AutoShipApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        Log.i("AutoShipApp", "Initializing AutoShip Clover POS application...")
        // Pre-warm SettingsManager singleton
        SettingsManager.getInstance(this)
    }
}
