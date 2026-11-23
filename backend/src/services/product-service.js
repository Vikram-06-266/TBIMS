let dsaSearchProducts = null;
try {
  const dsaModule = await import("../engines/dsa/product-search.js");
  dsaSearchProducts = dsaModule.searchProducts;
} catch (error) {
  // Only catch the specific module-not-found error for the optional P2 engine
  if (
    error?.code === "ERR_MODULE_NOT_FOUND" &&
    (error?.url?.includes("product-search.js") || error?.message?.includes("product-search.js"))
  ) {
    dsaSearchProducts = null;
  } else {
    // Do not hide unrelated errors (e.g. syntax, runtime) from an existing P2 module
    throw error;
  }
}

export const defaultProductAdapters = {
  p1: {},
  p2: typeof dsaSearchProducts === "function" ? { searchProducts: dsaSearchProducts } : {},
};

const adapterErrorResponses = {
  DUPLICATE_SKU: "DUPLICATE_SKU",
  INVALID_PRODUCT: "INVALID_PRODUCT_INPUT",
  DATABASE_UNAVAILABLE: "PRODUCT_DATA_UNAVAILABLE",
};

export class ProductServiceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function mapAdapterError(error) {
  if (error && typeof error === "object") {
    const mappedError = Object.hasOwn(adapterErrorResponses, error.code)
      ? adapterErrorResponses[error.code]
      : undefined;
    if (mappedError) {
      return new ProductServiceError(mappedError);
    }
  }

  return error instanceof Error ? error : new Error("The product adapter failed.");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createProductService({
  p1 = defaultProductAdapters.p1,
  p2 = defaultProductAdapters.p2,
} = {}) {
  return {
    async listProducts(filters = {}) {
      if (filters.lowStock !== undefined) {
        throw new ProductServiceError("LOW_STOCK_FILTER_UNAVAILABLE");
      }

      const hasSearchFilters = Object.keys(filters).length > 0;
      if (typeof p1.listProducts !== "function") {
        throw new ProductServiceError("PRODUCT_DATA_UNAVAILABLE");
      }
      if (hasSearchFilters && typeof p2.searchProducts !== "function") {
        throw new ProductServiceError("PRODUCT_SEARCH_UNAVAILABLE");
      }

      let products;
      try {
        products = await p1.listProducts();
      } catch (error) {
        throw mapAdapterError(error);
      }
      if (!Array.isArray(products)) {
        throw new Error("The product listing adapter returned an invalid result.");
      }

      if (!hasSearchFilters) {
        return products;
      }

      let matchingProducts;
      try {
        matchingProducts = await p2.searchProducts(products, filters);
      } catch (error) {
        throw mapAdapterError(error);
      }
      if (!Array.isArray(matchingProducts)) {
        throw new Error("The product search adapter returned an invalid result.");
      }

      return matchingProducts;
    },

    async createProduct(input) {
      if (typeof p1.createProduct !== "function") {
        throw new ProductServiceError("PRODUCT_DATA_UNAVAILABLE");
      }

      let product;
      try {
        product = await p1.createProduct(input);
      } catch (error) {
        throw mapAdapterError(error);
      }
      if (!isRecord(product)) {
        throw new Error("The product creation adapter returned an invalid result.");
      }

      return product;
    },

    async updateProduct(input) {
      if (typeof p1.updateProduct !== "function") {
        throw new ProductServiceError("PRODUCT_DATA_UNAVAILABLE");
      }

      let product;
      try {
        product = await p1.updateProduct(input);
      } catch (error) {
        throw mapAdapterError(error);
      }
      return product;
    },
  };
}
