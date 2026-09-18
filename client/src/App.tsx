import { FormEvent, useEffect, useState } from "react";
import { AuthSession, Category, changePassword, checkSystem, fetchCurrentUser, login, logout, User } from "./api.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import UserManagement from "./UserManagement.js";

type UiState = "idle" | "loading" | "success" | "error";
type AuthState = "loading" | "logged-out" | "authenticated";
type Workspace = "requester" | "staff" | "admin";

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
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null);
  const [staffTicketId, setStaffTicketId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>("requester");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    void fetchCurrentUser()
      .then((current) => {
        setSession(current);
        setWorkspace(current.user.role === "ADMINISTRATOR" ? "admin" : current.user.role === "IT_STAFF" ? "staff" : "requester");
        setAuthState("authenticated");
      })
      .catch(() => setAuthState("logged-out"));
  }, []);

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  async function handleLogout() {
    await logout().catch(() => undefined);
    setSession(null);
    setAuthState("logged-out");
    setCreateMode(false);
    setDetailTicketId(null);
    setStaffTicketId(null);
    setWorkspace("requester");
  }

  const authenticated = authState === "authenticated" && session !== null;
  const isStaff = authenticated && session.user.role !== "REQUESTER";
  const isAdmin = authenticated && session.user.role === "ADMINISTRATOR";
  const roleLabel: Record<User["role"], string> = { REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" };

  function showStaffQueue() {
    setWorkspace("staff");
    setStaffTicketId(null);
    setMenuOpen(false);
  }

  function showAdminUsers() {
    setWorkspace("admin");
    setMenuOpen(false);
  }

  function showMyTickets() {
    setWorkspace("requester");
    setCreateMode(false);
    setDetailTicketId(null);
    setMenuOpen(false);
  }

  function showCreateTicket() {
    setWorkspace("requester");
    setCreateMode(true);
    setDetailTicketId(null);
    setMenuOpen(false);
  }

  const pageTitle = isAdmin && workspace === "admin" ? "Administrator workspace" : isStaff ? "Staff operations workspace" : "Requester workspace";
  const pageIntro = isAdmin && workspace === "admin"
    ? "Manage user access, roles, account status, and initial passwords safely."
    : isStaff
      ? "Review, assign, and resolve operational Tickets with an auditable workflow."
      : "A clear, responsive workspace for creating and tracking your IT requests.";

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-brand" href="#top" aria-label="TokTickIT home">TokTickIT</a>
        {authenticated && (
          <>
            <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
            <nav id="primary-navigation" className={`primary-navigation${menuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
              {isStaff ? (
                <>
                  <a className={`nav-link${workspace === "staff" ? " is-active" : ""}`} href="#staff-tickets" aria-current={workspace === "staff" ? "page" : undefined} onClick={showStaffQueue}>Staff Queue</a>
                  {isAdmin && <a className={`nav-link${workspace === "admin" ? " is-active" : ""}`} href="#admin-users" aria-current={workspace === "admin" ? "page" : undefined} onClick={showAdminUsers}>User Management</a>}
                </>
              ) : (
                <>
                  <a className={`nav-link${workspace === "requester" && !createMode ? " is-active" : ""}`} href="#my-tickets" aria-current={workspace === "requester" && !createMode ? "page" : undefined} onClick={showMyTickets}>My Tickets</a>
                  <a className={`nav-link${createMode ? " is-active" : ""}`} href="#create-ticket" aria-current={createMode ? "page" : undefined} onClick={showCreateTicket}>Create Ticket</a>
                </>
              )}
              <span className="requester-context" aria-label="Current User">{session.user.name} <span className="role-badge">{roleLabel[session.user.role]}</span></span>
              <button className="nav-action" type="button" onClick={() => { setMenuOpen(false); void handleLogout(); }}>Log out</button>
            </nav>
          </>
        )}
      </header>

      <main id="top" className="app-main">
        <section className="page-card" aria-labelledby="page-title">
          <p className="eyebrow">IT Service Desk</p>
          <h1 id="page-title">{pageTitle}</h1>
          <p className="page-intro">{pageIntro}</p>

          {authState === "loading" && <div className="state-callout state-info" role="status">Checking your session...</div>}
          {authState === "logged-out" && <LoginPanel onSuccess={(next) => { setSession(next); setWorkspace(next.user.role === "ADMINISTRATOR" ? "admin" : next.user.role === "IT_STAFF" ? "staff" : "requester"); setAuthState("authenticated"); }} />}
          {authenticated && session.mustChangePassword && <ChangePasswordPanel session={session} onComplete={(next) => { setSession(next); setWorkspace(next.user.role === "ADMINISTRATOR" ? "admin" : next.user.role === "IT_STAFF" ? "staff" : "requester"); }} />}

          {authenticated && !session.mustChangePassword && (
            isStaff ? (
              <>
                {workspace === "staff" && staffTicketId === null && <StaffTicketQueue onOpen={setStaffTicketId} />}
                {workspace === "staff" && staffTicketId !== null && <StaffTicketDetail ticketId={staffTicketId} onBack={() => setStaffTicketId(null)} />}
                {isAdmin && workspace === "admin" && <UserManagement currentUserId={session.user.id} />}
              </>
            ) : (
              <>
                {createMode && <CreateTicket />}
                {!createMode && detailTicketId === null && <MyTickets onOpen={setDetailTicketId} />}
                {!createMode && detailTicketId !== null && <TicketDetail ticketId={detailTicketId} onBack={() => setDetailTicketId(null)} />}
              </>
            )
          )}

          <button className="btn btn-primary-green" onClick={handleCheck} disabled={state === "loading"}>{state === "loading" ? "Loading..." : "Check System"}</button>
          {state === "loading" && <div className="state-callout state-info" role="status" aria-live="polite"><strong>Loading:</strong> Checking TokTickIT API...</div>}
          {state === "success" && <><div className="state-callout state-success" role="status"><strong>System Status:</strong> Online</div><section aria-labelledby="category-heading"><h2 id="category-heading">IT Request Categories</h2><ul className="category-list">{categories.map((category) => <li className="category-item" key={category.id}>{category.name}</li>)}</ul></section></>}
          {state === "error" && <div className="state-callout state-error" role="alert"><p><strong>System Status:</strong> Offline</p><p>Unable to connect to TokTickIT API</p></div>}
        </section>
      </main>
    </div>
  );
}
