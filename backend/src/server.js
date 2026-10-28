import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "transaction-inventory-system" });
});

const port = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`API listening on port ${port}`));
}

export default app;
