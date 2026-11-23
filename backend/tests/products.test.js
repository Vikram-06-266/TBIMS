import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/server.js";
let searchProducts = null;
try {
  const dsaModule = await import("../src/engines/dsa/product-search.js");
  searchProducts = dsaModule.searchProducts;
} catch (error) {
  if (
    error?.code === "ERR_MODULE_NOT_FOUND" &&
    (error?.url?.includes("product-search.js") || error?.message?.includes("product-search.js"))
  ) {
    searchProducts = null;
  } else {
    throw error;
  }
}
import { defaultProductAdapters } from "../src/services/product-service.js";
import { AuthServiceError } from "../src/auth/auth-service.js";

const testTokens = {
  owner: "test-owner",
  admin: "test-admin",
  inventoryManager: "test-inventory-manager",
  staff: "test-staff",
  customer: "test-customer",
};

const testAuthService = {
  authenticate(token) {
    const role = Object.keys(testTokens).find(
      (candidate) => testTokens[candidate] === token,
    );
    if (!role) throw new AuthServiceError("UNAUTHENTICATED");
    return { username: `${role}@example.test`, role };
  },
};

function request(app) {
  const agent = supertest(app);
  return {
    get(path) {
      return agent
        .get(path)
        .set("Authorization", `Bearer ${testTokens.admin}`);
    },
    post(path) {
      return agent
        .post(path)
        .set("Authorization", `Bearer ${testTokens.admin}`);
    },
  };
}

function createTestApp({
  p1 = {},
  p2 = {},
  authService = testAuthService,
} = {}) {
  return createApp({ productAdapters: { p1, p2 }, authService });
}

const product = {
  id: 7,
  sku: "SKU-007",
  name: "Desk lamp",
  category: "Lighting",
  unit_price: "12.50",
  on_hand: 0,
  reserved: 0,
  available: 0,
};

describe("GET /api/products", () => {
  it("lists products without requiring a search adapter when no filters are given", async () => {
    const listProducts = vi.fn().mockResolvedValue([product]);
    const app = createTestApp({ p1: { listProducts } });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { products: [product] },
      requestId: response.headers["x-request-id"],
    });
    expect(listProducts).toHaveBeenCalledOnce();
  });

  it("passes validated filters from the P1 listing adapter to P2 search", async () => {
    const listProducts = vi.fn().mockResolvedValue([product]);
    const searchProducts = vi.fn().mockResolvedValue([product]);
    const app = createTestApp({
      p1: { listProducts },
      p2: { searchProducts },
    });

    const response = await request(app)
      .get("/api/products")
      .query({ sku: " SKU-007 ", name: "lamp", category: "Lighting" });

    expect(response.status).toBe(200);
    expect(listProducts).toHaveBeenCalledOnce();
    expect(searchProducts).toHaveBeenCalledWith([product], {
      sku: "SKU-007",
      name: "lamp",
      category: "Lighting",
    });
    expect(response.body.data.products).toEqual([product]);
  });

  it("uses the available local search engine when the default P2 adapter is selected", async () => {
    const listProducts = vi.fn().mockResolvedValue([
      product,
      { ...product, id: 8, sku: "SKU-008", name: "Desk chair" },
    ]);
    const app = createTestApp({
      p1: { listProducts },
      p2: defaultProductAdapters.p2,
    });

    const response = await request(app)
      .get("/api/products")
      .query({ name: "LAMP" });

    expect(response.status).toBe(200);
    expect(response.body.data.products).toEqual([product]);
  });

  it.each([
    ["unknown parameter", { extra: "value" }],
    ["empty SKU", { sku: " " }],
    ["invalid lowStock value", { lowStock: "sometimes" }],
  ])("rejects an invalid query (%s)", async (_caseName, query) => {
    const listProducts = vi.fn();
    const app = createTestApp({ p1: { listProducts } });

    const response = await request(app).get("/api/products").query(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PRODUCT_QUERY");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("reports lowStock as unsupported until a threshold is defined", async () => {
    const app = createTestApp({
      p1: { listProducts: vi.fn() },
      p2: { searchProducts: vi.fn() },
    });

    const response = await request(app).get("/api/products?lowStock=true");

    expect(response.status).toBe(501);
    expect(response.body.error.code).toBe("LOW_STOCK_FILTER_UNAVAILABLE");
    expect(response.body.error.message).toMatch(/threshold/i);
  });

  it("fails safely when the P1 listing adapter is missing", async () => {
    const response = await request(createTestApp()).get("/api/products");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("PRODUCT_DATA_UNAVAILABLE");
  });

  it("fails safely when P2 search is missing for a filtered request", async () => {
    const listProducts = vi.fn().mockResolvedValue([product]);
    const response = await request(
      createTestApp({ p1: { listProducts } }),
    ).get("/api/products?sku=SKU-007");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("PRODUCT_SEARCH_UNAVAILABLE");
    expect(listProducts).not.toHaveBeenCalled();
  });
});

describe("POST /api/products", () => {
  it("creates a product through an injected P1 adapter", async () => {
    const createProduct = vi.fn().mockResolvedValue(product);
    const app = createTestApp({ p1: { createProduct } });

    const response = await request(app)
      .post("/api/products")
      .send({
        sku: " SKU-007 ",
        name: " Desk lamp ",
        category: "Lighting",
        unit_price: "12.50",
      });

    expect(response.status).toBe(201);
    expect(createProduct).toHaveBeenCalledWith({
      sku: "SKU-007",
      name: "Desk lamp",
      category: "Lighting",
      unit_price: "12.50",
    });
    expect(response.body).toEqual({
      ok: true,
      data: { product },
      requestId: response.headers["x-request-id"],
    });
  });

  it.each([
    ["missing SKU", { name: "Desk lamp", unit_price: "12.50" }],
    ["blank name", { sku: "SKU-007", name: " ", unit_price: "12.50" }],
    ["negative price", { sku: "SKU-007", name: "Desk lamp", unit_price: -1 }],
    [
      "price with excess precision",
      { sku: "SKU-007", name: "Desk lamp", unit_price: "12.501" },
    ],
    [
      "price above database precision",
      { sku: "SKU-007", name: "Desk lamp", unit_price: "10000000000" },
    ],
    [
      "client-supplied stock",
      { sku: "SKU-007", name: "Desk lamp", unit_price: "12.50", on_hand: 5 },
    ],
    [
      "client-supplied ID",
      { id: 7, sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" },
    ],
  ])("rejects invalid input (%s)", async (_caseName, body) => {
    const createProduct = vi.fn();
    const response = await request(
      createTestApp({ p1: { createProduct } }),
    )
      .post("/api/products")
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PRODUCT_INPUT");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("maps a stable duplicate-SKU adapter error without exposing internals", async () => {
    const createProduct = vi.fn().mockRejectedValue(
      Object.assign(new Error("duplicate key; SQL and connection details"), {
        code: "DUPLICATE_SKU",
      }),
    );
    const response = await request(
      createTestApp({ p1: { createProduct } }),
    )
      .post("/api/products")
      .send({ sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" });

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: "DUPLICATE_SKU",
      message: "A product with this SKU already exists.",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/SQL|connection details/i);
  });

  it("returns service unavailable instead of fake success when P1 creation is missing", async () => {
    const response = await request(createTestApp())
      .post("/api/products")
      .send({ sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: "PRODUCT_DATA_UNAVAILABLE" },
    });
    expect(response.body).not.toHaveProperty("data");
  });

  it("includes the request ID in product error responses", async () => {
    const response = await request(createTestApp())
      .get("/api/products")
      .set("X-Request-ID", "products-error-test");

    expect(response.status).toBe(503);
    expect(response.body.requestId).toBe("products-error-test");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("default product API configuration", () => {
  it("uses the available search engine without claiming missing P1 operations", () => {
    expect(defaultProductAdapters.p1).toEqual({});
    if (searchProducts) {
      expect(defaultProductAdapters.p2.searchProducts).toBe(searchProducts);
    } else {
      expect(defaultProductAdapters.p2.searchProducts).toBeUndefined();
    }
  });
});

describe("product role authorization", () => {
  it.each([
    ["owner", testTokens.owner],
    ["admin", testTokens.admin],
    ["inventoryManager", testTokens.inventoryManager],
  ])("%s can create products", async (_role, token) => {
    const createProduct = vi.fn().mockResolvedValue(product);
    const response = await supertest(
      createTestApp({ p1: { createProduct } }),
    )
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" });

    expect(response.status).toBe(201);
    expect(createProduct).toHaveBeenCalledOnce();
  });

  it("allows staff to read products but forbids product creation", async () => {
    const listProducts = vi.fn().mockResolvedValue([product]);
    const createProduct = vi.fn();
    const app = createTestApp({ p1: { listProducts, createProduct } });
    const readResponse = await supertest(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${testTokens.staff}`);
    const createResponse = await supertest(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${testTokens.staff}`)
      .send({ sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" });

    expect(readResponse.status).toBe(200);
    expect(createResponse.status).toBe(403);
    expect(createResponse.body.error.code).toBe("FORBIDDEN");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("forbids customers from accessing internal product data", async () => {
    const listProducts = vi.fn().mockResolvedValue([product]);
    const response = await supertest(
      createTestApp({ p1: { listProducts } }),
    )
      .get("/api/products")
      .set("Authorization", `Bearer ${testTokens.customer}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("forbids customer product creation", async () => {
    const createProduct = vi.fn();
    const response = await supertest(
      createTestApp({ p1: { createProduct } }),
    )
      .post("/api/products")
      .set("Authorization", `Bearer ${testTokens.customer}`)
      .send({ sku: "SKU-007", name: "Desk lamp", unit_price: "12.50" });

    expect(response.status).toBe(403);
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("requires authentication before product query validation", async () => {
    const listProducts = vi.fn();
    const response = await supertest(
      createTestApp({ p1: { listProducts } }),
    ).get("/api/products?unknown=value");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(listProducts).not.toHaveBeenCalled();
  });
});
