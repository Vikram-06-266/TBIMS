import { Router } from "express";
import { defaultP1Operations } from "../engines/dbms/p1-operations.js";
import { defaultAuthService } from "../auth/auth-service.js";
import { requireAuthentication, requireRoles } from "../middleware/authentication.js";

export function createAuditRouter(operations = defaultP1Operations, authService = defaultAuthService) {
  const router = Router();
  if (authService) {
    router.use(requireAuthentication(authService));
  }

  // GET /api/audit-logs
  router.get("/", requireRoles("owner", "admin"), async (_req, res, next) => {
    try {
      const logs = await operations.listAuditLogs();
      res.json({ ok: true, logs });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createAuditRouter();
