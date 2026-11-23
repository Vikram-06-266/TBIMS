import { Router } from "express";
import { defaultP1Operations } from "../engines/dbms/p1-operations.js";
import { defaultAuthService } from "../auth/auth-service.js";
import { requireAuthentication, requireRoles } from "../middleware/authentication.js";

export function createOrdersRouter(operations = defaultP1Operations, authService = defaultAuthService) {
  const router = Router();
  if (authService) {
    router.use(requireAuthentication(authService));
  }

  // GET /api/orders
  router.get("/", requireRoles("owner", "admin", "inventoryManager", "staff", "customer"), async (req, res, next) => {
    try {
      const isCustomer = req.user.role === "customer";
      const filter = isCustomer ? { customerName: req.user.username } : {};
      const orders = await operations.listOrders(filter);
      res.json({ ok: true, orders });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/orders/:id
  router.get("/:id", requireRoles("owner", "admin", "inventoryManager", "staff", "customer"), async (req, res, next) => {
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

  // POST /api/orders (reserve stock and create pending order)
  router.post("/", requireRoles("owner", "admin", "inventoryManager", "staff", "customer"), async (req, res, next) => {
    try {
      const { customerName, items } = req.body || {};
      const effectiveCustomer = req.user.role === "customer" ? req.user.username : (customerName || "").trim();

      if (!effectiveCustomer) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_CUSTOMER", message: "Customer name is required." },
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          ok: false,
          error: { code: "EMPTY_ORDER", message: "At least one item is required." },
        });
      }

      const order = await operations.reserveOrder({
        customerName: effectiveCustomer,
        items,
        userId: req.user?.id || null,
        performedBy: req.user?.username || null,
      });

      res.status(201).json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/orders/:id/confirm
  router.post("/:id/confirm", requireRoles("owner", "admin", "inventoryManager", "staff"), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const confirmed = await operations.confirmOrder({
        orderId,
        userId: req.user?.id || null,
        performedBy: req.user?.username || null,
      });
      res.json({ ok: true, order: confirmed });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/orders/:id/cancel
  router.post("/:id/cancel", requireRoles("owner", "admin", "inventoryManager", "staff", "customer"), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      if (req.user.role === "customer" && typeof operations.getOrderById === "function") {
        const order = await operations.getOrderById(orderId);
        if (!order) {
          return res.status(404).json({
            ok: false,
            error: { code: "ORDER_NOT_FOUND", message: `Order ${orderId} not found.` },
          });
        }
        if (order.customerName !== req.user.username) {
          return res.status(403).json({
            ok: false,
            error: { code: "FORBIDDEN", message: "You are not authorized to cancel another customer's order." },
          });
        }
      }

      const cancelled = await operations.cancelOrder({
        orderId,
        userId: req.user?.id || null,
        performedBy: req.user?.username || null,
      });
      res.json({ ok: true, order: cancelled });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/orders/:id/return
  router.post("/:id/return", requireRoles("owner", "admin", "inventoryManager", "staff"), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const { productId, productSku, sku, quantity, reason } = req.body || {};
      const parsedQty = parseInt(quantity, 10);
      if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_QUANTITY", message: "Return quantity must be a positive integer." },
        });
      }

      const returnResult = await operations.processReturn({
        orderId,
        productId,
        sku: sku || productSku,
        quantity: parsedQty,
        reason: reason || "Customer return",
        userId: req.user?.id || null,
        performedBy: req.user?.username || null,
      });

      res.json({ ok: true, return: returnResult });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createOrdersRouter();
