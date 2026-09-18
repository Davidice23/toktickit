import { expect, Page } from "@playwright/test";

const INITIAL_PASSWORD = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";
const E2E_PASSWORD = process.env.LAB3_E2E_PASSWORD ?? "Lab3-E2E-password!2026";

async function submitCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Sign in with a seeded account, changing its initial password once if needed. */
export async function signIn(page: Page, email: string, workspaceHeading: RegExp): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  await submitCredentials(page, email, INITIAL_PASSWORD);

  const changeHeading = page.getByRole("heading", { name: "Change your password" });
  const workspace = page.getByRole("heading", { name: workspaceHeading });
  const loginError = page.getByRole("alert");
  await expect.poll(async () => (await changeHeading.isVisible()) || (await workspace.isVisible()) || (await loginError.isVisible()), { timeout: 10_000 }).toBeTruthy();
  if (await changeHeading.isVisible()) {
    await page.getByLabel("Current password").fill(INITIAL_PASSWORD);
    await page.getByLabel("New password").fill(E2E_PASSWORD);
    await page.getByLabel("Confirm new password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
  } else if (!(await workspace.isVisible())) {
    // The account may have been changed by an earlier serial test run.
    await submitCredentials(page, email, E2E_PASSWORD);
  }

  await expect(workspace).toBeVisible({ timeout: 10_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
}
