package com.autoship.clover.clover

import android.accounts.Account
import android.content.Context
import android.os.RemoteException
import android.util.Log
import com.autoship.clover.data.model.Address
import com.autoship.clover.data.model.CartItem
import com.clover.sdk.util.CloverAccount
import com.clover.sdk.v1.ClientException
import com.clover.sdk.v1.ServiceException
import com.clover.sdk.v1.customer.CustomerConnector
import com.clover.sdk.v3.order.Discount
import com.clover.sdk.v3.order.LineItem
import com.clover.sdk.v3.order.Order
import com.clover.sdk.v3.order.OrderConnector
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Manages IPC connections to Clover OrderConnector and CustomerConnector.
 * Safely handles device account resolution, active order inspection, line item mutations,
 * customer address lookup, and discount applications.
 */
class CloverConnectorManager(private val context: Context) {

    private val tag = "CloverConnectorManager"
    private var account: Account? = null
    private var orderConnector: OrderConnector? = null
    private var customerConnector: CustomerConnector? = null

    init {
        initAccountAndConnectors()
    }

    private fun initAccountAndConnectors() {
        try {
            account = CloverAccount.getAccount(context)
            if (account != null) {
                orderConnector = OrderConnector(context, account, null)
                orderConnector?.connect()

                customerConnector = CustomerConnector(context, account, null)
                customerConnector?.connect()
                Log.d(tag, "Initialized OrderConnector and CustomerConnector successfully.")
            } else {
                Log.w(tag, "No Clover Account found on device. App is running outside Clover environment or sandbox account not set.")
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to initialize Clover connectors", e)
        }
    }

    /**
     * Checks if a valid Clover account is available on the hardware.
     */
    fun isCloverDevice(): Boolean = account != null

    /**
     * Fetches a full Clover Order object by ID on IO dispatcher.
     */
    suspend fun getOrder(orderId: String): Order? = withContext(Dispatchers.IO) {
        val connector = orderConnector ?: return@withContext null
        try {
            connector.getOrder(orderId)
        } catch (e: Exception) {
            Log.e(tag, "Error fetching order with ID: $orderId", e)
            null
        }
    }

    /**
     * Extracts items from the active order to pass to the shipping rates calculation.
     */
    suspend fun getCartItems(orderId: String): List<CartItem> = withContext(Dispatchers.IO) {
        val order = getOrder(orderId) ?: return@withContext emptyList()
        val lineItems = order.lineItems ?: return@withContext emptyList()

        lineItems.filter { !isShippingLineItem(it.name) }.map { item ->
            CartItem(
                id = item.id ?: "",
                name = item.name ?: "Item",
                priceCents = item.price ?: 0L,
                quantity = 1,
                weightOz = 16.0 // standard default package weight estimate
            )
        }
    }

    /**
     * Looks up any saved shipping address associated with the order's attached customer.
     */
    suspend fun getCustomerAddressForOrder(orderId: String): Address? = withContext(Dispatchers.IO) {
        val connector = customerConnector ?: return@withContext null
        val order = getOrder(orderId) ?: return@withContext null

        try {
            val orderCustomers = order.customers
            if (!orderCustomers.isNullOrEmpty()) {
                val attachedCustomer = orderCustomers.first()
                val customerId = attachedCustomer.id
                val fullCustomer = if (!customerId.isNullOrBlank()) {
                    try {
                        connector.getCustomer(customerId)
                    } catch (e: Exception) {
                        null
                    }
                } else null

                if (fullCustomer != null) {
                    val addresses = fullCustomer.addresses
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses.first()
                        val fullName = buildString {
                            if (!fullCustomer.firstName.isNullOrBlank()) append(fullCustomer.firstName).append(" ")
                            if (!fullCustomer.lastName.isNullOrBlank()) append(fullCustomer.lastName)
                        }.trim()

                        return@withContext Address(
                            recipientName = fullName.ifBlank { "Customer" },
                            street1 = addr.address1 ?: "",
                            street2 = addr.address2,
                            city = addr.city ?: "",
                            state = addr.state ?: "",
                            zipCode = addr.zip ?: "",
                            country = addr.country ?: "US",
                            phone = fullCustomer.phoneNumbers?.firstOrNull()?.phoneNumber
                        )
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Error querying customer address for order: $orderId", e)
        }
        null
    }

    /**
     * Adds or replaces the shipping LineItem in the Clover active order.
     * If shipping was waived via free shipping promotion, applies a line item discount.
     */
    suspend fun applyShippingToOrder(
        orderId: String,
        carrier: String,
        serviceName: String,
        grossRateCents: Long,
        waivedAmountCents: Long
    ): Boolean = withContext(Dispatchers.IO) {
        val connector = orderConnector
        if (connector == null) {
            Log.e(tag, "Cannot apply shipping: OrderConnector is null (non-Clover environment)")
            return@withContext false
        }

        try {
            // 1. Fetch active order to see if a prior shipping line item exists
            val currentOrder = connector.getOrder(orderId)
            val itemsToDelete = mutableListOf<String>()
            currentOrder?.lineItems?.forEach { item ->
                if (isShippingLineItem(item.name)) {
                    item.id?.let { itemsToDelete.add(it) }
                }
            }

            if (itemsToDelete.isNotEmpty()) {
                try {
                    connector.deleteLineItems(orderId, itemsToDelete)
                    Log.d(tag, "Removed existing shipping line items: $itemsToDelete")
                } catch (e: Exception) {
                    Log.w(tag, "Could not remove prior shipping items", e)
                }
            }

            // 2. Build the custom LineItem
            val shippingTitle = "Shipping: $carrier $serviceName"
            val lineItem = LineItem().apply {
                name = shippingTitle
                price = grossRateCents
            }

            // 3. Add custom line item (non-taxable for standard shipping services)
            val addedItem = connector.addCustomLineItem(orderId, lineItem, false)
            Log.d(tag, "Successfully added custom line item: ${addedItem.id} at $grossRateCents cents")

            // 4. If free shipping promotion applies, apply discount to this line item
            if (waivedAmountCents > 0L) {
                val discount = Discount().apply {
                    name = "Free Shipping Promo"
                    amount = -waivedAmountCents // Clover line item discounts use negative cents
                }
                connector.addLineItemDiscount(orderId, addedItem.id, discount)
                Log.d(tag, "Applied free shipping discount of -$waivedAmountCents cents to line item ${addedItem.id}")
            }

            true
        } catch (e: RemoteException) {
            Log.e(tag, "Clover RemoteException while applying shipping", e)
            false
        } catch (e: ClientException) {
            Log.e(tag, "Clover ClientException while applying shipping", e)
            false
        } catch (e: ServiceException) {
            Log.e(tag, "Clover ServiceException while applying shipping", e)
            false
        } catch (e: Exception) {
            Log.e(tag, "Unexpected error applying shipping line item to order $orderId", e)
            false
        }
    }

    private fun isShippingLineItem(name: String?): Boolean {
        if (name.isNullOrBlank()) return false
        val lower = name.lowercase()
        return lower.startsWith("shipping:") || lower.startsWith("shipping fee") || lower.startsWith("autoship:")
    }

    /**
     * Cleans up and disconnects Clover IPC services.
     */
    fun disconnect() {
        try {
            orderConnector?.disconnect()
            orderConnector = null
        } catch (e: Exception) {
            Log.w(tag, "Error disconnecting OrderConnector", e)
        }

        try {
            customerConnector?.disconnect()
            customerConnector = null
        } catch (e: Exception) {
            Log.w(tag, "Error disconnecting CustomerConnector", e)
        }
    }
}
