export function notFoundHandler(_req, _res, next) {
  const error = new Error("Route not found.");
  error.code = "NOT_FOUND";
  next(error);
}

export function errorHandler(error, req, res, _next) {
  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";

  if (error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body must contain valid JSON.";
  } else if (error.code === "NOT_FOUND") {
    status = 404;
    code = "NOT_FOUND";
    message = "Route not found.";
  }

  res.status(status).json({
    ok: false,
    error: { code, message },
    requestId: req.requestId,
  });
}
