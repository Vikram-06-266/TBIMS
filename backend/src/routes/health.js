import { Router } from "express";
import { defaultP1Operations } from "../engines/dbms/p1-operations.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "transaction-inventory-system" });
});

router.get("/health/db", async (_req, res) => {
  try {
    const health = await defaultP1Operations.checkHealth();
    if (!health.ok) {
      return res.status(503).json({
        ok: false,
        status: "unavailable",
        error: health.message,
        code: health.code,
      });
    }

    const inspect = await defaultP1Operations.inspectDatabase();
    return res.json({
      ok: true,
      status: "connected",
      database: health.database,
      serverTime: health.serverTime,
      tables: inspect.tables,
      counts: inspect.counts,
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      status: "error",
      error: error.message || "Database connection failed.",
      code: error.code || "DATABASE_ERROR",
    });
  }
});

export default router;
