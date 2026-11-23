import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  createAuthService,
  hashPassword,
} from "../src/auth/auth-service.js";
import { createApp } from "../src/server.js";

const secret = "test-secret-with-more-than-thirty-two-bytes";
const accounts = [
  { username: "owner", role: "owner" },
  { username: "admin", role: "admin" },
  { username: "manager", role: "inventoryManager" },
  { username: "staff", role: "staff" },
  { username: "customer", role: "customer" },
];
let authService;
let tokens;

beforeAll(async () => {
  const users = await Promise.all(
    accounts.map(async ({ username, role }) => ({
      username,
      passwordHash: await hashPassword("correct-password"),
      role,
    })),
  );
  authService = createAuthService({ secret, users });
  tokens = Object.fromEntries(
    await Promise.all(
      users.map(async (user) => {
        const session = await authService.login({
          username: user.username,
          password: "correct-password",
        });
        return [user.role, session.token];
      }),
    ),
  );
});

describe("authentication API", () => {
  it("authenticates a configured user and returns a role-bound bearer token", async () => {
    const app = createApp({ authService });
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ADMIN", password: "correct-password" });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      username: "admin",
      role: "admin",
    });
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");

    const currentUser = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${response.body.data.token}`);
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.data.user).toEqual(response.body.data.user);
  });

  it.each(accounts)(
    "authenticates the $role account with its configured role",
    async ({ username, role }) => {
      const response = await request(createApp({ authService }))
        .post("/api/auth/login")
        .send({ username, password: "correct-password" });

      expect(response.status).toBe(200);
      expect(response.body.data.user).toEqual({ username, role });
    },
  );

  it("rejects invalid credentials without exposing authentication details", async () => {
    const response = await request(createApp({ authService }))
      .post("/api/auth/login")
      .send({ username: "admin@example.test", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|secret/i);
  });

  it("rejects an invalid username with the same credentials response", async () => {
    const response = await request(createApp({ authService }))
      .post("/api/auth/login")
      .send({ username: "unknown", password: "correct-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects invalid login bodies before calling the auth adapter", async () => {
    const login = vi.fn();
    const response = await request(
      createApp({ authService: { login, authenticate: vi.fn() } }),
    )
      .post("/api/auth/login")
      .send({ username: "admin", password: "passphrase", role: "owner" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_AUTH_INPUT");
    expect(login).not.toHaveBeenCalled();
  });

  it("rejects missing and tampered bearer tokens", async () => {
    const app = createApp({ authService });
    const missing = await request(app).get("/api/auth/me");
    const token = tokens.staff;
    const finalCharacter = token.at(-1) === "a" ? "b" : "a";
    const tampered = `${token.slice(0, -1)}${finalCharacter}`;
    const invalid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tampered}`);

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("UNAUTHENTICATED");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an expired access token", () => {
    const now = Math.floor(Date.now() / 1000);
    const clock = vi.spyOn(Date, "now").mockReturnValue((now + 1801) * 1000);

    try {
      expect(() => authService.authenticate(tokens.admin)).toThrowError(
        "UNAUTHENTICATED",
      );
    } finally {
      clock.mockRestore();
    }
  });

  it("revokes a session through logout", async () => {
    const app = createApp({ authService });
    const { token } = await authService.login({
      username: "staff",
      password: "correct-password",
    });

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    const currentUser = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);
    expect(currentUser.status).toBe(401);
    expect(currentUser.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("reports missing auth configuration instead of accepting a default user", async () => {
    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "admin", password: "anything" });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("AUTH_UNAVAILABLE");
    expect(response.body).not.toHaveProperty("data");
  });
});
