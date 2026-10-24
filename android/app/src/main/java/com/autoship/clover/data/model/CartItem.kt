package com.autoship.clover.data.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class CartItem(
    @SerializedName("id")
    val id: String,

    @SerializedName("name")
    val name: String,

    @SerializedName("price_cents")
    val priceCents: Long,

    @SerializedName("quantity")
    val quantity: Int = 1,

    @SerializedName("weight_oz")
    val weightOz: Double = 16.0,

    @SerializedName("length_in")
    val lengthIn: Double = 10.0,

    @SerializedName("width_in")
    val widthIn: Double = 7.0,

    @SerializedName("height_in")
    val heightIn: Double = 5.0,

    @SerializedName("is_heavy_override")
    val isHeavyOverride: Boolean = false
) : Serializable {

    /**
     * An item is treated as heavy/oversized if explicitly overridden by the cashier
     * or if its single unit weight exceeds 80 oz (5 lbs).
     */
    val isHeavy: Boolean
        get() = isHeavyOverride || weightOz > 80.0

    /**
     * Total weight for all units of this line item.
     */
    val totalWeightOz: Double
        get() = weightOz * quantity

    /**
     * Formatted dimension summary (e.g. 10 x 7 x 5 in)
     */
    fun formattedDimensions(): String {
        val l = if (lengthIn == lengthIn.toLong().toDouble()) lengthIn.toLong().toString() else lengthIn.toString()
        val w = if (widthIn == widthIn.toLong().toDouble()) widthIn.toLong().toString() else widthIn.toString()
        val h = if (heightIn == heightIn.toLong().toDouble()) heightIn.toLong().toString() else heightIn.toString()
        return "$l x $w x $h in"
    }

    /**
     * Formatted weight summary (e.g. 1 lb, 5 lbs, or 5.5 lbs)
     */
    fun formattedWeight(): String {
        val lbs = weightOz / 16.0
        return if (lbs == 1.0) {
            "1 lb"
        } else if (lbs == lbs.toLong().toDouble()) {
            "${lbs.toLong()} lbs"
        } else {
            String.format(java.util.Locale.US, "%.1f lbs", lbs)
        }
    }
}

