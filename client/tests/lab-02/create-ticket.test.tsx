import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 1, name: "Anan Chaiya", email: "anan@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const emptyTickets = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("Lab 3 session-owned Create Ticket", () => {
  it("loads reference data, validates fields, and creates a Ticket for the signed-in user", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    vi.spyOn(api, "fetchTickets").mockResolvedValue(emptyTickets);
    vi.spyOn(api, "fetchCategories").mockResolvedValue([{ id: 2, name: "Hardware" }]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([{ id: 7, name: "Network and VPN", isActive: true }]);
    vi.spyOn(api, "createTicket").mockResolvedValue({ id: 1, ticketNumber: "TKT-000001", requesterId: 1, summary: "Printer issue", currentStatus: "NEW", createdAt: "2026-09-05T00:00:00Z" });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await user.click(within(screen.getByRole("navigation", { name: /primary navigation/i })).getByRole("link", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });

    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Summary must contain 5-120 characters")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.selectOptions(screen.getByLabelText("Related System"), "7");
    await user.selectOptions(screen.getByLabelText("Requested Priority"), "MEDIUM");
    await user.type(screen.getByLabelText(/Summary/), "Printer issue");
    await user.type(screen.getByLabelText(/Description/), "The office printer cannot connect to the network.");
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Ticket created:")).toBeInTheDocument();
    expect(screen.getByText("TKT-000001")).toBeInTheDocument();
    expect(api.createTicket).toHaveBeenCalledWith(expect.objectContaining({ summary: "Printer issue" }), expect.any(String));
  });
});
