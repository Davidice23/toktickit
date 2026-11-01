import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers";

const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
];

async function captureResponsiveEvidence(page: Page, testInfo: TestInfo, role: string) {
  const originalViewport = page.viewportSize();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className.trim() ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`,
              right: Math.round(rect.right),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
              text: (element.innerText || "").replace(/\s+/g, " ").slice(0, 100),
            };
          })
          .filter((entry) => entry.right > viewportWidth + 1)
          .slice(0, 8);
        return { amount: document.documentElement.scrollWidth - viewportWidth, offenders };
      });
      expect(layout.amount, `${role} view should not overflow at ${viewport.width}px; offending elements: ${JSON.stringify(layout.offenders)}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`lab4-actions-${role}-${viewport.width}.png`), fullPage: true });
    }
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
}

test("Requester, Staff, and Administrator see role-appropriate Actions Taken workflow", async ({ page }, testInfo) => {
  const summary = `Lab 4 Actions workflow ${Date.now()}`;
  const description = `Record and verify an Action for ${summary}`;
  const result = `Collected diagnostics for ${summary}`;

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Create Ticket" }).click();
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Related System").selectOption({ index: 1 });
  await page.getByLabel("Requested Priority").selectOption("MEDIUM");
  await page.getByLabel(/Summary/).fill(summary);
  await page.getByLabel(/Description/).fill("End-to-end verification of the Lab 4 Actions Taken UI and role boundary.");
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
  await expect(page.getByRole("button", { name: "Reassign Owner" })).toBeVisible();

  await page.getByLabel("Next status").selectOption("OPEN");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("OPEN");
  await page.getByLabel("Next status").selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.locator(".detail-grid")).toContainText("IN_PROGRESS");

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
  await page.getByLabel("Result").fill(result);
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(actionCard.getByText(result)).toBeVisible();
  await expect(actionCard.getByText("IT Staff One").first()).toBeVisible();
  await captureResponsiveEvidence(page, testInfo, "staff");
  await signOut(page);

  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Tickets" }).click();
  await page.getByLabel("Search tickets").fill(summary);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const requesterRow = page.getByRole("row").filter({ hasText: summary });
  await expect(requesterRow).toBeVisible();
  await requesterRow.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken (read-only)" })).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText(result)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Complete" })).toHaveCount(0);
  await captureResponsiveEvidence(page, testInfo, "requester");
  await signOut(page);

  await signIn(page, "admin@example.test", /Staff operations workspace/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Staff Queue" }).click();
  await page.getByLabel("Search").fill(summary);
  await page.getByRole("button", { name: "Search Queue" }).click();
  const adminRow = page.getByRole("row").filter({ hasText: summary });
  await expect(adminRow).toBeVisible();
  await adminRow.getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Action" }).first()).toBeVisible();
});
