import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDashboard from "../../src/RequesterDashboard.js";
import * as api from "../../src/api.js";

const asOf = "2026-11-01T05:00:00.000Z";
const ticket = { id: 18, ticketNumber: "TKT-018", summary: "Reset VPN access", currentStatus: "WAITING_FOR_REQUESTER" as const, requestedPriority: "MEDIUM" as const, itPriority: null, createdAt: asOf, updatedAt: asOf, resolvedAt: null };
const dashboard: api.RequesterDashboard = {
  asOf,
  metrics: { openTickets: 3, waitingForRequester: 1, recentlyUpdated: 2, recentlyResolved: 0 },
  attentionTickets: [ticket], recentlyUpdatedTickets: [ticket], recentlyResolvedTickets: [],
  drillDown: {
    openTickets: "/my-tickets?scope=open",
    waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER",
    recentlyUpdated: `/my-tickets?scope=recently-updated&asOf=${encodeURIComponent(asOf)}`,
    recentlyResolved: `/my-tickets?scope=recently-resolved&asOf=${encodeURIComponent(asOf)}`,
  },
};

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Requester Dashboard", () => {
  it("renders API metrics, bounded lists, and matching requester-only drill-downs", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(dashboard);
    render(<RequesterDashboard />);

    expect(await screen.findByText("3", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText("TKT-018 · Reset VPN access")).toHaveLength(2);
    const updated = screen.getByRole("link", { name: "Recently Updated 2 View matching Tickets" });
    const parsed = new URL(updated.getAttribute("href")!.slice(1), "https://toktickit.invalid");
    expect(parsed.pathname).toBe("/my-tickets");
    expect(parsed.searchParams.get("scope")).toBe("recently-updated");
    expect(parsed.searchParams.get("asOf")).toBe(asOf);
    expect(screen.getAllByRole("link", { name: /TKT-018 · Reset VPN access/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /TKT-018 · Reset VPN access/ })[0]).toHaveAttribute("href", "#requester-ticket/18");
    expect(screen.getByText("No Tickets were resolved in the last 14 days.")).toBeInTheDocument();
  });

  it("keeps zero-valued cards visible and retries a safe dashboard read after failure", async () => {
    vi.spyOn(api, "fetchRequesterDashboard").mockRejectedValueOnce(new Error("Dashboard unavailable")).mockResolvedValueOnce({
      ...dashboard,
      metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
    });
    const user = userEvent.setup();
    render(<RequesterDashboard />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getAllByText("0", { selector: "strong" })).toHaveLength(4);
  });
});
