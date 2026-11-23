# API Contract

Product list/search and creation routes implement the validation and response
shape below. Their default P1/P2 adapters are intentionally unconnected in the
current P4 branch, so data requests return `503` until the agreed team
operations are integrated. This does not claim PostgreSQL integration. Other
endpoints in this document remain proposals.

## General conventions
- Base URL locally: `http://localhost:4000`
- JSON bodies.
- Except for health and sign-in, API calls require `Authorization: Bearer <token>`.
- Product listing is available to `owner`, `admin`, `inventoryManager`, and `staff`; customers cannot access internal product data.
- Product creation is limited to `owner`, `admin`, and `inventoryManager`.
- Stock-changing calls should include `Idempotency-Key` header or a documented request ID.
- Use ISO 8601 timestamps.
- Return appropriate HTTP status codes and a stable error shape.
- Do not expose database credentials or internal stack traces.

## Endpoint roadmap

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend is running |
| POST | `/api/auth/login` | Exchange configured credentials for a short-lived access token |
| GET | `/api/auth/me` | Return the authenticated user and role |
| POST | `/api/auth/logout` | Revoke the current bearer session |
| GET | `/api/products` | List/search products |
| POST | `/api/products` | Create product |
| POST | `/api/stock/receive` | Record incoming stock |
| POST | `/api/orders` | Create order |
| POST | `/api/orders/:id/reserve` | Reserve stock |
| POST | `/api/orders/:id/confirm` | Confirm sale |
| POST | `/api/orders/:id/cancel` | Cancel order/release reservation |
| POST | `/api/stock/returns` | Record return |
| GET | `/api/ledger` | Read stock movement ledger |
| GET | `/api/audit` | Read audit events |
| GET | `/api/kpis` | Return measured KPI data |

Do not implement a public load-test endpoint. P3 can run a separate script against the normal reservation endpoint.

The login body is `{ "username": "...", "password": "..." }`. A successful
response includes `{ "token": "...", "user": { "username": "...", "role":
"owner|admin|inventoryManager|staff|customer" } }` under `data`. Tokens expire
after 30 minutes. The browser stores a token in tab-scoped `sessionStorage`,
checks it with `GET /api/auth/me` after reload, and revokes it through
`POST /api/auth/logout` when signing out. Accounts are provisioned locally by
the administrator with `npm run auth:seed` in `backend`; only scrypt hashes
are stored in the ignored `backend/.env`. No user-management API or
built-in/demo credentials are provided.

The current checkout has no approved P1 user repository or users table
contract, so account provisioning does not modify P1 SQL. User/role
administration, customer profile, order, and reservation APIs are not
implemented. Owner/admin privileges apply only to currently supported API
operations; they do not imply access to nonexistent endpoints.

## Error response proposal

```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough available stock."
  },
  "requestId": "client-or-server-generated-id"
}
```

## Product fields proposal
- `id`: database ID
- `sku`: unique stock keeping unit
- `name`: product name
- `category`: optional category
- `unit_price`: non-negative price
- `on_hand`: non-negative integer
- `reserved`: non-negative integer, no greater than `on_hand`
- `available`: derived as `on_hand - reserved`

The API returns `available` as a calculated field; it is not independently
stored or edited.

## Product endpoint contract (adapters pending)

### `GET /api/products`

When integrated, returns P1 product rows ordered by `id`. The current default
runtime has no P1 adapter and returns `503 PRODUCT_DATA_UNAVAILABLE`. The
optional query parameters are:

| Parameter | Behavior |
|---|---|
| `sku` | Exact, case-sensitive SKU match. |
| `name` | Case-insensitive substring match. |
| `category` | Exact, case-insensitive category match. |
| `lowStock` | Accepted only as `true` or `false`, but currently returns `501 LOW_STOCK_FILTER_UNAVAILABLE` because no threshold is defined. |

Multiple filters are combined with AND. Text filters are trimmed and cannot
be empty. Unknown parameters are rejected. An unfiltered or empty result is
`200 OK` with `data.products` set to an array.

### `POST /api/products`

Accepts a JSON object with required non-empty `sku`, `name`, and
`unit_price`, and optional `category` (a non-empty string or `null`). Text
fields are trimmed. `unit_price` may be a non-negative number or decimal
string with at most two fractional digits and at most ten integer digits.
Unknown fields are rejected; clients cannot provide `id`, `on_hand`,
`reserved`, or `available`. The candidate schema defaults new products to zero
on-hand and reserved stock; product creation does not record a stock movement.
P1 must confirm this behavior before a production adapter is connected.

Successful listing response (`200 OK`):

```json
{
  "ok": true,
  "data": {
    "products": [
      {
        "id": 7,
        "sku": "SKU-001",
        "name": "Example product",
        "category": null,
        "unit_price": "12.50",
        "on_hand": 0,
        "reserved": 0,
        "available": 0
      }
    ]
  },
  "requestId": "server-generated-or-validated-id"
}
```

Successful creation response (`201 Created`) uses the same product fields
under `data.product`. The proposed contract uses PostgreSQL-generated integer
IDs and a decimal string for `unit_price`. Once integrated, P1 supplies product
rows and `available` is calculated from `on_hand - reserved`.

Invalid input returns `400 INVALID_PRODUCT_INPUT` or
`400 INVALID_PRODUCT_QUERY`. Duplicate SKU returns `409 DUPLICATE_SKU`.
Database connectivity failures return `503 PRODUCT_DATA_UNAVAILABLE`.
Unexpected failures return `500 INTERNAL_SERVER_ERROR`. Errors use the
standard error envelope above and never expose database details.
Authentication failures return `401`; insufficient role permission returns
`403`; missing authentication configuration returns `503 AUTH_UNAVAILABLE`.

The local candidate product schema is in
[`database/migrations/001_create_products.sql`](../database/migrations/001_create_products.sql).
It has not been applied to or verified against PostgreSQL. Product routes
return `503 PRODUCT_DATA_UNAVAILABLE` until P1 operations are attached; they
do not fall back to mock or local default database data.
