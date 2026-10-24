# AutoShip Clover POS Android Application

Production-ready native Android application for **AutoShip**, integrated directly into the Clover POS ecosystem (Clover Station, Clover Flex, and Clover Mini). This app allows cashiers and retail merchants to calculate real-time multi-carrier shipping rates (USPS, UPS, FedEx), validate customer delivery addresses, add transit insurance, automatically apply free-shipping promotional discounts, and append shipping line items directly to active Clover Register orders.

---

## Table of Contents
1. [Architecture & Tech Stack](#architecture--tech-stack)
2. [Clover POS Hardware Compatibility](#clover-pos-hardware-compatibility)
3. [Clover Developer Dashboard Setup](#clover-developer-dashboard-setup)
4. [Clover Intent Integration (Register App Action)](#clover-intent-integration-register-app-action)
5. [Clover SDK Connectors & LineItem Mechanics](#clover-sdk-connectors--lineitem-mechanics)
6. [Backend API Integration](#backend-api-integration)
7. [Building & Installing via ADB](#building--installing-via-adb)
8. [Testing & Verification](#testing--verification)

---

## Architecture & Tech Stack

The application is written in 100% Kotlin following modern Android architecture patterns (MVVM + Repository + Coroutines):

* **Language**: Kotlin 1.9.22 (JVM 17 Target)
* **SDK Compatibility**: `minSdk = 26` (Android 8.0 Oreo), `targetSdk = 34` (Android 14)
* **Clover Android SDK**: `com.clover.sdk:clover-android-sdk:341` (Hosted on Maven Central & Clover JFrog)
* **Networking**: Retrofit 2.9.0 + Gson + OkHttp 4.12.0 with HTTP logging
* **Async Concurrency**: Kotlin Coroutines (`Dispatchers.IO` / `Dispatchers.Main`)
* **UI & Layouts**: AndroidX Material Components, ViewBinding, responsive ConstraintLayout, dual portrait/landscape layouts
* **Persistence**: Encrypted/SharedPreferences via `SettingsManager` for merchant endpoints and rule preferences

```
android/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/autoship/clover/
│       │   │   ├── AutoShipApplication.kt
│       │   │   ├── clover/
│       │   │   │   └── CloverConnectorManager.kt      # Clover OrderConnector & CustomerConnector
│       │   │   ├── data/
│       │   │   │   ├── api/
│       │   │   │   │   ├── AutoShipApiService.kt       # Retrofit endpoints (/api/rates, /api/orders/ship)
│       │   │   │   │   └── RetrofitClient.kt
│       │   │   │   ├── model/
│       │   │   │   │   ├── Address.kt                 # Destination model & formatters
│       │   │   │   │   ├── CartItem.kt                # Line item model
│       │   │   │   │   ├── ShippingRate.kt            # Carrier rates & discount formulas
│       │   │   │   │   ├── RatesRequest.kt / RatesResponse.kt
│       │   │   │   │   └── ShipOrderRequest.kt / ShipOrderResponse.kt
│       │   │   │   └── repository/
│       │   │   │       └── ShippingRepository.kt      # Remote fetch & mock sandbox generation
│       │   │   ├── ui/
│       │   │   │   ├── settings/
│       │   │   │   │   ├── SettingsActivity.kt        # Terminal config & backend URL
│       │   │   │   │   └── SettingsManager.kt
│       │   │   │   └── shipping/
│       │   │   │       ├── AddressDialog.kt           # Destination modal & validation
│       │   │   │       ├── RatesAdapter.kt            # Multi-carrier RecyclerView
│       │   │   │       ├── ShippingActivity.kt        # Primary cashier screen
│       │   │   │       ├── ShippingViewModel.kt       # State machine & calculations
│       │   │   │       └── ShippingViewModelFactory.kt
│       │   │   └── util/
│       │   │       ├── CurrencyUtils.kt
│       │   │       └── Result.kt
│       │   └── res/
│       │       ├── layout/activity_shipping.xml       # Portrait layout (Clover Flex)
│       │       ├── layout-land/activity_shipping.xml  # Landscape layout (Clover Station / Mini)
│       │       ├── layout/item_shipping_rate.xml
│       │       ├── layout/dialog_address.xml
│       │       ├── layout/activity_settings.xml
│       │       ├── values/colors.xml, strings.xml, themes.xml
│       │       └── xml/network_security_config.xml
│       └── test/java/com/autoship/clover/
│           └── ShippingCalculationTest.kt             # Automated calculation & discount test suite
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
└── README.md
```

---

## Clover POS Hardware Compatibility

| Clover Device | Form Factor | Display Resolution | Default Orientation | Supported |
| :--- | :--- | :--- | :--- | :--- |
| **Clover Station 2018 / Solo / Duo** | Countertop 14" Terminal | 1920 × 1080 | Landscape (`layout-land`) | **Yes** |
| **Clover Mini 2 / 3** | Compact 7"/8" Terminal | 1280 × 800 | Landscape (`layout-land`) | **Yes** |
| **Clover Flex 2 / 3** | Handheld 5"/6" Terminal | 720 × 1280 | Portrait (`layout`) | **Yes** |

AutoShip includes dedicated XML layouts for both portrait (`res/layout/activity_shipping.xml`) and widescreen landscape (`res/layout-land/activity_shipping.xml`), providing an optimized two-column workflow for Station/Mini devices while retaining a streamlined single-column scroll on the handheld Flex.

---

## Clover Developer Dashboard Setup

To run and test AutoShip on the Clover Sandbox or a physical DevKit device:

1. Log into your [Clover Developer Dashboard (Sandbox)](https://sandbox.dev.clover.com/developer-home).
2. Click **Create New App** and provide the app name `AutoShip`.
3. In **App Settings** > **Requested Permissions**, request and grant:
   * **Orders**: Read (`READ_ORDERS`) & Write (`WRITE_ORDERS`)
   * **Customers**: Read (`READ_CUSTOMERS`) & Write (`WRITE_CUSTOMERS`)
4. In **App Settings** > **App Types / Actions**, register a **Register Action**:
   * **Action Intent**: `clover.intent.action.MODIFY_ORDER`
   * **Button Label**: `AutoShip Shipping`
   * **Button Icon**: Select the shipping box icon.

> [!IMPORTANT]
> If you change requested permissions in the Clover Developer Dashboard, you **must uninstall and reinstall** the APK on your test device for the new OAuth token and scopes to be synchronized.

---

## Clover Intent Integration (Register App Action)

When a cashier is ringing up a sale in Clover Register, tapping the AutoShip button launches `ShippingActivity` with the active order ID passed in the intent extra:

```xml
<activity
    android:name=".ui.shipping.ShippingActivity"
    android:exported="true"
    android:label="@string/app_name"
    android:launchMode="singleTop">
    
    <!-- Launcher intent -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- Clover Register Modify Order Hook -->
    <intent-filter>
        <action android:name="clover.intent.action.MODIFY_ORDER" />
        <action android:name="com.clover.intent.action.MODIFY_ORDER" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>

    <meta-data
        android:name="clover.intent.action.MODIFY_ORDER"
        android:value="true" />
</activity>
```

In `ShippingActivity.kt`:
```kotlin
val orderId = intent.getStringExtra(com.clover.sdk.v1.Intents.EXTRA_ORDER_ID)
```

---

## Clover SDK Connectors & LineItem Mechanics

All interactions with Clover's underlying services are encapsulated within `CloverConnectorManager.kt`:

1. **Authentication**: Resolves device account via `CloverAccount.getAccount(context)`.
2. **Customer Address Lookup**: Checks `order.customers` on the active order; if present, connects to `CustomerConnector` to auto-populate the recipient name, street, city, state, and ZIP.
3. **LineItem Creation**:
   * Removes any previously calculated `Shipping: ...` line items to prevent duplicate charges.
   * Creates a custom `LineItem` with the selected carrier name, service level, and gross price.
   * Calls `OrderConnector.addCustomLineItem(orderId, lineItem, false)` (non-taxable shipping fee).
4. **Free Shipping Promotion & Discount**:
   * If the order subtotal meets the merchant's configured threshold (e.g. $50.00), AutoShip waives the base shipping fee.
   * Rather than simply zeroing out the line item, it adds an explicit Clover line item discount:
     ```kotlin
     val discount = Discount().apply {
         name = "Free Shipping Promo"
         amount = -waivedAmountCents // Negative cents
     }
     orderConnector.addLineItemDiscount(orderId, lineItem.id, discount)
     ```
   * This provides full accounting auditability on customer receipts and merchant reporting.
5. **Finishing**: Sets `Activity.RESULT_OK` and finishes, instantly navigating the cashier back to the updated Clover Register cart.

---

## Backend API Integration

The app communicates with the AutoShip backend using Retrofit:

### `POST /api/rates`
Calculates live carrier rates based on destination address, cart contents, and transit insurance option.
```json
{
  "order_id": "9B8XYZ",
  "order_total_cents": 6450,
  "destination": {
    "recipient_name": "Jane Doe",
    "street1": "742 Evergreen Terrace",
    "street2": "Apt 4B",
    "city": "Springfield",
    "state": "OR",
    "zip_code": "97477",
    "country": "US"
  },
  "items": [
    { "id": "1", "name": "Coffee Beans", "price_cents": 1850, "quantity": 2, "weight_oz": 24.0 }
  ],
  "include_insurance": true
}
```

### `POST /api/orders/ship`
Confirms the selected shipping service and books the shipping label.
```json
{
  "order_id": "9B8XYZ",
  "selected_rate_id": "rate_usps_priority",
  "carrier": "USPS",
  "service_name": "Priority Mail",
  "charged_cost_cents": 150,
  "insurance_included": true,
  "insurance_cost_cents": 150,
  "destination": { ... },
  "items": [ ... ]
}
```

---

## Building & Installing via ADB

### Prerequisites
* JDK 17+ installed and configured in `JAVA_HOME`.
* Android SDK Platform 34 installed (`ANDROID_HOME` or `ANDROID_SDK_ROOT`).
* Clover DevKit terminal (connected via USB) OR Clover Sandbox Emulator with ADB debugging enabled.

### Build Debug APK
From `c:\Users\thera\Documents\Code\AutoShip\android`:
```powershell
# Build the debug APK
.\gradlew.bat assembleDebug

# Output APK path:
# app/build/outputs/apk/debug/app-debug.apk
```

### Install to Clover Device via ADB
Verify your device or emulator is recognized:
```bash
adb devices
```

Install the APK:
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Launch the app directly from ADB for testing:
```bash
adb shell am start -n com.autoship.clover/.ui.shipping.ShippingActivity
```

Simulate launching from Clover Register with an active order ID:
```bash
adb shell am start -n com.autoship.clover/.ui.shipping.ShippingActivity -a clover.intent.action.MODIFY_ORDER --es clover.intent.extra.ORDER_ID "TEST_ORDER_999"
```

---

## Testing & Verification

### In-App Settings & Mock Sandbox Mode
When developing without a live backend service:
1. Tap the **Settings** gear icon in the top right corner.
2. Toggle **Enable Mock Sandbox Rates (No backend required)** ON.
3. Tap **Save Preferences**.
4. The app will immediately generate real-world simulated USPS, UPS, and FedEx options with live delivery estimates and free shipping math.

### Connecting to a Local Backend Server
1. If running your backend locally on `http://localhost:3000`:
   * In the Android Emulator, configure the Backend URL as: `http://10.0.2.2:3000/`
   * On a physical Clover DevKit connected to Wi-Fi, configure the Backend URL using your workstation's LAN IP: `http://192.168.1.150:3000/`
2. `network_security_config.xml` is pre-configured to allow cleartext HTTP traffic to local subnet IPs during development.

### Running Automated Unit Tests
```powershell
.\gradlew.bat testDebugUnitTest
```
Tests cover:
* Currency formatting & parsing (`CurrencyUtils`)
* Destination address validation & multi-line string construction
* Gross rate, net charge, and free shipping discount waiver formulas
* Optional transit insurance price layering
