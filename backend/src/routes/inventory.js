import { Router } from "express";
import { defaultP1Operations } from "../engines/dbms/p1-operations.js";
import { defaultAuthService } from "../auth/auth-service.js";
import { requireAuthentication, requireRoles } from "../middleware/authentication.js";

export function createInventoryRouter(operations = defaultP1Operations, authService = defaultAuthService) {
  const router = Router();
  if (authService) {
    router.use(requireAuthentication(authService));
  }

  // GET /api/inventory/kpis
  router.get("/kpis", requireRoles("owner", "admin", "inventoryManager", "staff"), async (_req, res, next) => {
    try {
      const kpis = await operations.getDashboardKpis();
      res.json({ ok: true, kpis });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/inventory/ledger
  router.get("/ledger", requireRoles("owner", "admin", "inventoryManager"), async (_req, res, next) => {
    try {
      const movements = await operations.listStockLedger();
      res.json({ ok: true, movements });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/inventory/receive
  router.post("/receive", requireRoles("owner", "admin", "inventoryManager"), async (req, res, next) => {
    try {
      const { productId, sku, productSku, quantity, referenceId, reference, description } = req.body || {};
      const targetSku = sku || productSku;
      const parsedQty = parseInt(quantity, 10);
      if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({
          ok: false,
          error: { code: "INVALID_QUANTITY", message: "Received quantity must be a positive integer." },
        });
      }

      const updated = await operations.receiveStock({
        productId,
        sku: targetSku,
        quantity: parsedQty,
        referenceId: referenceId || reference || "",
        description: description || "Stock intake received into inventory",
        userId: req.user?.id || null,
        performedBy: req.user?.username || null,
      });

      res.status(200).json({ ok: true, product: updated });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createInventoryRouter();
