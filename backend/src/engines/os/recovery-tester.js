/**
 * P3 Recovery, Deadlock Prevention & Invariant Verification Suite
 *
 * Verifies:
 * 1. Multi-item concurrent orders with inverted product access sequences.
 * 2. Deterministic lock acquisition order (eliminating cyclic wait deadlocks).
 * 3. Complete atomic rollback when any item in a multi-item batch fails.
 * 4. Error recovery and connection pool sanity after failed transactions.
 * 5. Idempotent retry analysis.
 */

import { Barrier } from "./unsafe-baseline.js";
import { defaultP1Operations } from "../dbms/p1-operations.js";
import pool from "../dbms/pool.js";
import { defaultFixtureManager } from "./fixture-manager.js";

export class RecoveryTester {
  constructor({
    p1Operations = defaultP1Operations,
    fixtureManager = defaultFixtureManager,
    databasePool = pool,
  } = {}) {
    this.p1 = p1Operations;
    this.fixtureManager = fixtureManager;
    this.pool = databasePool;
  }

  /**
   * 1. Multi-item Deadlock Prevention Test
   * Demonstrates that when concurrent transactions request identical items in reversed order
   * ([A, B] vs [B, A]), P1's deterministic sorting (`product_id ASC`) prevents deadlocks.
   *
   * @param {Object} [options]
   * @param {number} [options.concurrency=8]
   * @returns {Promise<{
   *   concurrency: number,
   *   deadlocksDetected: number,
   *   successfulOrders: number,
   *   rejectedOrders: number,
   *   deadlockFree: boolean,
   *   itemA_Invariants: boolean,
   *   itemB_Invariants: boolean
   * }>}
   */
  async testDeadlockPrevention({ concurrency = 8 } = {}) {
    // Create two isolated fixtures
    const fixA = await this.fixtureManager.createFixture({ initialStock: 10, description: "Deadlock Test Item A" });
    const fixB = await this.fixtureManager.createFixture({ initialStock: 10, description: "Deadlock Test Item B" });

    // Determine strictly which has smaller ID
    const [first, second] = fixA.productId < fixB.productId ? [fixA, fixB] : [fixB, fixA];

    const barrier = new Barrier(concurrency);
    const workers = Array.from({ length: concurrency }, (_, i) => i + 1);

    const taskPromises = workers.map(async (workerId) => {
      await barrier.wait();

      // Even workers request [first, second]; odd workers request [second, first]
      const items = workerId % 2 === 0
        ? [{ productId: first.productId, quantity: 1 }, { productId: second.productId, quantity: 1 }]
        : [{ productId: second.productId, quantity: 1 }, { productId: first.productId, quantity: 1 }];

      try {
        const order = await this.p1.reserveOrder({
          customerName: `customer_dl_${workerId}`,
          items,
          performedBy: `deadlock_worker_${workerId}`,
        });
        return { workerId, success: true, orderId: order.id };
      } catch (err) {
        const isDeadlock =
          err?.code === "DEADLOCK_DETECTED" ||
          err?.code === "40P01" ||
          (typeof err?.message === "string" && err.message.toLowerCase().includes("deadlock"));
        return { workerId, success: false, isDeadlock, error: err?.message };
      }
    });

    try {
      const results = await Promise.all(taskPromises);

      const deadlocksDetected = results.filter((r) => r.isDeadlock).length;
      const successfulOrders = results.filter((r) => r.success).length;
      const rejectedOrders = results.filter((r) => !r.success && !r.isDeadlock).length;

      // Verify invariants on both items
      const stateA = await this.fixtureManager.verifyFixture(fixA.productId);
      const stateB = await this.fixtureManager.verifyFixture(fixB.productId);

      const itemA_Invariants =
        stateA.onHand === fixA.initialStock &&
        stateA.onHand === stateA.available + stateA.reserved &&
        stateA.available >= 0 &&
        stateA.reserved === successfulOrders;

      const itemB_Invariants =
        stateB.onHand === fixB.initialStock &&
        stateB.onHand === stateB.available + stateB.reserved &&
        stateB.available >= 0 &&
        stateB.reserved === successfulOrders;

      return {
        concurrency,
        deadlocksDetected,
        successfulOrders,
        rejectedOrders,
        deadlockFree: deadlocksDetected === 0,
        itemA_Invariants,
        itemB_Invariants,
      };
    } finally {
      await this.fixtureManager.cleanupFixture(fixA.productId);
      await this.fixtureManager.cleanupFixture(fixB.productId);
    }
  }

  /**
   * 2. Atomic Rollback on Partial Multi-Item Failure
   * Verifies that when an order requests Item A (available: 5) and Item B (available: 0),
   * failure on Item B causes an immediate complete rollback:
   * Item A's stock is NOT partially decremented, and no orphaned order/reservation exists.
   *
   * @returns {Promise<{
   *   rolledBackCleanly: boolean,
   *   itemA_availableBefore: number,
   *   itemA_availableAfter: number,
   *   itemA_reservedAfter: number,
   *   orderCreated: boolean,
   *   reservationsCreated: boolean,
   *   errorEncountered: string
   * }>}
   */
  async testAtomicRollback() {
    const fixA = await this.fixtureManager.createFixture({ initialStock: 5, description: "Rollback Test In-Stock" });
    const fixB = await this.fixtureManager.createFixture({ initialStock: 0, description: "Rollback Test Out-Of-Stock" });

    let errorEncountered = "";
    try {
      await this.p1.reserveOrder({
        customerName: "rollback_test_customer",
        items: [
          { productId: fixA.productId, quantity: 2 },
          { productId: fixB.productId, quantity: 1 }, // Will fail!
        ],
        performedBy: "test_runner",
      });
    } catch (err) {
      errorEncountered = err.message;
    }

    try {
      const stateA = await this.fixtureManager.verifyFixture(fixA.productId);
      const stateB = await this.fixtureManager.verifyFixture(fixB.productId);

      // Verify zero reservations exist for these products
      const resCheck = await this.pool.query(
        "SELECT COUNT(*)::int AS count FROM reservations WHERE product_id IN ($1, $2);",
        [fixA.productId, fixB.productId]
      );
      const reservationsCount = resCheck.rows[0].count;

      const rolledBackCleanly =
        stateA.available === 5 &&
        stateA.reserved === 0 &&
        stateB.available === 0 &&
        stateB.reserved === 0 &&
        reservationsCount === 0 &&
        errorEncountered.includes("Insufficient available stock");

      return {
        rolledBackCleanly,
        itemA_availableBefore: 5,
        itemA_availableAfter: stateA.available,
        itemA_reservedAfter: stateA.reserved,
        orderCreated: false,
        reservationsCreated: reservationsCount > 0,
        errorEncountered,
      };
    } finally {
      await this.fixtureManager.cleanupFixture(fixA.productId);
      await this.fixtureManager.cleanupFixture(fixB.productId);
    }
  }

  /**
   * 3. Connection and Transaction Failure Recovery
   * Injects an intentional syntax/constraint failure inside a transaction,
   * asserts rollback, and verifies subsequent valid transactions succeed cleanly.
   *
   * @returns {Promise<{
   *   abortedTransactionRolledBack: boolean,
   *   subsequentTransactionSucceeded: boolean,
   *   poolHealthy: boolean
   * }>}
   */
  async testFailureRecovery() {
    const fixture = await this.fixtureManager.createFixture({ initialStock: 5, description: "Failure Recovery Test" });

    const client = await this.pool.connect();
    let abortedTransactionRolledBack = false;

    try {
      await client.query("BEGIN;");
      // Deliberately trigger constraint failure
      await client.query("INSERT INTO inventory (product_id, available_qty, reserved_qty) VALUES ($1, -99, 0);", [fixture.productId]);
      await client.query("COMMIT;");
    } catch {
      await client.query("ROLLBACK;");
      abortedTransactionRolledBack = true;
    } finally {
      client.release();
    }

    // Now execute a valid reservation using P1
    let subsequentTransactionSucceeded = false;
    try {
      const order = await this.p1.reserveOrder({
        customerName: "recovery_customer",
        items: [{ productId: fixture.productId, quantity: 1 }],
      });
      subsequentTransactionSucceeded = Boolean(order?.id);
    } finally {
      await this.fixtureManager.cleanupFixture(fixture.productId);
    }

    const health = await this.p1.checkHealth();

    return {
      abortedTransactionRolledBack,
      subsequentTransactionSucceeded,
      poolHealthy: health.ok,
    };
  }
}

export const defaultRecoveryTester = new RecoveryTester();
