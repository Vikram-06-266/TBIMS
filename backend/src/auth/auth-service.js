import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const tokenLifetimeSeconds = 30 * 60;
const tokenHeader = Buffer.from(
  JSON.stringify({ alg: "HS256", typ: "JWT" }),
).toString("base64url");
const roles = new Set([
  "owner",
  "admin",
  "inventoryManager",
  "staff",
  "customer",
]);
const dummySalt = Buffer.alloc(16);
const dummyHash = Buffer.alloc(passwordKeyLength);

export class AuthServiceError extends Error {
  constructor(code) {
    super(code);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

function isPasswordHash(value) {
  return (
    typeof value === "string" &&
    /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(value)
  );
}

function normalizeConfig(secret, configuredUsers) {
  let users = configuredUsers;

  if (typeof users === "string") {
    try {
      users = JSON.parse(users);
    } catch {
      throw new AuthServiceError("AUTH_UNAVAILABLE");
    }
  }

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    !Array.isArray(users) ||
    users.length === 0
  ) {
    throw new AuthServiceError("AUTH_UNAVAILABLE");
  }

  const usernames = new Set();
  const normalizedUsers = users.map((user) => {
    if (
      !user ||
      typeof user.username !== "string" ||
      !user.username.trim() ||
      !isPasswordHash(user.passwordHash) ||
      !roles.has(user.role)
    ) {
      throw new AuthServiceError("AUTH_UNAVAILABLE");
    }

    const username = user.username.trim();
    const key = username.toLowerCase();
    if (usernames.has(key)) {
      throw new AuthServiceError("AUTH_UNAVAILABLE");
    }
    usernames.add(key);
    return { username, key, passwordHash: user.passwordHash, role: user.role };
  });

  return { secret, users: normalizedUsers };
}

function signToken(payload, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsignedToken = `${tokenHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64url");
  return `${unsignedToken}.${signature}`;
}

function unauthorized() {
  return new AuthServiceError("UNAUTHENTICATED");
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("Password must be a non-empty string.");
  }

  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, passwordKeyLength, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function passwordMatches(password, passwordHash) {
  const [, saltHex, hashHex] = passwordHash.split("$");
  const expectedHash = Buffer.from(hashHex, "hex");
  const actualHash = await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    expectedHash.length,
    { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  );
  return timingSafeEqual(expectedHash, actualHash);
}

export function createAuthService(config) {
  const revokedSessions = new Map();

  function getConfig() {
    if (config) {
      return normalizeConfig(config.secret, config.users);
    }
    if (process.env.VITEST && !process.env.TBIMS_TEST_AUTH) {
      throw new AuthServiceError("AUTH_UNAVAILABLE");
    }
    return normalizeConfig(
      process.env.AUTH_TOKEN_SECRET,
      process.env.AUTH_USERS,
    );
  }

  function verifyToken(token) {
    const { secret, users } = getConfig();
    const parts = typeof token === "string" ? token.split(".") : [];
    if (parts.length !== 3) throw unauthorized();

    const unsignedToken = `${parts[0]}.${parts[1]}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(unsignedToken)
      .digest();
    let actualSignature;
    try {
      actualSignature = Buffer.from(parts[2], "base64url");
    } catch {
      throw unauthorized();
    }
    if (
      actualSignature.toString("base64url") !== parts[2] ||
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      throw unauthorized();
    }

    let header;
    let claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      throw unauthorized();
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      !header ||
      typeof header !== "object" ||
      !claims ||
      typeof claims !== "object" ||
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      typeof claims.sub !== "string" ||
      !claims.sub ||
      !roles.has(claims.role) ||
      typeof claims.jti !== "string" ||
      !claims.jti ||
      !Number.isInteger(claims.iat) ||
      claims.iat > now ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= now ||
      claims.exp <= claims.iat
    ) {
      throw unauthorized();
    }

    for (const [sessionId, expiry] of revokedSessions) {
      if (expiry <= now) revokedSessions.delete(sessionId);
    }
    if (revokedSessions.has(claims.jti)) throw unauthorized();

    const user = users.find(
      (candidate) =>
        candidate.key === claims.sub.toLowerCase() &&
        candidate.role === claims.role,
    );
    if (!user || user.username !== claims.sub) throw unauthorized();

    return claims;
  }

  return {
    async login({ username, password }) {
      const { secret, users } = getConfig();
      const normalizedUsername = username.trim().toLowerCase();
      const user = users.find((candidate) => candidate.key === normalizedUsername);

      if (!user) {
        const dummyActual = await scrypt(password, dummySalt, dummyHash.length, {
          N: 16384,
          r: 8,
          p: 1,
          maxmem: 64 * 1024 * 1024,
        });
        timingSafeEqual(dummyHash, dummyActual);
        throw new AuthServiceError("INVALID_CREDENTIALS");
      }

      if (!(await passwordMatches(password, user.passwordHash))) {
        throw new AuthServiceError("INVALID_CREDENTIALS");
      }

      const now = Math.floor(Date.now() / 1000);
      const claims = {
        sub: user.username,
        role: user.role,
        iat: now,
        exp: now + tokenLifetimeSeconds,
        jti: randomBytes(16).toString("base64url"),
      };

      return {
        token: signToken(claims, secret),
        user: { username: user.username, role: user.role },
      };
    },

    authenticate(token) {
      const claims = verifyToken(token);
      return { username: claims.sub, role: claims.role };
    },

    logout(token) {
      const claims = verifyToken(token);
      revokedSessions.set(claims.jti, claims.exp);
    },
  };
}

export const defaultAuthService = createAuthService();
