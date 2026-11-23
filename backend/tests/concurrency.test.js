/**
 * P3 Automated Concurrency & Invariant Test Suite
 *
 * Verifies:
 * 1. Milestone 1: Unsafe baseline race condition reproducibility and TOCTOU overselling.
 * 2. Milestone 1: Fixture manager safety guards, SKU validation, and cleanup isolation.
 * 3. Milestone 2: Protected P1 concurrency harness, zero overselling, and inventory invariant checks.
 * 4. Milestone 3: Metrics collector percentiles (p50, p95), throughput, and error classification.
 * 5. Milestone 4: Multi-item deterministic locking (deadlock freedom), atomic rollback, and recovery.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runUnsafeSimulation, Barrier, UnsafeStorage, executeUnprotectedReservation } from "../src/engines/os/unsafe-baseline.js";
import { FixtureManager, FIXTURE_SKU_PREFIX } from "../src/engines/os/fixture-manager.js";
import { ConcurrencyHarness } from "../src/engines/os/concurrency-harness.js";
import { MetricsCollector } from "../src/engines/os/metrics-collector.js";
import { RecoveryTester } from "../src/engines/os/recovery-tester.js";
import { createP1Operations } from "../src/engines/dbms/p1-operations.js";
import pool from "../src/engines/dbms/pool.js";

describe("P3 OS Engine — Concurrency, Invariants & Recovery", { timeout: 30000 }, () => {
  let isDbConnected = false;
  let p1Ops = null;
  let fixtureMgr = null;
  let harness = null;
  let recoveryTester = null;

  beforeAll(async () => {
    try {
      p1Ops = createP1Operations(pool);
      const health = await p1Ops.checkHealth();
      if (health.ok) {
        isDbConnected = true;
        fixtureMgr = new FixtureManager(pool);
        harness = new ConcurrencyHarness({ p1Operations: p1Ops, fixtureManager: fixtureMgr, databasePool: pool });
        recoveryTester = new RecoveryTester({ p1Operations: p1Ops, fixtureManager: fixtureMgr, databasePool: pool });
      }
    } catch {
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    if (isDbConnected && fixtureMgr) {
      await fixtureMgr.cleanupAll();
    }
  });

  // -------------------------------------------------------------
  // Milestone 1 Tests: Unsafe Baseline & Fixture Manager Safety
  // -------------------------------------------------------------
  describe("Milestone 1: Unsafe Baseline & Fixture Safety", () => {
    it("Barrier coordinates N workers to release simultaneously", async () => {
      const barrier = new Barrier(4);
      let releasedCount = 0;

      const workers = Array.from({ length: 4 }, async () => {
        await barrier.wait();
        releasedCount++;
      });

      await Promise.all(workers);
      expect(releasedCount).toBe(4);
    });

    it("Unsafe baseline reproduces race conditions and overselling without locks", async () => {
      const result = await runUnsafeSimulation({
        initialStock: 3,
        concurrency: 10,
        requestQty: 1,
        artificialDelayMs: 2,
      });

      expect(result.initialStock).toBe(3);
      expect(result.concurrency).toBe(10);
      expect(result.successfulReservations).toBe(10);
      expect(result.oversellCount).toBe(7);
      expect(result.raceConditionDetected).toBe(true);
      expect(result.explanation).toContain("Time-of-Check to Time-of-Use");
    });

    it("FixtureManager strictly validates test SKU prefixes and blocks production SKUs", () => {
      expect(FixtureManager.isTestFixtureSku(`${FIXTURE_SKU_PREFIX}123`)).toBe(true);
      expect(FixtureManager.isTestFixtureSku("TEST-FIXTURE-1")).toBe(true);
      expect(FixtureManager.isTestFixtureSku("85123A")).toBe(false);
      expect(FixtureManager.isTestFixtureSku("PROD-1002")).toBe(false);
      expect(FixtureManager.isTestFixtureSku("")).toBe(false);
    });

    it("FixtureManager refuses to clean up non-test production records", async () => {
      if (!isDbConnected) return;

      const fakeProductionFixture = { productId: 1, sku: "85123A" };
      await expect(fixtureMgr.cleanupFixture(fakeProductionFixture)).rejects.toThrow(
        /SAFETY VIOLATION/
      );
    });
  });

  // -------------------------------------------------------------
  // Milestone 2 Tests: Protected Concurrency Harness & Invariants
  // -------------------------------------------------------------
  describe("Milestone 2: Protected P1 Concurrency & Invariant Verification", () => {
    it("Protected execution prevents overselling under heavy concurrency (C=10 on Stock=3)", async () => {
      if (!isDbConnected) {
        console.warn("Skipping live database test: PostgreSQL not connected.");
        return;
      }

      const fixture = await fixtureMgr.createFixture({
        initialStock: 3,
        description: "Vitest Concurrency Test C=10",
      });

      try {
        const result = await harness.runConcurrentReservations({
          productId: fixture.productId,
          concurrency: 10,
          quantityPerRequest: 1,
          useBarrier: true,
        });

        expect(result.oversellCount).toBe(0);
        expect(result.successfulReservations).toBe(3);
        expect(result.rejectedRequests).toBe(7);
        expect(result.finalAvailable).toBe(0);
        expect(result.finalReserved).toBe(3);
        expect(result.finalOnHand).toBe(3);
        expect(result.invariantsSatisfied).toBe(true);
        expect(result.invariants.noOverselling).toBe(true);
        expect(result.invariants.stockNonNegative).toBe(true);
        expect(result.invariants.onHandEqualsAvailablePlusReserved).toBe(true);
      } finally {
        await fixtureMgr.cleanupFixture(fixture.productId);
      }
    });

    it("Last-unit contention: exactly 1 worker wins when only 1 unit is available", async () => {
      if (!isDbConnected) return;

      const fixture = await fixtureMgr.createFixture({
        initialStock: 1,
        description: "Vitest Last-Unit Contention C=5",
      });

      try {
        const result = await harness.runConcurrentReservations({
          productId: fixture.productId,
          concurrency: 5,
          quantityPerRequest: 1,
          useBarrier: true,
        });

        expect(result.oversellCount).toBe(0);
        expect(result.successfulReservations).toBe(1);
        expect(result.rejectedRequests).toBe(4);
        expect(result.finalAvailable).toBe(0);
        expect(result.finalReserved).toBe(1);
        expect(result.invariantsSatisfied).toBe(true);
      } finally {
        await fixtureMgr.cleanupFixture(fixture.productId);
      }
    });
  });

  // -------------------------------------------------------------
  // Milestone 3 Tests: Performance & Metrics Collector
  // -------------------------------------------------------------
  describe("Milestone 3: Metrics Collector & Statistics", () => {
    it("Computes empirical p50, p95, p99 latencies and throughput accurately", () => {
      const collector = new MetricsCollector();
      collector.start();

      // Record known sample latencies: 10ms, 20ms, 30ms, 40ms, 50ms, 60ms, 70ms, 80ms, 90ms, 100ms
      for (let i = 1; i <= 10; i++) {
        collector.recordSample({ latencyMs: i * 10, success: i <= 8, isExpectedRejection: i > 8 });
      }

      const metrics = collector.computeMetrics(1000); // 1000ms duration

      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successCount).toBe(8);
      expect(metrics.rejectionCount).toBe(2);
      expect(metrics.unexpectedFailureCount).toBe(0);
      expect(metrics.minLatencyMs).toBe(10);
      expect(metrics.maxLatencyMs).toBe(100);
      expect(metrics.avgLatencyMs).toBe(55);
      expect(metrics.p50Ms).toBe(60);
      expect(metrics.p95Ms).toBe(100);
      expect(metrics.throughputRps).toBe(10);
    });
  });

  // -------------------------------------------------------------
  // Milestone 4 Tests: Deadlock Prevention, Rollback & Recovery
  // -------------------------------------------------------------
  describe("Milestone 4: Deadlock Prevention, Rollback & Recovery", () => {
    it("Multi-item inverted order reservations execute without deadlocks", async () => {
      if (!isDbConnected) return;

      const dlResult = await recoveryTester.testDeadlockPrevention({ concurrency: 4 });
      expect(dlResult.deadlocksDetected).toBe(0);
      expect(dlResult.deadlockFree).toBe(true);
      expect(dlResult.successfulOrders).toBe(4);
      expect(dlResult.itemA_Invariants).toBe(true);
      expect(dlResult.itemB_Invariants).toBe(true);
    });

    it("Atomic rollback preserves stock when any item in a multi-item batch fails", async () => {
      if (!isDbConnected) return;

      const rbResult = await recoveryTester.testAtomicRollback();
      expect(rbResult.rolledBackCleanly).toBe(true);
      expect(rbResult.itemA_availableAfter).toBe(5);
      expect(rbResult.itemA_reservedAfter).toBe(0);
      expect(rbResult.reservationsCreated).toBe(false);
      expect(rbResult.errorEncountered).toContain("Insufficient available stock");
    });

    it("Transaction failure recovery maintains connection pool sanity", async () => {
      if (!isDbConnected) return;

      const recResult = await recoveryTester.testFailureRecovery();
      expect(recResult.abortedTransactionRolledBack).toBe(true);
      expect(recResult.subsequentTransactionSucceeded).toBe(true);
      expect(recResult.poolHealthy).toBe(true);
    });
  });
});
