import { config } from "dotenv";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { defaultAuthService } from "./auth/auth-service.js";
import { closeDatabasePool } from "./engines/dbms/pool.js";
import { defaultP1Operations } from "./engines/dbms/p1-operations.js";
import { createAuthRouter } from "./routes/auth.js";
import healthRouter from "./routes/health.js";
import { createProductRouter } from "./routes/products.js";
import { createInventoryRouter } from "./routes/inventory.js";
import { createOrdersRouter } from "./routes/orders.js";
import { createAuditRouter } from "./routes/audit.js";
import { createShopRouter } from "./routes/shop.js";
import {
  createProductService,
  defaultProductAdapters,
} from "./services/product-service.js";

// Load backend/.env and optional root .env
config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export const defaultLiveProductAdapters = {
  p1: defaultP1Operations,
  p2: defaultProductAdapters.p2,
};

export function createApp({
  productAdapters,
  authService = defaultAuthService,
  p1Operations = defaultP1Operations,
} = {}) {
  const app = express();
  const resolvedProductAdapters = productAdapters || defaultLiveProductAdapters;
  const productService = createProductService(resolvedProductAdapters);

  app.use(requestId);
  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api/auth", createAuthRouter(authService));
  app.use(
    "/api/products",
    createProductRouter(productService, authService),
  );
  app.use("/api/inventory", createInventoryRouter(p1Operations, authService));
  app.use("/api/orders", createOrdersRouter(p1Operations, authService));
  app.use("/api/audit-logs", createAuditRouter(p1Operations, authService));
  app.use("/api/shop", createShopRouter(p1Operations, authService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

const port = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, () => console.log(`API listening on port ${port}`));
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    server.close(async (error) => {
      try {
        await closeDatabasePool();
      } catch {
        console.error("Could not close the PostgreSQL connection pool safely.");
        process.exitCode = 1;
      }
      if (error) {
        console.error("The API server did not close cleanly.");
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

export default app;
