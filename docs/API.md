# API Contract (proposal — finalize before implementation)

This document is a shared proposal. P1 and P4 should agree on request/response fields before implementation.

## General conventions
- Base URL locally: `http://localhost:4000`
- JSON bodies.
- Stock-changing calls should include `Idempotency-Key` header or a documented request ID.
- Use ISO 8601 timestamps.
- Return appropriate HTTP status codes and a stable error shape.
- Do not expose database credentials or internal stack traces.

## Proposed endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend is running |
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

The API may return `available` as a calculated field; it should not be independently edited.
