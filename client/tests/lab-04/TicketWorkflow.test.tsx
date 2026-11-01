import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const ticket: api.StaffTicketDetail = {
  id: 18, ticketNumber: "TKT-000018", requesterId: 2, summary: "VPN access", description: "Cannot connect to VPN",
  categoryId: 1, relatedSystemId: 1, category: { id: 1, name: "Network" }, relatedSystem: { id: 1, name: "VPN" },
  requestedPriority: "HIGH", itPriority: "HIGH", currentStatus: "OPEN", workflowVersion: 5, ownerId: 7,
  owner: { id: 7, name: "Staff User", email: "staff@example.com", role: "IT_STAFF", isActive: true },
  createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z",
  requester: { id: 2, name: "Requester User", email: "requester@example.com" },
  requesterConfirmedResolved: false, attachments: [], publicComments: [], internalNotes: [],
};
const pageMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Ticket workflow UI", () => {
  it("offers only contract-permitted transitions and requires cancellation reason and confirmation", async () => {
    let currentTicket = { ...ticket };
    vi.spyOn(api, "fetchStaffTicketDetail").mockImplementation(async () => currentTicket);
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta: pageMeta });
    const update = vi.spyOn(api, "updateStaffTicketStatus").mockImplementation(async (_ticketId, status) => { currentTicket = { ...currentTicket, currentStatus: status, workflowVersion: currentTicket.workflowVersion + 1 }; });
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={18} onBack={() => undefined} />);

    await screen.findByRole("heading", { name: "TKT-000018" });
    const statusSelect = screen.getByLabelText("Next status");
    const allowed = Array.from((statusSelect as HTMLSelectElement).options).map((option) => option.value).filter(Boolean);
    expect(allowed).toEqual(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"]);
    await user.selectOptions(statusSelect, "CANCELLED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByText("A reason is required for cancellation or reopening.")).toBeInTheDocument();
    expect(screen.getByText("Confirm this cancellation or closure.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Reason/), "Requester withdrew the request");
    await user.click(screen.getByLabelText(/I confirm this cancelled transition/));
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(18, "CANCELLED", 5, { confirmation: true, reason: "Requester withdrew the request" }));
    expect(await screen.findByText("CANCELLED")).toBeInTheDocument();
  });

  it("preserves the resolution form draft and explains server gate failures", async () => {
    let currentTicket = { ...ticket, currentStatus: "IN_PROGRESS" as const };
    vi.spyOn(api, "fetchStaffTicketDetail").mockImplementation(async () => currentTicket);
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "updateStaffTicketStatus").mockRejectedValue(Object.assign(new Error("Ticket cannot be resolved until all prerequisites are satisfied"), { code: "RESOLUTION_GATE_FAILED", fields: { completedAction: "Complete an Action with a Result" } }));
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={18} onBack={() => undefined} />);

    await screen.findByRole("heading", { name: "TKT-000018" });
    await user.selectOptions(screen.getByLabelText("Next status"), "RESOLVED");
    expect(screen.getByText(/Resolving a Ticket requires an active operational owner/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/all prerequisites are satisfied/);
    expect(screen.getByLabelText("Next status")).toHaveValue("RESOLVED");
    expect(screen.getByRole("alert")).toHaveTextContent("Complete an Action with a Result");
  });

  it("shows a safe not-found state and can retry loading the Ticket", async () => {
    const loadTicket = vi.spyOn(api, "fetchStaffTicketDetail")
      .mockRejectedValueOnce(Object.assign(new Error("Ticket not found"), { code: "TICKET_NOT_FOUND", status: 404 }))
      .mockResolvedValueOnce(ticket);
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta: pageMeta });
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={18} onBack={() => undefined} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found");
    expect(screen.getByText("Operational Ticket details are available only to IT Staff and Administrators.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "TKT-000018" })).toBeInTheDocument();
    expect(loadTicket).toHaveBeenCalledTimes(2);
  });
});
