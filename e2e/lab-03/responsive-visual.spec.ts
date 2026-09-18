import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

for (const width of [1440, 820, 390]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "admin@example.test", /Administrator workspace/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
