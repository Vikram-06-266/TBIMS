import { describe, expect, it, vi } from "vitest";
import { createProductDb, ProductDbError } from "../src/engines/dbms/products.js";
import { createDatabasePool } from "../src/engines/dbms/pool.js";

const product = {
  id: 7,
  sku: "SKU-007",
  name: "Desk lamp",
  category: null,
  unit_price: "12.50",
  on_hand: 0,
  reserved: 0,
  available: 0,
};

describe("P1 product database operations", () => {
  it("lists rows and derives available stock from database quantities", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [product] });
    const database = createProductDb({ query });

    await expect(database.listProducts()).resolves.toEqual([product]);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/SELECT[\s\S]*FROM products ORDER BY id/),
    );
  });

  it("inserts only validated product fields and returns the created row", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [product] });
    const database = createProductDb({ query });

    await expect(
      database.createProduct({
        sku: "SKU-007",
        name: "Desk lamp",
        unit_price: "12.50",
      }),
    ).resolves.toEqual(product);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO products[\s\S]*RETURNING/),
      ["SKU-007", "Desk lamp", null, "12.50"],
    );
  });

  it.each([
    ["23505", "DUPLICATE_SKU"],
    ["23514", "INVALID_PRODUCT"],
    ["ECONNREFUSED", "DATABASE_UNAVAILABLE"],
  ])("maps database error %s to %s", async (databaseCode, expectedCode) => {
    const query = vi.fn().mockRejectedValue(
      Object.assign(new Error("internal database details"), {
        code: databaseCode,
      }),
    );
    const database = createProductDb({ query });

    await expect(database.listProducts()).rejects.toMatchObject({
      name: "ProductDbError",
      code: expectedCode,
    });
  });

  it("preserves unexpected database errors for the API error handler", async () => {
    const error = new Error("unexpected query failure");
    const database = createProductDb({
      query: vi.fn().mockRejectedValue(error),
    });

    await expect(database.listProducts()).rejects.toBe(error);
    expect(error).not.toBeInstanceOf(ProductDbError);
  });

  it("fails safely when DATABASE_URL is not configured", async () => {
    const database = createProductDb(createDatabasePool(""));

    await expect(database.listProducts()).rejects.toMatchObject({
      name: "ProductDbError",
      code: "DATABASE_UNAVAILABLE",
    });
  });
});
