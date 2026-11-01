import { useEffect, useState } from "react";
import { fetchStaffDashboard, StaffDashboard as StaffDashboardData } from "./api.js";

type LoadState = "loading" | "ready" | "error";
const bangkokDate = (value: string) => new Date(value).toLocaleString(undefined, { timeZone: "Asia/Bangkok" });

function staffFilterHref(path: string, fallback: string): string {
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== "/staff-tickets") return fallback;
    const allowed = new URLSearchParams();
    const scope = url.searchParams.get("scope");
    const validScopes = ["unassigned-open", "my-owned-open", "my-active-actions", "my-recently-completed-actions", "urgent-open"];
    const asOf = url.searchParams.get("asOf");
    if (scope && validScopes.includes(scope)) allowed.set("scope", scope);
    if (asOf && /^\d{4}-\d\d-\d\dT.*Z$/.test(asOf)) allowed.set("asOf", asOf);
    return `#staff-tickets${allowed.size ? `?${allowed.toString()}` : ""}`;
  } catch {
    return fallback;
  }
}

export default function StaffDashboard({ isAdministrator }: { isAdministrator: boolean }) {
  const [dashboard, setDashboard] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  async function load() {
    setState("loading");
    setError("");
    try {
      setDashboard(await fetchStaffDashboard());
      setState("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Staff dashboard");
      setState("error");
    }
  }

  useEffect(() => { void load(); }, []);

  if (state === "loading") return <section className="dashboard" aria-labelledby="staff-dashboard-heading" aria-busy="true"><h2 id="staff-dashboard-heading">Staff Dashboard</h2><div className="state-callout state-info" role="status">Loading operational summary...</div></section>;
  if (state === "error" || !dashboard) return <section className="dashboard" aria-labelledby="staff-dashboard-heading"><h2 id="staff-dashboard-heading">Staff Dashboard</h2><div className="state-callout state-error" role="alert">{error || "Unable to load operational summary."}<button type="button" className="retry-button" onClick={() => void load()}>Retry</button></div></section>;

  const cards = [
    { label: "Unassigned Open", count: dashboard.metrics.unassignedOpenTickets, href: staffFilterHref(dashboard.drillDown.unassignedOpenTickets, "#staff-tickets?scope=unassigned-open") },
    { label: "My Owned Open", count: dashboard.metrics.myOwnedOpenTickets, href: staffFilterHref(dashboard.drillDown.myOwnedOpenTickets, "#staff-tickets?scope=my-owned-open") },
    { label: "My Active Actions", count: dashboard.metrics.myActiveActions, href: staffFilterHref(dashboard.drillDown.myActiveActions, "#staff-tickets?scope=my-active-actions") },
    { label: "My Recently Completed Actions", count: dashboard.metrics.myRecentlyCompletedActions, href: staffFilterHref(dashboard.drillDown.myRecentlyCompletedActions, "#staff-tickets?scope=my-recently-completed-actions") },
    { label: "Urgent Open", count: dashboard.metrics.urgentOpenTickets, href: staffFilterHref(dashboard.drillDown.urgentOpenTickets, "#staff-tickets?scope=urgent-open") },
  ];

  return <section className="dashboard" aria-labelledby="staff-dashboard-heading">
    <div className="list-header"><div><p className="eyebrow">Authenticated operational workspace</p><h2 id="staff-dashboard-heading">Staff Dashboard</h2></div><a className="btn btn-secondary-green" href="#staff-tickets">Open Staff Queue</a></div>
    <div className="dashboard-metrics dashboard-metrics-staff" aria-label="Staff operational metrics">{cards.map((card) => <a className="dashboard-metric-card" href={card.href} key={card.label}>
      <span>{card.label}</span><strong>{card.count}</strong><span className="dashboard-card-hint">View matching work</span>
    </a>)}</div>
    <div className="dashboard-section-grid">
      <section className="dashboard-panel" aria-labelledby="staff-active-actions-heading"><div className="dashboard-panel-heading"><h3 id="staff-active-actions-heading">My Active Actions</h3><a href={staffFilterHref(dashboard.drillDown.myActiveActions, "#staff-tickets?scope=my-active-actions")}>View matching Tickets</a></div>
        {dashboard.myActiveActions.length ? <ul className="dashboard-ticket-list">{dashboard.myActiveActions.map((action) => <li key={action.id}><a href={`#staff-ticket/${action.ticket.id}?action=${action.id}`}><span className="dashboard-ticket-title">{action.ticket.ticketNumber} · {action.ticket.summary}</span><span className="dashboard-ticket-meta"><span className="status-badge">{action.status.replaceAll("_", " ")}</span> {action.description}</span></a></li>)}</ul> : <p className="dashboard-empty">No Actions are currently assigned to you.</p>}
      </section>
      <section className="dashboard-panel" aria-labelledby="staff-completed-actions-heading"><div className="dashboard-panel-heading"><h3 id="staff-completed-actions-heading">My Recently Completed Actions</h3><a href={staffFilterHref(dashboard.drillDown.myRecentlyCompletedActions, "#staff-tickets?scope=my-recently-completed-actions")}>View matching Tickets</a></div>
        {dashboard.myRecentlyCompletedActions.length ? <ul className="dashboard-ticket-list">{dashboard.myRecentlyCompletedActions.map((action) => <li key={action.id}><a href={`#staff-ticket/${action.ticket.id}?action=${action.id}`}><span className="dashboard-ticket-title">{action.ticket.ticketNumber} · {action.ticket.summary}</span><span className="dashboard-ticket-meta">Completed {action.actionAt ? bangkokDate(action.actionAt) : "date unavailable"} · {action.description}</span></a></li>)}</ul> : <p className="dashboard-empty">No Actions were completed by you in the last 14 days.</p>}
      </section>
      <section className="dashboard-panel" aria-labelledby="staff-recent-tickets-heading"><div className="dashboard-panel-heading"><h3 id="staff-recent-tickets-heading">Recent or Urgent Tickets</h3><a href={staffFilterHref(dashboard.drillDown.urgentOpenTickets, "#staff-tickets?scope=urgent-open")}>View urgent work</a></div>
        {dashboard.recentOrUrgentTickets.length ? <ul className="dashboard-ticket-list">{dashboard.recentOrUrgentTickets.map((ticket) => <li key={ticket.id}><a href={`#staff-ticket/${ticket.id}`}><span className="dashboard-ticket-title">{ticket.ticketNumber} · {ticket.summary}</span><span className="dashboard-ticket-meta"><span className="status-badge">{ticket.currentStatus.replaceAll("_", " ")}</span> IT priority {ticket.itPriority ?? "Unassigned"} · Requested {ticket.requestedPriority} · {ticket.owner?.name ?? "Unassigned"} · Updated {bangkokDate(ticket.updatedAt)}</span></a></li>)}</ul> : <p className="dashboard-empty">No recent or urgent open Tickets need attention.</p>}
      </section>
      {isAdministrator && dashboard.adminAccountSummary && <section className="dashboard-panel" aria-labelledby="admin-account-summary-heading"><h3 id="admin-account-summary-heading">Active Account Summary</h3><p className="helper-text">Aggregate active-user totals only; account credentials and session details are not shown.</p><ul className="dashboard-account-list">{dashboard.adminAccountSummary.map((entry) => <li key={entry.role}><span>{entry.role.replaceAll("_", " ")}</span><strong>{entry.activeUsers}</strong></li>)}</ul></section>}
    </div>
    <p className="dashboard-refresh">Summary refreshed {bangkokDate(dashboard.asOf)} (Bangkok time).</p>
  </section>;
}
