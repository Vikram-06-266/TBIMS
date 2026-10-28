# Engine Contract (shared source of truth)

Do not change this file silently. Propose changes in the team chat or a GitHub issue and update the contract with team agreement.

## System shape
- One React frontend.
- One Express backend.
- One PostgreSQL database.
- Four logical engines, not four independent applications/services.

## Ownership
- P1 DBMS: schema, constraints, transactions, row locking, idempotency, stock ledger.
- P2 DSA: search, filters, low-stock prioritization, algorithms and benchmarks.
- P3 OS: concurrency/load-test harness, race-condition experiments in isolated test fixtures, latency/throughput measurements, invariant verification.
- P4 WT+SE: frontend, routes, middleware, API integration, roles, integration tests and docs.

## Stock definitions
- `on_hand`: physical quantity recorded by the application.
- `reserved`: units held for pending orders.
- `available = on_hand - reserved`.
- Invariants: `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`.

## Required operation rules
1. Reservation availability check and reservation write must be atomic.
2. Use row locking or a safe conditional update. Do not rely on an unprotected read-then-write in JavaScript.
3. Idempotency key must prevent duplicate processing of a retried stock-changing request.
4. Sale confirmation consumes a valid reservation exactly once.
5. Cancellation releases a reservation exactly once.
6. Returns reference an original sale and cannot exceed the unreturned quantity sold.
7. Each committed stock movement has a matching ledger event in the same transaction.
8. Ledger history is append-only for normal application users. Correct mistakes with compensating events.
9. Failed attempts may be written to audit history after the business transaction rolls back.
10. Database is the authoritative stock source; frontend and in-memory structures cannot independently update stock.

## API conventions
- JSON request and response bodies.
- Validate input at the API boundary.
- Stock-changing requests include an idempotency key or unique request ID.
- Return stable error codes; do not expose stack traces or secrets.
- Example error shape:
  `{ "ok": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "Not enough available stock." }, "requestId": "..." }`
- Successful response shape should be documented in `docs/API.md` before implementation.

## Initial endpoint proposal
- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- `POST /api/stock/receive`
- `POST /api/orders`
- `POST /api/orders/:id/reserve`
- `POST /api/orders/:id/confirm`
- `POST /api/orders/:id/cancel`
- `POST /api/stock/returns`
- `GET /api/ledger`
- `GET /api/audit`
- `GET /api/kpis`
- `POST /api/test/concurrency` (development/admin only, or keep the test harness outside the app)

P4 and P1 must finalize exact request/response bodies before the routes are implemented.

## Acceptance criteria
- No overselling in a controlled simultaneous-reservation test.
- Stock invariants remain true.
- Failed operations do not leave partial stock updates.
- Repeated idempotency key does not duplicate a stock movement.
- Ledger matches committed stock movements.
- Tests and KPI values come from actual runs.
