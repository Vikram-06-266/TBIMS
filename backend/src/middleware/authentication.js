import { AuthServiceError } from "../auth/auth-service.js";

export function requireAuthentication(authService) {
  return (req, _res, next) => {
    const authorization = req.get("Authorization");
    const match =
      typeof authorization === "string"
        ? /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization)
        : null;

    if (!match) {
      return next(new AuthServiceError("UNAUTHENTICATED"));
    }

    // Support demo/development role preview tokens in non-production development environments
    const previewMatch = /^demo-bearer-token-(owner|admin|inventoryManager|staff|customer)(?:-.*)?$/.exec(match[1]);
    if (process.env.NODE_ENV !== "production" && previewMatch) {
      req.user = { username: previewMatch[1], role: previewMatch[1] };
      req.authToken = match[1];
      return next();
    }

    try {
      req.user = authService.authenticate(match[1]);
      req.authToken = match[1];
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AuthServiceError("FORBIDDEN"));
    }
    return next();
  };
}
