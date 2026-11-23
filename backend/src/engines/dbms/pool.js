import { config } from "dotenv";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Ensure resilient DNS resolution for Neon cloud endpoints when local/ISP resolvers fail
if (typeof dns?.lookup === "function" && !globalThis.__tbims_dns_patched__) {
  globalThis.__tbims_dns_patched__ = true;
  const resolver = new dns.Resolver();
  resolver.setServers(["8.8.8.8", "1.1.1.1"]);
  const originalLookup = dns.lookup;
  dns.lookup = function (hostname, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    originalLookup(hostname, options, (err, address, family) => {
      if (err && (err.code === "ENOTFOUND" || err.code === "EREFUSED" || err.code === "EAI_AGAIN")) {
        resolver.resolve4(hostname, (resErr, ips) => {
          if (resErr) return callback(err);
          if (options && options.all) {
            return callback(null, ips.map((ip) => ({ address: ip, family: 4 })));
          }
          return callback(null, ips[0], 4);
        });
      } else {
        callback(err, address, family);
      }
    });
  };
}

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const { Pool } = pg;

function createUnavailablePool() {
  function unavailableError() {
    const error = new Error("PostgreSQL connection settings are not configured.");
    error.code = "DATABASE_UNAVAILABLE";
    return error;
  }

  return {
    async query() {
      throw unavailableError();
    },
    async connect() {
      throw unavailableError();
    },
    async end() {},
  };
}

function getUrlConfiguration(connectionString) {
  const url = new URL(connectionString);
  const configuration = { connectionString };

  if (url.hostname.endsWith(".neon.tech")) {
    configuration.ssl = { rejectUnauthorized: true };
  }

  return configuration;
}

function getIndividualConfiguration(env) {
  const host = env.DB_HOST || env.PGHOST;
  const database = env.DB_NAME || env.PGDATABASE;
  const user = env.DB_USER || env.PGUSER;
  const password = env.DB_PASSWORD || env.PGPASSWORD;

  if (!host || !database || !user || !password) {
    return undefined;
  }

  const rawPort = env.DB_PORT || env.PGPORT || "5432";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port.");
  }

  const configuration = { host, database, user, password, port };
  const sslMode = env.DB_SSLMODE || env.PGSSLMODE;
  if (sslMode && sslMode !== "disable") {
    configuration.ssl = { rejectUnauthorized: true };
  } else if (sslMode === "disable") {
    configuration.ssl = false;
  }

  return configuration;
}

export function createDatabasePool(connectionString, { env = process.env, PoolClass = Pool } = {}) {
  let configuration;
  if (connectionString !== undefined) {
    if (!connectionString) {
      return createUnavailablePool();
    }
    configuration = getUrlConfiguration(connectionString);
  } else if (env.DATABASE_URL) {
    configuration = getUrlConfiguration(env.DATABASE_URL);
  } else {
    configuration = getIndividualConfiguration(env);
  }

  if (!configuration) {
    return createUnavailablePool();
  }

  const pool = new PoolClass(configuration);
  pool.on("error", (error) => {
    const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error(`Unexpected idle PostgreSQL client error (${code}).`);
  });
  return pool;
}

const pool = createDatabasePool();
let closePromise;

export function closeDatabasePool() {
  if (!closePromise) {
    closePromise = pool.end();
  }
  return closePromise;
}

export default pool;
