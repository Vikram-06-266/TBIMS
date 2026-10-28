# Transaction-Based Retail Inventory Management System
## Starter repository + step-by-step team guide

This ZIP is the **common starting point** for all four team members. It gives you the shared folder structure, common rules, API/database contracts, and individual AI prompts. It is not the finished application yet.

**Project stack:** React + Vite, Node.js + Express, PostgreSQL, Git + GitHub  
**Engine ownership:** P1 = DBMS, P2 = DSA, P3 = OS, P4 = WT+SE  
**Suggested timeline:** 6 weeks. Build and test one small milestone at a time.

---

# 0. How to use this ZIP

1. One person (preferably P4, the integration lead) creates a **private GitHub repository**.
2. Extract this ZIP on the integration lead's computer.
3. Copy the ZIP's contents into the new repository folder. Do not create a nested `transaction-inventory-starter/transaction-inventory-starter/` folder.
4. Commit and push the starter structure.
5. Invite the other three members to the repository.
6. Every member clones the same repository and creates their own branch.
7. Everyone reads this README and `docs/ENGINE_CONTRACT.md` before asking AI to write code.
8. Use the shared AI prompt first, then that member's milestone prompt. **Do not ask AI to build the entire engine in one request.**
9. After each milestone: inspect the changes, run the commands/tests, fix failures, commit only verified work, and push the branch.
10. Merge through GitHub Pull Requests. Do not copy-paste whole folders between computers.

## What this starter includes

- Common folders for frontend, backend, database, scripts, and documentation
- Shared engine boundaries and API contract
- `.env.example`, `.gitignore`, and a sample Express health-check server
- Individual work plans and AI prompts for P1, P2, P3, and P4
- Commands and acceptance checks for each milestone

## What is intentionally not complete

- The business API endpoints
- Database migrations and full schema
- Login/authentication
- Stock reservation implementation
- React dashboard
- Load-test harness and KPI calculation

These are tasks for your team to implement and test. Do not present the starter as a finished project.

---

# 1. Install tools (all members)

Install:
- Node.js LTS (Node 20+ recommended): https://nodejs.org/
- Git: https://git-scm.com/downloads
- VS Code: https://code.visualstudio.com/
- PostgreSQL: https://www.postgresql.org/download/
- GitHub account: https://github.com/

Open PowerShell in VS Code and verify:

```powershell
node --version
npm --version
git --version
psql --version
```

If `psql` is not recognized on Windows, use SQL Shell (psql) or pgAdmin, or add PostgreSQL's `bin` directory to PATH.

---

# 2. Project purpose and core behaviour

The system manages products, stock, orders, reservations, returns, and an auditable history of stock changes.

Core stock definitions:
- `on_hand`: physical quantity recorded in the system
- `reserved`: quantity held for pending orders
- `available = on_hand - reserved`

Important rules:
1. A reservation must not exceed available stock.
2. The check and stock update must happen atomically in PostgreSQL.
3. The same idempotency key must not create duplicate stock movement.
4. A cancellation releases a reservation only once.
5. A return must refer to a valid original sale and cannot return more units than were sold.
6. Every committed stock-changing operation has a matching ledger record.
7. Normal application code must not edit/delete historical ledger entries; corrections use new compensating events.
8. The database is the source of truth for stock. Frontend values and in-memory DSA structures are not authoritative.
9. Record failed attempts in audit events without losing the record when the stock transaction rolls back.
10. KPI values must be measured from real test runs, never invented.

## Proposed unique feature: StockGuard

StockGuard combines:
- concurrency-safe stock reservation,
- append-only stock ledger,
- automatic consistency checks,
- explainable rule-based anomaly alerts.

Do not claim that no other product has these features. The project's defensible contribution is to combine them in a small prototype and evaluate correctness, audit completeness, and performance under repeatable tests.

---

# 3. Four people: ownership and boundaries

## P1 — DBMS / Database and Transaction Engine
Owns:
- `database/migrations/`, `database/seeds/`, `database/tests/`
- `backend/src/engines/dbms/`
- PostgreSQL schema, constraints, indexes, transaction operations, row locking, idempotency, stock ledger
- Tests for reserve, confirm sale, cancel, returns, rollback and concurrent updates

Does not own:
- React UI
- DSA priority queue implementation
- Load-test orchestration (P3 owns the test harness)

## P2 — DSA / Inventory Data Structures Engine
Owns:
- `backend/src/engines/dsa/`
- Search, filtering, low-stock detection, min-heap/priority queue, algorithm benchmarks
- Unit tests for algorithms and data structures

Does not own:
- Authoritative stock updates
- SQL schema/locking
- React pages

## P3 — OS / Concurrent Access Control Engine
Owns:
- `backend/src/engines/os/`
- `scripts/load-test.js` and concurrency test support
- Reproducible simultaneous-request experiments, bounded test concurrency, result collection, p50/p95 latency, throughput, invariant checks

Does not own:
- Production stock transaction logic (P1 owns it)
- React pages
- Database schema changes without P1 agreement

## P4 — WT+SE / Web and Software Engineering + Integration Lead
Owns:
- `frontend/`
- `backend/src/routes/`, `backend/src/middleware/`, `backend/src/services/`, `backend/src/engines/wtse/`
- API integration, validation, authentication/roles, error handling, dashboard, integration tests and docs
- GitHub repository, integration and final demo

Does not own:
- Rewriting other people's engine code
- Moving stock updates into frontend code
- Hardcoding successful responses or fake KPI values

## Shared files: ask before editing
- `README.md`
- `docs/ENGINE_CONTRACT.md`
- `docs/API.md`
- `.env.example`
- `backend/package.json`
- Root project scripts / dependencies

Make a GitHub issue or message the team before changing shared contracts.

---

# 4. Shared AI prompt (EVERY member uses this first)

Copy this prompt into your AI coding assistant before the member-specific prompt:

```text
We are building a Transaction-Based Retail Inventory and Order Management System with Concurrent Stock Reservation and Audit Tracking.

Stack: React + Vite, Node.js + Express, PostgreSQL. We are beginners and need simple English, step-by-step guidance, exact file paths, and exact commands.

Team ownership:
- P1 DBMS: schema, constraints, ACID transactions, row locking, idempotency, append-only stock ledger.
- P2 DSA: product search, filtering, low-stock prioritization, min-heap/priority queue, benchmarks.
- P3 OS: concurrency test harness, simultaneous request tests, race-condition reproduction in a disposable test-only baseline, latency/throughput measurement, stock invariant verification.
- P4 WT+SE: React UI, API routes/integration, validation, roles, error handling, integration tests, documentation; P4 is integration lead.

There is one repository, one Express backend, one React frontend, and one PostgreSQL database. Do not create a second application, database, or package structure. Read README.md and docs/ENGINE_CONTRACT.md before editing.

Respect the ownership boundaries. Do not modify another person's files unless the team agrees. Do not change the API or database contract silently.

Work ONE MILESTONE AT A TIME. For each milestone:
1. Inspect the current repository and report relevant existing files.
2. Explain the goal in simple English.
3. List exact files you plan to create/change.
4. Implement only that milestone.
5. Give exact commands to run.
6. Run or help me run tests and explain expected results.
7. Fix failures before moving on.
8. Summarize changed files and remaining work.

Do not claim tests passed unless they were actually run. Do not invent KPI results. Do not hardcode fake API success or fake stock values. Ask a short question if a required contract is missing instead of guessing.
```

---

# 5. P4: first create the common repository

P4 is the integration lead. P4 should do this before the others start major coding.

## P4 setup milestone 1 — make the repository

1. Create a private GitHub repo called `transaction-inventory-system`.
2. Extract this starter ZIP.
3. Copy its contents into the repo folder.
4. Open the folder in VS Code.
5. In PowerShell, run:

```powershell
git init
git add .
git commit -m "chore: add shared project starter"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/transaction-inventory-system.git
git push -u origin main
```

If you cloned an already-created repository, do not run `git init` or add the remote again; just copy the files and commit/push.

Invite all members in GitHub repository Settings > Collaborators.

## Every other member: clone and create your branch

Run once on each person's computer:

```powershell
git clone https://github.com/YOUR_USERNAME/transaction-inventory-system.git
cd transaction-inventory-system
git switch -c p1/dbms-engine
```

Use your own branch name:
- P1: `p1/dbms-engine`
- P2: `p2/dsa-engine`
- P3: `p3/os-concurrency`
- P4: `p4/web-integration`

After the branch exists, do not rerun `git switch -c`; use `git switch YOUR_BRANCH` when returning to it.

---

# 6. Common app setup (P4 does this, others verify it)

Run from the repository root.

## Milestone C1 — create React app

Because `frontend/` already exists in this starter, do not run Vite directly into the non-empty directory without checking. Either:
- keep the starter `frontend/` folder, move its placeholder contents temporarily, then run Vite in `frontend/`; or
- easiest for a beginner: rename the empty placeholder folder to `frontend-starter-backup`, run Vite to create `frontend/`, and then copy back only any useful starter files.

Commands for the second method:

```powershell
Rename-Item frontend frontend-starter-backup
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install recharts
cd ..
```

Delete `frontend-starter-backup` only after checking it contains no needed work.

## Milestone C2 — create Express backend

The starter includes a sample server. From repository root:

```powershell
cd backend
npm init -y
npm install express pg cors dotenv zod
npm install -D nodemon vitest supertest
npm pkg set type=module
npm pkg set scripts.dev="nodemon src/server.js"
npm pkg set scripts.start="node src/server.js"
npm pkg set scripts.test="vitest run"
cd ..
```

If `backend/package.json` already has the correct dependencies/scripts, do not initialize it again; inspect it and install only missing packages.

## Milestone C3 — verify backend

```powershell
cd backend
npm run dev
```

Open `http://localhost:4000/api/health`. Expected: JSON with `"status":"ok"`. Stop with Ctrl+C.

## Milestone C4 — database

Open pgAdmin or SQL Shell (psql) and run:

```sql
CREATE DATABASE inventory_db;
```

Create a local `backend/.env` file (never commit it):

```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/inventory_db
NODE_ENV=development
```

Use your actual local PostgreSQL username/password. Make sure `.env` is ignored by Git.

P4 then asks P1 to implement the schema and connection test. All members use the same local schema design; they can each have a local database named `inventory_db` on their own machine.

---

# 7. P1 individual plan: DBMS

Use the shared AI prompt first. Then send only the current milestone prompt below. Do not paste all milestones at once.

## P1 Milestone 1 — design the schema

Prompt:
```text
Implement ONLY the database schema design milestone. Read docs/ENGINE_CONTRACT.md. Propose tables for users, products, orders, order_items, reservations, stock_ledger and audit_events. Show primary keys, foreign keys, unique constraints, CHECK constraints, indexes, and relationships. Create SQL migration files under database/migrations/ and explain the schema. Do not implement API routes or UI yet. After creating the files, tell me exactly how to apply the migration and verify the tables.
```

Run/check:
- Use pgAdmin/psql to apply the migration as directed by the generated migration approach.
- Verify tables and constraints exist.
- Ask P4 to review names against `docs/API.md`.
- Commit only after the migration runs cleanly.

## P1 Milestone 2 — database connection

Prompt:
```text
Implement ONLY the PostgreSQL connection module inside backend/src/engines/dbms/. Use the existing DATABASE_URL environment variable and the pg package. Do not print passwords. Add a small connection test or health check. Do not create a new pool if a shared pool already exists. Give exact run commands and explain how to verify the connection.
```

Run:
```powershell
cd backend
npm install
npm run dev
```
Verify the server logs no connection errors and the database connection check succeeds. Do not expose credentials in logs.

## P1 Milestone 3 — safe stock reservation

Prompt:
```text
Implement ONLY the stock reservation database operation. Use a PostgreSQL transaction and row-level locking (for example SELECT ... FOR UPDATE) or a carefully designed conditional atomic update. Check availability inside the protected transaction. Update reservation/product state and append the ledger event atomically. Roll back all stock changes if any required write fails. Add an idempotency key so a repeated request cannot reserve twice. Do not build sale/cancel/return in this milestone. Add tests and show exact commands.
```

Run the migration, then:
```powershell
cd backend
npm test
```
Acceptance: enough stock reserves successfully; insufficient stock is rejected; no partial state remains after a failure; retrying the same idempotency key does not duplicate the reservation.

## P1 Milestone 4 — sale confirmation and cancellation

Prompt:
```text
Implement ONLY order confirmation and cancellation using the agreed contract. Confirmation must consume a valid reservation exactly once. Cancellation must release a reservation exactly once. Keep order status, product quantities, reservation state and ledger writes consistent within transactions. Handle duplicate requests safely. Add tests for normal operation, duplicate confirmation, duplicate cancellation and invalid state transitions.
```

Run:
```powershell
cd backend
npm test
```
Inspect final product quantities and ledger rows in PostgreSQL.

## P1 Milestone 5 — returns and consistency checks

Prompt:
```text
Implement ONLY returns and a database consistency-check query. A return must reference a valid original sale and cannot exceed the quantity sold minus prior accepted returns. Use a transaction and append a compensating stock-ledger event. Add tests for valid return, over-return, duplicate return request and rollback. Explain what each check proves and what it cannot prove.
```

Run all P1 tests:
```powershell
cd backend
npm test
```
Then open a Pull Request. P4 must review it before merging.

---

# 8. P2 individual plan: DSA

Use the shared AI prompt first. P2 must not change the database's authoritative stock or write a second inventory backend.

## P2 Milestone 1 — agree on product shape and basic search

Prompt:
```text
Implement ONLY a DSA product search module under backend/src/engines/dsa/. First inspect the actual product model/API contract. Search by exact SKU and by product name, and filter by category/low-stock status. Do not create a second data source or hardcode product data. Add unit tests and document the exported function signatures so P4 can call them.
```

Run:
```powershell
cd backend
npm test
```
If no tests are configured for this module yet, ask AI to add tests using the existing Vitest setup, then run them.

## P2 Milestone 2 — low-stock priority queue

Prompt:
```text
Implement ONLY a min-heap or priority queue for products requiring restocking. Define a clear priority rule using existing fields such as available quantity and reorder threshold. Do not modify stock quantities. Handle empty queues and equal priorities. Add unit tests and explain the time complexity of insertion and removal.
```

Run:
```powershell
cd backend
npm test
```
Acceptance: the most urgent product is returned first according to the documented rule.

## P2 Milestone 3 — connect real product data

Prompt:
```text
Connect the DSA functions to the existing shared service/API using the actual product data. Do not add fake fallback values. Keep database writes in P1's DBMS module. Add tests for no products, unknown SKU and normal results. Coordinate with P4 before changing any API shape.
```

Run backend tests and manually call the product list/search endpoint once it exists.

## P2 Milestone 4 — benchmark

Prompt:
```text
Add a repeatable benchmark comparing the baseline search approach with the chosen optimized approach at several dataset sizes. Use the same generated or imported test inputs for both. Measure actual execution time and output results to a CSV or JSON file. Do not invent results and do not claim the optimized method is faster unless the measurements show that.
```

Run the exact command provided by the generated benchmark script. Save raw results in a documented results folder, and explain data size, repetitions and limitations. Open a Pull Request after tests pass.

---

# 9. P3 individual plan: OS / Concurrent Access Control

P3 evaluates the shared database protection. P3 does not replace P1's production transaction code.

## P3 Milestone 1 — test plan and small concurrent test

Prompt:
```text
Implement ONLY the first concurrency test plan. Inspect the real API and P1's reservation operation. Write a test that creates/reset a disposable test product with one available unit and sends two simultaneous reservation requests. Record status codes and verify final stock/reservation/ledger state. Do not change production transaction logic. Give exact setup and run commands.
```

Run the test command from the generated test setup. Expected: no more than one reservation succeeds for one available unit. If both succeed, stop and report the failure to P1.

## P3 Milestone 2 — load-test harness

Prompt:
```text
Implement ONLY a configurable load-test harness under scripts/load-test.js. It should accept base URL, product ID, starting stock fixture, request count and concurrency limit. Send simultaneous requests to the real shared API. Collect request outcome, elapsed time and latency. Use a disposable test database or a resettable fixture, never live data. Do not create an unsafe production route.
```

Run the script with a small request count first, then increase it. Ensure the product is reset to known stock before every run.

## P3 Milestone 3 — invariant and KPI calculation

Prompt:
```text
Implement ONLY the test result verifier and KPI calculation. Check successful reserved units do not exceed initial available stock; final stock constraints hold; committed stock movements match ledger entries; duplicate idempotency keys do not duplicate movements. Calculate throughput, p50 and p95 latency from actual measurements. Save raw results and a summary. Do not fake values or treat rejected invalid requests as server failures.
```

Run repeated tests at concurrency levels such as 1, 5, 10, 25 and 50. Record the environment and number of repetitions.

## P3 Milestone 4 — controlled baseline comparison

Prompt:
```text
Implement an isolated, clearly labelled, test-only unsafe baseline to demonstrate a race condition if reproducible. Use a disposable test fixture or separate test module. Never wire it into the normal production reservation endpoint. Run the same workload against baseline and protected implementation, compare results fairly, and report if the baseline does not reproduce the issue.
```

P3 must document limitations and open a Pull Request. Never claim the system is fully race-free solely because a few tests pass.

---

# 10. P4 individual plan: WT+SE and integration

P4 should establish the common setup first (Section 6), then implement the UI and routes in small milestones.

## P4 Milestone 1 — API skeleton and error format

Prompt:
```text
Implement ONLY the Express API skeleton. Inspect the current server and package setup. Add central error handling, request ID support and a consistent JSON error format. Keep /api/health working. Do not implement stock business logic directly in routes; routes should call engine/service functions. Add a basic test for the health endpoint and one invalid request.
```

Run:
```powershell
cd backend
npm test
npm run dev
```

## P4 Milestone 2 — inventory/product endpoints

Prompt:
```text
Implement ONLY the product list/search and product creation endpoints using the agreed API contract and P1's DBMS functions. Validate input with the existing validation library. Use real database data, proper status codes and clear errors. Do not add order endpoints or UI in this milestone. Add route tests.
```

Run backend tests, start the server, and verify endpoints with the VS Code REST Client, Postman, or curl.

## P4 Milestone 3 — order endpoints

Prompt:
```text
Implement ONLY the order/reservation/confirm/cancel/return routes by calling P1's existing functions. Do not duplicate SQL stock updates in routes. Validate quantities, request IDs and user permissions. Return a stable response shape documented in docs/API.md. Add integration tests for success and failure paths.
```

Run backend tests and verify each route against a resettable test database.

## P4 Milestone 4 — React dashboard

Prompt:
```text
Implement ONLY the first React dashboard milestone. Connect to the real backend and display products with on-hand, reserved and available stock. Add loading, empty and error states. Do not hardcode sample inventory or pretend an API call succeeded. Keep components small and use frontend/src/services/ for API calls. Give exact frontend run commands.
```

Run:
```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Verify the product values change when database data changes.

## P4 Milestone 5 — orders, ledger and KPI pages

Prompt:
```text
Add ONLY the order actions and transaction history screen. Support reserve, confirm, cancel and return using the existing API. Then add a separate KPI screen that displays real results returned by the backend/test reports. Show loading and error states. Do not fabricate KPI values. Add tests for the main user flow and document the demo.
```

Run frontend tests if configured, backend tests, and perform the end-to-end flow in Section 13.

## P4 Milestone 6 — authentication/roles and final integration

Prompt:
```text
Review the complete app against README.md and docs/ENGINE_CONTRACT.md. Implement or verify authentication and role-based authorization using a secure established approach. Do not rely on hiding UI buttons for security; enforce authorization on the backend. Run all tests, identify missing acceptance criteria, and prepare a clean setup guide and demo checklist. Do not refactor unrelated engine code or claim unrun tests passed.
```

All members review the final app before the final demo.

---

# 11. Git workflow: every member follows this after EACH milestone

Check your current branch first:

```powershell
git status
git branch --show-current
```

Run the relevant tests before committing. Then:

```powershell
git add .
git commit -m "feat: describe the completed milestone"
git push -u origin YOUR_BRANCH_NAME
```

For later pushes to the same branch, `git push` is enough.

Then:
1. Open a Pull Request in GitHub targeting `main`.
2. Explain the files changed and tests run.
3. Ask another member to review it.
4. Fix test failures and review comments.
5. P4 merges only after the branch is compatible with the shared contract.

Do not run `git add .` blindly if unrelated or secret files may be present. Always inspect `git status` first. Never commit `.env`.

To update a branch with current main, use the team's agreed method. A simple approach is to merge `main` into your branch after committing/stashing your work:
```powershell
git fetch origin
git merge origin/main
```
Resolve conflicts carefully, run tests again, and then push.

---

# 12. Common run commands

Run each command from the correct directory.

## Backend
```powershell
cd backend
npm install
npm run dev
```

Tests:
```powershell
cd backend
npm test
```

## Frontend
```powershell
cd frontend
npm install
npm run dev
```

## Database
Use pgAdmin or psql to create the database and apply migrations. Use the exact migration runner or command the team chooses and documents; do not manually apply migrations twice.

## Load tests
Run the exact command documented by P3 after the harness exists. Always use a disposable/resettable test dataset.

---

# 13. End-to-end acceptance test

Before the mentor demo, run this sequence using the UI and verify the database after each step:

1. Add a product with on-hand stock = 10 and reserved = 0.
2. Verify available stock = 10.
3. Reserve 3 units for an order. Verify reserved = 3 and available = 7.
4. Cancel that order. Verify reserved returns to 0 and available returns to 10.
5. Create two simultaneous requests for the final available unit in a separate test fixture. At most one may succeed.
6. Confirm a valid reservation as a sale. Verify on-hand stock decreases and the reservation is consumed once.
7. Retry the same idempotency key. Verify no duplicate stock movement occurs.
8. Try to return more units than were sold. The system must reject it.
9. Open the ledger and audit screen. Verify the committed operations are traceable.
10. Run the KPI script and save the raw output and summary.

A failure is useful evidence: record it, fix the cause, and repeat the test. Do not hide failed runs.

---

# 14. KPI definitions

Define these in `docs/KPI.md` and calculate them from real runs.

- **Overselling violations:** successful reserved units must not exceed initial available units in a controlled test with no replenishment/release during the run.
- **Stock invariant violations:** count products where `on_hand < 0`, `reserved < 0`, or `reserved > on_hand`. Target 0.
- **Ledger completeness:** committed stock-changing operations with matching ledger records divided by all committed stock-changing operations. Target 100% for the defined test scope.
- **Idempotency failures:** repeated idempotency keys that create extra stock movements. Target 0.
- **Success rate:** successful valid requests divided by all valid requests. Report rejected out-of-stock requests separately from unexpected server errors.
- **Latency:** p50 and p95 request duration under a documented workload.
- **Throughput:** completed requests divided by elapsed seconds.
- **Search benchmark:** compare baseline and optimized algorithm with identical inputs and repetitions.
- **Audit traceability:** operations with actor, request ID, timestamp and outcome divided by all operations in the defined audit scope.

These are prototype acceptance goals, not pre-existing results. Record hardware, database version, data size, concurrency level and repetitions.

---

# 15. Suggested six-week schedule

- Week 1: common setup, API/database contract, health endpoint, schema.
- Week 2: inventory operations, reservations and ledger.
- Week 3: DSA functions and concurrency harness.
- Week 4: React integration and order workflows.
- Week 5: roles, audit checks, KPI calculation and repeatable tests.
- Week 6: final integration, diagrams, documentation and mentor demo.

Prioritize a working reservation transaction and concurrency test over decorative UI or a complex AI model. Add the optional anomaly assistant only after the core system is correct.

---

# 16. Final demo checklist

- [ ] Every member can explain their engine and its boundary.
- [ ] The frontend uses real API/database values.
- [ ] Reservation, confirmation, cancellation and return flows work.
- [ ] Concurrent requests do not oversell stock in repeatable tests.
- [ ] Ledger records match committed stock movements.
- [ ] Duplicate requests do not duplicate stock movements.
- [ ] KPI report contains measured values and raw test output.
- [ ] No secrets are committed.
- [ ] README commands work from a clean clone.
- [ ] Limitations and future improvements are stated honestly.

**Final rule:** AI writes code; your team verifies it. A file existing is not proof that a feature works. A passing test, inspected database state, and repeatable demo are the evidence.
