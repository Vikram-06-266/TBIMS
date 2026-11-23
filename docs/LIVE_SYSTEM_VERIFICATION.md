# TBIMS â€” Live System Verification & Architecture Report

This report documents the end-to-end verification of the **Transaction-Based Retail Inventory Management System (TBIMS)** connected to the live Neon PostgreSQL database (`inventory_db`).

Every operation described in this document was executed through real backend APIs (`Express`), authenticated using JWTs, and persisted to the underlying PostgreSQL schema without mock data or client simulation.

---

## 1. Application Architecture & Connectivity

### Service Overview
- **Frontend**: React + Vite single-page application running at `http://127.0.0.1:5173`.
  - Production build command: `npm run build` (vite build -> `dist/`).
  - Configurable backend target: `VITE_API_BASE_URL` (defaults to same-origin relative `/api/` in dev via Vite proxy).
  - Mode default: **Live Database Mode** (directly bound to Neon PostgreSQL).
- **Backend**: Node.js + Express API server running on port `4000`.
  - Process environment: `NODE_ENV=production`.
  - Authentication: Scrypt password hashing with HMAC-SHA256 signed JWT tokens (30-minute validity).
  - Database Driver: `pg` connection pool with SSL `sslmode=verify-full`.
- **Database**: Neon PostgreSQL cloud database (`inventory_db`).
  - Core tables verified: `products` (4,070), `inventory` (4,070), `orders`, `order_items`, `reservations`, `stock_transactions`, `stock_ledger`, `audit_logs`.

### Health Endpoints Verification
```http
GET http://127.0.0.1:4000/api/health
HTTP/1.1 200 OK
{ "status": "ok", "service": "transaction-inventory-system" }

GET http://127.0.0.1:4000/api/health/db
HTTP/1.1 200 OK
{
  "ok": true,
  "status": "connected",
  "database": "inventory_db",
  "tables": [
    "audit_logs", "historical_customers", "historical_invoice_items",
    "historical_invoices", "historical_products", "inventory",
    "online_retail_staging", "order_items", "orders", "products",
    "reservations", "stock_ledger", "stock_transactions", "users"
  ]
}
```

---

## 2. Authentication & Role Permissions

The application enforces role-based access control (RBAC) via cryptographically signed JWT tokens issued by `POST /api/auth/login`.

| Role | Username | Permissions |
|---|---|---|
| **Owner** | `owner` | Full administrative, inventory intake, order confirmation, return processing, and audit logs. |
| **Admin** | `admin` | Full operational and administrative access, user management, audit logs. |
| **Inventory Manager** | `manager` | Stock intake, inventory calculation, order fulfillment, return processing. |
| **Staff** | `staff` | Catalogue viewing, order confirmation/fulfillment, stock movement visibility. |
| **Customer** | `customer` | Safe catalogue browsing, shopping cart, order checkout, own order tracking & pending order cancellation. |

*Note: All development passwords are kept strictly in the git-ignored local environment configuration (`backend/.env`). No secrets are committed or displayed.*

---

## 3. Real Database Lifecycle Test (Steps Aâ€“I)

A controlled test was conducted on **Product ID 1** (`85123A` â€” *White hanging heart*, Unit Price: â‚¹2.55) through the authenticated Express APIs and verified by independent PostgreSQL queries.

### Invariant Constraint
At all points in the lifecycle, the system guarantees:
$$\text{on\_hand} = \text{available\_qty} + \text{reserved\_qty}$$
$$\text{available} = \text{on\_hand} - \text{reserved}$$
$$\text{available} \ge 0 \quad (\text{zero overselling allowed})$$

---

### Step-by-Step Test Log & Database State

#### Initial Baseline
- **Product ID**: 1
- **SKU**: `85123A`
- **Initial Inventory**:
  - `available_qty`: **102**
  - `reserved_qty`: **0**
  - `on_hand`: **102**
- **Invariant**: $102 = 102 + 0$ (**Satisfied**)

---

#### Step A â€” Stock Intake (Receive 5 Units)
- **Actor**: `manager` (`inventoryManager`)
- **API Request**: `POST /api/inventory/receive`
  ```json
  {
    "productId": 1,
    "sku": "85123A",
    "quantity": 5,
    "referenceId": "INTAKE-VERIFY-A"
  }
  ```
- **PostgreSQL Database Verification**:
  - `inventory`: `available_qty = 107`, `reserved_qty = 0`, `on_hand = 107`
  - Invariant: $107 = 107 + 0$ (**Satisfied**)
  - `stock_transactions`: Record ID `4093`, Type `IN`, Quantity `5`, Ref `INTAKE-VERIFY-A`
  - `stock_ledger`: Record ID `4092`, Quantity Change `+5`, Available After `107`, Reserved After `0`
  - `audit_logs`: Record ID `29`, Action `STOCK_RECEIVED`

---

#### Step B, C & D â€” Customer Checkout & Reservation (Purchase 2 Units)
- **Actor**: `customer` (`customer`)
- **API Request**: `POST /api/shop/checkout`
  ```json
  {
    "items": [{ "productId": 1, "quantity": 2 }],
    "idempotencyKey": "test-order-live-verification"
  }
  ```
- **Created Order**: Order ID **21** (`ORD-2026-021`), Status `PENDING`, Total `â‚¹5.10`
- **PostgreSQL Database Verification**:
  - `orders`: `order_id = 21`, `customer_name = 'customer'`, `order_status = 'PENDING'`
  - `order_items`: Record ID `16`, `order_id = 21`, `product_id = 1`, `quantity = 2`, `unit_price = 2.55`
  - `reservations`: Record ID `17`, `order_id = 21`, `product_id = 1`, `quantity = 2`, `reservation_status = 'ACTIVE'`
  - `inventory`: `available_qty = 105`, `reserved_qty = 2`, `on_hand = 107`
  - Invariant: $107 = 105 + 2$ (**Satisfied** â€” available reduced, reserved increased, physical on-hand unchanged)
  - `stock_transactions`: Record ID `4094`, Type `RESERVE`, Quantity `2`
  - `stock_ledger`: Record ID `4093`, Quantity Change `0`, Available After `105`, Reserved After `2`
  - `audit_logs`: Record ID `30`, Action `ORDER_CREATED`

---

#### Step E & F â€” Management Order Confirmation (Fulfillment)
- **Actor**: `manager` (`inventoryManager`)
- **API Request**: `POST /api/orders/21/confirm`
- **PostgreSQL Database Verification**:
  - `orders`: `order_id = 21`, `order_status = 'CONFIRMED'`
  - `reservations`: Record ID `17`, `reservation_status = 'CONFIRMED'` (Fulfilled)
  - `inventory`: `available_qty = 105`, `reserved_qty = 0`, `on_hand = 105`
  - Invariant: $105 = 105 + 0$ (**Satisfied** â€” reserved goods physically dispatched, decreasing on-hand)
  - `stock_transactions`: Record ID `4095`, Type `OUT`, Quantity `2`, Ref `ORD-21`
  - `stock_ledger`: Record ID `4094`, Quantity Change `-2`, Available After `105`, Reserved After `0`
  - `audit_logs`: Record ID `31`, Action `ORDER_CONFIRMED`

---

#### Step G â€” Order Return Processing (1 Unit Returned)
- **Actor**: `manager` (`inventoryManager`)
- **API Request**: `POST /api/orders/21/return`
  ```json
  {
    "productId": 1,
    "quantity": 1,
    "reason": "Customer return verification"
  }
  ```
- **PostgreSQL Database Verification**:
  - Validation: Checked against Order 21 ordered quantity (2) - previous returns (0) = 2 max returnable. Request for 1 unit approved.
  - `inventory`: `available_qty = 106`, `reserved_qty = 0`, `on_hand = 106`
  - Invariant: $106 = 106 + 0$ (**Satisfied** â€” 1 unit returned to physical available stock)
  - `stock_transactions`: Record ID `4096`, Type `RETURN`, Quantity `1`, Ref `ORD-21`
  - `stock_ledger`: Record ID `4095`, Quantity Change `+1`, Available After `106`, Reserved After `0`
  - `audit_logs`: Record ID `32`, Action `RETURN_PROCESSED`

---

#### Step H & I â€” Customer Order Placement and Self-Cancellation
- **Actor**: `customer` (`customer`)
- **API Request 1**: `POST /api/shop/checkout` for 1 unit of Product 1
  - Created Order ID **22** (`ORD-2026-022`), Status `PENDING`
  - Intermediate Inventory State: `available_qty = 105`, `reserved_qty = 1`, `on_hand = 106` ($106 = 105 + 1$)
- **API Request 2**: `POST /api/shop/orders/22/cancel`
- **PostgreSQL Database Verification**:
  - Authorization: Customer verified as owner of Order 22. Status verified as `PENDING`.
  - `orders`: `order_id = 22`, `order_status = 'CANCELLED'`
  - `reservations`: Record ID `18`, `reservation_status = 'CANCELLED'` (Released)
  - `inventory`: `available_qty = 106`, `reserved_qty = 0`, `on_hand = 106`
  - Invariant: $106 = 106 + 0$ (**Satisfied** â€” reservation released back to available inventory)
  - `stock_transactions`: Record ID `4098`, Type `CANCEL_RESERVATION`, Quantity `1`, Ref `ORD-22`
  - `stock_ledger`: Record ID `4097`, Quantity Change `0`, Available After `106`, Reserved After `0`
  - `audit_logs`: Record ID `34`, Action `ORDER_CANCELLED`

---

## 4. Test Summary Matrix

| Step | Operation | Initiator | Order ID | Avail Qty | Resv Qty | On Hand | Invariant ($\text{On Hand} = \text{Avail} + \text{Resv}$) | DB Tx Type | Ledger Change |
|---|---|---|---|---|---|---|---|---|---|
| **0** | Baseline | â€” | â€” | 102 | 0 | 102 | $102 = 102 + 0$ | â€” | â€” |
| **A** | Receive +5 | `manager` | â€” | 107 | 0 | 107 | $107 = 107 + 0$ | `IN` | +5 |
| **B** | Purchase 2 | `customer` | 21 | 105 | 2 | 107 | $107 = 105 + 2$ | `RESERVE` | 0 |
| **E** | Confirm Order | `manager` | 21 | 105 | 0 | 105 | $105 = 105 + 0$ | `OUT` | -2 |
| **G** | Return 1 | `manager` | 21 | 106 | 0 | 106 | $106 = 106 + 0$ | `RETURN` | +1 |
| **H** | Place Order | `customer` | 22 | 105 | 1 | 106 | $106 = 105 + 1$ | `RESERVE` | 0 |
| **I** | Cancel Order | `customer` | 22 | 106 | 0 | 106 | $106 = 106 + 0$ | `CANCEL_RESERVATION` | 0 |

---

## 5. Automated Unit & Integration Tests

### Backend Test Suite (Vitest)
- **Total Test Files**: 8 passed of 8
- **Total Tests**: 87 passed of 87 (0 failed, 0 skipped)
- **Suites**:
  - `tests/auth.test.js`: 13 tests (login, token verification, bcrypt hashing, role enforcement)
  - `tests/inventory-operations.test.js`: 20 tests (intake, reservations, fulfillment, cancellation, returns, audit)
  - `tests/products.test.js`: 28 tests (catalogue queries, price validation, error mapping, P2 boundary fallback)
  - `tests/product-db.test.js`: 7 tests (raw PostgreSQL operations)
  - `tests/server.test.js`: 5 tests (request ID preservation, 404 handler, JSON error formatting)
  - `tests/pool.test.js`: 5 tests (connection pooling and health)
  - `tests/p1-product-adapter.test.js`: 7 tests (adapter data contracts)
  - `tests/initial-users.test.js`: 2 tests (user validation)

### Frontend Test Suite (Node.js test runner)
- **Total Tests**: 22 passed of 22 (0 failed)
- **Suites**:
  - `tests/auth-session.test.js`: 4 tests (session storage, tab clearing, session validation)
  - `tests/customer-shop.test.js`: 4 tests (cart calculations, checkout payload, cancellation)
  - `tests/demo-state.test.js`: 7 tests (state formulas and invariants)
  - `tests/products-api.test.js`: 7 tests (network error mapping, authorization headers, queries)

---

## 6. Render Deployment Blueprint (`render.yaml`)

The repository includes a ready-to-deploy Render Blueprint specification (`render.yaml`) configured as follows:

```yaml
services:
  - type: web
    name: tbims-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health
    plan: free
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: AUTH_TOKEN_SECRET
        generateValue: true
      - key: AUTH_USERS
        sync: false

  - type: web
    name: tbims-frontend
    runtime: static
    rootDir: frontend
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    plan: free
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_BASE_URL
        fromService:
          type: web
          name: tbims-backend
          property: host
```

---

## 7. End-to-End Live Browser UI Verification

The built-in webview browser verified the live application running on `http://127.0.0.1:5173`:

1. **Sign-in Interface**: Clean professional login form containing only Username, Password, and Sign-in button. No role selector, demo banners, or hardcoded passwords.
2. **Customer Purchase & Cancellation Workflow**:
   - Customer authenticated and redirected to `#shop`. All 4,070 products rendered directly from PostgreSQL.
   - Added `85123A` ("White hanging heart") to cart, navigated to `#cart`, and completed checkout.
   - Order **`ORD-2026-023`** created with status `PENDING` and persistent reservation.
   - Cancelled order from `#orders` ("My Orders"); verified modal confirmation, status updated to `CANCELLED`, and stock reservation released immediately.
3. **Manager Operational Workflow**:
   - Manager authenticated (`manager`), TopBar displayed `"Neon Connected (inventory_db)"` with green `"Live Mode"` status indicator.
   - Executed live stock intake in `#intake` for +5 units of `85123A` with reference `BROWSER-UI-TEST`. Success banner verified new stock: On-hand: **111**, Available: **111**.
   - Verified live orders list in `#orders` (`ORD-2026-023`, `ORD-2026-022`, `ORD-2026-021`, etc.).
   - Verified confirmed orders dropdown in `#returns` containing confirmed Order `21`.
   - Verified `#reports` analytics dynamically computing real catalogue metrics without simulated data.
   - Verified browser reload (`page.reload`) maintains session and Live Database Mode seamlessly.
