# AutoShip for Clover POS

**AutoShip** is an application suite for the Clover App Market that empowers retail and in-store merchants to offer dynamic shipping options right from their Clover POS registers.

## Key Features

- **Live Multi-Carrier Rate Shopping:** Real-time shipping quotes from USPS, UPS, FedEx, and DHL at checkout.
- **Estimated Arrival Times:** Displays estimated delivery dates and business days so cashiers and customers can choose the right balance of speed and cost.
- **Integrated Shipping Insurance:** One-tap toggle to add shipment protection based on cart valuation.
- **Catalog-Based Box Selection:** Automatically calculates package dimensions and weights based on items in the cart and merchant box presets (Small, Medium, Large, Custom).
- **Clover Discounts Compatibility:**
  - Automated free shipping when order totals cross merchant-defined thresholds (e.g. Free shipping on orders over $100).
  - Promo code support.
  - Native compatibility with Clover's built-in Discounts app.
- **End-to-End Fulfillment:** When an order is paid, AutoShip purchases postage, creates shipping labels (4x6 thermal or 8.5x11), and generates tracking links.

---

## Architecture & Repository Structure

- [`backend/`](file:///c:/Users/thera/Documents/Code/AutoShip/backend): Node.js + TypeScript service, EasyPost multi-carrier integration, packaging engine, Clover webhook receivers, and Merchant Web Dashboard.
- [`android/`](file:///c:/Users/thera/Documents/Code/AutoShip/android): Native Clover POS terminal app (Kotlin) integrating with Clover Android SDK (`OrderConnector`, `CustomerConnector`), Clover Register app, and AutoShip backend.

---

## Getting Started

See individual directories for setup instructions:
- [Backend Setup & Web Dashboard Guide](file:///c:/Users/thera/Documents/Code/AutoShip/backend/README.md)
- [Clover Android POS App Setup Guide](file:///c:/Users/thera/Documents/Code/AutoShip/android/README.md)
