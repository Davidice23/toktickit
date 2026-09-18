import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 1, name: "Wachirawit", email: "wachirawit@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };

afterEach(() => vi.restoreAllMocks());

describe("Lab 2 UI foundation", () => {
  it("exposes authenticated navigation and current user context", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    render(<App />);

    expect(await screen.findByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Current User")).toHaveTextContent("Wachirawit");
    expect(screen.queryByRole("button", { name: "Choose Requester" })).not.toBeInTheDocument();
  });

  it("toggles the labeled mobile menu with aria-expanded", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    const user = userEvent.setup();
    render(<App />);
    const menu = await screen.findByRole("button", { name: "Menu" });

    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("navigation", { name: /primary navigation/i })).getByRole("link", { name: "Create Ticket" })).toBeVisible();
  });
});
