import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/server.js";
import { AuthServiceError } from "../src/auth/auth-service.js";

const testTokens = {
  owner: "token-owner",
  admin: "token-admin",
  manager: "token-manager",
  staff: "token-staff",
  customer: "token-customer",
};

const mockAuthService = {
  authenticate(token) {
    const entry = Object.entries(testTokens).find(([, t]) => t === token);
    if (!entry) throw new AuthServiceError("UNAUTHENTICATED");
    const roleKey = entry[0];
    const role = roleKey === "manager" ? "inventoryManager" : roleKey;
    return { username: roleKey, role };
  },
};

function createMockP1Operations() {
  return {
    async checkHealth() {
      return { ok: true, database: "test_db", serverTime: new Date().toISOString() };
    },
    async inspectDatabase() {
      return { ok: true, tables: ["products", "inventory"], counts: { products: 10, inventory: 10 } };
    },
    async listProducts() {
      return [{ id: 1, sku: "SKU1", name: "Prod 1", unit_price: "10.00", on_hand: 5, reserved: 1, available: 4 }];
    },
    async createProduct({ sku, name, unit_price }) {
      return { id: 2, sku, name, unit_price, on_hand: 0, reserved: 0, available: 0 };
    },
    async updateProduct({ id, sku, name, unit_price }) {
      return { id: id || 1, sku: sku || "SKU1", name: name || "Updated", unit_price: unit_price || "15.00" };
    },
    async getDashboardKpis() {
      return { products: 10, onHand: 100, reserved: 10, available: 90, lowStock: 2 };
    },
    async listStockLedger() {
      return [{ id: 1, transactionId: 1, type: "PURCHASE", productSku: "SKU1", quantityChange: 10, availableAfter: 10, reservedAfter: 0 }];
    },
    async receiveStock({ sku, quantity, referenceId }) {
      return { id: 1, sku: sku || "SKU1", name: "Prod 1", on_hand: 20, reserved: 0, available: 20 };
    },
    async listOrders() {
      return [{ id: "1", orderNumber: "ORD-2026-001", customerName: "customer", status: "PENDING", items: [] }];
    },
    async getOrderById(orderId) {
      return { id: orderId, orderNumber: `ORD-2026-${orderId}`, customerName: "customer", status: "PENDING", items: [] };
    },
    async listCustomerProducts() {
      return [{ id: 1, sku: "SKU1", name: "Prod 1", unit_price: "10.00", available: 4, in_stock: true }];
    },
    async getCustomerProductById(id) {
      return { id, sku: "SKU1", name: "Prod 1", unit_price: "10.00", available: 4, in_stock: true };
    },
    async reserveOrder({ customerName, items }) {
      return { id: "2", orderNumber: "ORD-2026-002", customerName, status: "PENDING", totalAmount: "25.00" };
    },
    async confirmOrder({ orderId }) {
      return { id: orderId, orderNumber: `ORD-2026-${orderId}`, status: "CONFIRMED" };
    },
    async cancelOrder({ orderId }) {
      return { id: orderId, orderNumber: `ORD-2026-${orderId}`, status: "CANCELLED" };
    },
    async processReturn({ orderId, productId, quantity }) {
      return { productId: productId || 1, returnedQuantity: quantity, availableAfter: 10, on_hand: 10, available: 10 };
    },
    async listAuditLogs() {
      return [{ id: 1, action: "STOCK_RECEIVED", details: "Received 5 units", performedBy: "admin" }];
    },
  };
}

describe("inventory and order API integration", () => {
  const p1 = createMockP1Operations();
  const app = createApp({
    authService: mockAuthService,
    p1Operations: p1,
    productAdapters: { p1, p2: { searchProducts: async (p) => p } },
  });
  const client = supertest(app);

  it("GET /api/inventory/kpis returns KPIs for authorized roles", async () => {
    const res = await client
      .get("/api/inventory/kpis")
      .set("Authorization", `Bearer ${testTokens.admin}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.kpis.products).toBe(10);
  });

  it("GET /api/inventory/kpis rejects unauthenticated requests", async () => {
    const res = await client.get("/api/inventory/kpis");
    expect(res.status).toBe(401);
  });

  it("GET /api/inventory/kpis forbids customer role", async () => {
    const res = await client
      .get("/api/inventory/kpis")
      .set("Authorization", `Bearer ${testTokens.customer}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/inventory/receive accepts stock intake from manager", async () => {
    const res = await client
      .post("/api/inventory/receive")
      .set("Authorization", `Bearer ${testTokens.manager}`)
      .send({ sku: "SKU1", quantity: 5, referenceId: "REF-001" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.product.available).toBe(20);
  });

  it("POST /api/inventory/receive rejects staff and customer roles", async () => {
    const staffRes = await client
      .post("/api/inventory/receive")
      .set("Authorization", `Bearer ${testTokens.staff}`)
      .send({ sku: "SKU1", quantity: 5 });
    expect(staffRes.status).toBe(403);
  });

  it("POST /api/inventory/receive rejects non-positive quantity", async () => {
    const res = await client
      .post("/api/inventory/receive")
      .set("Authorization", `Bearer ${testTokens.admin}`)
      .send({ sku: "SKU1", quantity: -2 });
    expect(res.status).toBe(400);
  });

  it("POST /api/orders creates order and reserves stock", async () => {
    const res = await client
      .post("/api/orders")
      .set("Authorization", `Bearer ${testTokens.staff}`)
      .send({
        customerName: "Alice",
        items: [{ productSku: "SKU1", quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.order.orderNumber).toBe("ORD-2026-002");
  });

  it("POST /api/orders rejects empty customer name or empty items", async () => {
    const emptyCustomer = await client
      .post("/api/orders")
      .set("Authorization", `Bearer ${testTokens.staff}`)
      .send({ customerName: "", items: [{ productSku: "SKU1", quantity: 1 }] });
    expect(emptyCustomer.status).toBe(400);

    const emptyItems = await client
      .post("/api/orders")
      .set("Authorization", `Bearer ${testTokens.staff}`)
      .send({ customerName: "Bob", items: [] });
    expect(emptyItems.status).toBe(400);
  });

  it("POST /api/orders/:id/confirm confirms order for staff/manager/admin", async () => {
    const res = await client
      .post("/api/orders/1/confirm")
      .set("Authorization", `Bearer ${testTokens.staff}`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("CONFIRMED");
  });

  it("POST /api/orders/:id/cancel cancels order", async () => {
    const res = await client
      .post("/api/orders/1/cancel")
      .set("Authorization", `Bearer ${testTokens.customer}`);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("CANCELLED");
  });

  it("POST /api/orders/:id/return processes return for manager/admin", async () => {
    const res = await client
      .post("/api/orders/1/return")
      .set("Authorization", `Bearer ${testTokens.manager}`)
      .send({ productId: 1, quantity: 1, reason: "Defective item" });
    expect(res.status).toBe(200);
    expect(res.body.return.returnedQuantity).toBe(1);
  });

  it("GET /api/audit-logs allows admin and owner, forbids staff", async () => {
    const adminRes = await client
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${testTokens.admin}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.logs.length).toBeGreaterThan(0);

    const staffRes = await client
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${testTokens.staff}`);
    expect(staffRes.status).toBe(403);
  });

  it("PUT /api/products/:id updates product details for authorized roles", async () => {
    const res = await client
      .put("/api/products/1")
      .set("Authorization", `Bearer ${testTokens.admin}`)
      .send({ name: "Updated Name", unit_price: "19.99" });
    expect(res.status).toBe(200);
    expect(res.body.data.product.name).toBe("Updated Name");
  });

  describe("Customer shopping and ordering workflow", () => {
    it("GET /api/shop/products returns safe catalogue without internal counts", async () => {
      const res = await client
        .get("/api/shop/products")
        .set("Authorization", `Bearer ${testTokens.customer}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.products).toBeInstanceOf(Array);
      expect(res.body.products[0]).toHaveProperty("sku");
      expect(res.body.products[0]).toHaveProperty("available");
      expect(res.body.products[0]).not.toHaveProperty("on_hand");
      expect(res.body.products[0]).not.toHaveProperty("reserved");
    });

    it("POST /api/shop/checkout completes checkout with atomic stock reservation", async () => {
      const res = await client
        .post("/api/shop/checkout")
        .set("Authorization", `Bearer ${testTokens.customer}`)
        .send({
          items: [{ productId: 1, quantity: 2 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.order).toBeDefined();
      expect(res.body.order.status).toBe("PENDING");
      expect(res.body.order.customerName).toBe("customer");
    });

    it("POST /api/shop/checkout rejects empty or non-array items", async () => {
      const res = await client
        .post("/api/shop/checkout")
        .set("Authorization", `Bearer ${testTokens.customer}`)
        .send({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("EMPTY_CART");
    });

    it("GET /api/shop/orders returns customer's orders", async () => {
      const res = await client
        .get("/api/shop/orders")
        .set("Authorization", `Bearer ${testTokens.customer}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.orders).toBeInstanceOf(Array);
    });

    it("POST /api/shop/orders/:id/cancel cancels customer's pending order", async () => {
      const res = await client
        .post("/api/shop/orders/1/cancel")
        .set("Authorization", `Bearer ${testTokens.customer}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.order.status).toBe("CANCELLED");
    });

    it("customer is forbidden from confirming orders directly", async () => {
      const res = await client
        .post("/api/orders/1/confirm")
        .set("Authorization", `Bearer ${testTokens.customer}`);
      expect(res.status).toBe(403);
    });

    it("customer is forbidden from accessing internal products endpoint", async () => {
      const res = await client
        .get("/api/products")
        .set("Authorization", `Bearer ${testTokens.customer}`);
      expect(res.status).toBe(403);
    });
  });
});
