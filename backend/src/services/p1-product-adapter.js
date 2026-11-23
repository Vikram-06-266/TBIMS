const stockSemantics = new Set([
  "available_qty_is_on_hand",
  "available_qty_excludes_reservations",
]);

export class ProductMappingError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProductMappingError";
    this.code = code;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readInteger(value, minimum = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new ProductMappingError("P1_PRODUCT_SCHEMA_MISMATCH");
  }
  return parsed;
}

function formatPrice(
  value,
  errorCode = "P1_PRODUCT_SCHEMA_MISMATCH",
) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ProductMappingError(errorCode);
  }

  const price = String(value);
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(price);
  if (!match) {
    throw new ProductMappingError(errorCode);
  }
  return `${match[1]}.${(match[2] || "").padEnd(2, "0")}`;
}

export function createP1ProductMapper({ availableQtyMeaning } = {}) {
  if (!stockSemantics.has(availableQtyMeaning)) {
    throw new ProductMappingError("P1_STOCK_SEMANTICS_UNCONFIRMED");
  }

  return {
    fromDatabase(row) {
      if (
        !isRecord(row) ||
        typeof row.stock_code !== "string" ||
        !row.stock_code.trim() ||
        typeof row.description !== "string" ||
        !row.description.trim()
      ) {
        throw new ProductMappingError("P1_PRODUCT_SCHEMA_MISMATCH");
      }

      const id = readInteger(row.product_id, 1);
      const quantity = readInteger(row.available_qty);
      const reserved = readInteger(row.reserved_qty);
      const onHand =
        availableQtyMeaning === "available_qty_is_on_hand"
          ? quantity
          : quantity + reserved;
      const available = onHand - reserved;

      if (!Number.isSafeInteger(onHand) || available < 0) {
        throw new ProductMappingError("P1_PRODUCT_SCHEMA_MISMATCH");
      }

      return {
        id,
        sku: row.stock_code,
        name: row.description,
        category: null,
        unit_price: formatPrice(row.unit_price),
        on_hand: onHand,
        reserved,
        available,
      };
    },

    toDatabase(input) {
      if (
        !isRecord(input) ||
        typeof input.name !== "string" ||
        !input.name.trim()
      ) {
        throw new ProductMappingError("INVALID_PRODUCT_INPUT");
      }

      if (
        input.category !== undefined &&
        input.category !== null &&
        input.category !== ""
      ) {
        throw new ProductMappingError("PRODUCT_FIELD_UNSUPPORTED");
      }

      if (
        typeof input.sku !== "string" ||
        !input.sku.trim() ||
        Array.from(input.sku).length > 50
      ) {
        throw new ProductMappingError("P1_PRODUCT_VALUE_OUT_OF_RANGE");
      }

      const price = formatPrice(
        input.unit_price,
        "P1_PRODUCT_VALUE_OUT_OF_RANGE",
      );
      return {
        stock_code: input.sku,
        description: input.name,
        unit_price: price,
      };
    },
  };
}

export function createP1ProductAdapter({
  operations,
  availableQtyMeaning,
} = {}) {
  if (
    !operations ||
    typeof operations.listProducts !== "function" ||
    typeof operations.createProduct !== "function"
  ) {
    throw new TypeError("P1 listProducts and createProduct operations are required.");
  }

  const mapper = createP1ProductMapper({ availableQtyMeaning });

  return {
    async listProducts() {
      const rows = await operations.listProducts();
      if (!Array.isArray(rows)) {
        throw new ProductMappingError("P1_PRODUCT_SCHEMA_MISMATCH");
      }
      return rows.map(mapper.fromDatabase);
    },

    async createProduct(input) {
      const row = await operations.createProduct(mapper.toDatabase(input));
      return mapper.fromDatabase(row);
    },
  };
}
