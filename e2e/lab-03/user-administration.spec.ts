import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Administrator can search users and create one without password disclosure", async ({ page }) => {
  await signIn(page, "admin@example.test", /Administrator workspace/);
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.getByText("Loading Users...")).toBeHidden();

  await page.getByLabel("Search users").fill("admin@example.test");
  await page.getByRole("button", { name: "Search Users" }).click();
  await expect(page.getByText("admin@example.test")).toBeVisible();

  await page.getByRole("button", { name: "Create User" }).first().click();
  const uniqueEmail = `e2e-${Date.now()}@example.test`;
  await page.getByLabel("Name", { exact: true }).fill("E2E Release User");
  await page.getByLabel("Email", { exact: true }).fill(uniqueEmail);
  await page.getByLabel("Role", { exact: true }).selectOption("REQUESTER");
  await page.getByLabel("Initial password").fill("Temporary-E2E!2026");
  await page.getByRole("button", { name: "Create User", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("User created");
  await expect(page.getByText("Temporary-E2E!2026")).toHaveCount(0);
});
