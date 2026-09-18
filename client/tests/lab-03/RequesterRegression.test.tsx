import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 1, name: "Anan Chaiya", email: "anan@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const list = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 authenticated Requester regression UI", () => {
  it("loads only the signed-in user's ticket workspace", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    vi.spyOn(api, "fetchTickets").mockResolvedValue(list);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(await screen.findByText("You have not created any tickets yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Development Requester/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose Requester" })).not.toBeInTheDocument();
    expect(api.fetchTickets).toHaveBeenCalledWith(expect.any(URLSearchParams));
  });
});
