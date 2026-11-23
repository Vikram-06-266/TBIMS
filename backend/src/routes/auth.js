import { Router } from "express";
import { z } from "zod";
import { AuthServiceError } from "../auth/auth-service.js";
import { requireAuthentication } from "../middleware/authentication.js";

const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(128),
    password: z.string().min(1).max(1024),
  })
  .strict();

export function createAuthRouter(authService) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    const parsedCredentials = loginSchema.safeParse(req.body);
    if (!parsedCredentials.success) {
      return next(new AuthServiceError("INVALID_AUTH_INPUT"));
    }

    try {
      const session = await authService.login(parsedCredentials.data);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ok: true,
        data: session,
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", requireAuthentication(authService), (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      data: { user: req.user },
      requestId: req.requestId,
    });
  });

  router.post("/logout", requireAuthentication(authService), (req, res, next) => {
    try {
      authService.logout(req.authToken);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ok: true,
        data: { loggedOut: true },
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
