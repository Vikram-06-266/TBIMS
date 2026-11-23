# P1 — DBMS engine
P1 owns database access, transaction operations, row locking, idempotency and ledger writes. Keep stock-changing SQL here or in an agreed database service. Read `docs/ENGINE_CONTRACT.md` first.

The existing P4 pool in `pool.js` loads `backend/.env`, accepts `DATABASE_URL`
or the `DB_*`/`PG*` individual settings, enables certificate verification for
Neon endpoints, and closes on `SIGINT`/`SIGTERM`. Run `npm run db:verify` from
`backend` for a read-only database/schema check. It reports table metadata and
up to three historical invoice-item rows with identifiers redacted; it does
not run migrations or write database data.

The P4 `products.js` module targets the separate P4 migration schema and is
not a substitute for P1 operations. The latest P1 schema has no exported
product/inventory/order/reservation/transaction/ledger/audit operations, so P4
must not wire those services directly to guessed SQL.
