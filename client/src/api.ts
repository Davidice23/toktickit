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
