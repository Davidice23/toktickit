import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers";

const viewports = [
  { width: 1440, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
];

function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = color.replace("#", "").match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function captureDashboard(page: Page, testInfo: TestInfo, role: string) {
  const original = page.viewportSize();
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: role === "requester" ? "Requester Dashboard" : "Staff Dashboard" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${role} dashboard overflows at ${viewport.width}px`).toBeLessThanOrEqual(1);
      const palette = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        return {
          secondary: styles.getPropertyValue("--color-secondary").trim(),
          surface: styles.getPropertyValue("--color-surface").trim(),
          paleGreen: styles.getPropertyValue("--color-pale-green").trim(),
          focus: styles.getPropertyValue("--color-focus").trim(),
          primary: styles.getPropertyValue("--color-primary").trim(),
        };
      });
      expect(contrastRatio(palette.secondary, palette.surface), "dashboard link text on white cards").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.secondary, palette.paleGreen), "dashboard link text on pale-green surfaces").toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.focus, palette.surface), "focus indicator against a white surface").toBeGreaterThanOrEqual(3);
      expect(contrastRatio("#ffffff", palette.primary), "header focus indicator against the green header").toBeGreaterThanOrEqual(3);
      if (viewport.width === 390) {
        const menu = page.getByRole("button", { name: "Menu" });
        await menu.focus();
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Tab");
        const dashboardLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Dashboard" });
        await expect(dashboardLink).toBeFocused();
        const focusColor = await dashboardLink.evaluate((element) => getComputedStyle(element).outlineColor);
        expect(focusColor, "keyboard focus in the green header must remain clearly visible").toBe("rgb(255, 255, 255)");
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await menu.focus();
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        await expect(dashboardLink).toHaveAttribute("aria-current", "page");
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "false");
      }
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
