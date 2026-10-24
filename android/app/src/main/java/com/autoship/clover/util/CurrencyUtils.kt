package com.autoship.clover.util

import java.text.NumberFormat
import java.util.Locale

object CurrencyUtils {

    private val usdFormat: NumberFormat = NumberFormat.getCurrencyInstance(Locale.US)

    /**
     * Formats an amount in cents (e.g. 850L) into a USD currency string (e.g. "$8.50").
     */
    fun formatCents(cents: Long): String {
        return usdFormat.format(cents / 100.0)
    }

    /**
     * Parses a dollar string like "50.00" or "$50.00" into cents (5000L).
     * Returns 0L if parsing fails.
     */
    fun parseDollarsToCents(amountString: String): Long {
        val clean = amountString.replace("$", "").trim()
        return try {
            val dollars = clean.toDouble()
            (dollars * 100).toLong()
        } catch (_: Exception) {
            0L
        }
    }
}
