import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("IT Staff can open the authenticated operational queue and use its filters", async ({ page }) => {
  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
  await expect(page.getByLabel("Staff Ticket Queue filters")).toBeVisible();
  await page.getByLabel("Search").fill("E2E regression");
  await page.getByRole("button", { name: "Search Queue" }).click();
  const queueResult = page.getByRole("status").or(page.getByRole("table"));
  await expect(queueResult).toBeVisible({ timeout: 10_000 });
});
