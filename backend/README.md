# AutoShip — Clover POS Shipping & Fulfillment Backend

AutoShip is an automated multi-carrier shipping, packaging, and fulfillment engine built specifically for the **Clover POS App Market**. It seamlessly calculates real-time carrier shipping rates, determines the optimal box size via 3D bin-packing, handles merchant free-shipping thresholds and promo codes, and automatically purchases shipping labels with printable barcodes upon payment.

---

## 🌟 Key Features

1. **Multi-Carrier Rate Calculation**:
   - Integrates with **EasyPost API** for live commercial rates across USPS, UPS, and FedEx.
   - Features a **Resilient Mock Carrier Provider** that automatically activates when no API key is set, generating realistic rates, accurate delivery dates, postal zone adjustments, and full 4"×6" printable shipping labels with barcodes.

2. **3D Bin-Packing & Packaging Engine**:
   - Evaluates cart item dimensions and weights against merchant packaging presets (Padded Mailer, Small Box, Medium Box, Large Box, and Extra Large Box).
   - Supports 3D rotations, packing efficiency factor (void volume adjustment), tare weight, and billable dimensional weight calculation (`(L × W × H) / 166`).

3. **Discounts & Free Shipping Rules**:
   - Merchant-defined **Free Shipping Threshold** (e.g. orders $\ge$ $100 waive standard shipping).
   - Custom **Promo Codes** (`percentage`, `fixed_amount`, or `free_shipping`) with minimum order constraints.
   - Automatically generates the exact **Clover POS Discount Object** (in negative cents) for 1-click POS sync.

4. **Post-Payment Webhook Fulfillment**:
   - Clover Webhook receiver (`/api/webhooks/clover`) handling `orders.updated` and `payments.created`.
   - Automatically verifies payment status, packs items, generates carrier tracking, and attaches tracking details to the Clover order.
   - Completely idempotent: prevents double-purchasing postage for the same order.

5. **Printable Shipping Labels**:
   - Generates high-resolution vector SVG and print-ready HTML shipping labels (4"×6" standard thermal format) complete with Code 128 barcodes, postal routing codes, and addresses.

6. **Embedded Merchant Dashboard**:
   - Clean, modern UI styled to match the Clover POS aesthetic (`http://localhost:3000/dashboard`).
   - **Overview**: Real-time KPI metrics, recent shipments table with search, label reprint modal, and live tracking simulator.
   - **Rate Sandbox**: Interactive calculator to test any destination address, select items from catalog, apply promo codes, and visualize box selection.
   - **Packaging Presets**: Manage dimensions, tare weight, and maximum weight limits.
   - **Discounts & Promo Codes**: Adjust threshold rules and create promo codes.
   - **Carrier Settings**: Toggle USPS, UPS, FedEx, configure EasyPost credentials, and customize merchant origin address.

---

## 📁 Architecture & File Structure

```text
backend/
├── data/
│   └── autoship.json               # Atomic JSON persistent database store
├── public/
│   ├── index.html                  # Merchant Web Dashboard UI
│   ├── style.css                   # Clover-themed modern styles (container-queries compliant)
│   └── app.js                      # Client dashboard application
├── src/
│   ├── carriers/
│   │   ├── ICarrierProvider.ts      # Carrier interface definition
│   │   ├── MockCarrierProvider.ts   # Realistic USPS/UPS/FedEx mock rates & SVG label generator
│   │   ├── EasyPostCarrierProvider.ts# EasyPost REST client
│   │   └── carrierFactory.ts        # Carrier provider resolution
│   ├── controllers/
│   │   ├── rateController.ts        # Rate calculation & packaging endpoints
│   │   ├── shipmentController.ts    # Shipment retrieval, print labels, voiding
│   │   ├── settingsController.ts    # Carrier settings, box presets, promo codes
│   │   └── webhookController.ts     # Clover webhook handling & sandbox simulation
│   ├── db/
│   │   └── database.ts              # File-backed persistence layer with in-memory cache
│   ├── services/
│   │   ├── binPackingService.ts     # 3D bin-packing and box selection algorithm
│   │   ├── discountService.ts       # Free shipping thresholds & Clover discount mapping
│   │   ├── rateCalculationService.ts# Orchestrator for rates, packaging, and discounts
│   │   ├── cloverService.ts         # Clover REST API client & order mock provider
│   │   └── fulfillmentService.ts    # Post-payment label purchase & order fulfillment
│   ├── types/
│   │   └── index.ts                 # Full TypeScript interfaces & types
│   ├── app.ts                       # Express application configuration
│   └── index.ts                     # Server entry point
├── tests/
│   ├── binPacking.test.ts           # Box selection, rotational fit, tare & weight limits
│   ├── discounts.test.ts            # Thresholds, promo codes, Clover payloads
│   ├── rates.test.ts                # Multi-carrier quotes, insurance, delivery dates
│   └── fulfillment.test.ts          # Order fulfillment, label generation, voiding
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port for server | `3000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `EASYPOST_API_KEY` | EasyPost API Key (production or test). *Leave empty for Mock Carrier Sandbox.* | `""` |
| `CLOVER_MERCHANT_ID` | Clover Merchant ID | `MERCHANT_CLOVER_12345` |
| `CLOVER_API_TOKEN` | Clover REST API Bearer Token | `""` |
| `CLOVER_ENV` | Clover API environment (`sandbox` or `production`) | `sandbox` |
| `CLOVER_WEBHOOK_SECRET` | Secret token to verify `X-Clover-Auth` webhook signature | `clover_autoship_secret` |

### 4. Build and Run

#### Development Mode (with hot-reloading via `tsx`):
```bash
npm run dev
```

#### Production Build:
```bash
npm run build
npm start
```

Once running:
- **Merchant Web Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 🧪 Running Unit Tests

AutoShip includes comprehensive unit tests verifying the packaging algorithm, discount threshold calculations, multi-carrier rate generation, and post-payment fulfillment:

```bash
npm test
```

To run tests in watch mode:
```bash
npm run test:watch
```

---

## 📡 API Reference

### Rate Calculation & Packaging
- `POST /api/rates/calculate`: Computes optimal box size, billable dimensional weight, carrier rates, insurance, and discounts.
  ```json
  {
    "toAddress": {
      "name": "Jane Smith",
      "street1": "100 Main St",
      "city": "Beverly Hills",
      "state": "CA",
      "zip": "90210"
    },
    "items": [
      {
        "id": "item_tee",
        "name": "Cotton T-Shirt",
        "quantity": 2,
        "price": 28.00,
        "weightOz": 7.5,
        "lengthIn": 9.0,
        "widthIn": 7.0,
        "heightIn": 0.8
      }
    ],
    "cartSubtotal": 56.00,
    "promoCode": "SHIP50",
    "insuranceRequested": true,
    "deliveryGuaranteeRequested": false
  }
  ```
- `GET /api/rates/boxes`: Returns packaging presets and product catalog items.

### Shipments & Printable Labels
- `GET /api/shipments`: List recent shipments with optional search and status filters.
- `GET /api/shipments/:id`: Get full shipment details and tracking timeline.
- `GET /api/shipments/:id/label?view=print`: Render print-ready 4"×6" shipping label with browser print button.
- `POST /api/shipments/fulfill`: Manually fulfill an order.
- `POST /api/shipments/:id/events`: Simulate a tracking progress step (`in_transit`, `out_for_delivery`, `delivered`).
- `POST /api/shipments/:id/void`: Void a postage label and submit refund request.

### Settings & Rules
- `GET /api/settings` & `PUT /api/settings`: Fetch and update carrier settings, free shipping thresholds, and origin address.
- `GET /api/settings/presets` & `POST /api/settings/presets`: Manage packaging presets.
- `GET /api/settings/promos` & `POST /api/settings/promos`: Manage promo codes.

### Clover Webhooks
- `POST /api/webhooks/clover`: Receives live Clover Webhook notifications (`orders` and `payments`).
- `POST /api/webhooks/simulate`: One-click developer simulator to generate a paid test order and purchase a label.
- `GET /api/webhooks/logs`: View recent webhook transaction logs.

---

## 🔒 Clover App Market Setup

1. **Register App**: In the [Clover Developer Portal](https://sandbox.dev.clover.com/), create an app named **AutoShip**.
2. **App Permissions**: Request `ORDERS_R` (Read Orders), `ORDERS_W` (Write Orders), and `ECOMMERCE`.
3. **Configure Webhook**: Set the Webhook URL to `https://your-domain.com/api/webhooks/clover` and subscribe to `orders` (UPDATE) and `payments` (CREATE).
4. **Embed Dashboard**: In the App Settings, set the Merchant App URL to `https://your-domain.com/dashboard` so the dashboard opens seamlessly inside the Clover Merchant Web Dashboard.
