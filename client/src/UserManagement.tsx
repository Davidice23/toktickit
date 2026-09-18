import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  AdminUserInput,
  AdminUserRole,
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from "./api.js";

type Panel = "create" | "edit" | "reset" | null;
type FormErrors = Record<string, string>;

const roles: AdminUserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

function errorFields(reason: unknown): FormErrors {
  if (typeof reason === "object" && reason !== null && "fields" in reason) {
    const fields = (reason as { fields?: unknown }).fields;
    if (typeof fields === "object" && fields !== null) return fields as FormErrors;
  }
  return {};
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function emptyCreateForm(): AdminUserInput {
  return { name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" };
}

export default function UserManagement({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState<AdminUserRole | "">("");
  const [filters, setFilters] = useState<{ search: string; role: AdminUserRole | "" }>({ search: "", role: "" });
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [createForm, setCreateForm] = useState<AdminUserInput>(emptyCreateForm());
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "REQUESTER" as AdminUserRole, isActive: true });
  const [password, setPassword] = useState("");
  const [mutationState, setMutationState] = useState<"idle" | "saving">("idle");
  const [mutationError, setMutationError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState("");

  const activeAdminCount = useMemo(
    () => users.filter((user) => user.role === "ADMINISTRATOR" && user.isActive).length,
    [users],
  );

  async function load(nextFilters = filters) {
    setState("loading");
    setLoadError("");
    try {
      const result = await fetchAdminUsers(nextFilters.search, nextFilters.role);
      setUsers(result.data);
      setState("ready");
    } catch (reason) {
      setLoadError(errorMessage(reason, "Unable to load Users"));
      setState("error");
    }
  }

  useEffect(() => {
    void load({ search: "", role: "" });
  }, []);

  function closePanel() {
    setPanel(null);
    setSelected(null);
    setMutationError("");
    setFieldErrors({});
    setPassword("");
  }

  function beginCreate() {
    setCreateForm(emptyCreateForm());
    setMutationError("");
    setFieldErrors({});
    setSuccess("");
    setPanel("create");
  }

  function beginEdit(user: AdminUser) {
    setSelected(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, isActive: user.isActive });
    setMutationError("");
    setFieldErrors({});
    setSuccess("");
    setPanel("edit");
  }

  function beginReset(user: AdminUser) {
    setSelected(user);
    setPassword("");
    setMutationError("");
    setFieldErrors({});
    setSuccess("");
    setPanel("reset");
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = { search: searchDraft.trim(), role: roleDraft };
    setFilters(next);
    await load(next);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const next = { ...createForm, name: createForm.name.trim(), email: createForm.email.trim() };
    if (!next.name || !next.email || !next.initialPassword) {
      setMutationError("Complete all required fields before creating the user.");
      return;
    }
    setMutationState("saving");
    setMutationError("");
    setFieldErrors({});
    try {
      await createAdminUser(next);
      closePanel();
      setSuccess("User created. The initial password must be changed at the next sign-in.");
      await load();
    } catch (reason) {
      setMutationError(errorMessage(reason, "Unable to create User"));
      setFieldErrors(errorFields(reason));
    } finally {
      setMutationState("idle");
    }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const isSelf = selected.id === currentUserId;
    const isLastActiveAdmin = selected.role === "ADMINISTRATOR" && selected.isActive && activeAdminCount <= 1;
    if (!editForm.isActive && (isSelf || isLastActiveAdmin)) {
      setMutationError(isSelf ? "You cannot deactivate your own Administrator account." : "At least one active Administrator must remain.");
      return;
    }
    setMutationState("saving");
    setMutationError("");
    setFieldErrors({});
    try {
      const updated = await updateAdminUser(selected.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      });
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      closePanel();
      setSuccess("User changes saved.");
    } catch (reason) {
      setMutationError(errorMessage(reason, "Unable to update User"));
      setFieldErrors(errorFields(reason));
    } finally {
      setMutationState("idle");
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (password.length < 12) {
      setMutationError("Initial password must be at least 12 characters.");
      return;
    }
    setMutationState("saving");
    setMutationError("");
    setFieldErrors({});
    try {
      const updated = await resetAdminUserPassword(selected.id, password);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      closePanel();
      setSuccess("Initial password reset. The user must change it at the next sign-in.");
    } catch (reason) {
      setMutationError(errorMessage(reason, "Unable to reset initial password"));
      setFieldErrors(errorFields(reason));
    } finally {
      setMutationState("idle");
    }
  }

  const hasFilters = Boolean(filters.search || filters.role);

  return (
    <section className="admin-users" aria-labelledby="admin-users-heading">
      <div className="list-header">
        <div>
          <p className="eyebrow">Administrator workspace</p>
          <h2 id="admin-users-heading">User Management</h2>
          <p className="helper-text">Manage roles, account status, and initial passwords without exposing password material.</p>
        </div>
        <button className="btn btn-primary-green" type="button" onClick={beginCreate}>Create User</button>
      </div>

      {success && <div className="state-callout state-success" role="status">{success}</div>}

      <form className="admin-user-filters" onSubmit={submitSearch} aria-label="User Management filters">
        <div>
          <label htmlFor="admin-user-search">Search users</label>
          <input id="admin-user-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Name or email" maxLength={120} />
        </div>
        <div>
          <label htmlFor="admin-user-role">Role filter</label>
          <select id="admin-user-role" value={roleDraft} onChange={(event) => setRoleDraft(event.target.value as AdminUserRole | "")}>
            <option value="">All roles</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
        <div className="admin-user-filter-actions">
          <button className="btn btn-primary-green" type="submit" disabled={state === "loading"}>{state === "loading" ? "Loading..." : "Search Users"}</button>
          <button className="btn btn-secondary-green" type="button" disabled={state === "loading"} onClick={() => { setSearchDraft(""); setRoleDraft(""); setFilters({ search: "", role: "" }); void load({ search: "", role: "" }); }}>Clear Filters</button>
        </div>
      </form>

      {state === "loading" && <div className="state-callout state-info" role="status">Loading Users...</div>}
      {state === "error" && <div className="state-callout state-error" role="alert">{loadError || "Unable to load Users."}<button className="retry-button" type="button" onClick={() => void load()}>Retry</button></div>}
      {state === "ready" && users.length === 0 && <div className="state-callout state-info" role="status">{hasFilters ? "No users match these filters." : "No users found."}</div>}
      {state === "ready" && users.length > 0 && (
        <div className="ticket-table-wrap">
          <table className="ticket-table admin-user-table">
            <caption className="visually-hidden">Administrator User Management</caption>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Name"><strong>{user.name}</strong>{user.mustChangePassword && <span className="private-badge">Password change required</span>}</td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Role"><span className="status-badge">{user.role}</span></td>
                  <td data-label="Status"><span className={user.isActive ? "status-badge" : "private-badge"}>{user.isActive ? "Active" : "Inactive"}</span></td>
                  <td data-label="Actions"><div className="admin-user-actions"><button className="btn btn-secondary-green" type="button" onClick={() => beginEdit(user)}>Edit</button><button className="btn btn-secondary-green" type="button" onClick={() => beginReset(user)}>Reset password</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panel === "create" && (
        <div className="admin-user-panel" aria-labelledby="create-user-heading">
          <div className="list-header"><h3 id="create-user-heading">Create User</h3><button className="btn btn-secondary-green" type="button" onClick={closePanel}>Cancel</button></div>
          <form className="admin-user-form" onSubmit={submitCreate}>
            <label htmlFor="create-user-name">Name</label><input id="create-user-name" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            <label htmlFor="create-user-email">Email</label><input id="create-user-email" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} required aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            <label htmlFor="create-user-role">Role</label><select id="create-user-role" value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as AdminUserRole })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
            <label htmlFor="create-user-password">Initial password</label><input id="create-user-password" type="password" minLength={12} value={createForm.initialPassword} onChange={(event) => setCreateForm({ ...createForm, initialPassword: event.target.value })} required aria-invalid={Boolean(fieldErrors.initialPassword)} />{fieldErrors.initialPassword && <span className="field-error">{fieldErrors.initialPassword}</span>}
            <label className="checkbox-label"><input type="checkbox" checked={createForm.isActive} onChange={(event) => setCreateForm({ ...createForm, isActive: event.target.checked })} /> Active account</label>
            {mutationError && <div className="state-callout state-error" role="alert">{mutationError}</div>}
            <button className="btn btn-primary-green" type="submit" disabled={mutationState === "saving"}>{mutationState === "saving" ? "Creating..." : "Create User"}</button>
          </form>
        </div>
      )}

      {panel === "edit" && selected && (
        <div className="admin-user-panel" aria-labelledby="edit-user-heading">
          <div className="list-header"><h3 id="edit-user-heading">Edit User</h3><button className="btn btn-secondary-green" type="button" onClick={closePanel}>Cancel</button></div>
          <form className="admin-user-form" onSubmit={submitEdit}>
            <label htmlFor="edit-user-name">Name</label><input id="edit-user-name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            <label htmlFor="edit-user-email">Email</label><input id="edit-user-email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            <label htmlFor="edit-user-role">Role</label><select id="edit-user-role" value={editForm.role} disabled={selected.role === "ADMINISTRATOR" && selected.isActive && activeAdminCount <= 1} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as AdminUserRole })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
            <label className="checkbox-label"><input type="checkbox" checked={editForm.isActive} disabled={selected.id === currentUserId || (selected.role === "ADMINISTRATOR" && selected.isActive && activeAdminCount <= 1)} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} /> Active account</label>
            {(selected.id === currentUserId || (selected.role === "ADMINISTRATOR" && selected.isActive && activeAdminCount <= 1)) && <p className="helper-text">This account cannot be deactivated or lose the last active Administrator protection.</p>}
            {mutationError && <div className="state-callout state-error" role="alert">{mutationError}</div>}
            <button className="btn btn-primary-green" type="submit" disabled={mutationState === "saving"}>{mutationState === "saving" ? "Saving..." : "Save Changes"}</button>
          </form>
        </div>
      )}

      {panel === "reset" && selected && (
        <div className="admin-user-panel" aria-labelledby="reset-user-heading">
          <div className="list-header"><h3 id="reset-user-heading">Reset Initial Password</h3><button className="btn btn-secondary-green" type="button" onClick={closePanel}>Cancel</button></div>
          <p className="helper-text">Set a new temporary password for {selected.name}. The user must change it at the next sign-in.</p>
          <form className="admin-user-form" onSubmit={submitReset}>
            <label htmlFor="reset-user-password">New initial password</label><input id="reset-user-password" type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required aria-invalid={Boolean(fieldErrors.initialPassword)} />{fieldErrors.initialPassword && <span className="field-error">{fieldErrors.initialPassword}</span>}
            {mutationError && <div className="state-callout state-error" role="alert">{mutationError}</div>}
            <button className="btn btn-primary-green" type="submit" disabled={mutationState === "saving"}>{mutationState === "saving" ? "Resetting..." : "Reset Password"}</button>
          </form>
        </div>
      )}
    </section>
  );
}
