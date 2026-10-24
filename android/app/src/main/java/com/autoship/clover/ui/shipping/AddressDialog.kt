package com.autoship.clover.ui.shipping

import android.app.Dialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.fragment.app.DialogFragment
import com.autoship.clover.R
import com.autoship.clover.data.model.Address
import com.autoship.clover.databinding.DialogAddressBinding

class AddressDialog : DialogFragment() {

    private var _binding: DialogAddressBinding? = null
    private val binding get() = _binding!!

    private var initialAddress: Address? = null
    private var onAddressSavedListener: ((Address) -> Unit)? = null

    companion object {
        private const val ARG_ADDRESS = "arg_address"

        fun newInstance(address: Address?): AddressDialog {
            val dialog = AddressDialog()
            val args = Bundle()
            if (address != null) {
                args.putSerializable(ARG_ADDRESS, address)
            }
            dialog.arguments = args
            return dialog
        }
    }

    fun setOnAddressSavedListener(listener: (Address) -> Unit) {
        this.onAddressSavedListener = listener
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.Theme_AutoShip_Dialog)
        @Suppress("DEPRECATION")
        initialAddress = arguments?.getSerializable(ARG_ADDRESS) as? Address
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogAddressBinding.inflate(inflater, container, false)
        dialog?.requestWindowFeature(Window.FEATURE_NO_TITLE)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefillData()
        setupTextWatchers()

        binding.btnCancelAddress.setOnClickListener {
            dismiss()
        }

        binding.btnSaveAddress.setOnClickListener {
            if (validateAndSave()) {
                dismiss()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val screenWidth = resources.displayMetrics.widthPixels
        val maxWidth = (480 * resources.displayMetrics.density).toInt()
        val targetWidth = minOf((screenWidth * 0.94).toInt(), maxWidth)
        dialog?.window?.setLayout(
            targetWidth,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    private fun prefillData() {
        initialAddress?.let { addr ->
            binding.etRecipientName.setText(addr.recipientName)
            binding.etStreet1.setText(addr.street1)
            binding.etStreet2.setText(addr.street2 ?: "")
            binding.etCity.setText(addr.city)
            binding.etState.setText(addr.state)
            binding.etZip.setText(addr.zipCode)
            binding.etPhone.setText(addr.phone ?: "")
        }
    }

    private fun setupTextWatchers() {
        // Clear errors as soon as user types
        val clearErrorWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                clearErrors()
            }
            override fun afterTextChanged(s: Editable?) {}
        }

        binding.etRecipientName.addTextChangedListener(clearErrorWatcher)
        binding.etStreet1.addTextChangedListener(clearErrorWatcher)
        binding.etCity.addTextChangedListener(clearErrorWatcher)
        binding.etState.addTextChangedListener(clearErrorWatcher)
        binding.etZip.addTextChangedListener(clearErrorWatcher)
    }

    private fun clearErrors() {
        binding.tilRecipientName.error = null
        binding.tilStreet1.error = null
        binding.tilCity.error = null
        binding.tilState.error = null
        binding.tilZip.error = null
    }

    private fun validateAndSave(): Boolean {
        clearErrors()
        var hasError = false

        val name = binding.etRecipientName.text?.toString()?.trim().orEmpty()
        val street1 = binding.etStreet1.text?.toString()?.trim().orEmpty()
        val street2 = binding.etStreet2.text?.toString()?.trim()
        val city = binding.etCity.text?.toString()?.trim().orEmpty()
        val state = binding.etState.text?.toString()?.trim()?.uppercase().orEmpty()
        val zip = binding.etZip.text?.toString()?.trim().orEmpty()
        val phone = binding.etPhone.text?.toString()?.trim()

        if (name.isEmpty()) {
            binding.tilRecipientName.error = getString(R.string.error_name_required)
            hasError = true
        }

        if (street1.isEmpty()) {
            binding.tilStreet1.error = getString(R.string.error_street_required)
            hasError = true
        }

        if (city.isEmpty()) {
            binding.tilCity.error = getString(R.string.error_city_required)
            hasError = true
        }

        if (state.length != 2) {
            binding.tilState.error = getString(R.string.error_state_required)
            hasError = true
        }

        if (zip.length < 5) {
            binding.tilZip.error = getString(R.string.error_zip_required)
            hasError = true
        }

        if (hasError) return false

        val address = Address(
            recipientName = name,
            street1 = street1,
            street2 = if (street2.isNullOrBlank()) null else street2,
            city = city,
            state = state,
            zipCode = zip,
            country = "US",
            phone = if (phone.isNullOrBlank()) null else phone
        )

        onAddressSavedListener?.invoke(address)
        return true
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
