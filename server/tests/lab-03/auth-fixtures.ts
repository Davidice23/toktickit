import request, { type SuperAgentTest } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const password = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";

export async function loginAsUser(role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", userId?: number): Promise<{ agent: SuperAgentTest; userId: number; csrfToken: string }> {
  const prisma = getPrisma();
  const user = await prisma.requesterUser.findFirstOrThrow({
    where: { isActive: true, role, ...(userId ? { id: userId } : {}) },
    orderBy: { id: "asc" },
  });
  if (user.mustChangePassword) {
    await prisma.requesterUser.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  }
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: user.email, password });
  if (response.status !== 200) throw new Error("Fixture login failed with status " + response.status);
  return { agent, userId: user.id, csrfToken: response.body.data.csrfToken as string };
}

export async function loginAsRequester(userId?: number) {
  return loginAsUser("REQUESTER", userId);
}

export async function loginAsStaff(userId?: number) {
  return loginAsUser("IT_STAFF", userId);
}

export async function loginAsAdministrator(userId?: number) {
  return loginAsUser("ADMINISTRATOR", userId);
}
