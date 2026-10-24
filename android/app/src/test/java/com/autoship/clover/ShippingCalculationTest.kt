package com.autoship.clover

import com.autoship.clover.data.model.Address
import com.autoship.clover.data.model.ShippingRate
import com.autoship.clover.util.CurrencyUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShippingCalculationTest {

    @Test
    fun testCurrencyFormatting() {
        assertEquals("$8.50", CurrencyUtils.formatCents(850L))
        assertEquals("$0.00", CurrencyUtils.formatCents(0L))
        assertEquals("$120.99", CurrencyUtils.formatCents(12099L))

        assertEquals(5000L, CurrencyUtils.parseDollarsToCents("50.00"))
        assertEquals(5000L, CurrencyUtils.parseDollarsToCents("$50.00"))
        assertEquals(1050L, CurrencyUtils.parseDollarsToCents("10.50"))
    }

    @Test
    fun testAddressValidation() {
        val validAddress = Address(
            recipientName = "Jane Doe",
            street1 = "123 Main St",
            street2 = "Apt 4B",
            city = "San Jose",
            state = "CA",
            zipCode = "95113"
        )
        assertTrue(validAddress.isValid())
        assertEquals("123 Main St, Apt 4B", validAddress.formattedStreet())
        assertEquals("San Jose, CA 95113", validAddress.formattedCityStateZip())

        val invalidState = validAddress.copy(state = "CALIFORNIA")
        assertFalse(invalidState.isValid())

        val invalidZip = validAddress.copy(zipCode = "951")
        assertFalse(invalidZip.isValid())

        val emptyStreet = validAddress.copy(street1 = "")
        assertFalse(emptyStreet.isValid())
    }

    @Test
    fun testShippingRateCalculationsWithoutFreeShipping() {
        val rate = ShippingRate(
            id = "rate_usps_priority",
            carrier = "USPS",
            serviceName = "Priority Mail",
            estimatedDelivery = "2-3 business days",
            baseRateCents = 850L,
            insuranceCostCents = 150L,
            isFreeShippingEligible = true
        )

        // Without Insurance, No Free Shipping
        assertEquals(850L, rate.grossRateCents(includeInsurance = false))
        assertEquals(850L, rate.netChargedCents(includeInsurance = false, isFreeShippingGranted = false))
        assertEquals(0L, rate.waivedAmountCents(isFreeShippingGranted = false))

        // With Insurance, No Free Shipping
        assertEquals(1000L, rate.grossRateCents(includeInsurance = true))
        assertEquals(1000L, rate.netChargedCents(includeInsurance = true, isFreeShippingGranted = false))
        assertEquals(0L, rate.waivedAmountCents(isFreeShippingGranted = false))
    }

    @Test
    fun testShippingRateCalculationsWithFreeShipping() {
        val rate = ShippingRate(
            id = "rate_usps_priority",
            carrier = "USPS",
            serviceName = "Priority Mail",
            estimatedDelivery = "2-3 business days",
            baseRateCents = 850L,
            insuranceCostCents = 150L,
            isFreeShippingEligible = true
        )

        // Free Shipping Granted, Without Insurance -> $0 charged, $8.50 waived
        assertEquals(850L, rate.grossRateCents(includeInsurance = false))
        assertEquals(0L, rate.netChargedCents(includeInsurance = false, isFreeShippingGranted = true))
        assertEquals(850L, rate.waivedAmountCents(isFreeShippingGranted = true))

        // Free Shipping Granted, With Insurance -> $1.50 charged (insurance), $8.50 waived
        assertEquals(1000L, rate.grossRateCents(includeInsurance = true))
        assertEquals(150L, rate.netChargedCents(includeInsurance = true, isFreeShippingGranted = true))
        assertEquals(850L, rate.waivedAmountCents(isFreeShippingGranted = true))
    }
}
