const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category { id: number; name: string }
export interface RelatedSystem { id: number; name: string; isActive?: boolean }
export interface Requester { id: number; name: string; isActive: boolean }
export interface User { id: number; name: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; isActive: boolean; mustChangePassword: boolean }
export type AdminUserRole = User["role"];
export interface AdminUser extends User {}
export interface AdminUserList { data: AdminUser[]; meta: { totalItems: number } }
export interface AuthSession { user: User; mustChangePassword: boolean; csrfToken: string }
export interface SystemStatus { online: boolean; categories: Category[] }
export interface CreatedTicket { id: number; ticketNumber: string; requesterId: number; summary: string; currentStatus: string; createdAt: string }
export interface TicketSummary extends CreatedTicket { category: Category; relatedSystem: RelatedSystem; requestedPriority: string; updatedAt: string }
export interface PublicComment { id: number; ticketId: number; body: string; createdAt: string; author: { id: number; name: string; role: User["role"] } }
export interface TicketDetail extends TicketSummary {
  categoryId: number;
  relatedSystemId: number;
  description: string;
  itPriority: string | null;
  requester: { id: number; name: string; email: string };
  requesterConfirmedResolved?: boolean;
  requesterConfirmedResolvedAt?: string | null;
  attachments: Array<{ id: number; ticketId: number; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: string; removedAt: string | null; removedReason: string | null }>;
  publicComments?: PublicComment[];
}
export interface TicketList { data: TicketSummary[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } }

let csrfToken: string | null = null;

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  return fallback;
}

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({})) as unknown;
  if (!response.ok) throw Object.assign(new Error(errorMessage(payload, fallback)), { fields: typeof (payload as { error?: { fields?: unknown } })?.error === "object" ? (payload as { error: { fields?: Record<string, string> } }).error.fields : undefined });
  return payload as T;
}

function protectedHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, password }) });
  const payload = await jsonResponse<{ data: AuthSession }>(response, "Unable to sign in");
  csrfToken = payload.data.csrfToken;
  return payload.data;
}

export async function fetchCurrentUser(): Promise<AuthSession> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include", signal: controller.signal });
    const payload = await jsonResponse<{ data: AuthSession }>(response, "Unable to load the current user");
    csrfToken = payload.data.csrfToken;
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/auth/change-password`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
  const payload = await jsonResponse<{ data: AuthSession }>(response, "Unable to change password");
  csrfToken = payload.data.csrfToken;
  return payload.data;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: protectedHeaders(), credentials: "include" });
  if (!response.ok && response.status !== 401) await jsonResponse(response, "Unable to log out");
  csrfToken = null;
}

export async function fetchTickets(paramsOrRequester: URLSearchParams | number, legacyParams?: URLSearchParams): Promise<TicketList> {
  const params = paramsOrRequester instanceof URLSearchParams ? paramsOrRequester : (legacyParams ?? new URLSearchParams());
  const response = await fetch(`${API_URL}/api/tickets?${params.toString()}`, { credentials: "include" });
  const payload = await jsonResponse<TicketList>(response, "Unable to load Tickets");
  if (!payload.meta || !Array.isArray(payload.data)) throw new Error("Unexpected Ticket response");
  return payload;
}

export async function fetchTicketDetail(requesterOrTicketId: number, legacyTicketId?: number): Promise<TicketDetail> {
  const ticketId = legacyTicketId ?? requesterOrTicketId;
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, { credentials: "include" });
  const payload = await jsonResponse<{ data: TicketDetail }>(response, "Unable to load Ticket");
  if (!payload.data) throw new Error("Unexpected Ticket response");
  return payload.data;
}

export async function uploadAttachments(ticketId: number, files: File[]): Promise<void>;
export async function uploadAttachments(_legacyRequesterId: number, ticketId: number, files: File[]): Promise<void>;
export async function uploadAttachments(first: number, second: File[] | number, third?: File[]): Promise<void> {
  const ticketId = typeof second === "number" ? second : first;
  const files = typeof second === "number" ? (third ?? []) : second;
  const form = new FormData(); files.forEach((file) => form.append("files", file));
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, { method: "POST", headers: protectedHeaders(), credentials: "include", body: form });
  await jsonResponse(response, "Unable to upload attachments");
}

export async function removeAttachment(ticketId: number, attachmentId: number, reason: string): Promise<void>;
export async function removeAttachment(_legacyRequesterId: number, ticketId: number, attachmentId: number, reason: string): Promise<void>;
export async function removeAttachment(first: number, second: number, third: number | string, fourth?: string): Promise<void> {
  const ticketId = fourth === undefined ? first : second;
  const attachmentId = fourth === undefined ? second : third as number;
  const reason = fourth === undefined ? third as string : fourth;
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}`, { method: "DELETE", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ reason }) });
  await jsonResponse(response, "Unable to remove attachment");
}

export async function downloadAttachment(ticketId: number, attachmentId: number, originalName: string): Promise<void>;
export async function downloadAttachment(_legacyRequesterId: number, ticketId: number, attachmentId: number, originalName: string): Promise<void>;
export async function downloadAttachment(first: number, second: number, third: number | string, fourth?: string): Promise<void> {
  const ticketId = fourth === undefined ? first : second;
  const attachmentId = fourth === undefined ? second : third as number;
  const originalName = fourth === undefined ? third as string : fourth;
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}/download`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to download attachment");
  const objectUrl = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = originalName; anchor.click(); URL.revokeObjectURL(objectUrl);
}

export async function createTicket(body: { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string }, idempotencyKey: string): Promise<CreatedTicket>;
export async function createTicket(_legacyRequesterId: number, body: { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string }, idempotencyKey: string): Promise<CreatedTicket>;
export async function createTicket(first: number | { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string }, second: string | { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string }, third?: string): Promise<CreatedTicket> {
  const body = typeof first === "number" ? second as { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string } : first;
  const idempotencyKey = typeof first === "number" ? third as string : second as string;
  const response = await fetch(`${API_URL}/api/tickets`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }), credentials: "include", body: JSON.stringify(body) });
  const payload = await jsonResponse<{ data: CreatedTicket }>(response, "Unable to create Ticket");
  return payload.data;
}

export async function fetchComments(ticketId: number): Promise<PublicComment[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { credentials: "include" });
  const payload = await jsonResponse<{ data: PublicComment[] }>(response, "Unable to load comments");
  return payload.data;
}

export async function createComment(ticketId: number, body: string): Promise<PublicComment> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ body }) });
  const payload = await jsonResponse<{ data: PublicComment }>(response, "Unable to add comment");
  return payload.data;
}

export async function confirmRequesterResolution(ticketId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/requester-resolution`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: "{}" });
  await jsonResponse(response, "Unable to record resolution indication");
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories?active=true`); if (!response.ok) throw new Error("Unable to load Categories"); const values = await response.json() as unknown; if (!Array.isArray(values) || !values.every(isCategory)) throw new Error("Unexpected Category response"); return values;
}
export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems?active=true`); if (!response.ok) throw new Error("Unable to load Related Systems"); const values = await response.json() as unknown; if (!Array.isArray(values)) throw new Error("Unexpected Related System response"); return values as RelatedSystem[];
}

// Kept as a compatibility export for old Lab 2 tests; the normal UI no longer calls it.
export async function fetchRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters?active=true`); if (!response.ok) throw new Error("Unable to load Development Requesters"); const values = await response.json() as unknown; if (!Array.isArray(values)) throw new Error("Unexpected Development Requester response"); return values as Requester[];
}

function isCategory(value: unknown): value is Category { return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).id === "number" && typeof (value as Record<string, unknown>).name === "string"; }
export async function checkSystem(): Promise<SystemStatus> {
  const response = await fetch(`${API_URL}/api/health`); if (!response.ok) throw new Error("TokTickIT API health check failed"); const health = await response.json() as { status: string; service: string }; if (health.status !== "ok" || health.service !== "TokTickIT API") throw new Error("TokTickIT API returned an unexpected health response"); const categories = await fetchCategories(); return { online: true, categories };
}

export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export interface StaffOwner { id: number; name: string; email: string; role: User["role"]; isActive: boolean }
export interface StaffTicketRow extends TicketSummary {
  ownerId: number | null;
  requester: { id: number; name: string; email: string };
  owner: StaffOwner | null;
  itPriority: TicketPriority | null;
}
export interface StaffTicketList { data: StaffTicketRow[]; meta: TicketList["meta"] }
export interface InternalNote { id: number; ticketId: number; body: string; createdAt: string; author: { id: number; name: string; role: User["role"] } }
export interface StaffTicketDetail extends Omit<TicketDetail, "itPriority" | "publicComments"> {
  itPriority: TicketPriority | null;
  ownerId: number | null;
  owner: StaffOwner | null;
  publicComments: PublicComment[];
  internalNotes: InternalNote[];
}

export async function fetchStaffTickets(params: URLSearchParams): Promise<StaffTicketList> {
  const response = await fetch(`${API_URL}/api/staff/tickets?${params.toString()}`, { credentials: "include" });
  const payload = await jsonResponse<StaffTicketList>(response, "Unable to load Staff Queue");
  if (!payload.meta || !Array.isArray(payload.data)) throw new Error("Unexpected Staff Queue response");
  return payload;
}

export async function fetchStaffTicketDetail(ticketId: number): Promise<StaffTicketDetail> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, { credentials: "include" });
  const payload = await jsonResponse<{ data: StaffTicketDetail }>(response, "Unable to load Staff Ticket");
  if (!payload.data) throw new Error("Unexpected Staff Ticket response");
  return payload.data;
}

export async function claimStaffTicket(ticketId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/claim`, { method: "POST", headers: protectedHeaders(), credentials: "include" });
  await jsonResponse(response, "Unable to claim Ticket");
}

export async function assignStaffTicket(ticketId: number, ownerId: number | null): Promise<void> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/assignment`, { method: "PATCH", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ ownerId }) });
  await jsonResponse(response, "Unable to update Ticket owner");
}

export async function updateStaffTicketPriority(ticketId: number, itPriority: TicketPriority): Promise<void> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/priority`, { method: "PATCH", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ itPriority }) });
  await jsonResponse(response, "Unable to update IT Priority");
}

export async function updateStaffTicketStatus(ticketId: number, status: TicketStatus, options: { confirmation?: boolean; reason?: string } = {}): Promise<void> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, { method: "PATCH", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ status, ...options }) });
  await jsonResponse(response, "Unable to update Ticket status");
}

export async function fetchStaffComments(ticketId: number): Promise<PublicComment[]> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/comments`, { credentials: "include" });
  const payload = await jsonResponse<{ data: PublicComment[] }>(response, "Unable to load public comments");
  return payload.data;
}

export async function createStaffComment(ticketId: number, body: string): Promise<PublicComment> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/comments`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ body }) });
  const payload = await jsonResponse<{ data: PublicComment }>(response, "Unable to add public comment");
  return payload.data;
}

export async function createInternalNote(ticketId: number, body: string): Promise<InternalNote> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/internal-notes`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ body }) });
  const payload = await jsonResponse<{ data: InternalNote }>(response, "Unable to add internal note");
  return payload.data;
}

export async function downloadStaffAttachment(ticketId: number, attachmentId: number, originalName: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/attachments/${attachmentId}/download`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to download attachment");
  const objectUrl = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = originalName; anchor.click(); URL.revokeObjectURL(objectUrl);
}

export async function fetchAdminUsers(search = "", role: AdminUserRole | "" = ""): Promise<AdminUserList> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (role) params.set("role", role);
  const response = await fetch(`${API_URL}/api/admin/users${params.toString() ? `?${params.toString()}` : ""}`, { credentials: "include" });
  const payload = await jsonResponse<AdminUserList>(response, "Unable to load Users");
  if (!payload.meta || !Array.isArray(payload.data)) throw new Error("Unexpected User response");
  return payload;
}

export interface AdminUserInput {
  name: string;
  email: string;
  role: AdminUserRole;
  isActive: boolean;
  initialPassword: string;
}

export async function createAdminUser(input: AdminUserInput): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/api/admin/users`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify(input) });
  const payload = await jsonResponse<{ data: AdminUser }>(response, "Unable to create User");
  return payload.data;
}

export async function updateAdminUser(userId: number, input: Partial<Pick<AdminUser, "name" | "email" | "role" | "isActive">>): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}`, { method: "PATCH", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify(input) });
  const payload = await jsonResponse<{ data: AdminUser }>(response, "Unable to update User");
  return payload.data;
}

export async function resetAdminUserPassword(userId: number, initialPassword: string): Promise<AdminUser> {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/initial-password`, { method: "POST", headers: protectedHeaders({ "Content-Type": "application/json" }), credentials: "include", body: JSON.stringify({ initialPassword }) });
  const payload = await jsonResponse<{ data: AdminUser }>(response, "Unable to reset initial password");
  return payload.data;
}
