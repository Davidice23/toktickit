import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const session = { user: { id: 7, name: "Staff User", email: "staff@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false }, mustChangePassword: false, csrfToken: "csrf" };
const queue = { data: [{ id: 11, ticketNumber: "TKT-000011", requesterId: 2, summary: "VPN access", requestedPriority: "HIGH", itPriority: null, currentStatus: "OPEN", ownerId: null, createdAt: "2026-09-18T01:00:00.000Z", updatedAt: "2026-09-18T02:00:00.000Z", requester: { id: 2, name: "Requester User", email: "requester@example.com" }, owner: null, category: { id: 1, name: "Network" }, relatedSystem: { id: 1, name: "VPN" } }], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } };
const detail = { ...queue.data[0], categoryId: 1, relatedSystemId: 1, description: "Cannot connect to VPN", requester: { id: 2, name: "Requester User", email: "requester@example.com" }, requesterConfirmedResolved: false, requesterConfirmedResolvedAt: null, attachments: [], publicComments: [], internalNotes: [] };

afterEach(() => vi.restoreAllMocks());

describe("Lab 3 Staff Ticket Detail UI", () => {
  it("opens operational detail and exposes claim, status, comments, notes, and attachment continuity", async () => {
    vi.spyOn(api, "fetchCurrentUser").mockResolvedValue(session);
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(queue);
    const detailLoad = vi.spyOn(api, "fetchStaffTicketDetail").mockResolvedValue(detail);
    const claim = vi.spyOn(api, "claimStaffTicket").mockResolvedValue();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Staff Ticket Queue" });
    await screen.findByText("TKT-000011");
    await user.click(screen.getByRole("button", { name: "Open Detail" }));
    expect(await screen.findByRole("heading", { name: "TKT-000011" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational Controls" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add public comment")).toBeInTheDocument();
    expect(screen.getByLabelText("Add internal note")).toBeInTheDocument();
    expect(screen.getByText("No attachments.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Claim for me" }));
    expect(claim).toHaveBeenCalledWith(11);
    expect(detailLoad).toHaveBeenCalledWith(11);
  });
});
