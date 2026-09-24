import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

const root = resolve(process.cwd(), "..", "artifacts", "lab-03", "screenshots");

async function capture(page: import("@playwright/test").Page, group: string, name: string) {
  const directory = resolve(root, group);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, name), animations: "disabled" });
}

test("capture the initial-password gate without revealing credentials", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  await capture(page, "authentication", "desktop-login.png");
  await page.getByLabel("Email").fill("it.staff.three@example.test");
  await page.getByLabel("Password").fill(process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await capture(page, "authentication", "desktop-first-password-change.png");
});

for (const [size, width, height] of [["desktop", 1440, 900], ["tablet", 820, 900], ["mobile", 390, 760]] as const) {
  test(`capture major Lab 3 screens at ${size} width`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    await signIn(page, "admin@example.test", /Administrator workspace/);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByText("Loading Users...")).toBeHidden();
    await capture(page, "user-management", `${size}-list.png`);
    if (size !== "desktop") {
      await page.getByRole("row").filter({ hasText: "admin@example.test" }).scrollIntoViewIfNeeded();
      await capture(page, "user-management", `${size}-users.png`);
    }
    if (size === "desktop") {
      await page.getByRole("button", { name: "Create User" }).first().click();
      await capture(page, "user-management", "desktop-create.png");
    }

    const menu = page.getByRole("button", { name: "Menu" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("link", { name: "Staff Queue" }).click();
    const fixtureRow = page.getByRole("row").filter({ hasText: "L3-DEMO-003" });
    await expect(fixtureRow).toBeVisible();
    await capture(page, "staff-queue", `${size}-queue.png`);
    await fixtureRow.scrollIntoViewIfNeeded();
    await capture(page, "staff-queue", `${size}-rows.png`);
    await fixtureRow.getByRole("button", { name: "Open Detail" }).click();
    await expect(page.getByRole("heading", { name: "L3-DEMO-003" })).toBeVisible();
    await capture(page, "staff-ticket-detail", `${size}-detail.png`);
    await page.getByRole("heading", { name: /Internal Notes/ }).scrollIntoViewIfNeeded();
    await capture(page, "staff-ticket-detail", `${size}-comments-notes.png`);
    await signOut(page);

    await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await capture(page, "authentication", `${size}-requester-workspace.png`);
    await signOut(page);
  });
}
