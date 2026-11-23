# P3 — OS & Concurrency Engine

The P3 OS engine provides concurrency testing, race condition evaluation, performance metrics collection, deadlock prevention analysis, and invariant verification for TBIMS (Transaction-Based Inventory Management System).

## 1. Operating Systems Concurrency Concepts in TBIMS

### The Critical Section Problem
In an inventory management system, reserving stock is a classic **Critical Section** comprising three non-atomic steps:
1. **Read**: Check whether `available_qty >= requested_qty`.
2. **Compute**: Calculate `available_qty - requested_qty` and `reserved_qty + requested_qty`.
3. **Write**: Update the persistent storage with the new values.

If two or more concurrent processes (e.g. web requests from different customers) execute this sequence simultaneously without synchronization, a **Time-of-Check to Time-of-Use (TOCTOU)** race condition occurs. Both processes read the same starting stock, both verify that sufficient stock exists, and both execute the decrement—resulting in **lost updates** and **inventory overselling**.

### Unsafe Baseline vs. Protected Execution

| Feature | Unsafe Baseline (`unsafe-baseline.js`) | Protected P1 Execution (`p1-operations.js`) |
|---|---|---|
| **Synchronization** | None (uncoordinated async calls) | PostgreSQL `SELECT ... FOR UPDATE` |
| **Mutual Exclusion** | Absent (concurrent interleaved access) | Enforced by PostgreSQL row-level locks |
| **Transaction Boundary** | Non-atomic | `BEGIN; ... COMMIT; / ROLLBACK;` |
| **Deadlock Prevention** | N/A | Deterministic `product_id ASC` ordering |
| **Stock Invariant** | Frequently violated (`oversell > 0`) | Guaranteed: `on_hand = available + reserved` |
| **Ledger Consistency** | None | Append-only audit trail in same transaction |

## 2. P1 Transaction Boundaries & Locking Architecture

P1 implements strict database-level serializability on affected rows using PostgreSQL row-level exclusive locks:
```sql
BEGIN;

-- 1. Sort all requested items by product_id ASC to prevent cyclic deadlocks
-- 2. Acquire exclusive row lock on the inventory companion table
SELECT available_qty, reserved_qty
FROM inventory
WHERE product_id = $1
FOR UPDATE;

-- 3. Atomic evaluation inside the transaction boundary
-- If available_qty < requested_qty: ROLLBACK and abort with INSUFFICIENT_STOCK
-- If available_qty >= requested_qty:
UPDATE inventory
SET available_qty = available_qty - $2,
    reserved_qty = reserved_qty + $2,
    updated_at = NOW()
WHERE product_id = $1;

-- 4. Create reservation and order line items
INSERT INTO reservations (order_id, product_id, quantity, reservation_status)
VALUES ($3, $1, $2, 'ACTIVE');

COMMIT;
```

When multiple concurrent workers attempt to reserve the same product:
1. The first worker acquires the row lock on `inventory`.
2. All competing workers block safely at the database lock queue.
3. The first worker modifies stock and commits, releasing the lock.
4. The next worker immediately reads the *committed, updated* stock. If remaining stock is insufficient, it aborts cleanly with a rollback.
5. Invariant `on_hand = available_qty + reserved_qty` is strictly preserved.

## 3. Module Index

- `fixture-manager.js`: Creates and cleans up isolated, disposable test fixtures (`P3-TEST-*`). Never touches production records.
- `unsafe-baseline.js`: Reproducible simulation of unprotected read-modify-write stock operations demonstrating overselling and race conditions using coordination barriers.
- `concurrency-harness.js`: Multi-worker load generator executing real concurrent reservations against P1's `reserveOrder`.
- `metrics-collector.js`: High-precision latency (p50, p95), throughput (req/sec), and invariant verification.
