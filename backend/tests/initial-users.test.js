import { describe, expect, it, vi } from "vitest";
import { addMissingInitialAccounts } from "../src/auth/initial-users.js";

describe("initial account setup", () => {
  it("adds missing initial users and never changes an existing account", async () => {
    const existingOwner = {
      username: "owner",
      passwordHash: "existing-owner-hash",
      role: "owner",
    };
    const getPassword = vi.fn(async ({ username }) => `${username}-new-password`);
    const hash = vi.fn(async (password) => `hash:${password}`);

    const firstRun = await addMissingInitialAccounts([existingOwner], {
      getPassword,
      hash,
    });
    const owner = firstRun.users.find((user) => user.username === "owner");

    expect(firstRun.users).toHaveLength(5);
    expect(firstRun.addedAccounts.map((account) => account.username)).toEqual([
      "admin",
      "manager",
      "staff",
      "customer",
    ]);
    expect(owner).toBe(existingOwner);
    expect(getPassword).not.toHaveBeenCalledWith(
      expect.objectContaining({ username: "owner" }),
    );

    const secondRun = await addMissingInitialAccounts(firstRun.users, {
      getPassword: vi.fn(() => {
        throw new Error("Existing users must not be prompted again.");
      }),
      hash,
    });

    expect(secondRun.users).toEqual(firstRun.users);
    expect(secondRun.addedAccounts).toEqual([]);
    expect(owner.passwordHash).toBe("existing-owner-hash");
  });

  it("rejects duplicate usernames and refuses to change a seeded role", async () => {
    const getPassword = vi.fn();

    await expect(
      addMissingInitialAccounts(
        [
          { username: "Owner", passwordHash: "first", role: "owner" },
          { username: "owner", passwordHash: "second", role: "owner" },
        ],
        { getPassword },
      ),
    ).rejects.toThrow(/duplicate username/i);

    await expect(
      addMissingInitialAccounts(
        [{ username: "owner", passwordHash: "existing", role: "admin" }],
        { getPassword },
      ),
    ).rejects.toThrow(/different role/i);
    expect(getPassword).not.toHaveBeenCalled();
  });
});
