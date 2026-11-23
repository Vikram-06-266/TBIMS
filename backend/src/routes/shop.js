import { Router } from "express";
import { defaultP1Operations } from "../engines/dbms/p1-operations.js";
import { defaultAuthService } from "../auth/auth-service.js";
import { requireAuthentication } from "../middleware/authentication.js";

// In-memory idempotency cache for duplicate request suppression
const idempotencyCache = new Map();

export function createShopRouter(operations = defaultP1Operations, authService = defaultAuthService) {
  const router = Router();
  if (authService) {
    router.use(requireAuthentication(authService));
  }

  // GET /api/shop/products (customer catalogue)
  router.get("/products", async (req, res, next) => {
    try {
      const { query, search, limit, offset } = req.query;
      const searchQuery = query || search || "";
      const products = await operations.listCustomerProducts({
        query: searchQuery,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      res.json({ ok: true, products, count: products.length });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/shop/products/:id (customer product detail)
  router.get("/products/:id", async (req, res, next) => {
    try {
      const product = await operations.getCustomerProductById(req.params.id);
      if (!product) {
        return res.status(404).json({
          ok: false,
          error: { code: "PRODUCT_NOT_FOUND", message: `Product ${req.params.id} not found.` },
        });
      }
      res.json({ ok: true, product });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/shop/checkout (customer cart order placement)
  router.post("/checkout", async (req, res, next) => {
    try {
      const { items, idempotencyKey } = req.body || {};
      const key = idempotencyKey || req.get("X-Idempotency-Key");

      // Idempotency check
      if (key) {
        const cacheId = `${req.user.username}:${key}`;
        if (idempotencyCache.has(cacheId)) {
          const cached = idempotencyCache.get(cacheId);
          return res.status(200).json({ ok: true, order: cached, idempotentReplay: true });
        }
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          ok: false,
          error: { code: "EMPTY_CART", message: "Cart contains no items to checkout." },
        });
      }

      // Validate item quantities
      const sanitizedItems = [];
      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (!Number.isInteger(qty) || qty <= 0) {
          return res.status(400).json({
            ok: false,
            error: { code: "INVALID_QUANTITY", message: `Quantity for item must be a positive integer.` },
          });
        }
        if (!item.productId && !item.productSku && !item.sku) {
          return res.status(400).json({
            ok: false,
            error: { code: "MISSING_PRODUCT", message: "Each item must have a product ID or SKU." },
          });
        }
        sanitizedItems.push({
          productId: item.productId,
          productSku: item.productSku || item.sku,
          quantity: qty,
        });
      }

      // Customer name is strictly derived from authenticated session
      const customerName = req.user.username;

      const order = await operations.reserveOrder({
        customerName,
        items: sanitizedItems,
        userId: req.user?.id || null,
        performedBy: req.user.username,
      });

      if (key) {
        const cacheId = `${req.user.username}:${key}`;
        idempotencyCache.set(cacheId, order);
        if (idempotencyCache.size > 1000) {
          const firstKey = idempotencyCache.keys().next().value;
          idempotencyCache.delete(firstKey);
        }
      }

      res.status(201).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/shop/orders (customer order history)
  router.get("/orders", async (req, res, next) => {
    try {
      const orders = await operations.listOrders({ customerName: req.user.username });
      res.json({ ok: true, orders });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/shop/orders/:id (customer order details)
  router.get("/orders/:id", async (req, res, next) => {
    try {
      const order = await operations.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({
          ok: false,
          error: { code: "ORDER_NOT_FOUND", message: `Order ${req.params.id} not found.` },
        });
      }
      if (req.user.role === "customer" && order.customerName !== req.user.username) {
        return res.status(403).json({
          ok: false,
          error: { code: "FORBIDDEN", message: "You are not authorized to view another customer's order." },
        });
      }
      res.json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/shop/orders/:id/cancel (customer self-cancellation of pending orders)
  router.post("/orders/:id/cancel", async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const order = await operations.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          ok: false,
          error: { code: "ORDER_NOT_FOUND", message: `Order ${orderId} not found.` },
        });
      }

      if (req.user.role === "customer" && order.customerName !== req.user.username) {
        return res.status(403).json({
          ok: false,
          error: { code: "FORBIDDEN", message: "You are not authorized to cancel another customer's order." },
        });
      }

      if (order.status !== "PENDING") {
        return res.status(400).json({
          ok: false,
          error: {
            code: "ORDER_NOT_CANCELLABLE",
            message: `Order cannot be cancelled because its status is "${order.status}".`,
          },
        });
      }

      const cancelled = await operations.cancelOrder({
        orderId,
        userId: req.user?.id || null,
        performedBy: req.user.username,
      });

      res.json({ ok: true, order: cancelled });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createShopRouter();
