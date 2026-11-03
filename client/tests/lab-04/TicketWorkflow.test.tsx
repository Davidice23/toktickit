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

  it("locks Ticket controls until an Action write and workflow-version refresh finish", async () => {
    let currentTicket: api.StaffTicketDetail = { ...ticket, currentStatus: "IN_PROGRESS" };
    let currentAction: api.ActionTaken = {
      id: 41, ticketId: 18, status: "IN_PROGRESS", description: "Complete verified work", result: null,
      followUpRequired: false, followUpNote: null, attachmentNotes: null, actionAt: null, cancelledAt: null,
      cancellationReason: null, version: 1, createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z",
      assignee: { id: 7, name: "Staff User", role: "IT_STAFF" }, performedBy: null,
    };
    let finishTransition!: (action: api.ActionTaken) => void;
    vi.spyOn(api, "fetchStaffTicketDetail").mockImplementation(async () => currentTicket);
    vi.spyOn(api, "fetchStaffActions").mockImplementation(async () => ({ data: [currentAction], meta: { ...pageMeta, totalItems: 1, totalPages: 1 } }));
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta: pageMeta });
    vi.spyOn(api, "transitionStaffAction").mockImplementation(async (_ticketId, _actionId, input) => {
      currentTicket = { ...currentTicket, workflowVersion: currentTicket.workflowVersion + 1 };
      currentAction = { ...currentAction, status: input.status, version: currentAction.version + 1, result: input.result ?? null };
      return new Promise((resolve) => { finishTransition = () => resolve(currentAction); });
    });
    const updateStatus = vi.spyOn(api, "updateStaffTicketStatus").mockImplementation(async (_ticketId, status) => {
      currentTicket = { ...currentTicket, currentStatus: status, workflowVersion: currentTicket.workflowVersion + 1 };
    });
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={18} onBack={() => undefined} />);

    await screen.findByRole("heading", { name: "TKT-000018" });
    await user.selectOptions(screen.getByLabelText("Next status"), "RESOLVED");
    await user.click(await screen.findByRole("button", { name: "Complete" }));
    await user.type(screen.getByLabelText(/Result/), "Diagnostics verified");
    const completion = user.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByText("Saving an Action and refreshing the Ticket. Other Ticket updates are temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Status" })).toBeDisabled();

    finishTransition(currentAction);
    await completion;
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(18, "RESOLVED", 6, { confirmation: false, reason: "" }));
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
