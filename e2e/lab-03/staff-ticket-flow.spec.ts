import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("IT Staff can open the authenticated operational queue and use its filters", async ({ page }) => {
  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
  await expect(page.getByLabel("Staff Ticket Queue filters")).toBeVisible();
  await page.getByLabel("Search").fill("E2E regression");
  await page.getByRole("button", { name: "Search Queue" }).click();
  const queueResult = page.getByRole("status").or(page.getByRole("table"));
  await expect(queueResult).toBeVisible({ timeout: 10_000 });
});

test("Requester submission flows through Staff ownership, priority, status, and private notes", async ({ page }) => {
  const summary = `Cross-role E2E ${Date.now()}`;
  const publicMessage = `Public response for ${summary}`;
  const privateMessage = `Internal triage for ${summary}`;

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Create Ticket" }).click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel(/Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("Cross-role browser verification of the operational Ticket lifecycle.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("status")).toContainText("Ticket created");
  await signOut(page);

  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await page.getByLabel("Search").fill(summary);
  await page.getByRole("button", { name: "Search Queue" }).click();
  const row = page.getByRole("row").filter({ hasText: summary });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open Detail" }).click();
  await page.getByRole("button", { name: "Claim for me" }).click();
  await expect(page.getByRole("button", { name: "Reassign Owner" })).toBeVisible();
  await page.getByLabel("Set IT Priority").selectOption("HIGH");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await expect(page.locator(".detail-grid")).toContainText("HIGH");
  await page.getByLabel("Next status").selectOption("OPEN");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("OPEN");
  await page.getByLabel("Add public comment").fill(publicMessage);
  await page.getByRole("button", { name: "Add Public Comment" }).click();
  await expect(page.getByText(publicMessage)).toBeVisible();
  await page.getByLabel("Add internal note").fill(privateMessage);
  await page.getByRole("button", { name: "Add Internal Note" }).click();
  await expect(page.getByText(privateMessage)).toBeVisible();
  await signOut(page);

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByLabel("Search tickets").fill(summary);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const requesterRow = page.getByRole("row").filter({ hasText: summary });
  await expect(requesterRow).toBeVisible();
  await requesterRow.getByRole("button", { name: "View" }).click();
  await expect(page.getByText(publicMessage)).toBeVisible();
  await expect(page.getByText(privateMessage)).toHaveCount(0);
  await expect(page.getByText("Internal Notes")).toHaveCount(0);
});
