import { useEffect, useState } from "react";
import { Category, fetchCategories, fetchRelatedSystems, fetchTickets, RelatedSystem, TicketList } from "./api.js";

export default function MyTickets({ requesterId, onOpen, onCreate }: { requesterId: number; onOpen: (ticketId: number) => void; onCreate?: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [priority, setPriority] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageSize, setPageSize] = useState("10");
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<RelatedSystem[]>([]);
  const [list, setList] = useState<TicketList | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load(nextPage = page, nextQuery = query) {
    setState("loading");
    const params = new URLSearchParams({ page: String(nextPage), pageSize, sortBy, sortDirection });
    if (nextQuery) params.set("search", nextQuery);
    if (categoryId) params.set("categoryId", categoryId);
    if (relatedSystemId) params.set("relatedSystemId", relatedSystemId);
    if (priority) params.set("requestedPriority", priority);
    if (statusFilter) params.set("status", statusFilter);
    try { setList(await fetchTickets(requesterId, params)); setState("ready"); } catch { setState("error"); }
  }

  useEffect(() => { void Promise.all([fetchCategories(), fetchRelatedSystems()]).then(([loadedCategories, loadedSystems]) => { setCategories(loadedCategories); setSystems(loadedSystems); }).catch(() => undefined); void load(1, ""); }, [requesterId]);

  function submit(event: React.FormEvent) { event.preventDefault(); setQuery(search.trim()); setPage(1); void load(1, search.trim()); }
  function applyFilter() { const nextQuery = search.trim(); setQuery(nextQuery); setPage(1); void load(1, nextQuery); }
  function clearFilters() { setSearch(""); setQuery(""); setCategoryId(""); setRelatedSystemId(""); setPriority(""); setStatusFilter(""); setSortBy("updatedAt"); setSortDirection("desc"); setPageSize("10"); setPage(1); window.setTimeout(() => void load(1, ""), 0); }

  return <section className="ticket-list" aria-labelledby="my-tickets-heading">
    <div className="list-header"><div><p className="eyebrow">Requester workspace</p><h2 id="my-tickets-heading">My Tickets</h2></div><a className="btn btn-primary-green" href="#create-ticket" onClick={onCreate}>Create Ticket</a></div>
    <form className="ticket-search" onSubmit={submit}><label htmlFor="ticket-search-input">Search tickets</label><input id="ticket-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number or summary" /><button className="btn btn-secondary-green" type="submit">Search</button></form>
    <div className="ticket-filters" aria-label="Ticket filters">
      <label htmlFor="filter-category">Category</label><select id="filter-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All Categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <label htmlFor="filter-system">Related System</label><select id="filter-system" value={relatedSystemId} onChange={(event) => setRelatedSystemId(event.target.value)}><option value="">All Systems</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select>
      <label htmlFor="filter-priority">Priority</label><select id="filter-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All Priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <label htmlFor="filter-status">Status</label><select id="filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All Statuses</option><option value="NEW">NEW</option></select>
      <label htmlFor="sort-by">Sort by</label><select id="sort-by" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="updatedAt">Last Updated</option><option value="ticketDate">Ticket Date</option><option value="ticketNumber">Ticket Number</option><option value="summary">Summary</option></select>
      <label htmlFor="sort-direction">Direction</label><select id="sort-direction" value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
      <label htmlFor="page-size">Page size</label><select id="page-size" value={pageSize} onChange={(event) => setPageSize(event.target.value)}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select>
      <button className="btn btn-secondary-green" type="button" onClick={applyFilter}>Apply Filters</button><button className="btn btn-secondary-green" type="button" onClick={clearFilters}>Clear Filters</button>
    </div>
    {state === "loading" && <div className="state-callout state-info" role="status">Loading Tickets...</div>}
    {state === "error" && <div className="state-callout state-error" role="alert">Unable to load Tickets. <button type="button" className="retry-button" onClick={() => void load()}>Retry</button></div>}
    {state === "ready" && list && list.data.length === 0 && <div className="state-callout state-info" role="status"><strong>{query ? "No tickets match these filters." : "You have not created any tickets yet."}</strong></div>}
    {state === "ready" && list && list.data.length > 0 && <>
      <div className="ticket-table-wrap"><table className="ticket-table"><caption className="visually-hidden">Tickets owned by the current Requester</caption><thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Related System</th><th>Priority</th><th>Status</th><th>Last Updated</th><th>Action</th></tr></thead><tbody>{list.data.map((ticket) => <tr key={ticket.id}><td data-label="Ticket Number">{ticket.ticketNumber}</td><td data-label="Summary">{ticket.summary}</td><td data-label="Category">{ticket.category.name}</td><td data-label="Related System">{ticket.relatedSystem.name}</td><td data-label="Priority">{ticket.requestedPriority}</td><td data-label="Status"><span className="status-badge">{ticket.currentStatus}</span></td><td data-label="Last Updated">{new Date(ticket.updatedAt).toLocaleDateString()}</td><td data-label="Action"><button className="btn btn-secondary-green" type="button" onClick={() => onOpen(ticket.id)}>View</button></td></tr>)}</tbody></table></div>
      <div className="pagination" aria-label="Ticket pagination"><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasPreviousPage} onClick={() => { const next = page - 1; setPage(next); void load(next); }}>Previous</button><span>Page {list.meta.page} of {list.meta.totalPages}</span><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasNextPage} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Next</button></div>
    </>}
  </section>;
}
