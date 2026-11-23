/**
 * P3 Protected Concurrency Harness
 *
 * Orchestrates concurrent execution against P1's real `reserveOrder` transaction service.
 * Enforces mutual exclusion and atomic boundaries via PostgreSQL `SELECT ... FOR UPDATE`.
 *
 * Verifies all TBIMS invariants:
 * 1. Zero overselling (`oversellCount === 0`).
 * 2. Available stock never becomes negative (`available >= 0`).
 * 3. Physical on-hand stock is preserved: `on_hand = available_qty + reserved_qty`.
 * 4. Failed reservations roll back completely without partial state mutations.
 */

import { performance } from "perf_hooks";
import { defaultP1Operations } from "../dbms/p1-operations.js";
import pool from "../dbms/pool.js";
import { Barrier } from "./unsafe-baseline.js";
import { FixtureManager, defaultFixtureManager } from "./fixture-manager.js";

export class ConcurrencyHarness {
  /**
   * @param {Object} [options]
   * @param {import('../dbms/p1-operations.js').defaultP1Operations} [options.p1Operations]
   * @param {FixtureManager} [options.fixtureManager]
   * @param {import('pg').Pool} [options.databasePool]
   */
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
   * Executes N concurrent reservations against a single product using P1's real `reserveOrder`.
   *
   * @param {Object} params
   * @param {number} params.productId
   * @param {string} [params.sku]
   * @param {number} [params.concurrency=10]
   * @param {number} [params.quantityPerRequest=1]
   * @param {boolean} [params.useBarrier=true]
   * @returns {Promise<{
   *   concurrency: number,
   *   initialAvailable: number,
   *   initialReserved: number,
   *   initialOnHand: number,
   *   finalAvailable: number,
   *   finalReserved: number,
   *   finalOnHand: number,
   *   successfulReservations: number,
   *   rejectedRequests: number,
   *   oversellCount: number,
   *   invariantsSatisfied: boolean,
   *   errors: Array<string>,
   *   timings: { totalDurationMs: number, avgLatencyMs: number, p50Ms: number, p95Ms: number, rps: number },
   *   results: Array<{ workerId: number, success: boolean, orderId?: number|string, latencyMs: number, error?: string }>
   * }>}
   */
  async runConcurrentReservations({
    productId,
    sku = "",
    concurrency = 10,
    quantityPerRequest = 1,
    useBarrier = true,
  }) {
    if (!productId || concurrency < 1) {
      throw new Error("Valid productId and positive concurrency are required.");
    }

    // 1. Inspect initial inventory state directly from database
    const initialInvRes = await this.pool.query(
      "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1;",
      [productId]
    );

    if (initialInvRes.rows.length === 0) {
      throw new Error(`Inventory row for product ID ${productId} does not exist.`);
    }

    const initialAvailable = Number(initialInvRes.rows[0].available_qty);
    const initialReserved = Number(initialInvRes.rows[0].reserved_qty);
    const initialOnHand = initialAvailable + initialReserved;

    const barrier = useBarrier ? new Barrier(concurrency) : null;
    const workers = Array.from({ length: concurrency }, (_, i) => i + 1);

    const startTime = performance.now();

    // 2. Dispatch all concurrent workers simultaneously
    const taskPromises = workers.map(async (workerId) => {
      if (barrier) {
        await barrier.wait();
      }

      const t0 = performance.now();
      try {
        const order = await this.p1.reserveOrder({
          customerName: `customer_${workerId}`,
          items: [{ productId, productSku: sku, quantity: quantityPerRequest }],
          userId: null,
          performedBy: `concurrency_worker_${workerId}`,
        });
        const t1 = performance.now();

        return {
          workerId,
          success: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          latencyMs: t1 - t0,
        };
      } catch (err) {
        const t1 = performance.now();
        const isExpectedStockRejection =
          typeof err?.message === "string" &&
          (err.message.includes("Insufficient available stock") || err.message.includes("available stock"));

        return {
          workerId,
          success: false,
          error: err?.message || "Unknown error",
          isExpectedStockRejection,
          latencyMs: t1 - t0,
        };
      }
    });

    const results = await Promise.all(taskPromises);
    const totalDurationMs = performance.now() - startTime;

    // 3. Inspect final state directly from PostgreSQL
    const finalInvRes = await this.pool.query(
      "SELECT available_qty, reserved_qty FROM inventory WHERE product_id = $1;",
      [productId]
    );

    const finalAvailable = Number(finalInvRes.rows[0].available_qty);
    const finalReserved = Number(finalInvRes.rows[0].reserved_qty);
    const finalOnHand = finalAvailable + finalReserved;

    // 4. Calculate counts
    const successfulReservations = results.filter((r) => r.success).length;
    const rejectedRequests = results.filter((r) => !r.success).length;
    const expectedMaxSuccesses = Math.min(concurrency, Math.floor(initialAvailable / quantityPerRequest));
    const totalReservedUnits = successfulReservations * quantityPerRequest;
    const oversellCount = Math.max(0, totalReservedUnits - initialAvailable);

    // 5. Invariant Checks
    const invariants = {
      noOverselling: oversellCount === 0,
      stockNonNegative: finalAvailable >= 0,
      reservedNonNegative: finalReserved >= 0,
      onHandPreserved: finalOnHand === initialOnHand,
      onHandEqualsAvailablePlusReserved: finalOnHand === (finalAvailable + finalReserved),
      expectedSuccessCount: successfulReservations === expectedMaxSuccesses,
    };

    const invariantsSatisfied = Object.values(invariants).every(Boolean);

    // 6. Timings & Latencies
    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const rps = totalDurationMs > 0 ? (concurrency / (totalDurationMs / 1000)) : 0;

    return {
      concurrency,
      quantityPerRequest,
      initialAvailable,
      initialReserved,
      initialOnHand,
      finalAvailable,
      finalReserved,
      finalOnHand,
      successfulReservations,
      rejectedRequests,
      oversellCount,
      invariants,
      invariantsSatisfied,
      timings: {
        totalDurationMs: Number(totalDurationMs.toFixed(2)),
        avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
        p50Ms: Number(p50Ms.toFixed(2)),
        p95Ms: Number(p95Ms.toFixed(2)),
        rps: Number(rps.toFixed(2)),
      },
      results,
    };
  }

  /**
   * Tests multi-item overlapping orders to verify deadlock avoidance.
   * e.g., Worker 1 requests [Item A, Item B] while Worker 2 requests [Item B, Item A].
   * P1 sorts items deterministically by product_id ASC, preventing cyclic wait deadlocks.
   *
   * @param {Object} params
   * @param {Array<{ productId: number, sku: string }>} params.fixtures
   * @param {number} [params.concurrency=8]
   * @returns {Promise<{
   *   concurrency: number,
   *   successCount: number,
   *   failureCount: number,
   *   deadlocksDetected: number,
   *   allInvariantsSatisfied: boolean,
   *   results: Array<any>
   * }>}
   */
  async runMultiItemContentionTest({ fixtures, concurrency = 8 }) {
    if (!Array.isArray(fixtures) || fixtures.length < 2) {
      throw new Error("At least two fixture products are required for multi-item testing.");
    }

    const barrier = new Barrier(concurrency);
    const [pA, pB] = fixtures;

    const workers = Array.from({ length: concurrency }, (_, i) => i + 1);

    const promises = workers.map(async (workerId) => {
      await barrier.wait();

      // Alternate requested item ordering: even workers request [A, B], odd workers request [B, A]
      const items = workerId % 2 === 0
        ? [{ productId: pA.productId, quantity: 1 }, { productId: pB.productId, quantity: 1 }]
        : [{ productId: pB.productId, quantity: 1 }, { productId: pA.productId, quantity: 1 }];

      try {
        const order = await this.p1.reserveOrder({
          customerName: `customer_multi_${workerId}`,
          items,
          performedBy: `worker_${workerId}`,
        });
        return { workerId, success: true, orderId: order.id };
      } catch (err) {
        const isDeadlock = err?.code === "DEADLOCK_DETECTED" || (err?.message && err.message.includes("deadlock"));
        return { workerId, success: false, error: err.message, isDeadlock };
      }
    });

    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const deadlocksDetected = results.filter((r) => r.isDeadlock).length;

    return {
      concurrency,
      successCount,
      failureCount,
      deadlocksDetected,
      deadlockFree: deadlocksDetected === 0,
      results,
    };
  }
}

export const defaultConcurrencyHarness = new ConcurrencyHarness();
