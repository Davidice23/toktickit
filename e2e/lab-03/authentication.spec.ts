import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("active Administrator can sign in, reach the role workspace, and log out", async ({ page }) => {
  await signIn(page, "admin@example.test", /Administrator workspace/);
  await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff Queue" })).toBeVisible();
  await signOut(page);
});
