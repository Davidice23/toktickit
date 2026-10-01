import { useEffect, useState } from "react";
import { fetchStaffTickets, StaffTicketList, TicketPriority, TicketStatus } from "./api.js";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type QueueFilters = {
  search: string;
  status: string;
  requestedPriority: string;
  itPriority: string;
  owner: string;
  sortBy: string;
  sortDirection: string;
  pageSize: string;
};

const initialFilters: QueueFilters = { search: "", status: "", requestedPriority: "", itPriority: "", owner: "", sortBy: "updatedAt", sortDirection: "desc", pageSize: "20" };

export default function StaffTicketQueue({ onOpen }: { onOpen: (ticketId: number) => void }) {
  const [filters, setFilters] = useState<QueueFilters>(initialFilters);
  const [draft, setDraft] = useState<QueueFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<StaffTicketList | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  async function load(nextPage = page, nextFilters = filters) {
    setState("loading"); setError("");
    const params = new URLSearchParams({ page: String(nextPage), pageSize: nextFilters.pageSize, sortBy: nextFilters.sortBy, sortDirection: nextFilters.sortDirection });
    (Object.keys(nextFilters) as Array<keyof QueueFilters>).forEach((key) => { if (["search", "status", "requestedPriority", "itPriority", "owner"].includes(key) && nextFilters[key]) params.set(key, nextFilters[key]); });
    try { setList(await fetchStaffTickets(params)); setState("ready"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load Staff Queue"); setState("error"); }
  }

  useEffect(() => { void load(1, initialFilters); }, []);

  function submit(event: React.FormEvent) { event.preventDefault(); const next = { ...draft, search: draft.search.trim() }; setFilters(next); setPage(1); void load(1, next); }
  function clearFilters() { setDraft(initialFilters); setFilters(initialFilters); setPage(1); void load(1, initialFilters); }
  function changePage(nextPage: number) { setPage(nextPage); void load(nextPage); }

  return <section className="staff-queue" aria-labelledby="staff-queue-heading">
    <div className="list-header"><div><p className="eyebrow">Authenticated operational workspace</p><h2 id="staff-queue-heading">Staff Ticket Queue</h2><p className="helper-text">Search and manage Tickets assigned to the IT operations team.</p></div></div>
    <form className="queue-filters" onSubmit={submit} aria-label="Staff Ticket Queue filters">
      <div className="queue-filter-wide"><label htmlFor="staff-search">Search</label><input id="staff-search" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Ticket, summary, description, requester" /></div>
      <div><label htmlFor="staff-status">Status</label><select id="staff-status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
      <div><label htmlFor="staff-requested-priority">Requested Priority</label><select id="staff-requested-priority" value={draft.requestedPriority} onChange={(event) => setDraft({ ...draft, requestedPriority: event.target.value })}><option value="">All requested priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div>
      <div><label htmlFor="staff-it-priority">IT Priority</label><select id="staff-it-priority" value={draft.itPriority} onChange={(event) => setDraft({ ...draft, itPriority: event.target.value })}><option value="">All IT priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}<option value="UNASSIGNED">UNASSIGNED</option></select></div>
      <div><label htmlFor="staff-owner">Ownership</label><select id="staff-owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option value="">All owners</option><option value="unassigned">Unassigned</option><option value="me">Assigned to me</option></select></div>
      <div><label htmlFor="staff-sort">Sort by</label><select id="staff-sort" value={draft.sortBy} onChange={(event) => setDraft({ ...draft, sortBy: event.target.value })}><option value="updatedAt">Last updated</option><option value="createdAt">Created</option><option value="ticketNumber">Ticket number</option><option value="status">Status</option><option value="itPriority">IT Priority</option><option value="owner">Owner</option></select></div>
      <div><label htmlFor="staff-sort-direction">Direction</label><select id="staff-sort-direction" value={draft.sortDirection} onChange={(event) => setDraft({ ...draft, sortDirection: event.target.value })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
      <div><label htmlFor="staff-page-size">Page size</label><select id="staff-page-size" value={draft.pageSize} onChange={(event) => setDraft({ ...draft, pageSize: event.target.value })}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></div>
      <div className="queue-filter-actions"><button className="btn btn-primary-green" type="submit" disabled={state === "loading"}>{state === "loading" ? "Loading..." : "Search Queue"}</button><button className="btn btn-secondary-green" type="button" onClick={clearFilters} disabled={state === "loading"}>Clear Filters</button></div>
    </form>
    {state === "loading" && <div className="state-callout state-info" role="status" aria-live="polite">Loading Staff Queue...</div>}
    {state === "error" && <div className="state-callout state-error" role="alert">{error || "Unable to load Staff Queue."}<button type="button" className="retry-button" onClick={() => void load()}>Retry</button></div>}
    {state === "ready" && list && list.data.length === 0 && <div className="state-callout state-info" role="status"><strong>{filters.search || filters.status || filters.owner ? "No Tickets match these filters." : "The Staff Queue is empty."}</strong>{(filters.search || filters.status || filters.owner) && <button className="retry-button" type="button" onClick={clearFilters}>Clear Filters</button>}</div>}
    {state === "ready" && list && list.data.length > 0 && <>
      <div className="ticket-table-wrap"><table className="ticket-table staff-queue-table"><caption className="visually-hidden">Operational Staff Ticket Queue</caption><thead><tr><th>Ticket / Dates</th><th>Summary / Category</th><th>Requester</th><th>Priority</th><th>Status / Owner</th><th>Action</th></tr></thead><tbody>{list.data.map((ticket) => <tr key={ticket.id}>
        <td data-label="Ticket / Dates"><span className="queue-cell-stack"><strong>{ticket.ticketNumber}</strong><span className="helper-text">Created {new Date(ticket.createdAt).toLocaleDateString()}</span><span className="helper-text">Updated {new Date(ticket.updatedAt).toLocaleDateString()}</span></span></td>
        <td data-label="Summary / Category"><span className="queue-cell-stack">{ticket.summary}<span className="helper-text">{ticket.category.name}</span></span></td>
        <td data-label="Requester"><span className="queue-cell-stack">{ticket.requester.name}<span className="helper-text">{ticket.requester.email}</span></span></td>
        <td data-label="Priority"><span className="queue-cell-stack"><span>Requested <span className="status-badge">{ticket.requestedPriority}</span></span><span>IT <span className="status-badge">{ticket.itPriority ?? "UNASSIGNED"}</span></span></span></td>
        <td data-label="Status / Owner"><span className="queue-cell-stack"><span className="status-badge">{ticket.currentStatus}</span><span className="helper-text">{ticket.owner ? ticket.owner.name : "Unassigned"}</span></span></td>
        <td data-label="Action"><button className="btn btn-secondary-green" type="button" onClick={() => onOpen(ticket.id)}>Open Detail</button></td>
      </tr>)}</tbody></table></div>
      <div className="pagination" aria-label="Staff Ticket Queue pagination"><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasPreviousPage} onClick={() => changePage(page - 1)}>Previous</button><span>Page {list.meta.page} of {Math.max(list.meta.totalPages, 1)} ({list.meta.totalItems} Tickets)</span><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasNextPage} onClick={() => changePage(page + 1)}>Next</button></div>
    </>}
  </section>;
}

