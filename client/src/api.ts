const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 checks the backend health endpoint. Issue 4 will extend the system
// check with the categories request after the database work is available.
interface HealthResponse {
  status: string;
  service: string;
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

  // Issue 4 will extend this request with categories from PostgreSQL.
  return { online: true, categories: [] };
}
