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

    @Test
    fun testCartItemDimensionsAndHeavyDetection() {
        val standardItem = com.autoship.clover.data.model.CartItem(
            id = "item_1",
            name = "Coffee Mug",
            priceCents = 1500L,
            quantity = 1,
            weightOz = 16.0,
            lengthIn = 10.0,
            widthIn = 7.0,
            heightIn = 5.0,
            isHeavyOverride = false
        )
        assertFalse(standardItem.isHeavy)
        assertEquals("10 x 7 x 5 in", standardItem.formattedDimensions())
        assertEquals("1 lb", standardItem.formattedWeight())

        // Overridden heavy item
        val cashierOverrideHeavy = standardItem.copy(
            isHeavyOverride = true,
            weightOz = 400.0,
            lengthIn = 24.0,
            widthIn = 18.0,
            heightIn = 12.0
        )
        assertTrue(cashierOverrideHeavy.isHeavy)
        assertEquals("24 x 18 x 12 in", cashierOverrideHeavy.formattedDimensions())
        assertEquals("25 lbs", cashierOverrideHeavy.formattedWeight())

        // Naturally heavy item by weight (> 5 lbs / 80 oz)
        val heavyByWeight = standardItem.copy(weightOz = 96.0)
        assertTrue(heavyByWeight.isHeavy)
        assertEquals("6 lbs", heavyByWeight.formattedWeight())
    }

    @Test
    fun testOfflineFallbackRateTableTieredPricing() {
        // Standard item without heavy overrides
        val items = listOf(
            com.autoship.clover.data.model.CartItem(
                id = "item_std",
                name = "Book",
                priceCents = 2500L,
                quantity = 1,
                weightOz = 16.0
            )
        )
        val dest = Address(
            recipientName = "Test Receiver",
            street1 = "100 Market St",
            city = "San Francisco",
            state = "CA",
            zipCode = "94105"
        )

        // Mock generator logic matching ShippingViewModel.generateOfflineFallbackRates
        val rates = listOf(
            ShippingRate(
                id = "offline_standard_ground",
                carrier = "USPS",
                serviceName = "Standard Ground",
                estimatedDelivery = "3-5 business days (Offline Est.)",
                estimatedDays = 4,
                baseRateCents = com.autoship.clover.ui.shipping.ShippingViewModel.OFFLINE_STANDARD_RATE_CENTS,
                isFreeShippingEligible = true,
                isOfflineFallback = true
            ),
            ShippingRate(
                id = "offline_priority_mail",
                carrier = "USPS",
                serviceName = "Priority Mail",
                estimatedDelivery = "2-3 business days (Offline Est.)",
                estimatedDays = 2,
                baseRateCents = com.autoship.clover.ui.shipping.ShippingViewModel.OFFLINE_PRIORITY_RATE_CENTS,
                isFreeShippingEligible = false,
                isOfflineFallback = true
            ),
            ShippingRate(
                id = "offline_express_overnight",
                carrier = "UPS",
                serviceName = "Next Day Air",
                estimatedDelivery = "1-2 business days (Offline Est.)",
                estimatedDays = 1,
                baseRateCents = com.autoship.clover.ui.shipping.ShippingViewModel.OFFLINE_EXPRESS_RATE_CENTS,
                isFreeShippingEligible = false,
                isOfflineFallback = true
            )
        )

        assertEquals(3, rates.size)

        // Verify Tier 1: Standard Ground $8.95
        val ground = rates.first { it.id == "offline_standard_ground" }
        assertEquals(895L, ground.baseRateCents)
        assertEquals("Standard Ground", ground.serviceName)
        assertTrue(ground.isOfflineFallback)

        // Verify Tier 2: Priority $14.50
        val priority = rates.first { it.id == "offline_priority_mail" }
        assertEquals(1450L, priority.baseRateCents)
        assertEquals("Priority Mail", priority.serviceName)
        assertTrue(priority.isOfflineFallback)

        // Verify Tier 3: Express $28.50
        val express = rates.first { it.id == "offline_express_overnight" }
        assertEquals(2850L, express.baseRateCents)
        assertEquals("Next Day Air", express.serviceName)
        assertTrue(express.isOfflineFallback)
    }

    @Test
    fun testOfflineFallbackWithHeavyItemSurcharge() {
        val heavyItems = listOf(
            com.autoship.clover.data.model.CartItem(
                id = "heavy_1",
                name = "Heavy Machinery Part",
                priceCents = 15000L,
                quantity = 1,
                weightOz = 400.0, // 25 lbs
                isHeavyOverride = true
            )
        )
        val totalWeightOz = heavyItems.sumOf { it.totalWeightOz }
        val hasHeavy = heavyItems.any { it.isHeavy } || totalWeightOz > 160.0
        assertTrue(hasHeavy)

        // Surcharge calculation
        val extraWeightLbs = ((totalWeightOz - 80.0).coerceAtLeast(0.0) / 16.0).toInt() // (400 - 80)/16 = 20 lbs
        val heavySurchargeCents = 800L + (extraWeightLbs * 150L) // 800 + 3000 = 3800L ($38.00)

        val standardGroundHeavy = com.autoship.clover.ui.shipping.ShippingViewModel.OFFLINE_STANDARD_RATE_CENTS + heavySurchargeCents
        assertEquals(895L + 3800L, standardGroundHeavy)
        assertEquals(4695L, standardGroundHeavy)
    }

    @Test
    fun testDebounceMutationLockingSimulation() {
        var lastApplyTimestamp = 0L
        val debounceWindowMs = 1000L
        var executionCount = 0

        fun attemptApply(currentTimestamp: Long): Boolean {
            if (currentTimestamp - lastApplyTimestamp < debounceWindowMs) {
                return false // Debounced / locked
            }
            lastApplyTimestamp = currentTimestamp
            executionCount++
            return true
        }

        // First click succeeds
        val firstClick = attemptApply(1000L)
        assertTrue(firstClick)
        assertEquals(1, executionCount)

        // Second click after 200ms is blocked by debounce lock
        val doubleTap = attemptApply(1200L)
        assertFalse(doubleTap)
        assertEquals(1, executionCount)

        // Third click after 1500ms succeeds
        val thirdClick = attemptApply(2500L)
        assertTrue(thirdClick)
        assertEquals(2, executionCount)
    }
}
