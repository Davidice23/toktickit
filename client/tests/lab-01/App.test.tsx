import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading while signed out", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockRejectedValue(new Error("Unauthenticated"));
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Sign in to TokTickIT" })).toBeInTheDocument();
  });

  it("keeps the temporary Check System widget out of the authenticated workspace", async () => {
    const requester = { user: { id: 1, name: "Requester", email: "requester@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(requester);
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
      drillDown: { openTickets: "", waitingForRequester: "", recentlyUpdated: "", recentlyResolved: "" },
    });
    render(<App />);
    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check system/i })).not.toBeInTheDocument();
  });
});
