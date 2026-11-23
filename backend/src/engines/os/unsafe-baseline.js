/**
 * P3 Unsafe Baseline Simulation
 *
 * Demonstrates the fundamental Operating Systems concurrency problem:
 * A Race Condition caused by a non-atomic Critical Section (Check-then-Act / Read-Modify-Write)
 * when multiple execution threads/coroutines access shared mutable state without Mutual Exclusion.
 *
 * THIS IS TEST-ONLY CODE AND IS NEVER EXPOSED THROUGH PRODUCTION EXPRESS ROUTES.
 */

/**
 * Coordination Barrier (Rendezvous)
 * Synchronizes N concurrent workers so all reach the critical section concurrently,
 * eliminating timing jitter and making the race condition 100% reproducible.
 */
export class Barrier {
  constructor(parties) {
    this.parties = parties;
    this.count = 0;
    this.waiting = [];
  }

  /**
   * Waits until all `parties` have called wait().
   * @returns {Promise<void>}
   */
  async wait() {
    this.count++;
    if (this.count >= this.parties) {
      // Release all waiting workers simultaneously
      const waiters = this.waiting.slice();
      this.waiting = [];
      this.count = 0;
      for (const resolve of waiters) {
        resolve();
      }
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }
}

/**
 * Unsafe In-Memory Inventory Storage
 * Represents a shared mutable state without locking or transactional isolation.
 */
export class UnsafeStorage {
  constructor(initialStock = 5) {
    this.initialStock = initialStock;
    this.available = initialStock;
    this.reserved = 0;
    this.readCount = 0;
    this.writeCount = 0;
  }

  getAvailable() {
    this.readCount++;
    return this.available;
  }

  setAvailable(value) {
    this.writeCount++;
    this.available = value;
  }

  addReserved(qty) {
    this.reserved += qty;
  }
}

/**
 * Helper to simulate non-blocking asynchronous latency (e.g., I/O or network round-trip).
 * @param {number} ms
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a single unprotected reservation attempt.
 *
 * CRITICAL SECTION ANATOMY:
 * 1. Time-of-Check (TOC): Read `available` stock.
 * 2. Gap (Interleaving): Unprotected delay where concurrent workers also read the same stale stock.
 * 3. Time-of-Use (TOU): Decide stock sufficiency and write back updated stock.
 *
 * @param {Object} params
 * @param {UnsafeStorage} params.storage
 * @param {number} params.workerId
 * @param {number} [params.quantity=1]
 * @param {Barrier} [params.barrier]
 * @param {number} [params.artificialDelayMs=2]
 * @returns {Promise<{ workerId: number, success: boolean, readAvailable: number, requestedQty: number, reason?: string }>}
 */
export async function executeUnprotectedReservation({
  storage,
  workerId,
  quantity = 1,
  barrier = null,
  artificialDelayMs = 2,
}) {
  // 1. Time-of-Check (TOC) — Unprotected read
  const currentAvailable = storage.getAvailable();

  // 2. Coordinated synchronization barrier:
  // Forces all concurrent workers to pause right after reading, maximizing interleaving
  if (barrier) {
    await barrier.wait();
  }

  // 3. I/O latency gap (simulating database query round-trip or context switch)
  if (artificialDelayMs > 0) {
    await delay(artificialDelayMs);
  }

  // 4. Time-of-Use (TOU) — Decision based on STALE data
  if (currentAvailable >= quantity) {
    // Both workers see stock >= 1, so both calculate update from stale baseline!
    // Lost Update / Overselling occurs here:
    const updatedAvailable = currentAvailable - quantity;
    storage.setAvailable(updatedAvailable);
    storage.addReserved(quantity);

    return {
      workerId,
      success: true,
      readAvailable: currentAvailable,
      requestedQty: quantity,
    };
  }

  return {
    workerId,
    success: false,
    readAvailable: currentAvailable,
    requestedQty: quantity,
    reason: "INSUFFICIENT_STOCK",
  };
}

/**
 * Runs an unsafe concurrency simulation with N simultaneous workers.
 *
 * @param {Object} [options]
 * @param {number} [options.initialStock=5]
 * @param {number} [options.concurrency=20]
 * @param {number} [options.requestQty=1]
 * @param {number} [options.artificialDelayMs=2]
 * @returns {Promise<{
 *   initialStock: number,
 *   concurrency: number,
 *   successfulReservations: number,
 *   rejectedRequests: number,
 *   totalUnitsReserved: number,
 *   oversellCount: number,
 *   finalAvailableStock: number,
 *   raceConditionDetected: boolean,
 *   explanation: string,
 *   results: Array<any>
 * }>}
 */
export async function runUnsafeSimulation({
  initialStock = 5,
  concurrency = 20,
  requestQty = 1,
  artificialDelayMs = 2,
} = {}) {
  const storage = new UnsafeStorage(initialStock);
  const barrier = new Barrier(concurrency);

  const workers = Array.from({ length: concurrency }, (_, i) => i + 1);

  // Dispatch all workers concurrently
  const promises = workers.map((workerId) =>
    executeUnprotectedReservation({
      storage,
      workerId,
      quantity: requestQty,
      barrier,
      artificialDelayMs,
    })
  );

  const results = await Promise.all(promises);

  const successfulReservations = results.filter((r) => r.success).length;
  const rejectedRequests = results.filter((r) => !r.success).length;
  const totalUnitsReserved = storage.reserved;
  const finalAvailableStock = storage.available;
  const oversellCount = Math.max(0, totalUnitsReserved - initialStock);
  const raceConditionDetected = oversellCount > 0 || (initialStock < concurrency && successfulReservations > initialStock);

  return {
    initialStock,
    concurrency,
    successfulReservations,
    rejectedRequests,
    totalUnitsReserved,
    oversellCount,
    finalAvailableStock,
    raceConditionDetected,
    explanation:
      "A classic Time-of-Check to Time-of-Use (TOCTOU) race condition occurred. All concurrent workers read the initial stock before any worker wrote its update. Because there was no mutual exclusion lock or atomic transaction boundary, every worker made decisions on stale data, leading to overselling.",
    results,
  };
}
