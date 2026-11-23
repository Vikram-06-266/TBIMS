import { describe, expect, it, vi } from "vitest";
import {
  createP1ProductAdapter,
  createP1ProductMapper,
} from "../src/services/p1-product-adapter.js";

const row = {
  product_id: 7,
  stock_code: "SKU-007",
  description: "Desk lamp",
  unit_price: "12.5",
  available_qty: 8,
  reserved_qty: 2,
};

describe("P1 product field adapter", () => {
  it("maps actual database columns when quantity meaning is explicitly approved", () => {
    const mapper = createP1ProductMapper({
      availableQtyMeaning: "available_qty_excludes_reservations",
    });

    expect(mapper.fromDatabase(row)).toEqual({
      id: 7,
      sku: "SKU-007",
      name: "Desk lamp",
      category: null,
      unit_price: "12.50",
      on_hand: 10,
      reserved: 2,
      available: 8,
    });
  });

  it("uses physical stock directly when P1 confirms available_qty means on-hand", () => {
    const mapper = createP1ProductMapper({
      availableQtyMeaning: "available_qty_is_on_hand",
    });

    expect(mapper.fromDatabase(row)).toMatchObject({
      on_hand: 8,
      reserved: 2,
      available: 6,
    });
  });

  it("does not guess whether available_qty is physical stock or available stock", () => {
    expect(() => createP1ProductMapper()).toThrow(
      expect.objectContaining({ code: "P1_STOCK_SEMANTICS_UNCONFIRMED" }),
    );
  });

  it("maps API input to P1 column names and database price precision", () => {
    const mapper = createP1ProductMapper({
      availableQtyMeaning: "available_qty_is_on_hand",
    });

    expect(
      mapper.toDatabase({
        sku: "SKU-007",
        name: "Desk lamp",
        unit_price: "12.5",
      }),
    ).toEqual({
      stock_code: "SKU-007",
      description: "Desk lamp",
      unit_price: "12.50",
    });
  });

  it("rejects category and prices the current products table cannot store", () => {
    const mapper = createP1ProductMapper({
      availableQtyMeaning: "available_qty_is_on_hand",
    });
    const input = {
      sku: "SKU-007",
      name: "Desk lamp",
      unit_price: "12.50",
    };

    expect(() =>
      mapper.toDatabase({ ...input, category: "Lighting" }),
    ).toThrow(expect.objectContaining({ code: "PRODUCT_FIELD_UNSUPPORTED" }));
    expect(() =>
      mapper.toDatabase({ ...input, unit_price: "100000000.00" }),
    ).toThrow(
      expect.objectContaining({ code: "P1_PRODUCT_VALUE_OUT_OF_RANGE" }),
    );
    expect(() =>
      mapper.toDatabase({ ...input, sku: "S".repeat(51) }),
    ).toThrow(
      expect.objectContaining({ code: "P1_PRODUCT_VALUE_OUT_OF_RANGE" }),
    );
  });

  it("rejects P1 rows with invalid inventory invariants", () => {
    const mapper = createP1ProductMapper({
      availableQtyMeaning: "available_qty_is_on_hand",
    });

    expect(() =>
      mapper.fromDatabase({ ...row, available_qty: 1, reserved_qty: 2 }),
    ).toThrow(
      expect.objectContaining({ code: "P1_PRODUCT_SCHEMA_MISMATCH" }),
    );
  });

  it("wraps actual P1 function exports without issuing SQL from P4", async () => {
    const listProducts = vi.fn().mockResolvedValue([row]);
    const createProduct = vi.fn().mockResolvedValue(row);
    const adapter = createP1ProductAdapter({
      operations: { listProducts, createProduct },
      availableQtyMeaning: "available_qty_excludes_reservations",
    });

    await expect(adapter.listProducts()).resolves.toMatchObject([
      { id: 7, sku: "SKU-007", on_hand: 10, available: 8 },
    ]);
    await expect(
      adapter.createProduct({
        sku: "SKU-007",
        name: "Desk lamp",
        unit_price: "12.50",
      }),
    ).resolves.toMatchObject({ id: 7, sku: "SKU-007" });
    expect(createProduct).toHaveBeenCalledWith({
      stock_code: "SKU-007",
      description: "Desk lamp",
      unit_price: "12.50",
    });
  });
});
