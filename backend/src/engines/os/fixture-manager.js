/**
 * P3 Fixture Manager
 *
 * Safely manages isolated disposable test fixtures for concurrency testing.
 * Guarantees that:
 * 1. Only disposable fixtures with explicit test prefixes ("P3-TEST-") are created.
 * 2. Real production catalog items and customer data are never touched.
 * 3. All test fixtures are reliably cleaned up in finally blocks.
 * 4. Append-only stock ledger records are never updated or deleted.
 */

import pool from "../dbms/pool.js";

export const FIXTURE_SKU_PREFIX = "P3-TEST-";

export class FixtureManager {
  /**
   * @param {import('pg').Pool} [databasePool]
   */
  constructor(databasePool = pool) {
    this.pool = databasePool;
    this.activeFixtures = new Set();
  }

  /**
   * Validates whether a SKU strictly belongs to the isolated test fixture namespace.
   * @param {string} sku
   * @returns {boolean}
   */
  static isTestFixtureSku(sku) {
    return typeof sku === "string" && (sku.startsWith(FIXTURE_SKU_PREFIX) || sku.startsWith("TEST-"));
  }

  /**
   * Creates a disposable test product and companion inventory row.
   * @param {Object} [options]
   * @param {number} [options.initialStock=10]
   * @param {number} [options.unitPrice=9.99]
   * @param {string} [options.description="P3 Concurrency Test Fixture"]
   * @param {string} [options.skuSuffix]
   * @returns {Promise<{ productId: number, sku: string, name: string, initialStock: number, onHand: number, available: number, reserved: number }>}
   */
  async createFixture({
    initialStock = 10,
    unitPrice = 9.99,
    description = "P3 Concurrency Test Fixture",
    skuSuffix = "",
  } = {}) {
    const stock = parseInt(initialStock, 10);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error("Fixture initial stock must be a non-negative integer.");
    }

    const uniqueId = skuSuffix || `${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const sku = `${FIXTURE_SKU_PREFIX}${uniqueId}`;
    const name = `[P3 FIXTURE] ${description} (${uniqueId})`;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN;");

      const prodRes = await client.query(
        `INSERT INTO products (stock_code, description, unit_price)
         VALUES ($1, $2, $3)
         RETURNING product_id, stock_code, description, unit_price::text AS unit_price;`,
        [sku, name, unitPrice.toFixed(2)]
      );
      const product = prodRes.rows[0];
      const productId = product.product_id;

      await client.query(
        `INSERT INTO inventory (product_id, available_qty, reserved_qty)
         VALUES ($1, $2, 0)
         ON CONFLICT (product_id) DO UPDATE SET available_qty = $2, reserved_qty = 0;`,
        [productId, stock]
      );

      await client.query("COMMIT;");

      const fixtureInfo = {
        productId,
        sku,
        name,
        initialStock: stock,
        onHand: stock,
        available: stock,
        reserved: 0,
      };

      this.activeFixtures.add(productId);
      return fixtureInfo;
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifies that the given product is indeed a test fixture.
   * Throws an error if attempting to touch production records.
   * @param {number} productId
   * @returns {Promise<{ productId: number, sku: string, description: string, available: number, reserved: number, onHand: number }>}
   */
  async verifyFixture(productId) {
    const res = await this.pool.query(
      `SELECT p.product_id, p.stock_code, p.description,
              COALESCE(i.available_qty, 0) AS available,
              COALESCE(i.reserved_qty, 0) AS reserved,
              (COALESCE(i.available_qty, 0) + COALESCE(i.reserved_qty, 0)) AS on_hand
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = $1;`,
      [productId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Test fixture product ID ${productId} not found.`);
    }

    const row = res.rows[0];
    if (!FixtureManager.isTestFixtureSku(row.stock_code)) {
      throw new Error(
        `SAFETY VIOLATION: Refusing to interact with non-fixture production item: SKU ${row.stock_code}`
      );
    }

    return {
      productId: row.product_id,
      sku: row.stock_code,
      description: row.description,
      available: Number(row.available),
      reserved: Number(row.reserved),
      onHand: Number(row.on_hand),
    };
  }

  /**
   * Safely cleans up a disposable test fixture.
   * Never deletes or modifies append-only stock ledger rows.
   * @param {number|{ productId: number, sku?: string }} fixtureOrId
   */
  async cleanupFixture(fixtureOrId) {
    const productId = typeof fixtureOrId === "object" ? fixtureOrId.productId : fixtureOrId;
    if (!productId) return;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN;");

      // Verify safety before touching
      const checkRes = await client.query(
        "SELECT stock_code FROM products WHERE product_id = $1;",
        [productId]
      );
      if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK;");
        this.activeFixtures.delete(productId);
        return;
      }

      const sku = checkRes.rows[0].stock_code;
      if (!FixtureManager.isTestFixtureSku(sku)) {
        await client.query("ROLLBACK;");
        throw new Error(`SAFETY VIOLATION: Refusing to cleanup non-test product SKU ${sku}`);
      }

      // Check if any append-only stock_ledger entries reference this product
      const ledgerCheck = await client.query(
        "SELECT COUNT(*)::int AS count FROM stock_ledger WHERE product_id = $1;",
        [productId]
      );
      const hasLedgerEntries = ledgerCheck.rows[0].count > 0;

      // Clean up test order items and test reservations
      await client.query(
        "DELETE FROM reservations WHERE product_id = $1;",
        [productId]
      );
      await client.query(
        "DELETE FROM order_items WHERE product_id = $1;",
        [productId]
      );

      if (hasLedgerEntries) {
        // If ledger entries exist, respect append-only rule: do NOT delete product or ledger.
        // Instead, zero out stock and mark as inactive test fixture.
        await client.query(
          "UPDATE inventory SET available_qty = 0, reserved_qty = 0, updated_at = NOW() WHERE product_id = $1;",
          [productId]
        );
        await client.query(
          "UPDATE products SET description = '[ARCHIVED TEST FIXTURE] ' || description WHERE product_id = $1;",
          [productId]
        );
      } else {
        // Safe to delete completely if no immutable ledger records reference it
        await client.query("DELETE FROM inventory WHERE product_id = $1;", [productId]);
        await client.query("DELETE FROM products WHERE product_id = $1;", [productId]);
      }

      await client.query("COMMIT;");
      this.activeFixtures.delete(productId);
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cleans up all active fixtures tracked by this manager instance.
   */
  async cleanupAll() {
    const fixtureIds = Array.from(this.activeFixtures);
    for (const id of fixtureIds) {
      try {
        await this.cleanupFixture(id);
      } catch (err) {
        console.error(`Failed to cleanup fixture ${id}:`, err.message);
      }
    }
    this.activeFixtures.clear();
  }

  /**
   * Higher-order utility to run a test with an automatically managed isolated fixture.
   * Guarantees cleanup in a finally block.
   * @template T
   * @param {Object} options
   * @param {(fixture: { productId: number, sku: string, initialStock: number }) => Promise<T>} testFn
   * @returns {Promise<T>}
   */
  async withFixture(options, testFn) {
    const fixture = await this.createFixture(options);
    try {
      return await testFn(fixture);
    } finally {
      await this.cleanupFixture(fixture.productId);
    }
  }
}

export const defaultFixtureManager = new FixtureManager();
