import { chmod, readFile, writeFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { addMissingInitialAccounts, initialAccounts } from "../src/auth/initial-users.js";
import { createAuthService } from "../src/auth/auth-service.js";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const passwordVariables = initialAccounts.map(
  (account) => account.passwordVariable,
);
const validationSecret = "seed-validation-secret-with-at-least-32-bytes";

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error(
      "Use an interactive terminal or set the missing TBIMS_*_PASSWORD variables for this run.",
    );
  }

  return new Promise((resolve, reject) => {
    let password = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    function finish(error) {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    }

    function onData(buffer) {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    }

    stdin.on("data", onData);
  });
}

async function readEnvFile() {
  try {
    const text = await readFile(envPath, "utf8");
    const values = parse(text);
    if (values.AUTH_USERS?.includes("\n")) {
      throw new Error(
        "Store AUTH_USERS as a single line in backend/.env before running setup.",
      );
    }
    return { text, values };
  } catch (error) {
    if (error.code === "ENOENT") return { text: "", values: {} };
    throw error;
  }
}

function parseExistingUsers(value) {
  if (!value) return [];
  let users;
  try {
    users = JSON.parse(value);
  } catch {
    throw new Error("AUTH_USERS must contain a valid JSON array of user records.");
  }
  if (!Array.isArray(users)) {
    throw new Error("AUTH_USERS must contain a JSON array of user records.");
  }
  if (users.length > 0) createAuthService({ secret: validationSecret, users });
  return users;
}

async function passwordForAccount(account, envValues) {
  const supplied = process.env[account.passwordVariable] || envValues[account.passwordVariable];
  if (supplied) return supplied;

  const password = await readHidden(
    `Set a password for ${account.username} (hidden, 12+ characters): `,
  );
  const confirmation = await readHidden(`Confirm ${account.username} password: `);
  if (password !== confirmation) {
    throw new Error(`The passwords for ${account.username} did not match.`);
  }
  return password;
}

function serializeEnv(text, users) {
  const withoutPasswords = text.replace(
    /^\s*TBIMS_(?:OWNER|ADMIN|MANAGER|STAFF|CUSTOMER)_PASSWORD\s*=.*(?:\r?\n|$)/gm,
    "",
  );
  const withoutUsers = withoutPasswords.replace(
    /^\s*AUTH_USERS\s*=.*(?:\r?\n|$)/gm,
    "",
  );
  const separator = withoutUsers && !withoutUsers.endsWith("\n") ? "\n" : "";
  return `${withoutUsers}${separator}AUTH_USERS=${JSON.stringify(users)}\n`;
}

try {
  const { text, values } = await readEnvFile();
  const configuredUsers = process.env.AUTH_USERS || values.AUTH_USERS || "";
  const existingUsers = parseExistingUsers(configuredUsers);
  const { users, addedAccounts } = await addMissingInitialAccounts(
    existingUsers,
    { getPassword: (account) => passwordForAccount(account, values) },
  );

  await writeFile(envPath, serializeEnv(text, users), { mode: 0o600 });
  await chmod(envPath, 0o600);

  if (addedAccounts.length === 0) {
    stdout.write("All initial accounts are already configured; no passwords were changed.\n");
  } else {
    stdout.write(
      `Configured accounts: ${addedAccounts
        .map(({ username, role }) => `${username} (${role})`)
        .join(", ")}.\n`,
    );
  }
} catch (error) {
  console.error(error.message || "Initial account setup failed.");
  process.exitCode = 1;
}
