import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { user: { id: 1, name: "Requester", email: "requester@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const staff = { user: { id: 7, name: "Staff", email: "staff@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const emptyQueue = { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } };
const emptyTickets = { data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("Lab 3 role-specific navigation", () => {
  it("lands IT Staff on the Staff Dashboard and keeps requester actions hidden", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(staff);
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { unassignedOpenTickets: 0, myOwnedOpenTickets: 0, myActiveActions: 0, myRecentlyCompletedActions: 0, urgentOpenTickets: 0 },
      myActiveActions: [], myRecentlyCompletedActions: [], recentOrUrgentTickets: [],
      drillDown: { unassignedOpenTickets: "", myOwnedOpenTickets: "", myActiveActions: "", myRecentlyCompletedActions: "", urgentOpenTickets: "" }, adminAccountSummary: null,
    });
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(emptyQueue);
    render(<App />);
    expect(await screen.findByRole("link", { name: "Open Staff Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("link", { name: "Staff Queue" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("link", { name: "Staff Queue" }));
    expect(await screen.findByRole("heading", { name: "Staff Ticket Queue" })).toBeInTheDocument();
  });

  it("keeps Requester navigation separate from Staff Queue", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(requester);
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
      drillDown: { openTickets: "", waitingForRequester: "", recentlyUpdated: "", recentlyResolved: "" },
    });
    vi.spyOn(api, "fetchTickets").mockResolvedValue(emptyTickets);
    render(<App />);
    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create Ticket" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Staff Queue" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("link", { name: "My Tickets" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  it("shows both Staff Queue and User Management for Administrators", async () => {
    const administrator = { user: { id: 9, name: "Admin", email: "admin@example.com", role: "ADMINISTRATOR" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(administrator);
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { unassignedOpenTickets: 0, myOwnedOpenTickets: 0, myActiveActions: 0, myRecentlyCompletedActions: 0, urgentOpenTickets: 0 },
      myActiveActions: [], myRecentlyCompletedActions: [], recentOrUrgentTickets: [],
      drillDown: { unassignedOpenTickets: "", myOwnedOpenTickets: "", myActiveActions: "", myRecentlyCompletedActions: "", urgentOpenTickets: "" }, adminAccountSummary: [],
    });
    vi.spyOn(api, "fetchAdminUsers").mockResolvedValue({ data: [], meta: { totalItems: 0 } });
    render(<App />);
    expect(await screen.findByRole("link", { name: "Open Staff Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff Dashboard" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Staff Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("link", { name: "User Management" }));
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
  });

  it("rejects a Requester deep-link to Administrator User Management and returns to the dashboard", async () => {
    window.history.replaceState(null, "", "/#admin-users");
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(requester);
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
      drillDown: { openTickets: "", waitingForRequester: "", recentlyUpdated: "", recentlyResolved: "" },
    });
    render(<App />);
    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#dashboard");
    expect(screen.queryByRole("heading", { name: "User Management" })).not.toBeInTheDocument();
  });

  it("clears the previous Requester's dashboard data when the signed-in account changes", async () => {
    const requesterB = { user: { id: 2, name: "Requester B", email: "b@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf-b" };
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("Unauthenticated"));
    vi.spyOn(api, "login").mockResolvedValueOnce(requester).mockResolvedValueOnce(requesterB);
    vi.spyOn(api, "logout").mockResolvedValue();
    vi.spyOn(api, "fetchRequesterDashboard")
      .mockResolvedValueOnce({
        asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 1, waitingForRequester: 1, recentlyUpdated: 0, recentlyResolved: 0 },
        attentionTickets: [{ id: 91, ticketNumber: "TKT-A-091", summary: "Private account A", currentStatus: "WAITING_FOR_REQUESTER", requestedPriority: "LOW", itPriority: null, createdAt: "2026-11-01T05:00:00.000Z", updatedAt: "2026-11-01T05:00:00.000Z", resolvedAt: null }], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
        drillDown: { openTickets: "/my-tickets?scope=open", waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER", recentlyUpdated: "/my-tickets?scope=recently-updated", recentlyResolved: "/my-tickets?scope=recently-resolved" },
      })
      .mockResolvedValueOnce({
        asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
        attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
        drillDown: { openTickets: "/my-tickets?scope=open", waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER", recentlyUpdated: "/my-tickets?scope=recently-updated", recentlyResolved: "/my-tickets?scope=recently-resolved" },
      });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), requester.user.email);
    await user.type(screen.getByLabelText("Password"), "password-a");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("TKT-A-091 · Private account A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.type(await screen.findByLabelText("Email"), requesterB.user.email);
    await user.type(screen.getByLabelText("Password"), "password-b");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.queryByText("TKT-A-091 · Private account A")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current User")).toHaveTextContent("Requester B");
  });
});
