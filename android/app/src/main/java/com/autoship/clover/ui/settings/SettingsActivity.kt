package com.autoship.clover.ui.settings

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.autoship.clover.R
import com.autoship.clover.databinding.ActivitySettingsBinding
import com.autoship.clover.util.CurrencyUtils

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var settingsManager: SettingsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settingsManager = SettingsManager.getInstance(this)

        setupToolbar()
        loadCurrentSettings()
        setupListeners()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.settingsToolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        binding.settingsToolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun loadCurrentSettings() {
        binding.etApiUrl.setText(settingsManager.backendUrl)
        binding.etApiKey.setText(settingsManager.apiKey)

        val thresholdDollars = settingsManager.freeShippingThresholdCents / 100.0
        binding.etFreeShippingThreshold.setText(String.format(java.util.Locale.US, "%.2f", thresholdDollars))

        binding.switchAutoInsurance.isChecked = settingsManager.isAutoInsuranceEnabled
    }

    private fun setupListeners() {
        binding.btnSaveSettings.setOnClickListener {
            saveSettings()
        }
    }

    private fun saveSettings() {
        val rawUrl = binding.etApiUrl.text?.toString()?.trim().orEmpty()
        val apiKey = binding.etApiKey.text?.toString()?.trim().orEmpty()
        val thresholdText = binding.etFreeShippingThreshold.text?.toString()?.trim().orEmpty()
        val autoInsurance = binding.switchAutoInsurance.isChecked

        if (rawUrl.isBlank()) {
            binding.tilApiUrl.error = "API URL cannot be empty"
            return
        }

        binding.tilApiUrl.error = null

        val thresholdCents = CurrencyUtils.parseDollarsToCents(thresholdText)

        settingsManager.backendUrl = rawUrl
        settingsManager.apiKey = apiKey
        settingsManager.freeShippingThresholdCents = thresholdCents
        settingsManager.isAutoInsuranceEnabled = autoInsurance

        Toast.makeText(this, R.string.settings_saved_success, Toast.LENGTH_SHORT).show()
        setResult(Activity.RESULT_OK)
        finish()
    }
}
