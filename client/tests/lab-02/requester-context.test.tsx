import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 1, name: "Anan Chaiya", email: "anan@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Lab 3 authenticated Requester context", () => {
  it("uses the authenticated session instead of a Development Requester selector", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    render(<App />);

    expect(await screen.findByLabelText("Current User")).toHaveTextContent("Anan Chaiya");
    expect(screen.queryByRole("button", { name: "Choose Requester" })).not.toBeInTheDocument();
    expect(localStorage.getItem("toktickit.devRequesterId")).toBeNull();
  });

  it("shows a safe sign-in form when there is no authenticated session", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("database details"));
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("database details")).not.toBeInTheDocument();
  });
});
