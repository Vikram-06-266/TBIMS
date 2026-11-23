import { afterEach, describe, expect, it, vi } from "vitest";
import { createDatabasePool } from "../src/engines/dbms/pool.js";

class TestPool {
  constructor(configuration) {
    this.configuration = configuration;
    this.listeners = new Map();
    this.query = vi.fn();
    this.connect = vi.fn();
    this.end = vi.fn().mockResolvedValue();
  }

  on(event, listener) {
    this.listeners.set(event, listener);
    return this;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PostgreSQL connection pool configuration", () => {
  it("uses DATABASE_URL and verifies Neon certificates", () => {
    const pool = createDatabasePool(undefined, {
      env: {
        DATABASE_URL:
          "postgresql://db-user:secret@example.neon.tech/tbims?sslmode=verify-full",
        DB_HOST: "ignored.example",
      },
      PoolClass: TestPool,
    });

    expect(pool.configuration).toEqual({
      connectionString:
        "postgresql://db-user:secret@example.neon.tech/tbims?sslmode=verify-full",
      ssl: { rejectUnauthorized: true },
    });
  });

  it("supports individual DB_* settings and verified SSL", () => {
    const pool = createDatabasePool(undefined, {
      env: {
        DB_HOST: "database.example",
        DB_PORT: "6432",
        DB_NAME: "tbims",
        DB_USER: "db-user",
        DB_PASSWORD: "secret",
        DB_SSLMODE: "verify-full",
      },
      PoolClass: TestPool,
    });

    expect(pool.configuration).toEqual({
      host: "database.example",
      port: 6432,
      database: "tbims",
      user: "db-user",
      password: "secret",
      ssl: { rejectUnauthorized: true },
    });
  });

  it("supports standard PG* settings when DB_* names are absent", () => {
    const pool = createDatabasePool(undefined, {
      env: {
        PGHOST: "localhost",
        PGDATABASE: "tbims",
        PGUSER: "db-user",
        PGPASSWORD: "secret",
      },
      PoolClass: TestPool,
    });

    expect(pool.configuration).toEqual({
      host: "localhost",
      database: "tbims",
      user: "db-user",
      password: "secret",
      port: 5432,
    });
  });

  it("rejects incomplete or invalid settings without echoing credentials", async () => {
    const unavailablePool = createDatabasePool(undefined, {
      env: { DB_USER: "db-user", DB_PASSWORD: "secret" },
      PoolClass: TestPool,
    });
    const invalidPortPool = () =>
      createDatabasePool(undefined, {
        env: {
          DB_HOST: "localhost",
          DB_NAME: "tbims",
          DB_USER: "db-user",
          DB_PASSWORD: "secret",
          DB_PORT: "not-a-port",
        },
        PoolClass: TestPool,
      });

    await expect(unavailablePool.connect()).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE",
    });
    expect(invalidPortPool).toThrow("DB_PORT must be a valid TCP port.");
  });

  it("logs only a safe error code for idle-client failures", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = createDatabasePool(undefined, {
      env: {
        DB_HOST: "localhost",
        DB_NAME: "tbims",
        DB_USER: "db-user",
        DB_PASSWORD: "secret",
      },
      PoolClass: TestPool,
    });

    pool.listeners.get("error")(
      Object.assign(new Error("postgresql://db-user:secret@localhost/tbims"), {
        code: "ECONNRESET",
      }),
    );

    expect(logError).toHaveBeenCalledWith(
      "Unexpected idle PostgreSQL client error (ECONNRESET).",
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain("secret");
  });
});
