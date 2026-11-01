import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers";

const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
];

async function captureDashboard(page: Page, testInfo: TestInfo, role: string) {
  const original = page.viewportSize();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: role === "requester" ? "Requester Dashboard" : "Staff Dashboard" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${role} dashboard overflows at ${viewport.width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`lab4-${role}-dashboard-${viewport.width}.png`), fullPage: true });
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

test("Requester, IT Staff, and Administrator reach role-scoped dashboards and working drill-downs", async ({ page }, testInfo) => {
  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const openTickets = page.getByRole("link", { name: /^Open Tickets\s+\d+\s+View matching Tickets$/ });
  await expect(openTickets).toBeVisible();
  await expect(openTickets).toHaveAttribute("href", /#my-tickets\?scope=open/);
  await openTickets.click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByText("Dashboard filter: Open Tickets")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByText("Dashboard filter: Open Tickets")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#staff-tickets"; });
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await expect(page).toHaveURL(/#dashboard$/);
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Dashboard" }).click();
  await captureDashboard(page, testInfo, "requester");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Requester Dashboard" })).toBeVisible();
  await signOut(page);

  await signIn(page, "it.staff.one@example.test", /Staff operations workspace/);
  await expect(page.getByRole("heading", { name: "Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
  const ownedOpen = page.getByRole("link", { name: /^My Owned Open\s+\d+\s+View matching work$/ });
  await expect(ownedOpen).toBeVisible();
  await expect(ownedOpen).toHaveAttribute("href", /#staff-tickets\?scope=my-owned-open/);
  await ownedOpen.click();
  await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
  await expect(page.getByText("Dashboard filter: My Owned Open")).toBeVisible();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Dashboard" }).click();
  await captureDashboard(page, testInfo, "staff");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Staff Queue" }).click();
  await expect(page.getByRole("heading", { name: "Staff Ticket Queue" })).toBeVisible();
  await signOut(page);

  await signIn(page, "admin@example.test", /Staff operations workspace/);
  await expect(page.getByRole("heading", { name: "Staff Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "User Management" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active Account Summary" })).toBeVisible();
  await captureDashboard(page, testInfo, "administrator");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "User Management" }).click();
  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
});
