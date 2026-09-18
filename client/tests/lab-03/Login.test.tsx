import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 1, name: "Anan Chaiya", email: "anan@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 login and safe authentication states", () => {
  it("signs in and opens the session-owned workspace", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("Unauthenticated"));
    vi.spyOn(api, "login").mockResolvedValue(session);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), "anan@example.com");
    await user.type(screen.getByLabelText("Password"), "temporary-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current User")).toHaveTextContent("Anan Chaiya");
    expect(api.login).toHaveBeenCalledWith("anan@example.com", "temporary-password");
  });

  it("shows a generic error without exposing backend details", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("Unauthenticated"));
    vi.spyOn(api, "login").mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), "anan@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.queryByText("database details")).not.toBeInTheDocument();
  });
});
