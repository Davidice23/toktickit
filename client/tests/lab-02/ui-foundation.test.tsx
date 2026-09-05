import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

describe("Lab 2 UI foundation", () => {
  it("exposes the desktop navigation and current requester context", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Current Requester")).toHaveTextContent("Not selected");
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
  });

  it("toggles the labeled mobile menu with aria-expanded", async () => {
    const user = userEvent.setup();
    render(<App />);
    const menu = screen.getByRole("button", { name: "Menu" });

    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeVisible();
  });
});
