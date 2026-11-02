import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import healthRouter from "./routes/health.js";

const app = express();
app.use(requestId);
app.use(express.json());

app.use("/api", healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`API listening on port ${port}`));
}

export default app;
