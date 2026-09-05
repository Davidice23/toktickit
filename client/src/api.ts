const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface Requester {
  id: number;
  name: string;
  isActive: boolean;
}

export interface RelatedSystem { id: number; name: string; isActive: boolean }
export interface CreatedTicket { id: number; ticketNumber: string; requesterId: number; summary: string; currentStatus: string; createdAt: string }
export interface TicketSummary extends CreatedTicket { category: { id: number; name: string }; relatedSystem: { id: number; name: string }; requestedPriority: string; updatedAt: string }
export interface TicketList { data: TicketSummary[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } }
export interface TicketDetail extends TicketSummary { categoryId: number; relatedSystemId: number; description: string; itPriority: string | null; requester: { id: number; name: string; email: string }; attachments: Array<{ id: number; originalName: string; mimeType: string; sizeBytes: number; uploadedAt: string; removedAt: string | null; removedReason: string | null }> }

export async function fetchTickets(requesterId: number, params: URLSearchParams): Promise<TicketList> {
  const response = await fetch(`${API_URL}/api/tickets?${params.toString()}`, { headers: { "X-Requester-Id": String(requesterId) } });
  const payload = await response.json() as TicketList & { error?: string };
  if (!response.ok || !payload.meta || !Array.isArray(payload.data)) throw new Error(payload.error ?? "Unable to load Tickets");
  return payload;
}

export async function fetchTicketDetail(requesterId: number, ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, { headers: { "X-Requester-Id": String(requesterId) } });
  const payload = await response.json() as { data?: TicketDetail; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error ?? "Unable to load Ticket");
  return payload.data;
}
export async function uploadAttachments(requesterId: number, ticketId: number, files: File[]): Promise<void> { const form = new FormData(); files.forEach((file) => form.append("files", file)); const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, { method: "POST", headers: { "X-Requester-Id": String(requesterId) }, body: form }); if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? "Unable to upload attachments"); } }
export async function removeAttachment(requesterId: number, ticketId: number, attachmentId: number, reason: string): Promise<void> { const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}`, { method: "DELETE", headers: { "Content-Type": "application/json", "X-Requester-Id": String(requesterId) }, body: JSON.stringify({ reason }) }); if (!response.ok) throw new Error("Unable to remove attachment"); }
export function attachmentDownloadUrl(ticketId: number, attachmentId: number): string { return `${API_URL}/api/tickets/${ticketId}/attachments/${attachmentId}/download`; }

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories?active=true`);
  if (!response.ok) throw new Error("Unable to load Categories");
  const values = (await response.json()) as unknown;
  if (!Array.isArray(values) || !values.every(isCategory)) throw new Error("Unexpected Category response");
  return values;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems?active=true`);
  if (!response.ok) throw new Error("Unable to load Related Systems");
  const values = (await response.json()) as unknown;
  if (!Array.isArray(values) || !values.every((value) => typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).id === "number" && typeof (value as Record<string, unknown>).name === "string")) throw new Error("Unexpected Related System response");
  return values as RelatedSystem[];
}

export async function createTicket(requesterId: number, body: { categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string }, idempotencyKey: string): Promise<CreatedTicket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requester-Id": String(requesterId), "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: CreatedTicket; error?: string; fields?: Record<string, string> };
  if (!response.ok || !payload.data) {
    const error = new Error(payload.error ?? "Unable to create Ticket") as Error & { fields?: Record<string, string> };
    error.fields = payload.fields;
    throw error;
  }
  return payload.data;
}

function isRequester(value: unknown): value is Requester {
  if (typeof value !== "object" || value === null) return false;
  const requester = value as Record<string, unknown>;
  return typeof requester.id === "number" && typeof requester.name === "string" && typeof requester.isActive === "boolean";
}

export async function fetchRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters?active=true`);
  if (!response.ok) throw new Error("Unable to load Development Requesters");
  const requesters = (await response.json()) as unknown;
  if (!Array.isArray(requesters) || !requesters.every(isRequester)) {
    throw new Error("Unexpected Development Requester response");
  }
  return requesters;
}

// Issue 2 checks the backend health endpoint. Issue 4 will extend the system
// check with the categories request after the database work is available.
interface HealthResponse {
  status: string;
  service: string;
}

function isCategory(value: unknown): value is Category {
  if (typeof value !== "object" || value === null) return false;

  const category = value as Record<string, unknown>;
  return typeof category.id === "number" && typeof category.name === "string";
}

export async function checkSystem(): Promise<SystemStatus> {
  const response = await fetch(`${API_URL}/api/health`);

  if (!response.ok) {
    throw new Error("TokTickIT API health check failed");
  }

  const health = (await response.json()) as HealthResponse;

  if (health.status !== "ok" || health.service !== "TokTickIT API") {
    throw new Error("TokTickIT API returned an unexpected health response");
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  if (!categoriesResponse.ok) {
    throw new Error("TokTickIT API category request failed");
  }

  const categories = (await categoriesResponse.json()) as unknown;

  if (!Array.isArray(categories) || !categories.every(isCategory)) {
    throw new Error("TokTickIT API returned an unexpected category response");
  }

  return { online: true, categories };
}
