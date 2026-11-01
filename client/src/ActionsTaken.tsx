import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useRef, useState } from "react";
import {
  ActionPage,
  ActionTaken as ActionTakenData,
  fetchOperationalUsers,
  fetchRequesterActions,
  fetchStaffActions,
  fetchStaffTicketHistory,
  OperationalUserOption,
  TicketHistoryPage,
  transitionStaffAction,
  createStaffAction,
  updateStaffAction,
} from "./api.js";

type Draft = { assigneeId: string; description: string; followUpRequired: boolean; followUpNote: string; attachmentNotes: string };
type Props = { ticketId: number; role: "requester" | "staff"; ticketVersion?: number; ticketStatus?: string; onTicketChanged?: () => void | Promise<void> };
type ApiProblem = Error & { code?: string; fields?: Record<string, string> };
type TransitionDialog = { action: ActionTakenData; kind: "complete" | "cancel" } | null;

const emptyDraft: Draft = { assigneeId: "", description: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" };
const terminalTicketStatuses = new Set(["RESOLVED", "CLOSED", "CANCELLED"]);

function errorFields(error: unknown): Record<string, string> {
  return error && typeof error === "object" && "fields" in error && typeof (error as ApiProblem).fields === "object" && (error as ApiProblem).fields
    ? (error as ApiProblem).fields!
    : {};
}

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Pending completion";
}

export default function ActionsTaken({ ticketId, role, ticketVersion = 0, ticketStatus = "OPEN", onTicketChanged }: Props) {
  const isStaff = role === "staff";
  const canWrite = isStaff && !terminalTicketStatuses.has(ticketStatus);
  const [actionPage, setActionPage] = useState<ActionPage | null>(null);
  const [actionPageNumber, setActionPageNumber] = useState(1);
  const [actionState, setActionState] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState("");
  const [actionOperationError, setActionOperationError] = useState("");
  const [conflictRecoveryAvailable, setConflictRecoveryAvailable] = useState(false);
  const [historyPage, setHistoryPage] = useState<TicketHistoryPage | null>(null);
  const [historyPageNumber, setHistoryPageNumber] = useState(1);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [directory, setDirectory] = useState<OperationalUserOption[]>([]);
  const [directoryMeta, setDirectoryMeta] = useState<ActionPage["meta"] | null>(null);
  const [directoryState, setDirectoryState] = useState<"loading" | "ready" | "error">("loading");
  const [directoryError, setDirectoryError] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryPageNumber, setDirectoryPageNumber] = useState(1);
  const [transitionDialog, setTransitionDialog] = useState<TransitionDialog>(null);
  const [transitionResult, setTransitionResult] = useState("");
  const [transitionFollowUpRequired, setTransitionFollowUpRequired] = useState(false);
  const [transitionFollowUpNote, setTransitionFollowUpNote] = useState("");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionErrors, setTransitionErrors] = useState<Record<string, string>>({});
  const [transitionError, setTransitionError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const dialogFallbackRef = useRef<HTMLElement | null>(null);
  const dialogActionIdRef = useRef<number | null>(null);
  const dialogReturnPendingRef = useRef(false);
  const formTriggerRef = useRef<HTMLButtonElement | null>(null);
  const initialDraftRef = useRef<Draft>(emptyDraft);

  async function loadActions(page = 1) {
    setActionState("loading");
    setActionError("");
    try {
      const value = isStaff ? await fetchStaffActions(ticketId, page) : await fetchRequesterActions(ticketId, page);
      setActionPage(value);
      setActionPageNumber(page);
      setActionState("ready");
    } catch (error) {
      setActionError(friendlyError(error, "Unable to load Actions Taken"));
      setActionState("error");
    }
  }

  async function loadHistory(page = 1) {
    if (!isStaff) return;
    setHistoryState("loading");
    setHistoryError("");
    try {
      const value = await fetchStaffTicketHistory(ticketId, page);
      setHistoryPage(value);
      setHistoryPageNumber(page);
      setHistoryState("ready");
    } catch (error) {
      setHistoryError(friendlyError(error, "Unable to load Ticket history"));
      setHistoryState("error");
    }
  }

  async function loadDirectory(page = 1, search = directoryQuery) {
    setDirectoryState("loading");
    setDirectoryError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) params.set("search", search.trim());
    try {
      const value = await fetchOperationalUsers(params);
      setDirectory(value.data);
      setDirectoryMeta(value.meta);
      setDirectoryPageNumber(page);
      setDirectoryState("ready");
    } catch (error) {
      setDirectoryError(friendlyError(error, "Unable to search active Staff and Administrators"));
      setDirectoryState("error");
    }
  }

  useEffect(() => {
    void loadActions();
    if (isStaff) {
      void loadHistory();
      void loadDirectory(1, "");
    }
  }, [ticketId, role]);

  useEffect(() => {
    if (!transitionDialog) return;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>("textarea, input, button");
    firstControl?.focus();
    function trapFocus(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        closeTransitionDialog();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled), input:not(:disabled)") ?? []);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
    };
  }, [transitionDialog, busy]);

  useEffect(() => {
    if (transitionDialog || busy || actionState === "loading" || !dialogReturnPendingRef.current) return;
    const trigger = dialogTriggerRef.current;
    if (trigger?.isConnected && !trigger.hasAttribute("disabled")) trigger.focus();
    else if (dialogActionIdRef.current !== null) document.getElementById(`action-card-${dialogActionIdRef.current}`)?.focus();
    else if (dialogFallbackRef.current?.isConnected) dialogFallbackRef.current.focus();
    else document.getElementById(`actions-heading-${ticketId}`)?.focus();
    dialogTriggerRef.current = null;
    dialogFallbackRef.current = null;
    dialogActionIdRef.current = null;
    dialogReturnPendingRef.current = false;
  }, [transitionDialog, busy, actionState, ticketId]);

  useEffect(() => {
    if (formOpen || busy || !formTriggerRef.current) return;
    if (formTriggerRef.current.isConnected && !formTriggerRef.current.hasAttribute("disabled")) formTriggerRef.current.focus();
    else document.getElementById(`add-action-${ticketId}`)?.focus();
    formTriggerRef.current = null;
  }, [formOpen, busy, ticketId]);

  function resetForm() {
    setFormOpen(false);
    setEditingActionId(null);
    setDraft(emptyDraft);
    setFormErrors({});
    setFormError("");
    setIdempotencyKey("");
  }

  function requestCloseForm() {
    if (JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current) && !window.confirm("Discard unsaved Action changes?")) return;
    resetForm();
  }

  function openCreateForm(event: MouseEvent<HTMLButtonElement>) {
    formTriggerRef.current = event.currentTarget;
    initialDraftRef.current = emptyDraft;
    setDraft(emptyDraft);
    setEditingActionId(null);
    setFormErrors({});
    setFormError("");
    setIdempotencyKey("");
    setFormOpen(true);
  }

  function openEditForm(event: MouseEvent<HTMLButtonElement>, action: ActionTakenData) {
    formTriggerRef.current = event.currentTarget;
    const actionDraft: Draft = { assigneeId: String(action.assignee.id), description: action.description, followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "" };
    setEditingActionId(action.id);
    initialDraftRef.current = actionDraft;
    setDraft(actionDraft);
    setFormErrors({});
    setFormError("");
    setFormOpen(true);
  }

  function updateDraft(field: keyof Draft, value: string | boolean) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
    if (editingActionId === null) setIdempotencyKey("");
  }

  async function refreshAfterMutation() {
    await Promise.all([loadActions(actionPageNumber), loadHistory(historyPageNumber)]);
    await onTicketChanged?.();
  }

  async function reconcileConflict() {
    await refreshAfterMutation();
    setConflictRecoveryAvailable(false);
  }

  async function startAction(action: ActionTakenData) {
    setBusy(true); setActionOperationError(""); setConflictRecoveryAvailable(false);
    try {
      await transitionStaffAction(ticketId, action.id, { expectedTicketVersion: ticketVersion, expectedActionVersion: action.version, status: "IN_PROGRESS" });
      await refreshAfterMutation();
    } catch (error) {
      setActionOperationError(friendlyError(error, "Unable to start Action"));
      const problem = error as ApiProblem;
      if (problem.code === "STALE_VERSION" || problem.code === "WRITE_CONFLICT") { setConflictRecoveryAvailable(true); await onTicketChanged?.(); }
      await Promise.all([loadActions(actionPageNumber), loadHistory(historyPageNumber)]);
    } finally { setBusy(false); }
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    const localErrors: Record<string, string> = {};
    const assigneeId = Number(draft.assigneeId);
    if (!Number.isSafeInteger(assigneeId) || assigneeId <= 0) localErrors.assigneeId = "Choose an active Staff or Administrator.";
    if (!draft.description.trim()) localErrors.description = "Action Description is required.";
    if (draft.followUpRequired && !draft.followUpNote.trim()) localErrors.followUpNote = "A note is required when follow-up is selected.";
    if (Object.keys(localErrors).length) { setFormErrors(localErrors); return; }
    setBusy(true); setFormErrors({}); setFormError(""); setActionOperationError(""); setConflictRecoveryAvailable(false);
    try {
      if (editingActionId === null) {
        const retryKey = idempotencyKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        setIdempotencyKey(retryKey);
        await createStaffAction(ticketId, { expectedTicketVersion: ticketVersion, assigneeId, description: draft.description, followUpRequired: draft.followUpRequired, followUpNote: draft.followUpRequired ? draft.followUpNote : null, attachmentNotes: draft.attachmentNotes }, retryKey);
      } else {
        const current = actionPage?.data.find((action) => action.id === editingActionId);
        if (!current) throw new Error("Action changed; reload before editing.");
        await updateStaffAction(ticketId, editingActionId, { expectedTicketVersion: ticketVersion, expectedActionVersion: current.version, assigneeId, description: draft.description, followUpRequired: draft.followUpRequired, followUpNote: draft.followUpRequired ? draft.followUpNote : null, attachmentNotes: draft.attachmentNotes });
      }
      resetForm();
      await refreshAfterMutation();
    } catch (error) {
      setFormError(friendlyError(error, "Unable to save Action"));
      setFormErrors(errorFields(error));
      const problem = error as ApiProblem;
      if (problem.code === "STALE_VERSION" || problem.code === "WRITE_CONFLICT") { setConflictRecoveryAvailable(true); await onTicketChanged?.(); }
      await Promise.all([loadActions(actionPageNumber), loadHistory(historyPageNumber)]);
    } finally { setBusy(false); }
  }

  function openTransition(event: MouseEvent<HTMLButtonElement>, action: ActionTakenData, kind: "complete" | "cancel") {
    dialogTriggerRef.current = event.currentTarget;
    dialogFallbackRef.current = event.currentTarget.closest<HTMLElement>(".action-card");
    dialogActionIdRef.current = action.id;
    dialogReturnPendingRef.current = true;
    setTransitionResult("");
    setTransitionFollowUpRequired(action.followUpRequired);
    setTransitionFollowUpNote(action.followUpNote ?? "");
    setTransitionReason("");
    setTransitionErrors({});
    setTransitionError(""); setConflictRecoveryAvailable(false);
    setTransitionDialog({ action, kind });
  }

  function closeTransitionDialog() {
    if (!busy) setTransitionDialog(null);
  }

  async function submitTransition(event: FormEvent) {
    event.preventDefault();
    if (!transitionDialog) return;
    const fields: Record<string, string> = {};
    if (transitionDialog.kind === "complete" && !transitionResult.trim()) fields.result = "Result is required to complete this Action.";
    if (transitionDialog.kind === "complete" && transitionFollowUpRequired && !transitionFollowUpNote.trim()) fields.followUpNote = "A note is required when follow-up is selected.";
    if (transitionDialog.kind === "cancel" && !transitionReason.trim()) fields.cancellationReason = "A cancellation reason is required.";
    if (Object.keys(fields).length) { setTransitionErrors(fields); return; }
    setBusy(true); setTransitionErrors({}); setTransitionError(""); setActionOperationError(""); setConflictRecoveryAvailable(false);
    try {
      const { action, kind } = transitionDialog;
      await transitionStaffAction(ticketId, action.id, {
        expectedTicketVersion: ticketVersion,
        expectedActionVersion: action.version,
        status: kind === "complete" ? "COMPLETED" : "CANCELLED",
        ...(kind === "complete" ? { result: transitionResult, followUpRequired: transitionFollowUpRequired, followUpNote: transitionFollowUpRequired ? transitionFollowUpNote : null } : { cancellationReason: transitionReason }),
      });
      setTransitionDialog(null);
      await refreshAfterMutation();
    } catch (error) {
      setTransitionError(friendlyError(error, "Unable to update Action status"));
      setTransitionErrors(errorFields(error));
      const problem = error as ApiProblem;
      if (problem.code === "STALE_VERSION" || problem.code === "WRITE_CONFLICT") { setConflictRecoveryAvailable(true); await onTicketChanged?.(); }
      await Promise.all([loadActions(actionPageNumber), loadHistory(historyPageNumber)]);
    } finally { setBusy(false); }
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && formOpen && !busy) { event.preventDefault(); requestCloseForm(); }
  }

  const actions = actionPage?.data ?? [];
  const actionsHeading = isStaff ? "Actions Taken" : "Actions Taken (read-only)";

  return <section className={`detail-section actions-taken${isStaff ? " actions-taken-staff" : ""}`} aria-labelledby={`actions-heading-${ticketId}`}>
    <div className="list-header">
      <div><h3 id={`actions-heading-${ticketId}`} tabIndex={-1}>{actionsHeading}</h3><p className="helper-text">Work records and results associated with this Ticket.</p></div>
      {canWrite && <button id={`add-action-${ticketId}`} type="button" className="btn btn-primary-green" disabled={busy} onClick={openCreateForm}>Add Action</button>}
    </div>

    {actionState === "loading" && <div className="state-callout state-info" role="status">Loading Actions Taken...</div>}
    {actionState === "error" && <div className="state-callout state-error" role="alert">{actionError} <button type="button" className="retry-button" onClick={() => void loadActions(actionPageNumber)}>Retry</button></div>}
    {actionOperationError && <div className="state-callout state-error" role="alert">{actionOperationError}</div>}
    {conflictRecoveryAvailable && <div className="state-callout state-info" role="status">This Action or Ticket changed since it was loaded. The latest state was refreshed; review your preserved draft before retrying.<button type="button" className="retry-button" onClick={() => void reconcileConflict()}>Reload latest Action data</button></div>}
    {actionState === "ready" && actions.length === 0 && <div className="state-callout state-info" role="status">No Actions Taken have been recorded for this Ticket.{canWrite && <button type="button" className="retry-button" onClick={openCreateForm}>Add Action</button>}</div>}
    {actionState === "ready" && actions.length > 0 && <ol className="action-list">{actions.map((action) => <li id={`action-card-${action.id}`} className="action-card" key={action.id} tabIndex={-1}>
      <div className="action-card-heading"><div><span className="status-badge">{action.status.replaceAll("_", " ")}</span><span className="helper-text"> Action #{action.id}</span></div><p className="helper-text">Created {formatDate(action.createdAt)}</p></div>
      <dl className="action-detail-grid">
        <div><dt>Description</dt><dd className="preserve-text">{action.description}</dd></div>
        <div><dt>Assignee</dt><dd>{action.assignee.name}{isStaff && action.assignee.role ? ` (${action.assignee.role.replaceAll("_", " ")})` : ""}</dd></div>
        <div><dt>Performed by</dt><dd>{action.performedBy?.name ?? "Pending completion"}</dd></div>
        <div><dt>Action date/time</dt><dd>{formatDate(action.actionAt)}</dd></div>
        {action.result && <div><dt>Result</dt><dd className="preserve-text">{action.result}</dd></div>}
        <div><dt>Follow-up required</dt><dd>{action.followUpRequired ? "Yes" : "No"}</dd></div>
        {action.followUpRequired && action.followUpNote && <div><dt>Follow-up note</dt><dd className="preserve-text">{action.followUpNote}</dd></div>}
        {action.attachmentNotes && <div><dt>Attachment notes</dt><dd className="preserve-text">{action.attachmentNotes}</dd></div>}
        {action.cancellationReason && <div><dt>Cancellation reason</dt><dd className="preserve-text">{action.cancellationReason}</dd></div>}
      </dl>
      {canWrite && <div className="action-controls" aria-label={`Controls for Action ${action.id}`}>
        {(action.status === "PLANNED" || action.status === "IN_PROGRESS") && <button type="button" className="btn btn-secondary-green" disabled={busy} onClick={(event) => openEditForm(event, action)}>Edit or assign</button>}
        {action.status === "PLANNED" && <button type="button" className="btn btn-secondary-green" disabled={busy} onClick={() => void startAction(action)}>Start</button>}
        {(action.status === "PLANNED" || action.status === "IN_PROGRESS") && <button type="button" className="btn btn-secondary-green" disabled={busy} onClick={(event) => openTransition(event, action, "complete")}>Complete</button>}
        {(action.status === "PLANNED" || action.status === "IN_PROGRESS") && <button type="button" className="btn btn-secondary-green" disabled={busy} onClick={(event) => openTransition(event, action, "cancel")}>Cancel Action</button>}
        {(action.status === "COMPLETED" || action.status === "CANCELLED") && <p className="helper-text">This Action is terminal; its recorded history is read-only.</p>}
      </div>}
    </li>)}</ol>}

    {actionState === "ready" && actionPage?.meta && actionPage.meta.totalPages > 1 && <div className="pagination" aria-label="Action pagination">
      <button type="button" className="btn btn-secondary-green" disabled={!actionPage.meta.hasPreviousPage} onClick={() => void loadActions(actionPageNumber - 1)}>Previous</button>
      <span>Page {actionPage.meta.page} of {actionPage.meta.totalPages}</span>
      <button type="button" className="btn btn-secondary-green" disabled={!actionPage.meta.hasNextPage} onClick={() => void loadActions(actionPageNumber + 1)}>Next</button>
    </div>}

    {canWrite && formOpen && <form className="action-form" onSubmit={submitForm} onKeyDown={handleFormKeyDown} noValidate aria-labelledby={`action-form-heading-${ticketId}`}>
      <h4 id={`action-form-heading-${ticketId}`}>{editingActionId === null ? "Add Action" : `Edit Action #${editingActionId}`}</h4>
      {formError && <div className="state-callout state-error" role="alert">{formError}</div>}
      <label htmlFor={`assignee-search-${ticketId}`}>Search active Staff/Admin by name</label>
      <div className="action-search-row"><input id={`assignee-search-${ticketId}`} value={directorySearch} maxLength={120} onChange={(event) => setDirectorySearch(event.target.value)} /><button type="button" className="btn btn-secondary-green" disabled={directoryState === "loading"} onClick={() => { setDirectoryQuery(directorySearch.trim()); void loadDirectory(1, directorySearch.trim()); }}>Search</button></div>
      {directoryState === "error" && <p className="field-error" role="alert">{directoryError} <button type="button" className="retry-button" onClick={() => void loadDirectory(directoryPageNumber)}>Retry</button></p>}
      <label htmlFor={`action-assignee-${ticketId}`}>Assignee <span aria-hidden="true">*</span></label>
      <select id={`action-assignee-${ticketId}`} value={draft.assigneeId} onChange={(event) => updateDraft("assigneeId", event.target.value)} aria-invalid={Boolean(formErrors.assigneeId)} aria-describedby={formErrors.assigneeId ? `action-assignee-error-${ticketId}` : undefined} required>
        <option value="">Select an active Staff/Admin</option>{directory.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} — {candidate.role.replaceAll("_", " ")}</option>)}
      </select>
      {formErrors.assigneeId && <span id={`action-assignee-error-${ticketId}`} className="field-error">{formErrors.assigneeId}</span>}
      {directoryState === "ready" && directory.length === 0 && <p className="helper-text">No active Staff or Administrator matches the search.</p>}
      {directoryMeta && directoryMeta.totalPages > 1 && <div className="pagination action-directory-pagination" aria-label="Assignee search results">
        <button type="button" className="btn btn-secondary-green" disabled={!directoryMeta.hasPreviousPage || directoryState === "loading"} onClick={() => void loadDirectory(directoryPageNumber - 1)}>Previous</button>
        <span>Page {directoryMeta.page} of {directoryMeta.totalPages}</span>
        <button type="button" className="btn btn-secondary-green" disabled={!directoryMeta.hasNextPage || directoryState === "loading"} onClick={() => void loadDirectory(directoryPageNumber + 1)}>Next</button>
      </div>}
      <label htmlFor={`action-description-${ticketId}`}>Action Description <span aria-hidden="true">*</span></label>
      <textarea id={`action-description-${ticketId}`} value={draft.description} maxLength={2000} onChange={(event) => updateDraft("description", event.target.value)} aria-invalid={Boolean(formErrors.description)} aria-describedby={formErrors.description ? `action-description-error-${ticketId}` : undefined} required />
      {formErrors.description && <span id={`action-description-error-${ticketId}`} className="field-error">{formErrors.description}</span>}
      <label className="checkbox-label"><input type="checkbox" checked={draft.followUpRequired} onChange={(event) => { const checked = event.target.checked; if (!checked && draft.followUpRequired && draft.followUpNote && !window.confirm("Turning follow-up off clears its note. Continue?")) return; updateDraft("followUpRequired", checked); if (!checked) setDraft((current) => ({ ...current, followUpNote: "" })); }} /> Follow-up required?</label>
      {draft.followUpRequired && <><label htmlFor={`action-followup-${ticketId}`}>Follow-up Note <span aria-hidden="true">*</span></label><textarea id={`action-followup-${ticketId}`} value={draft.followUpNote} maxLength={2000} onChange={(event) => updateDraft("followUpNote", event.target.value)} aria-invalid={Boolean(formErrors.followUpNote)} aria-describedby={formErrors.followUpNote ? `action-followup-error-${ticketId}` : undefined} required />{formErrors.followUpNote && <span id={`action-followup-error-${ticketId}`} className="field-error">{formErrors.followUpNote}</span>}</>}
      <label htmlFor={`action-attachment-notes-${ticketId}`}>Attachment Notes (optional)</label>
      <textarea id={`action-attachment-notes-${ticketId}`} value={draft.attachmentNotes} maxLength={2000} onChange={(event) => updateDraft("attachmentNotes", event.target.value)} aria-invalid={Boolean(formErrors.attachmentNotes)} aria-describedby={formErrors.attachmentNotes ? `action-attachment-notes-error-${ticketId}` : undefined} />
      {formErrors.attachmentNotes && <span id={`action-attachment-notes-error-${ticketId}`} className="field-error">{formErrors.attachmentNotes}</span>}
      <p className="helper-text">A new Action starts as Planned. Performer and Action date/time are recorded by the server when it is completed.</p>
        <div className="action-controls"><button type="submit" className="btn btn-primary-green" disabled={busy || directoryState === "loading"}>{busy ? "Saving..." : editingActionId === null ? "Save Action" : "Save changes"}</button><button type="button" className="btn btn-secondary-green" disabled={busy} onClick={requestCloseForm}>Cancel form</button></div>
    </form>}

    {isStaff && <section className="workflow-history" aria-labelledby={`history-heading-${ticketId}`}>
      <div className="list-header"><h4 id={`history-heading-${ticketId}`}>Ticket and Action History</h4><button type="button" className="btn btn-secondary-green" aria-expanded={showHistory} onClick={() => setShowHistory((value) => !value)}>{showHistory ? "Hide history" : "Show history"}</button></div>
      {showHistory && <>
        {historyState === "loading" && <div className="state-callout state-info" role="status">Loading workflow history...</div>}
        {historyState === "error" && <div className="state-callout state-error" role="alert">{historyError} <button type="button" className="retry-button" onClick={() => void loadHistory(historyPageNumber)}>Retry</button></div>}
        {historyState === "ready" && (historyPage?.data.length ?? 0) === 0 && <p className="helper-text">No workflow history has been recorded.</p>}
        {historyState === "ready" && (historyPage?.data.length ?? 0) > 0 && <ol className="history-list">{historyPage?.data.map((entry) => <li key={entry.id}><strong>{entry.source === "TICKET" ? "Ticket" : `Action #${entry.actionId}`} — {entry.kind.replaceAll("_", " ")}</strong><span className="helper-text">{entry.actor.name} ({entry.actor.role.replaceAll("_", " ")}) · {formatDate(entry.createdAt)}</span>{(entry.fromStatus || entry.toStatus) && <span>{entry.fromStatus ?? "Created"} → {entry.toStatus ?? "Updated"}</span>}{entry.fieldName && <span>{entry.fieldName}: {String(entry.oldValue ?? "—")} → {String(entry.newValue ?? "—")}</span>}{entry.reason && <span className="preserve-text">Reason/result: {entry.reason}</span>}</li>)}</ol>}
        {historyState === "ready" && historyPage?.meta && historyPage.meta.totalPages > 1 && <div className="pagination" aria-label="History pagination"><button type="button" className="btn btn-secondary-green" disabled={!historyPage.meta.hasPreviousPage} onClick={() => void loadHistory(historyPageNumber - 1)}>Previous</button><span>Page {historyPage.meta.page} of {historyPage.meta.totalPages}</span><button type="button" className="btn btn-secondary-green" disabled={!historyPage.meta.hasNextPage} onClick={() => void loadHistory(historyPageNumber + 1)}>Next</button></div>}
      </>}
    </section>}

    {transitionDialog && <div className="action-dialog-backdrop"><div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby={`action-dialog-heading-${ticketId}`} ref={dialogRef}>
      <h4 id={`action-dialog-heading-${ticketId}`}>{transitionDialog.kind === "complete" ? `Complete Action #${transitionDialog.action.id}` : `Cancel Action #${transitionDialog.action.id}`}</h4>
      <p className="helper-text">This changes the Action's recorded lifecycle. The history entry is retained.</p>
      {transitionError && <div className="state-callout state-error" role="alert">{transitionError}</div>}
      <form className="action-form dialog-form" onSubmit={submitTransition} noValidate>
        {transitionDialog.kind === "complete" ? <>
          <label htmlFor={`action-result-${ticketId}`}>Result <span aria-hidden="true">*</span></label><textarea id={`action-result-${ticketId}`} value={transitionResult} maxLength={2000} onChange={(event) => { setTransitionResult(event.target.value); setTransitionErrors((current) => ({ ...current, result: "" })); }} aria-invalid={Boolean(transitionErrors.result)} aria-describedby={transitionErrors.result ? `action-result-error-${ticketId}` : undefined} required />{transitionErrors.result && <span id={`action-result-error-${ticketId}`} className="field-error">{transitionErrors.result}</span>}
          <label className="checkbox-label"><input type="checkbox" checked={transitionFollowUpRequired} onChange={(event) => setTransitionFollowUpRequired(event.target.checked)} /> Follow-up required?</label>
          {transitionFollowUpRequired && <><label htmlFor={`action-complete-followup-${ticketId}`}>Follow-up Note <span aria-hidden="true">*</span></label><textarea id={`action-complete-followup-${ticketId}`} value={transitionFollowUpNote} maxLength={2000} onChange={(event) => { setTransitionFollowUpNote(event.target.value); setTransitionErrors((current) => ({ ...current, followUpNote: "" })); }} aria-invalid={Boolean(transitionErrors.followUpNote)} aria-describedby={transitionErrors.followUpNote ? `action-complete-followup-error-${ticketId}` : undefined} required />{transitionErrors.followUpNote && <span id={`action-complete-followup-error-${ticketId}`} className="field-error">{transitionErrors.followUpNote}</span>}</>}
        </> : <><label htmlFor={`action-cancel-reason-${ticketId}`}>Cancellation reason <span aria-hidden="true">*</span></label><textarea id={`action-cancel-reason-${ticketId}`} value={transitionReason} maxLength={1000} onChange={(event) => { setTransitionReason(event.target.value); setTransitionErrors((current) => ({ ...current, cancellationReason: "" })); }} aria-invalid={Boolean(transitionErrors.cancellationReason)} aria-describedby={transitionErrors.cancellationReason ? `action-cancel-reason-error-${ticketId}` : undefined} required />{transitionErrors.cancellationReason && <span id={`action-cancel-reason-error-${ticketId}`} className="field-error">{transitionErrors.cancellationReason}</span>}</>}
        <div className="action-controls"><button type="submit" className="btn btn-primary-green" disabled={busy}>{busy ? "Saving..." : transitionDialog.kind === "complete" ? "Confirm completion" : "Confirm cancellation"}</button><button type="button" className="btn btn-secondary-green" disabled={busy} onClick={closeTransitionDialog}>Close</button></div>
      </form>
    </div></div>}
  </section>;
}
