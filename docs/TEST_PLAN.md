# Test plan

## Unit tests
- DSA search: exact SKU, partial name, empty inventory, unknown SKU, category filters.
- DSA priority queue: empty queue, equal priorities, ordering, repeated entries.
- DBMS operations: reserve success, insufficient stock, rollback, idempotency, confirm, cancel, returns.
- API validation: missing fields, invalid quantity, unknown IDs, permission denied.

## Integration tests
- Product create/list/search uses PostgreSQL.
- Order reserve/confirm/cancel uses DBMS functions.
- Ledger records match committed stock movements.
- UI reflects API state, including errors.

## Concurrency tests
1. Reset a disposable product fixture to a known stock quantity.
2. Start N requests at the same time through the actual API.
3. Wait for all responses.
4. Query final database state.
5. Check stock invariants and ledger consistency.
6. Save raw results.
7. Reset fixture before the next run.

Use a disposable test database, not production or a shared database containing important data.
