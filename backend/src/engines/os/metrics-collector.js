/**
 * P3 Metrics Collector & Benchmarking Engine
 *
 * Captures high-precision execution timings, calculates empirical percentiles (p50, p95, p99),
 * throughput (requests per second), and tracks error distributions.
 *
 * Provides direct empirical comparison between Unsafe Baseline and Protected P1 Execution.
 */

import { performance } from "perf_hooks";
import { runUnsafeSimulation } from "./unsafe-baseline.js";
import { defaultConcurrencyHarness } from "./concurrency-harness.js";
import { defaultFixtureManager } from "./fixture-manager.js";

export class MetricsCollector {
  constructor() {
    this.samples = [];
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.samples = [];
    this.startTime = performance.now();
  }

  recordSample({ latencyMs, success, isExpectedRejection = false, error = null }) {
    this.samples.push({
      latencyMs,
      success,
      isExpectedRejection,
      error,
      timestamp: performance.now(),
    });
  }

  stop() {
    this.endTime = performance.now();
    return this.computeMetrics();
  }

  computeMetrics(totalDurationOverrideMs = null) {
    const totalDurationMs =
      totalDurationOverrideMs !== null
        ? totalDurationOverrideMs
        : (this.endTime ? this.endTime - this.startTime : 0);

    const totalRequests = this.samples.length;
    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        rejectionCount: 0,
        unexpectedFailureCount: 0,
        totalDurationMs: 0,
        avgLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        throughputRps: 0,
      };
    }

    const successful = this.samples.filter((s) => s.success);
    const rejected = this.samples.filter((s) => !s.success && s.isExpectedRejection);
    const failed = this.samples.filter((s) => !s.success && !s.isExpectedRejection);

    const latencies = this.samples.map((s) => s.latencyMs).sort((a, b) => a - b);
    const sumLatency = latencies.reduce((acc, v) => acc + v, 0);

    const p50Index = Math.min(Math.floor(latencies.length * 0.5), latencies.length - 1);
    const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
    const p99Index = Math.min(Math.floor(latencies.length * 0.99), latencies.length - 1);

    const seconds = totalDurationMs / 1000;
    const throughputRps = seconds > 0 ? totalRequests / seconds : 0;

    return {
      totalRequests,
      successCount: successful.length,
      rejectionCount: rejected.length,
      unexpectedFailureCount: failed.length,
      successRatePct: Number(((successful.length / totalRequests) * 100).toFixed(2)),
      totalDurationMs: Number(totalDurationMs.toFixed(2)),
      avgLatencyMs: Number((sumLatency / totalRequests).toFixed(2)),
      minLatencyMs: Number(latencies[0].toFixed(2)),
      maxLatencyMs: Number(latencies[latencies.length - 1].toFixed(2)),
      p50Ms: Number(latencies[p50Index].toFixed(2)),
      p95Ms: Number(latencies[p95Index].toFixed(2)),
      p99Ms: Number(latencies[p99Index].toFixed(2)),
      throughputRps: Number(throughputRps.toFixed(2)),
    };
  }
}

/**
 * Executes a full comparative benchmark suite across multiple concurrency levels.
 *
 * @param {Object} [options]
 * @param {ConcurrencyHarness} [options.harness]
 * @param {FixtureManager} [options.fixtureManager]
 * @param {Array<number>} [options.concurrencyLevels=[2, 5, 10, 20]]
 * @param {number} [options.initialStock=5]
 * @returns {Promise<{
 *   environment: { nodeVersion: string, platform: string, timestamp: string },
 *   levels: Array<number>,
 *   unsafeBenchmarks: Array<any>,
 *   protectedBenchmarks: Array<any>,
 *   comparisonSummary: Array<any>
 * }>}
 */
export async function runBenchmarkSuite({
  harness = defaultConcurrencyHarness,
  fixtureManager = defaultFixtureManager,
  concurrencyLevels = [2, 5, 10, 20],
  initialStock = 5,
} = {}) {
  const unsafeBenchmarks = [];
  const protectedBenchmarks = [];
  const comparisonSummary = [];

  for (const concurrency of concurrencyLevels) {
    // 1. Run Unsafe Baseline Simulation
    const unsafeRes = await runUnsafeSimulation({
      initialStock,
      concurrency,
      requestQty: 1,
      artificialDelayMs: 2,
    });
    unsafeBenchmarks.push(unsafeRes);

    // 2. Run Protected P1 Execution using Isolated Test Fixture
    const fixture = await fixtureManager.createFixture({
      initialStock,
      description: `Benchmark Level C=${concurrency}`,
    });

    let protectedRes;
    try {
      protectedRes = await harness.runConcurrentReservations({
        productId: fixture.productId,
        sku: fixture.sku,
        concurrency,
        quantityPerRequest: 1,
        useBarrier: true,
      });
      protectedBenchmarks.push(protectedRes);
    } finally {
      await fixtureManager.cleanupFixture(fixture.productId);
    }

    comparisonSummary.push({
      concurrency,
      initialStock,
      unsafe: {
        successes: unsafeRes.successfulReservations,
        oversold: unsafeRes.oversellCount,
        invariantSatisfied: !unsafeRes.raceConditionDetected,
      },
      protected: {
        successes: protectedRes.successfulReservations,
        rejected: protectedRes.rejectedRequests,
        oversold: protectedRes.oversellCount,
        invariantSatisfied: protectedRes.invariantsSatisfied,
        p50Ms: protectedRes.timings.p50Ms,
        p95Ms: protectedRes.timings.p95Ms,
        rps: protectedRes.timings.rps,
      },
    });
  }

  return {
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
    levels: concurrencyLevels,
    unsafeBenchmarks,
    protectedBenchmarks,
    comparisonSummary,
  };
}
