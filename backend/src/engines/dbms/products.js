import pool from "./pool.js";

const productColumns = `
  id,
  sku,
  name,
  category,
  unit_price::text AS unit_price,
  on_hand,
  reserved,
  on_hand - reserved AS available
`;

const unavailableConnectionCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03",
]);

export class ProductDbError extends Error {
  constructor(code, options) {
    super(code, options);
    this.name = "ProductDbError";
    this.code = code;
  }
}

function mapDatabaseError(error) {
  if (error instanceof ProductDbError) {
    return error;
  }

  if (error?.code === "23505") {
    return new ProductDbError("DUPLICATE_SKU", { cause: error });
  }
  if (["23502", "23514", "22P02", "22003"].includes(error?.code)) {
    return new ProductDbError("INVALID_PRODUCT", { cause: error });
  }
  if (
    error?.code === "DATABASE_UNAVAILABLE" ||
    unavailableConnectionCodes.has(error?.code) ||
    error?.code?.startsWith("08")
  ) {
    return new ProductDbError("DATABASE_UNAVAILABLE", { cause: error });
  }

  return error;
}

export function createProductDb(databasePool = pool) {
  return {
    async listProducts() {
      try {
        const result = await databasePool.query(
          `SELECT ${productColumns} FROM products ORDER BY id`,
        );
        return result.rows;
      } catch (error) {
        throw mapDatabaseError(error);
      }
    },

    async createProduct({ sku, name, category = null, unit_price }) {
      try {
        const result = await databasePool.query(
          `INSERT INTO products (sku, name, category, unit_price)
           VALUES ($1, $2, $3, $4)
           RETURNING ${productColumns}`,
          [sku, name, category, unit_price],
        );
        return result.rows[0];
      } catch (error) {
        throw mapDatabaseError(error);
      }
    },
  };
}

const productDb = createProductDb();

export const listProducts = productDb.listProducts;
export const createProduct = productDb.createProduct;
