import { randomUUID } from "node:crypto";

const requestIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export function requestId(req, res, next) {
  const suppliedRequestId = req.get("X-Request-ID");
  req.requestId =
    suppliedRequestId && requestIdPattern.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  res.setHeader("X-Request-ID", req.requestId);
  next();
}
