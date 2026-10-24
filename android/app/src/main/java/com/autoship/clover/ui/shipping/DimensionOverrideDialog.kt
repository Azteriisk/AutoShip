package com.autoship.clover.ui.shipping

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.fragment.app.DialogFragment
import com.autoship.clover.databinding.DialogDimensionsBinding

class DimensionOverrideDialog : DialogFragment() {

    private var _binding: DialogDimensionsBinding? = null
    private val binding get() = _binding!!

    private var onDimensionsApplied: ((weightOz: Double, lengthIn: Double, widthIn: Double, heightIn: Double, isHeavy: Boolean) -> Unit)? = null

    companion object {
        private const val ARG_WEIGHT_OZ = "arg_weight_oz"
        private const val ARG_LENGTH_IN = "arg_length_in"
        private const val ARG_WIDTH_IN = "arg_width_in"
        private const val ARG_HEIGHT_IN = "arg_height_in"
        private const val ARG_IS_HEAVY = "arg_is_heavy"

        fun newInstance(
            weightOz: Double = 16.0,
            lengthIn: Double = 10.0,
            widthIn: Double = 7.0,
            heightIn: Double = 5.0,
            isHeavy: Boolean = false
        ): DimensionOverrideDialog {
            val fragment = DimensionOverrideDialog()
            val args = Bundle().apply {
                putDouble(ARG_WEIGHT_OZ, weightOz)
                putDouble(ARG_LENGTH_IN, lengthIn)
                putDouble(ARG_WIDTH_IN, widthIn)
                putDouble(ARG_HEIGHT_IN, heightIn)
                putBoolean(ARG_IS_HEAVY, isHeavy)
            }
            fragment.arguments = args
            return fragment
        }
    }

    fun setOnDimensionsAppliedListener(
        listener: (weightOz: Double, lengthIn: Double, widthIn: Double, heightIn: Double, isHeavy: Boolean) -> Unit
    ) {
        this.onDimensionsApplied = listener
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState)
        dialog.window?.requestFeature(Window.FEATURE_NO_TITLE)
        return dialog
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogDimensionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val initWeightOz = arguments?.getDouble(ARG_WEIGHT_OZ, 16.0) ?: 16.0
        val initLengthIn = arguments?.getDouble(ARG_LENGTH_IN, 10.0) ?: 10.0
        val initWidthIn = arguments?.getDouble(ARG_WIDTH_IN, 7.0) ?: 7.0
        val initHeightIn = arguments?.getDouble(ARG_HEIGHT_IN, 5.0) ?: 5.0
        val initIsHeavy = arguments?.getBoolean(ARG_IS_HEAVY, false) ?: false

        val initialLbs = initWeightOz / 16.0
        binding.etWeightLbs.setText(if (initialLbs == initialLbs.toLong().toDouble()) initialLbs.toLong().toString() else String.format(java.util.Locale.US, "%.1f", initialLbs))
        binding.etLengthIn.setText(if (initLengthIn == initLengthIn.toLong().toDouble()) initLengthIn.toLong().toString() else initLengthIn.toString())
        binding.etWidthIn.setText(if (initWidthIn == initWidthIn.toLong().toDouble()) initWidthIn.toLong().toString() else initWidthIn.toString())
        binding.etHeightIn.setText(if (initHeightIn == initHeightIn.toLong().toDouble()) initHeightIn.toLong().toString() else initHeightIn.toString())
        binding.switchHeavyItem.isChecked = initIsHeavy

        setupPresetButtons()

        binding.btnCancelDimensions.setOnClickListener {
            dismiss()
        }

        binding.btnSaveDimensions.setOnClickListener {
            val weightLbs = binding.etWeightLbs.text?.toString()?.toDoubleOrNull() ?: 1.0
            val length = binding.etLengthIn.text?.toString()?.toDoubleOrNull() ?: 10.0
            val width = binding.etWidthIn.text?.toString()?.toDoubleOrNull() ?: 7.0
            val height = binding.etHeightIn.text?.toString()?.toDoubleOrNull() ?: 5.0
            val isHeavy = binding.switchHeavyItem.isChecked

            val weightOz = (weightLbs * 16.0).coerceAtLeast(1.0)

            onDimensionsApplied?.invoke(
                weightOz,
                length.coerceAtLeast(1.0),
                width.coerceAtLeast(1.0),
                height.coerceAtLeast(1.0),
                isHeavy
            )
            dismiss()
        }
    }

    private fun setupPresetButtons() {
        // Standard: 1 lb, 10x7x5, non-heavy
        binding.btnPresetStandard.setOnClickListener {
            binding.etWeightLbs.setText("1.0")
            binding.etLengthIn.setText("10")
            binding.etWidthIn.setText("7")
            binding.etHeightIn.setText("5")
            binding.switchHeavyItem.isChecked = false
        }

        // Medium: 5 lbs, 14x10x6, non-heavy
        binding.btnPresetMedium.setOnClickListener {
            binding.etWeightLbs.setText("5.0")
            binding.etLengthIn.setText("14")
            binding.etWidthIn.setText("10")
            binding.etHeightIn.setText("6")
            binding.switchHeavyItem.isChecked = false
        }

        // Heavy Freight: 25 lbs, 24x18x12, heavy = true
        binding.btnPresetHeavy.setOnClickListener {
            binding.etWeightLbs.setText("25.0")
            binding.etLengthIn.setText("24")
            binding.etWidthIn.setText("18")
            binding.etHeightIn.setText("12")
            binding.switchHeavyItem.isChecked = true
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
