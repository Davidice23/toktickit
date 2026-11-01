import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers";

const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
];

async function captureEvidence(page: Page, testInfo: TestInfo, stage: string) {
  const original = page.viewportSize();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${stage} must not overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`lab4-resolution-${stage}-${viewport.width}.png`), fullPage: true });
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

test("requester resolution indication stays advisory and staff resolve only after the gate is satisfied", async ({ page, browser }, testInfo) => {
  const summary = `Lab 4 resolution gate ${Date.now()}`;
  const description = `Complete the required work for ${summary}`;
  const result = `Verified the issue is fixed for ${summary}`;

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Create Ticket" }).click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel(/Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("Browser verification for the formal Ticket resolution gate and requester advisory.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("status")).toContainText("Ticket created");
  await signOut(page);

  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Staff Queue" }).click();
  await page.getByLabel("Search").fill(summary);
  await page.getByRole("button", { name: "Search Queue" }).click();
  const staffRow = page.getByRole("row").filter({ hasText: summary });
  await expect(staffRow).toBeVisible();
  await staffRow.getByRole("button", { name: "Open Detail" }).click();
  await page.getByRole("button", { name: "Claim for me" }).click();
  await page.getByLabel("Next status").selectOption("OPEN");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("OPEN");
  await page.getByLabel("Next status").selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("IN_PROGRESS");
  await signOut(page);

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Tickets" }).click();
  await page.getByLabel("Search tickets").fill(summary);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const requesterRow = page.getByRole("row").filter({ hasText: summary });
  await expect(requesterRow).toBeVisible();
  await requesterRow.getByRole("button", { name: "View" }).click();
  await expect(page.locator(".detail-grid")).toContainText("IN_PROGRESS");
  await page.getByRole("button", { name: /This problem appears resolved/ }).click();
  await expect(page.getByRole("button", { name: "Resolution Indicated" })).toBeDisabled();
  await expect(page.locator(".detail-grid")).toContainText("IN_PROGRESS");
  await captureEvidence(page, testInfo, "requester-advisory");
  await signOut(page);

  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Staff Queue" }).click();
  await page.getByLabel("Search").fill(summary);
  await page.getByRole("button", { name: "Search Queue" }).click();
  const refreshedStaffRow = page.getByRole("row").filter({ hasText: summary });
  await expect(refreshedStaffRow).toBeVisible();
  await refreshedStaffRow.getByRole("button", { name: "Open Detail" }).click();

  await expect(page.locator(".detail-grid")).toContainText("Requester indicated resolved");
  await expect(page.getByText(/Resolving a Ticket requires an active operational owner/)).toBeVisible();
  await page.getByLabel("Next status").selectOption("RESOLVED");

  // Change the Ticket from a separate authenticated browser context so this
  // page must handle a real stale workflow version, not a sequential mock.
  const competingContext = await browser.newContext();
  try {
    const competingPage = await competingContext.newPage();
    await signIn(competingPage, "admin@example.test", /Staff operations workspace/);
    await competingPage.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Staff Queue" }).click();
    await competingPage.getByLabel("Search").fill(summary);
    await competingPage.getByRole("button", { name: "Search Queue" }).click();
    const competingRow = competingPage.getByRole("row").filter({ hasText: summary });
    await expect(competingRow).toBeVisible();
    await competingRow.getByRole("button", { name: "Open Detail" }).click();
    await competingPage.getByLabel("Set IT Priority").selectOption("HIGH");
    await competingPage.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(competingPage.locator(".detail-grid")).toContainText("HIGH");
  } finally {
    await competingContext.close();
  }

  await page.getByRole("button", { name: "Update Status" }).click();
  const staleError = page.getByRole("alert");
  await expect(staleError).toContainText("Ticket changed; reload before updating");
  await expect(page.locator(".detail-grid")).toContainText("HIGH");
  await captureEvidence(page, testInfo, "stale-update-recovered");

  // The stale response refreshes the workflow version. The same selected
  // transition can now be retried and is rejected by the resolution gate.
  await page.getByRole("button", { name: "Update Status" }).click();
  const gateError = page.getByRole("alert");
  await expect(gateError).toContainText("Ticket cannot be resolved until all prerequisites are satisfied");
  await expect(gateError).toContainText("At least one completed Action with a non-blank result is required");
  await expect(page.locator(".detail-grid")).toContainText("IN_PROGRESS");
  await captureEvidence(page, testInfo, "blocked-resolution");

  await page.getByRole("button", { name: "Add Action" }).first().click();
  const assignee = page.getByLabel("Assignee");
  await expect(assignee.locator("option").nth(1)).toBeAttached();
  await assignee.selectOption({ index: 1 });
  await page.getByLabel("Action Description").fill(description);
  await page.getByRole("button", { name: "Save Action" }).click();
  const actionCard = page.locator(".action-card").filter({ hasText: description });
  await expect(actionCard).toBeVisible();
  await actionCard.getByRole("button", { name: "Start" }).click();
  await expect(actionCard.getByText("IN PROGRESS")).toBeVisible();
  await actionCard.getByRole("button", { name: "Complete" }).click();
  const completionDialog = page.getByRole("dialog");
  await expect(completionDialog).toBeVisible();
  await expect(page.getByLabel("Result")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(completionDialog).toBeHidden();
  await expect(actionCard.getByRole("button", { name: "Complete" })).toBeFocused();
  await actionCard.getByRole("button", { name: "Complete" }).click();
  await page.getByLabel("Result").fill(result);
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(actionCard.getByText(result)).toBeVisible();

  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("RESOLVED");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByText(/IN_PROGRESS → RESOLVED/)).toBeVisible();
  await expect(page.getByText(new RegExp(result))).toBeVisible();
  await captureEvidence(page, testInfo, "resolved-with-evidence");
  await signOut(page);
});
