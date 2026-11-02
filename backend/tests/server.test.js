import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/server.js";

describe("API skeleton", () => {
  it("returns the health status and preserves the request ID", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-ID", "health-test-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "transaction-inventory-system",
    });
    expect(response.headers["x-request-id"]).toBe("health-test-123");
  });

  it("returns a consistent error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/example")
      .set("Content-Type", "application/json")
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON.",
      },
    });
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it("returns a standard 404 error for an unknown API route", async () => {
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("replaces an invalid client request ID with a generated ID", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-ID", "invalid request id");
    const returnedRequestId = response.headers["x-request-id"];

    expect(returnedRequestId).toEqual(
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    );
    expect(returnedRequestId).not.toBe("invalid request id");
    expect(response.text).not.toContain("invalid request id");
  });

  it("uses the same safe error fields for malformed JSON and unknown routes", async () => {
    const malformedJson = await request(app)
      .post("/api/example")
      .set("Content-Type", "application/json")
      .send('{"broken":');
    const unknownRoute = await request(app).get("/api/unknown-route");
    const expectedErrorFields = ["code", "message"];

    for (const response of [malformedJson, unknownRoute]) {
      expect(Object.keys(response.body).sort()).toEqual(
        ["error", "ok", "requestId"].sort(),
      );
      expect(Object.keys(response.body.error).sort()).toEqual(
        expectedErrorFields.sort(),
      );
      expect(response.body.ok).toBe(false);
      expect(response.body.requestId).toBe(response.headers["x-request-id"]);
      expect(JSON.stringify(response.body)).not.toMatch(/stack| at .*:\d+:\d+/i);
    }

    expect(malformedJson.status).toBe(400);
    expect(unknownRoute.status).toBe(404);
  });
});
