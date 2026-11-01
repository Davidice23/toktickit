import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

for (const width of [1440, 820, 390]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "admin@example.test", /Staff operations workspace/);
    await expect(page.getByRole("heading", { name: "Staff Dashboard" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
