import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const pendingSession = { user: { id: 1, name: "Anan Chaiya", email: "anan@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: true }, mustChangePassword: true, csrfToken: "csrf" };
const activeSession = { user: { ...pendingSession.user, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf-2" };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 mandatory Change Password flow", () => {
  it("blocks the workspace until the first password change succeeds", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(pendingSession);
    vi.spyOn(api, "changePassword").mockResolvedValue(activeSession);
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue({
      asOf: "2026-11-01T05:00:00.000Z", metrics: { openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 },
      attentionTickets: [], recentlyUpdatedTickets: [], recentlyResolvedTickets: [],
      drillDown: { openTickets: "", waitingForRequester: "", recentlyUpdated: "", recentlyResolved: "" },
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Change your password" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Current password"), "temporary-password");
    await user.type(screen.getByLabelText("New password"), "new-password-123");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByText("No Tickets are waiting for your response.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(api.changePassword).toHaveBeenCalledWith("temporary-password", "new-password-123", "new-password-123");
  });
});
