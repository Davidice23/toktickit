import { useEffect, useState } from "react";
import { fetchTickets, TicketList } from "./api.js";

export default function MyTickets({ requesterId }: { requesterId: number }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<TicketList | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  async function load(nextPage = page, nextQuery = query) {
    setState("loading");
    const params = new URLSearchParams({ page: String(nextPage), pageSize: "10" });
    if (nextQuery) params.set("search", nextQuery);
    try { setList(await fetchTickets(requesterId, params)); setState("ready"); } catch { setState("error"); }
  }

  useEffect(() => { void load(1, ""); }, [requesterId]);

  function submit(event: React.FormEvent) { event.preventDefault(); setQuery(search.trim()); setPage(1); void load(1, search.trim()); }

  return <section className="ticket-list" aria-labelledby="my-tickets-heading">
    <div className="list-header"><div><p className="eyebrow">Requester workspace</p><h2 id="my-tickets-heading">My Tickets</h2></div><a className="btn btn-primary-green" href="#create-ticket">Create Ticket</a></div>
    <form className="ticket-search" onSubmit={submit}><label htmlFor="ticket-search-input">Search tickets</label><input id="ticket-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by number or summary" /><button className="btn btn-secondary-green" type="submit">Search</button></form>
    {state === "loading" && <div className="state-callout state-info" role="status">Loading Tickets...</div>}
    {state === "error" && <div className="state-callout state-error" role="alert">Unable to load Tickets. <button type="button" className="retry-button" onClick={() => void load()}>Retry</button></div>}
    {state === "ready" && list && list.data.length === 0 && <div className="state-callout state-info" role="status"><strong>{query ? "No tickets match these filters." : "You have not created any tickets yet."}</strong></div>}
    {state === "ready" && list && list.data.length > 0 && <>
      <div className="ticket-table-wrap"><table className="ticket-table"><caption className="visually-hidden">Tickets owned by the current Requester</caption><thead><tr><th>Ticket Number</th><th>Summary</th><th>Category</th><th>Related System</th><th>Priority</th><th>Status</th><th>Last Updated</th></tr></thead><tbody>{list.data.map((ticket) => <tr key={ticket.id}><td data-label="Ticket Number">{ticket.ticketNumber}</td><td data-label="Summary">{ticket.summary}</td><td data-label="Category">{ticket.category.name}</td><td data-label="Related System">{ticket.relatedSystem.name}</td><td data-label="Priority">{ticket.requestedPriority}</td><td data-label="Status"><span className="status-badge">{ticket.currentStatus}</span></td><td data-label="Last Updated">{new Date(ticket.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
      <div className="pagination" aria-label="Ticket pagination"><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasPreviousPage} onClick={() => { const next = page - 1; setPage(next); void load(next); }}>Previous</button><span>Page {list.meta.page} of {list.meta.totalPages}</span><button className="btn btn-secondary-green" type="button" disabled={!list.meta.hasNextPage} onClick={() => { const next = page + 1; setPage(next); void load(next); }}>Next</button></div>
    </>}
  </section>;
}
