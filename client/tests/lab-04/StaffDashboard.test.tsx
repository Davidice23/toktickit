import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffDashboard from "../../src/StaffDashboard.js";
import * as api from "../../src/api.js";

const asOf = "2026-11-01T05:00:00.000Z";
const dashboard: api.StaffDashboard = {
  asOf,
  metrics: { unassignedOpenTickets: 4, myOwnedOpenTickets: 2, myActiveActions: 1, myRecentlyCompletedActions: 1, urgentOpenTickets: 2 },
  myActiveActions: [{ id: 501, ticketId: 18, status: "IN_PROGRESS", description: "Check network path", actionAt: null, updatedAt: asOf, ticket: { id: 18, ticketNumber: "TKT-018", summary: "VPN access" } }],
  myRecentlyCompletedActions: [{ id: 502, ticketId: 19, status: "COMPLETED", description: "Restore access", actionAt: asOf, updatedAt: asOf, ticket: { id: 19, ticketNumber: "TKT-019", summary: "Account locked" } }],
  recentOrUrgentTickets: [{ id: 20, ticketNumber: "TKT-020", summary: "Printer down", currentStatus: "OPEN", requestedPriority: "HIGH", itPriority: "URGENT", ownerId: 7, createdAt: asOf, updatedAt: asOf, requester: { id: 1, name: "Requester A" }, owner: { id: 7, name: "Staff A" } }],
  drillDown: {
    unassignedOpenTickets: "/staff-tickets?scope=unassigned-open",
    myOwnedOpenTickets: "/staff-tickets?scope=my-owned-open",
    myActiveActions: "/staff-tickets?scope=my-active-actions",
    myRecentlyCompletedActions: `/staff-tickets?scope=my-recently-completed-actions&asOf=${encodeURIComponent(asOf)}`,
    urgentOpenTickets: "/staff-tickets?scope=urgent-open",
  },
  adminAccountSummary: [{ role: "REQUESTER", activeUsers: 12 }, { role: "IT_STAFF", activeUsers: 3 }, { role: "ADMINISTRATOR", activeUsers: 1 }],
};

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Staff Dashboard", () => {
  it("maps operational metrics, action-specific links, and Ticket drill-downs", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(dashboard);
    render(<StaffDashboard isAdministrator={false} />);

    expect(await screen.findByText("4", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /TKT-018 · VPN access/ })).toHaveAttribute("href", "#staff-ticket/18?action=501");
    expect(screen.getByRole("link", { name: /TKT-019 · Account locked/ })).toHaveAttribute("href", "#staff-ticket/19?action=502");
    expect(screen.getByRole("link", { name: /TKT-020 · Printer down/ })).toHaveAttribute("href", "#staff-ticket/20");
    expect(screen.queryByRole("heading", { name: "Active Account Summary" })).not.toBeInTheDocument();
    const completed = screen.getByRole("link", { name: "My Recently Completed Actions 1 View matching work" });
    const parsed = new URL(completed.getAttribute("href")!.slice(1), "https://toktickit.invalid");
    expect(parsed.pathname).toBe("/staff-tickets");
    expect(parsed.searchParams.get("scope")).toBe("my-recently-completed-actions");
    expect(parsed.searchParams.get("asOf")).toBe(asOf);
  });

  it("shows administrator summary as aggregates only, and all zero cards remain available", async () => {
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue({
      ...dashboard,
      metrics: { unassignedOpenTickets: 0, myOwnedOpenTickets: 0, myActiveActions: 0, myRecentlyCompletedActions: 0, urgentOpenTickets: 0 },
      myActiveActions: [], myRecentlyCompletedActions: [], recentOrUrgentTickets: [],
    });
    render(<StaffDashboard isAdministrator />);

    expect(await screen.findByRole("heading", { name: "Active Account Summary" })).toBeInTheDocument();
    expect(screen.getAllByText("0", { selector: "strong" })).toHaveLength(5);
    expect(screen.getByText("No Actions are currently assigned to you.")).toBeInTheDocument();
    expect(screen.getByText("No recent or urgent open Tickets need attention.")).toBeInTheDocument();
    expect(screen.queryByText(/password|session/i)).toHaveTextContent("account credentials and session details are not shown.");
  });
});
