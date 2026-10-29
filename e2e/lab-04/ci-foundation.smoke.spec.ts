import { expect, test } from "@playwright/test";
import { signIn, signOut } from "../lab-03/helpers";

test("anonymous users see the sign-in page and cannot call a protected API", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in to TokTickIT" })).toBeVisible();
  const denied = await page.request.get("http://127.0.0.1:3000/api/tickets");
  expect(denied.status()).toBe(401);
  expect(await denied.json()).toEqual({
    error: { code: "UNAUTHENTICATED", message: "Authentication is required" },
  });
});

test("a seeded requester can sign in, reach My Tickets, and sign out", async ({ page }) => {
  await signIn(page, "anan.chaiya@example.test", /Requester workspace/);

  await expect(page.getByRole("link", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

  await signOut(page);
});
