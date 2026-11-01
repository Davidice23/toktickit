import { useEffect, useState } from "react";
import { DashboardRequesterTicket, fetchRequesterDashboard, RequesterDashboard as RequesterDashboardData } from "./api.js";

type LoadState = "loading" | "ready" | "error";
const bangkokDate = (value: string) => new Date(value).toLocaleString(undefined, { timeZone: "Asia/Bangkok" });

function requesterFilterHref(path: string, fallback: string): string {
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/my-tickets") return fallback;
    const allowed = new URLSearchParams();
    const scope = url.searchParams.get("scope");
    const status = url.searchParams.get("status");
    const asOf = url.searchParams.get("asOf");
    if (scope && ["open", "recently-updated", "recently-resolved"].includes(scope)) allowed.set("scope", scope);
    if (status === "WAITING_FOR_REQUESTER") allowed.set("status", status);
    if (asOf && /^\d{4}-\d\d-\d\dT.*Z$/.test(asOf)) allowed.set("asOf", asOf);
    return `#my-tickets${allowed.size ? `?${allowed.toString()}` : ""}`;
  } catch {
    return fallback;
  }
}

function TicketLinks({ tickets, emptyText }: { tickets: DashboardRequesterTicket[]; emptyText: string }) {
  if (!tickets.length) return <p className="dashboard-empty">{emptyText}</p>;
  return <ul className="dashboard-ticket-list">{tickets.map((ticket) => <li key={ticket.id}>
    <a href={`#requester-ticket/${ticket.id}`}>
      <span className="dashboard-ticket-title">{ticket.ticketNumber} · {ticket.summary}</span>
      <span className="dashboard-ticket-meta"><span className="status-badge">{ticket.currentStatus.replaceAll("_", " ")}</span> Updated {bangkokDate(ticket.updatedAt)}</span>
    </a>
  </li>)}</ul>;
}

export default function RequesterDashboard() {
  const [dashboard, setDashboard] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  async function load() {
    setState("loading");
    setError("");
    try {
      setDashboard(await fetchRequesterDashboard());
      setState("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Requester dashboard");
      setState("error");
    }
  }

  useEffect(() => { void load(); }, []);

  if (state === "loading") return <section className="dashboard" aria-labelledby="requester-dashboard-heading" aria-busy="true"><h2 id="requester-dashboard-heading">Requester Dashboard</h2><div className="state-callout state-info" role="status">Loading your Ticket summary...</div></section>;
  if (state === "error" || !dashboard) return <section className="dashboard" aria-labelledby="requester-dashboard-heading"><h2 id="requester-dashboard-heading">Requester Dashboard</h2><div className="state-callout state-error" role="alert">{error || "Unable to load your Ticket summary."}<button type="button" className="retry-button" onClick={() => void load()}>Retry</button></div></section>;

  const cards = [
    { label: "Open Tickets", count: dashboard.metrics.openTickets, href: requesterFilterHref(dashboard.drillDown.openTickets, "#my-tickets?scope=open") },
    { label: "Waiting for You", count: dashboard.metrics.waitingForRequester, href: requesterFilterHref(dashboard.drillDown.waitingForRequester, "#my-tickets?status=WAITING_FOR_REQUESTER") },
    { label: "Recently Updated", count: dashboard.metrics.recentlyUpdated, href: requesterFilterHref(dashboard.drillDown.recentlyUpdated, "#my-tickets?scope=recently-updated") },
    { label: "Recently Resolved", count: dashboard.metrics.recentlyResolved, href: requesterFilterHref(dashboard.drillDown.recentlyResolved, "#my-tickets?scope=recently-resolved") },
  ];

  return <section className="dashboard" aria-labelledby="requester-dashboard-heading">
    <div className="list-header"><div><p className="eyebrow">Authenticated requester workspace</p><h2 id="requester-dashboard-heading">Requester Dashboard</h2></div><a className="btn btn-secondary-green" href="#my-tickets">View My Tickets</a></div>
    <div className="dashboard-metrics" aria-label="Requester Ticket metrics">{cards.map((card) => <a className="dashboard-metric-card" href={card.href} key={card.label}>
      <span>{card.label}</span><strong>{card.count}</strong><span className="dashboard-card-hint">View matching Tickets</span>
    </a>)}</div>
    <div className="dashboard-section-grid">
      <section className="dashboard-panel" aria-labelledby="requester-attention-heading"><div className="dashboard-panel-heading"><h3 id="requester-attention-heading">Waiting for You</h3><a href={requesterFilterHref(dashboard.drillDown.waitingForRequester, "#my-tickets?status=WAITING_FOR_REQUESTER")}>View all</a></div><TicketLinks tickets={dashboard.attentionTickets} emptyText="No Tickets are waiting for your response." /></section>
      <section className="dashboard-panel" aria-labelledby="requester-updated-heading"><div className="dashboard-panel-heading"><h3 id="requester-updated-heading">Recently Updated</h3><a href={requesterFilterHref(dashboard.drillDown.recentlyUpdated, "#my-tickets?scope=recently-updated")}>View all</a></div><TicketLinks tickets={dashboard.recentlyUpdatedTickets} emptyText="No Tickets were updated in the last 14 days." /></section>
      <section className="dashboard-panel" aria-labelledby="requester-resolved-heading"><div className="dashboard-panel-heading"><h3 id="requester-resolved-heading">Recently Resolved</h3><a href={requesterFilterHref(dashboard.drillDown.recentlyResolved, "#my-tickets?scope=recently-resolved")}>View all</a></div><TicketLinks tickets={dashboard.recentlyResolvedTickets} emptyText="No Tickets were resolved in the last 14 days." /></section>
    </div>
    <p className="dashboard-refresh">Summary refreshed {bangkokDate(dashboard.asOf)} (Bangkok time).</p>
  </section>;
}
