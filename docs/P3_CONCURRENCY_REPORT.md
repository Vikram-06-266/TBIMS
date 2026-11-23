# TBIMS P3 — Operating Systems & Concurrency Engine Report

## 1. Executive Summary & Milestone Scorecard

| Milestone | Scope | Status | Evidence |
|---|---|---|---|
| **Milestone 1** | Fixture Manager, Unsafe Baseline & Critical Section Analysis | **PASS** | `fixture-manager.js`, `unsafe-baseline.js`, 15 oversold at C=20 in simulation |
| **Milestone 2** | Protected Concurrency Harness & Real P1 Integration | **PASS** | `concurrency-harness.js`, 0 overselling at C=2, 5, 10, 20 on real PostgreSQL |
| **Milestone 3** | High-Precision Metrics Collector & Comparative Benchmarking | **PASS** | `metrics-collector.js`, p50/p95 latency and RPS throughput calculated |
| **Milestone 4** | Deadlock Prevention, Atomic Rollback & Failure Recovery | **PASS** | `recovery-tester.js`, 0 deadlocks across inverted multi-item orders, clean rollback |
| **Milestone 5** | Vitest Automated Suite, Standalone CLI Runner & Handoff | **PASS** | `concurrency.test.js`, `run-concurrency-benchmark.js`, complete OS documentation |

---

## 2. Test Environment & System Specifications

- **Operating System**: Windows 11 (x64)
- **Runtime Environment**: Node.js v26.13.0
- **Database Engine**: PostgreSQL 16 on Neon Serverless (Database: `inventory_db`)
- **Isolation Mode**: Isolated Disposable Test Fixtures (`P3-TEST-*`)
- **Shared Baseline**: Git branch `p3/os-engine`

---

## 3. Operating Systems Concepts in TBIMS

### 3.1. Race Condition
A **Race Condition** occurs in a concurrent system when the correctness of the final state depends on the non-deterministic scheduling, timing, or interleaving of multiple concurrent processes or threads.
- In TBIMS, when two customers attempt to reserve the last available item simultaneously, an unprotected system allows both requests to interleave, resulting in **overselling** (selling more units than physically exist).

### 3.2. Critical Section
The **Critical Section** is a code segment that accesses a shared mutable resource (such as inventory stock) and must not be concurrently executed by more than one process.
- In TBIMS, the critical section comprises:
  1. **Time-of-Check (TOC)**: Reading `available_qty`.
  2. **Computation**: Verifying `available_qty >= requested_qty`.
  3. **Time-of-Use (TOU)**: Decrementing `available_qty` and incrementing `reserved_qty`.

### 3.3. Mutual Exclusion & Synchronization
**Mutual Exclusion** is the property that ensures only one process enters the critical section at any given time.
- TBIMS achieves mutual exclusion at the database layer using **PostgreSQL Row-Level Locks** via `SELECT ... FOR UPDATE`.
- In our test harness, **Synchronization Barriers (`Barrier`)** coordinate N asynchronous workers to fire at the exact same millisecond, eliminating timing jitter and ensuring reproducible concurrency stress.

### 3.4. Database Row-Level Locking (`SELECT ... FOR UPDATE`)
When a client executes:
```sql
SELECT available_qty, reserved_qty
FROM inventory
WHERE product_id = $1
FOR UPDATE;
```
PostgreSQL locks the specific row in the `inventory` table. Any subsequent concurrent transaction attempting to lock or update the same row is placed into a sleep queue until the holding transaction issues `COMMIT` or `ROLLBACK`.

### 3.5. PostgreSQL Transactions & Atomicity
An **Atomic Transaction** (`BEGIN; ... COMMIT;`) guarantees that a series of database operations either execute in their entirety or leave the system unchanged:
- If a customer places an order for 3 items, and stock is unavailable for the 3rd item, the entire transaction triggers a `ROLLBACK;`.
- Partial state mutations (such as reserving items 1 and 2 while failing on item 3) are completely prevented.

### 3.6. Deadlocks & Coffman Conditions
A **Deadlock** occurs when two or more transactions are permanently blocked because each holds a lock the other needs to proceed:
- *Example*: Transaction 1 holds a lock on Item A and requests Item B. Transaction 2 holds a lock on Item B and requests Item A.
- TBIMS prevents deadlocks by strictly eliminating the **Circular Wait (Coffman Condition #4)**: all multi-item orders are deterministically sorted by `product_id ASC` before row locks are acquired.

### 3.7. Idempotency & Recovery
An operation is **Idempotent** if applying it multiple times produces the identical outcome as applying it once. In network environments, client retries must never duplicate stock reservations or ledger entries.

---

## 4. Empirical Benchmark Results

### 4.1. Side-by-Side Comparison: Unsafe Baseline vs. Protected P1 Execution

All tests were performed with a fixed starting stock of **5 units** across varying concurrency levels:

| Concurrency Level | Starting Stock | Unsafe Sold | Unsafe Oversold | Unsafe Race Condition? | P1 Protected Sold | P1 Rejected (Out of Stock) | P1 Oversold | P1 Invariants OK? | P1 p50 Latency (ms) | P1 p95 Latency (ms) | Throughput (RPS) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **C = 2** | 5 units | 2 | 0 | NO | 2 | 0 | **0** | **PASS** | 1345.50 ms | 1345.50 ms | 1.49 req/s |
| **C = 5** | 5 units | 5 | 0 | NO | 5 | 0 | **0** | **PASS** | 1429.02 ms | 3539.72 ms | 1.41 req/s |
| **C = 10** | 5 units | 10 | **5** | **YES (VIOLATION)** | 5 | 5 | **0** | **PASS** | 3079.07 ms | 4442.99 ms | 2.25 req/s |
| **C = 20** | 5 units | 20 | **15** | **YES (VIOLATION)** | 5 | 15 | **0** | **PASS** | 3598.77 ms | 4247.67 ms | 4.71 req/s |

### 4.2. Invariant Verification
Across all concurrency levels, P1's real implementation satisfied all database invariants:
1. `oversellCount === 0` (Zero overselling).
2. `available_qty >= 0` (Non-negative available stock).
3. `reserved_qty >= 0` (Valid non-negative reservation).
4. `on_hand === available_qty + reserved_qty` (Physical stock conservation).

---

## 5. Multi-Item Deadlock & Failure Recovery Results

### 5.1. Multi-Item Deadlock Prevention
- **Test Setup**: 6 concurrent workers executing simultaneous orders with opposing item access orders:
  - Even workers requested `[Product A, Product B]`.
  - Odd workers requested `[Product B, Product A]`.
- **Observed Deadlocks**: **0** (`40P01` deadlocks detected = 0).
- **Result**: **PASS**. Both products' final stock invariants remained 100% consistent.

### 5.2. Atomic Rollback on Partial Multi-Item Failure
- **Test Setup**: Customer order requesting 2 units of Item A (5 available) and 1 unit of Item B (0 available).
- **Observation**:
  - Item B triggered `Insufficient available stock`.
  - Transaction aborted and executed `ROLLBACK;`.
  - Item A stock remained unchanged at **5 available, 0 reserved**.
  - Zero rogue reservations or orphaned order rows were created.
- **Result**: **PASS**.

### 5.3. Connection Pool & Transaction Failure Recovery
- **Test Setup**: Synthetic constraint error injected inside an open transaction.
- **Observation**: Transaction cleanly rolled back, releasing all held row locks. Subsequent valid transactions completed successfully. Database pool remained 100% healthy.
- **Result**: **PASS**.

---

## 6. How to Reproduce the Demonstration

### Step 1: Run Full Automated Concurrency Test Suite
```bash
npm run test:concurrency --prefix backend
```

### Step 2: Run Standalone CLI Benchmark Runner
```bash
npm run benchmark:concurrency --prefix backend
```

### Step 3: Run Full Backend Regression Suite
```bash
npm test --prefix backend
```
*(All 9 test suites and 95+ unit/integration/concurrency tests will execute and pass).*
