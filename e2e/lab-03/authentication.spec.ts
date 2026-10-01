import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("active Administrator can sign in, reach the role workspace, and log out", async ({ page }) => {
  await signIn(page, "admin@example.test", /Administrator workspace/);
  await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff Queue" })).toBeVisible();
  await signOut(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  const denied = await page.request.get("http://127.0.0.1:3000/api/staff/tickets");
  expect(denied.status()).toBe(401);
});

test("invalid and inactive credentials receive the same safe feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("missing@example.test");
  await page.getByLabel("Password").fill("local-only-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
  await page.getByLabel("Email").fill("inactive.staff@example.test");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");
});

test("an initial password blocks navigation until a valid replacement is saved", async ({ page }) => {
  const email = `e2e-first-login-${Date.now()}@example.test`;
  await signIn(page, "admin@example.test", /Administrator workspace/);
  await page.getByRole("button", { name: "Create User" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("First Login E2E User");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption("IT_STAFF");
  await page.getByLabel("Initial password").fill("local-only-password");
  await page.getByRole("button", { name: "Create User", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("User created");
  await signOut(page);
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await page.getByLabel("Current password").fill(process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password");
  await page.getByLabel("New password", { exact: true }).fill(process.env.LAB3_E2E_PASSWORD ?? "Lab3-E2E-password!2026");
  await page.getByLabel("Confirm new password").fill(process.env.LAB3_E2E_PASSWORD ?? "Lab3-E2E-password!2026");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
});
