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
