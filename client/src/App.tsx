import { FormEvent, useEffect, useState } from "react";
import { AuthSession, changePassword, fetchCurrentUser, login, logout, User } from "./api.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import UserManagement from "./UserManagement.js";
import RequesterDashboard from "./RequesterDashboard.js";
import StaffDashboard from "./StaffDashboard.js";

type AuthState = "loading" | "logged-out" | "authenticated";
type Workspace = "dashboard" | "requester" | "staff" | "admin";
type Route = {
  allowed: boolean;
  workspace: Workspace;
  createMode: boolean;
  requesterTicketId: number | null;
  staffTicketId: number | null;
  selectedActionId: number | null;
  scope: string;
  status: string;
  asOf: string;
};

const dashboardRoute = (): Route => ({ allowed: true, workspace: "dashboard", createMode: false, requesterTicketId: null, staffTicketId: null, selectedActionId: null, scope: "", status: "", asOf: "" });

function resolveRoute(hash: string, role: User["role"]): Route {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  const separator = value.indexOf("?");
  const path = separator < 0 ? value : value.slice(0, separator);
  const params = new URLSearchParams(separator < 0 ? "" : value.slice(separator + 1));
  const roleIsRequester = role === "REQUESTER";
  const roleIsOperational = role === "IT_STAFF" || role === "ADMINISTRATOR";
  const positiveId = (input: string | undefined) => input && /^[1-9]\d*$/.test(input) && Number.isSafeInteger(Number(input)) ? Number(input) : null;
  const asOf = params.get("asOf") ?? "";

  if (!path || path === "top" || path === "dashboard") return dashboardRoute();
  if (path === "my-tickets" && roleIsRequester) {
    const scope = params.get("scope") ?? "";
    const status = params.get("status") ?? "";
    if (scope && !["open", "recently-updated", "recently-resolved"].includes(scope)) return { ...dashboardRoute(), allowed: false };
    if (status && status !== "WAITING_FOR_REQUESTER") return { ...dashboardRoute(), allowed: false };
    return { ...dashboardRoute(), workspace: "requester", scope, status, asOf };
  }
  if (path === "create-ticket" && roleIsRequester) return { ...dashboardRoute(), workspace: "requester", createMode: true };
  const requesterTicket = path.match(/^requester-ticket\/([1-9]\d*)$/);
  if (requesterTicket && roleIsRequester) {
    const ticketId = positiveId(requesterTicket[1]);
    return ticketId ? { ...dashboardRoute(), workspace: "requester", requesterTicketId: ticketId } : { ...dashboardRoute(), allowed: false };
  }
  if (path === "staff-tickets" && roleIsOperational) {
    const scope = params.get("scope") ?? "";
    const scopes = ["unassigned-open", "my-owned-open", "my-active-actions", "my-recently-completed-actions", "urgent-open"];
    if (scope && !scopes.includes(scope)) return { ...dashboardRoute(), allowed: false };
    return { ...dashboardRoute(), workspace: "staff", scope, asOf };
  }
  const staffTicket = path.match(/^staff-ticket\/([1-9]\d*)$/);
  if (staffTicket && roleIsOperational) {
    const ticketId = positiveId(staffTicket[1]);
    const selectedActionId = positiveId(params.get("action") ?? undefined);
    if (!ticketId || (params.has("action") && !selectedActionId)) return { ...dashboardRoute(), allowed: false };
    return { ...dashboardRoute(), workspace: "staff", staffTicketId: ticketId, selectedActionId };
  }
  if (path === "admin-users" && role === "ADMINISTRATOR") return { ...dashboardRoute(), workspace: "admin" };
  return { ...dashboardRoute(), allowed: false };
}

function replaceHash(hash: string) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

function LoginPanel({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      onSuccess(await login(email, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="requester-card" onSubmit={submit} aria-labelledby="login-heading">
      <h2 id="login-heading">Sign in to TokTickIT</h2>
      <p className="helper-text">Use your authenticated account to access the workspace for your role.</p>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      {error && <div className="state-callout state-error" role="alert">{error}</div>}
      <button className="btn btn-primary-green" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}

function ChangePasswordPanel({ session, onComplete }: { session: AuthSession; onComplete: (session: AuthSession) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      onComplete(await changePassword(currentPassword, newPassword, confirmPassword));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="requester-card" onSubmit={submit} aria-labelledby="change-password-heading">
      <h2 id="change-password-heading">Change your password</h2>
      <p className="helper-text">A password change is required before using the TokTickIT workspace.</p>
      <label htmlFor="current-password">Current password</label>
      <input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      <label htmlFor="new-password">New password</label>
      <input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} required />
      <label htmlFor="confirm-password">Confirm new password</label>
      <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} required />
      {error && <div className="state-callout state-error" role="alert">{error}</div>}
      <button className="btn btn-primary-green" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save password"}</button>
      <span className="helper-text">Signed in as {session.user.email}</span>
    </form>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [staffTicketId, setStaffTicketId] = useState<number | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>("dashboard");
  const [ticketScope, setTicketScope] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [dashboardAsOf, setDashboardAsOf] = useState("");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  function applyRoute(route: Route) {
    setWorkspace(route.workspace);
    setCreateMode(route.createMode);
    setDetailTicketId(route.requesterTicketId);
    setStaffTicketId(route.staffTicketId);
    setSelectedActionId(route.selectedActionId);
    setTicketScope(route.scope);
    setTicketStatus(route.status);
    setDashboardAsOf(route.asOf);
    setMenuOpen(false);
  }

  function establishSession(next: AuthSession, useCurrentLocation = false) {
    setSession(next);
    if (next.mustChangePassword) {
      applyRoute(dashboardRoute());
    } else {
      const route = useCurrentLocation ? resolveRoute(window.location.hash, next.user.role) : dashboardRoute();
      if (!route.allowed) replaceHash("#dashboard");
      applyRoute(route.allowed ? route : dashboardRoute());
      if (!window.location.hash) replaceHash("#dashboard");
    }
    setAuthState("authenticated");
  }

  useEffect(() => {
    void fetchCurrentUser()
      .then((current) => establishSession(current, true))
      .catch(() => setAuthState("logged-out"));
  }, []);

  const authenticated = authState === "authenticated" && session !== null;
  const isStaff = authenticated && session.user.role !== "REQUESTER";
  const isAdmin = authenticated && session.user.role === "ADMINISTRATOR";

  useEffect(() => {
    if (!authenticated || !session) return;
    const onHashChange = () => {
      const route = resolveRoute(window.location.hash, session.user.role);
      if (!route.allowed) {
        replaceHash("#dashboard");
        applyRoute(dashboardRoute());
      } else {
        applyRoute(route);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [authenticated, session]);

  function navigate(hash: string) {
    const nextHash = hash.startsWith("#") ? hash : `#${hash}`;
    if (window.location.hash === nextHash) {
      if (session) {
        const route = resolveRoute(nextHash, session.user.role);
        if (route.allowed) applyRoute(route);
      }
      return;
    }
    window.location.hash = nextHash;
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setSession(null);
    setAuthState("logged-out");
    applyRoute(dashboardRoute());
    replaceHash("#dashboard");
  }

  const roleLabel: Record<User["role"], string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };
  const pageTitle = authenticated && session.mustChangePassword
    ? "Password change required"
    : workspace === "admin" ? "Administrator workspace" : isStaff ? "Staff operations workspace" : "Requester workspace";
  const pageIntro = authenticated && session.mustChangePassword
    ? "Choose a new password before entering your workspace."
    : workspace === "admin"
    ? "Manage user access, roles, account status, and initial passwords safely."
    : isStaff
      ? "Review, assign, and resolve operational Tickets with an auditable workflow."
      : "A clear, responsive workspace for creating and tracking your IT requests.";

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-brand" href="#dashboard" aria-label="TokTickIT home" onClick={() => setMenuOpen(false)}>TokTickIT</a>
        {authenticated && !session.mustChangePassword && (
          <>
            <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
            <nav id="primary-navigation" className={`primary-navigation${menuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
              <a className={`nav-link${workspace === "dashboard" ? " is-active" : ""}`} href="#dashboard" aria-current={workspace === "dashboard" ? "page" : undefined} onClick={() => setMenuOpen(false)}>Dashboard</a>
              {isStaff ? (
                <>
                  <a className={`nav-link${workspace === "staff" ? " is-active" : ""}`} href="#staff-tickets" aria-current={workspace === "staff" ? "page" : undefined} onClick={() => setMenuOpen(false)}>Staff Queue</a>
                  {isAdmin && <a className={`nav-link${workspace === "admin" ? " is-active" : ""}`} href="#admin-users" aria-current={workspace === "admin" ? "page" : undefined} onClick={() => setMenuOpen(false)}>User Management</a>}
                </>
              ) : (
                <>
                  <a className={`nav-link${workspace === "requester" && !createMode ? " is-active" : ""}`} href="#my-tickets" aria-current={workspace === "requester" && !createMode ? "page" : undefined} onClick={() => setMenuOpen(false)}>My Tickets</a>
                  <a className={`nav-link${createMode ? " is-active" : ""}`} href="#create-ticket" aria-current={createMode ? "page" : undefined} onClick={() => setMenuOpen(false)}>Create Ticket</a>
                </>
              )}
              <span className="requester-context" aria-label="Current User">{session.user.name} <span className="role-badge">{roleLabel[session.user.role]}</span></span>
              <button className="nav-action" type="button" onClick={() => { setMenuOpen(false); void handleLogout(); }}>Log out</button>
            </nav>
          </>
        )}
        {authenticated && session.mustChangePassword && <button className="nav-action" type="button" onClick={() => { void handleLogout(); }}>Log out</button>}
      </header>

      <main id="top" className="app-main">
        <section className="page-card" aria-labelledby="page-title">
          <p className="eyebrow">IT Service Desk</p>
          <h1 id="page-title">{pageTitle}</h1>
          <p className="page-intro">{pageIntro}</p>

          {authState === "loading" && <div className="state-callout state-info" role="status">Checking your session...</div>}
          {authState === "logged-out" && <LoginPanel onSuccess={(next) => establishSession(next)} />}
          {authenticated && session.mustChangePassword && <ChangePasswordPanel session={session} onComplete={(next) => { establishSession(next); replaceHash("#dashboard"); }} />}

          {authenticated && !session.mustChangePassword && (
            workspace === "dashboard" ? (
              isStaff
                ? <StaffDashboard key={`${session.user.id}:staff-dashboard`} isAdministrator={isAdmin} />
                : <RequesterDashboard key={`${session.user.id}:requester-dashboard`} />
            ) : isStaff ? (
              <>
                {workspace === "staff" && staffTicketId === null && <StaffTicketQueue key={`${session.user.id}:queue:${ticketScope}:${dashboardAsOf}`} onOpen={(id) => navigate(`#staff-ticket/${id}`)} scope={ticketScope || undefined} asOf={dashboardAsOf || undefined} />}
                {workspace === "staff" && staffTicketId !== null && <StaffTicketDetail key={`${session.user.id}:staff-ticket:${staffTicketId}`} ticketId={staffTicketId} selectedActionId={selectedActionId ?? undefined} onBack={() => navigate("#staff-tickets")} />}
                {isAdmin && workspace === "admin" && <UserManagement key={`${session.user.id}:admin-users`} currentUserId={session.user.id} />}
              </>
            ) : (
              <>
                {createMode && <CreateTicket key={`${session.user.id}:create`} />}
                {!createMode && detailTicketId === null && <MyTickets key={`${session.user.id}:my-tickets:${ticketScope}:${ticketStatus}:${dashboardAsOf}`} onOpen={(id) => navigate(`#requester-ticket/${id}`)} scope={ticketScope || undefined} status={ticketStatus || undefined} asOf={dashboardAsOf || undefined} />}
                {!createMode && detailTicketId !== null && <TicketDetail key={`${session.user.id}:requester-ticket:${detailTicketId}`} ticketId={detailTicketId} onBack={() => navigate("#my-tickets")} />}
              </>
            )
          )}
        </section>
      </main>
    </div>
  );
}
