import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("authenticated Requester can create a Ticket and cannot see staff controls", async ({ page }) => {
  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff Queue" })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel(/Summary/).fill(`E2E regression ${Date.now()}`);
  await page.getByLabel(/Description/).fill("Created by the authenticated Requester regression workflow.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("status")).toContainText("Ticket created");
});
