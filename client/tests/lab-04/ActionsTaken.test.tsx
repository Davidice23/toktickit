import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ActionsTaken from "../../src/ActionsTaken.js";
import * as api from "../../src/api.js";

const meta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
const plannedAction: api.ActionTaken = {
  id: 41, ticketId: 18, status: "PLANNED", description: "Collect browser diagnostics", result: null,
  followUpRequired: false, followUpNote: null, attachmentNotes: null, actionAt: null, cancelledAt: null,
  cancellationReason: null, version: 1, createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z",
  assignee: { id: 8, name: "Staff User", role: "IT_STAFF" }, performedBy: null,
};

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Actions Taken UI", () => {
  it("shows Requester Actions as safe read-only records", async () => {
    const requesterSafeAction: api.ActionTaken = { ...plannedAction, assignee: { id: 8, name: "Staff User" } };
    vi.spyOn(api, "fetchRequesterActions").mockResolvedValue({ data: [requesterSafeAction], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    render(<ActionsTaken ticketId={18} role="requester" ticketStatus="OPEN" />);

    expect(await screen.findByText("Collect browser diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Staff User")).toBeInTheDocument();
    expect(screen.queryByText(/IT STAFF|ADMINISTRATOR/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Pending completion")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Actions Taken (read-only)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(api.fetchStaffTicketHistory).not.toHaveBeenCalled();
  });

  it("shows loading, recoverable list failure, retry, and an explicit empty state", async () => {
    let rejectInitial!: (reason: Error) => void;
    const fetchActions = vi.spyOn(api, "fetchRequesterActions")
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectInitial = reject; }))
      .mockResolvedValueOnce({ data: [], meta });
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="requester" ticketStatus="OPEN" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Actions Taken");
    rejectInitial(new Error("Temporary connection failure"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary connection failure");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No Actions Taken have been recorded");
    expect(fetchActions).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
  });

  it("shows a safe forbidden state and permits retry after access is restored", async () => {
    const fetchActions = vi.spyOn(api, "fetchStaffActions")
      .mockRejectedValueOnce(Object.assign(new Error("You do not have permission to access this resource"), { code: "FORBIDDEN", status: 403 }))
      .mockResolvedValueOnce({ data: [], meta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta });
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketStatus="OPEN" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No Actions Taken have been recorded");
    expect(fetchActions).toHaveBeenCalledTimes(2);
  });

  it("follows a dashboard-selected Action across bounded pages and restores focus to it", async () => {
    const selected = { ...plannedAction, id: 99, description: "Follow dashboard-selected work" };
    const fetchActions = vi.spyOn(api, "fetchStaffActions")
      .mockResolvedValueOnce({ data: [], meta: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2, hasPreviousPage: false, hasNextPage: true } })
      .mockResolvedValueOnce({ data: [selected], meta: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2, hasPreviousPage: true, hasNextPage: false } });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [], meta });
    render(<ActionsTaken ticketId={18} role="staff" ticketStatus="OPEN" focusActionId={99} />);

    expect(await screen.findByText("Follow dashboard-selected work")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("listitem")).toHaveFocus());
    expect(fetchActions).toHaveBeenCalledTimes(2);
    expect(fetchActions).toHaveBeenNthCalledWith(2, 18, 2);
  });

  it("creates, starts, and completes an Action with server versions and accessible dialog behavior", async () => {
    let currentAction: api.ActionTaken | null = null;
    const fetchActions = vi.spyOn(api, "fetchStaffActions").mockImplementation(async () => ({ data: currentAction ? [currentAction] : [], meta: { ...meta, totalItems: currentAction ? 1 : 0, totalPages: currentAction ? 1 : 0 } }));
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [{ id: 8, name: "Staff User", role: "IT_STAFF" }], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    const create = vi.spyOn(api, "createStaffAction").mockImplementation(async () => { currentAction = plannedAction; return plannedAction; });
    const transition = vi.spyOn(api, "transitionStaffAction").mockImplementation(async (_ticketId, _actionId, input) => {
      if (!currentAction) throw new Error("Expected created Action");
      currentAction = { ...currentAction, status: input.status, version: currentAction.version + 1, ...(input.status === "COMPLETED" ? { result: input.result ?? null, performedBy: { id: 8, name: "Staff User", role: "IT_STAFF" }, actionAt: "2026-11-01T09:00:00.000Z" } : {}) };
      return currentAction;
    });
    const user = userEvent.setup();
    function Host() {
      const [version, setVersion] = useState(4);
      return <ActionsTaken ticketId={18} role="staff" ticketVersion={version} ticketStatus="OPEN" onTicketChanged={() => setVersion((value) => value + 1)} />;
    }
    render(<Host />);

    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    await user.selectOptions(screen.getByLabelText(/Assignee/), "8");
    await user.type(screen.getByLabelText(/Action Description/), "Collect browser diagnostics");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText("Collect browser diagnostics");
    expect(create).toHaveBeenCalledWith(18, { expectedTicketVersion: 4, assigneeId: 8, description: "Collect browser diagnostics", followUpRequired: false, followUpNote: null, attachmentNotes: "" }, expect.any(String));

    await user.click(await screen.findByRole("button", { name: "Start" }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(18, 41, { expectedTicketVersion: 5, expectedActionVersion: 1, status: "IN_PROGRESS" }));
    const completeButton = await screen.findByRole("button", { name: "Complete" });
    await user.click(completeButton);
    const dialog = screen.getByRole("dialog", { name: "Complete Action #41" });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(completeButton).toHaveFocus();

    await user.click(completeButton);
    await user.type(screen.getByLabelText(/Result/), "Diagnostics collected");
    await user.click(screen.getByLabelText("Follow-up required?"));
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    expect(await screen.findByText("A note is required when follow-up is selected.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Follow-up Note/)).toHaveAttribute("aria-invalid", "true");
    await user.type(screen.getByLabelText(/Follow-up Note/), "Requester to confirm service restoration");
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(transition).toHaveBeenLastCalledWith(18, 41, { expectedTicketVersion: 6, expectedActionVersion: 2, status: "COMPLETED", result: "Diagnostics collected", followUpRequired: true, followUpNote: "Requester to confirm service restoration" }));
    expect(await screen.findByText("Diagnostics collected")).toBeInTheDocument();
    expect(screen.getByText("Staff User")).toBeInTheDocument();
    const completedActionCard = screen.getByRole("listitem");
    await waitFor(() => expect(completedActionCard).toHaveFocus());
    expect(fetchActions).toHaveBeenCalled();
  });

  it("keeps a failed form draft and associates server validation with its field", async () => {
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [{ id: 8, name: "Staff User", role: "IT_STAFF" }], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    vi.spyOn(api, "createStaffAction").mockRejectedValue(Object.assign(new Error("Check the highlighted values and try again."), { fields: { description: "Description must contain 1-2,000 characters" } }));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketVersion={4} ticketStatus="OPEN" />);

    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    await user.selectOptions(screen.getByLabelText(/Assignee/), "8");
    await user.type(screen.getByLabelText(/Action Description/), "Draft survives failure");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("Description must contain 1-2,000 characters")).toBeInTheDocument();
    expect(screen.getByLabelText(/Action Description/)).toHaveValue("Draft survives failure");
    expect(screen.getByLabelText(/Action Description/)).toHaveAttribute("aria-invalid", "true");
  });

  it("edits an active Action and requires a reason before cancellation", async () => {
    let currentAction = plannedAction;
    vi.spyOn(api, "fetchStaffActions").mockImplementation(async () => ({ data: [currentAction], meta: { ...meta, totalItems: 1, totalPages: 1 } }));
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [{ id: 8, name: "Staff User", role: "IT_STAFF" }, { id: 9, name: "Admin User", role: "ADMINISTRATOR" }], meta: { ...meta, totalItems: 2, totalPages: 1 } });
    const update = vi.spyOn(api, "updateStaffAction").mockImplementation(async (_ticketId, _actionId, input) => { currentAction = { ...currentAction, assignee: { id: input.assigneeId, name: input.assigneeId === 9 ? "Admin User" : "Staff User", role: input.assigneeId === 9 ? "ADMINISTRATOR" : "IT_STAFF" }, description: input.description, version: currentAction.version + 1 }; return currentAction; });
    const transition = vi.spyOn(api, "transitionStaffAction").mockImplementation(async (_ticketId, _actionId, input) => { currentAction = { ...currentAction, status: input.status, cancellationReason: input.cancellationReason ?? null, version: currentAction.version + 1 }; return currentAction; });
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketVersion={4} ticketStatus="OPEN" />);

    await user.click(await screen.findByRole("button", { name: "Edit or assign" }));
    await user.selectOptions(screen.getByLabelText(/Assignee/), "9");
    await user.clear(screen.getByLabelText(/Action Description/));
    await user.type(screen.getByLabelText(/Action Description/), "Updated browser diagnostics");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(18, 41, { expectedTicketVersion: 4, expectedActionVersion: 1, assigneeId: 9, description: "Updated browser diagnostics", followUpRequired: false, followUpNote: null, attachmentNotes: "" }));
    expect(await screen.findByText("Updated browser diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Admin User (ADMINISTRATOR)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel Action" }));
    await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    expect(await screen.findByText("A cancellation reason is required.")).toBeInTheDocument();
    expect(transition).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Cancellation reason/), "Duplicate request");
    await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(18, 41, { expectedTicketVersion: 4, expectedActionVersion: 2, status: "CANCELLED", cancellationReason: "Duplicate request" }));
    expect(await screen.findByText("CANCELLED")).toBeInTheDocument();
  });

  it("reconciles a stale-version conflict without discarding the edit draft", async () => {
    const fetchActions = vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [plannedAction], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [{ id: 8, name: "Staff User", role: "IT_STAFF" }], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    vi.spyOn(api, "updateStaffAction").mockRejectedValue(Object.assign(new Error("The Ticket changed since it was loaded"), { code: "STALE_VERSION" }));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketVersion={4} ticketStatus="OPEN" />);

    await user.click(await screen.findByRole("button", { name: "Edit or assign" }));
    const description = screen.getByLabelText(/Action Description/);
    await user.clear(description);
    await user.type(description, "Keep this draft while reconciling");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed since it was loaded");
    expect(description).toHaveValue("Keep this draft while reconciling");
    await user.click(screen.getByRole("button", { name: "Reload latest Action data" }));
    await waitFor(() => expect(fetchActions).toHaveBeenCalledTimes(3));
    expect(description).toHaveValue("Keep this draft while reconciling");
  });

  it("confirms discard of a dirty Action form and restores focus to its trigger", async () => {
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    vi.spyOn(api, "fetchOperationalUsers").mockResolvedValue({ data: [{ id: 8, name: "Staff User", role: "IT_STAFF" }], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketVersion={4} ticketStatus="OPEN" />);

    const addAction = screen.getAllByRole("button", { name: "Add Action" })[0];
    await user.click(addAction);
    const description = await screen.findByLabelText(/Action Description/);
    await user.type(description, "Unsaved work");
    await user.click(screen.getByRole("button", { name: "Cancel form" }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved Action changes?");
    expect(description).toHaveValue("Unsaved work");

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancel form" }));
    await waitFor(() => expect(screen.queryByLabelText(/Action Description/)).not.toBeInTheDocument());
    expect(addAction).toHaveFocus();
  });

  it("allows Escape to close a transition dialog and restore focus", async () => {
    vi.spyOn(api, "fetchStaffActions").mockResolvedValue({ data: [plannedAction], meta: { ...meta, totalItems: 1, totalPages: 1 } });
    vi.spyOn(api, "fetchStaffTicketHistory").mockResolvedValue({ data: [], meta });
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={18} role="staff" ticketVersion={4} ticketStatus="OPEN" />);
    const complete = await screen.findByRole("button", { name: "Complete" });
    await user.click(complete);
    const result = screen.getByLabelText(/Result/);
    const close = screen.getByRole("button", { name: "Close" });
    expect(result).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(result).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(complete).toHaveFocus();
  });
});
