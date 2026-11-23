export function notFoundHandler(_req, _res, next) {
  const error = new Error("Route not found.");
  error.code = "NOT_FOUND";
  next(error);
}

export function errorHandler(error, req, res, _next) {
  const publicErrors = {
    INVALID_AUTH_INPUT: {
      status: 400,
      code: "INVALID_AUTH_INPUT",
      message: "Provide a valid username and password.",
    },
    INVALID_CREDENTIALS: {
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "The username or password is incorrect.",
    },
    UNAUTHENTICATED: {
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Sign in to access this resource.",
    },
    FORBIDDEN: {
      status: 403,
      code: "FORBIDDEN",
      message: "Your role is not permitted to perform this action.",
    },
    AUTH_UNAVAILABLE: {
      status: 503,
      code: "AUTH_UNAVAILABLE",
      message: "Authentication is not configured.",
    },
    P1_STOCK_SEMANTICS_UNCONFIRMED: {
      status: 503,
      code: "P1_STOCK_SEMANTICS_UNCONFIRMED",
      message: "Inventory quantity semantics have not been confirmed by P1.",
    },
    P1_PRODUCT_SCHEMA_MISMATCH: {
      status: 503,
      code: "P1_PRODUCT_SCHEMA_MISMATCH",
      message: "The P1 product result does not match the approved schema mapping.",
    },
    PRODUCT_FIELD_UNSUPPORTED: {
      status: 422,
      code: "PRODUCT_FIELD_UNSUPPORTED",
      message: "The database schema does not support one of the supplied product fields.",
    },
    P1_PRODUCT_VALUE_OUT_OF_RANGE: {
      status: 422,
      code: "P1_PRODUCT_VALUE_OUT_OF_RANGE",
      message: "A product value is outside the database column limits.",
    },
    NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "Route not found." },
    INVALID_PRODUCT_QUERY: {
      status: 400,
      code: "INVALID_PRODUCT_QUERY",
      message: "Use only sku, name, category, and lowStock=true|false; text filters cannot be empty.",
    },
    INVALID_PRODUCT_INPUT: {
      status: 400,
      code: "INVALID_PRODUCT_INPUT",
      message: "Provide non-empty sku and name, an optional category, and a non-negative unit_price with at most 2 decimal places; extra fields are not allowed.",
    },
    PRODUCT_DATA_UNAVAILABLE: {
      status: 503,
      code: "PRODUCT_DATA_UNAVAILABLE",
      message: "Product data is temporarily unavailable.",
    },
    PRODUCT_SEARCH_UNAVAILABLE: {
      status: 503,
      code: "PRODUCT_SEARCH_UNAVAILABLE",
      message: "Product search is temporarily unavailable.",
    },
    LOW_STOCK_FILTER_UNAVAILABLE: {
      status: 501,
      code: "LOW_STOCK_FILTER_UNAVAILABLE",
      message: "The low-stock filter is unavailable until its threshold is defined.",
    },
    DUPLICATE_SKU: {
      status: 409,
      code: "DUPLICATE_SKU",
      message: "A product with this SKU already exists.",
    },
  };

  const errorCode =
    error && typeof error === "object" ? error.code : undefined;
  let response = Object.hasOwn(publicErrors, errorCode)
    ? publicErrors[errorCode]
    : {
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      };

  if (error && error.type === "entity.parse.failed") {
    response = {
      status: 400,
      code: "INVALID_JSON",
      message: "Request body must contain valid JSON.",
    };
  }

  res.status(response.status).json({
    ok: false,
    error: { code: response.code, message: response.message },
    requestId: req.requestId,
  });
}
