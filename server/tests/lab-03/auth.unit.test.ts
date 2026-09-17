import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from "../../src/auth.js";

describe("Lab 3 authentication primitives", () => {
  it("normalizes email before lookup", () => {
    expect(normalizeEmail("  USER@Example.TEST ")).toBe("user@example.test");
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("enforces the contract password boundaries and confirmation", () => {
    expect(validatePassword("short", "short")).toHaveProperty("password");
    expect(validatePassword("a-valid-local-password", "different")).toHaveProperty("confirmPassword");
    expect(validatePassword("a-valid-local-password", "a-valid-local-password")).toEqual({});
  });

  it("hashes with Argon2id and never treats plaintext as a valid hash", async () => {
    const password = "a-valid-local-password";
    const hash = await hashPassword(password);
    expect(hash).toContain("$argon2id$");
    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });
});
