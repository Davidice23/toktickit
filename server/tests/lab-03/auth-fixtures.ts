import request, { type SuperAgentTest } from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const password = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";

export async function loginAsRequester(userId?: number): Promise<{ agent: SuperAgentTest; userId: number; csrfToken: string }> {
  const user = await getPrisma().requesterUser.findFirstOrThrow({
    where: { isActive: true, role: "REQUESTER", ...(userId ? { id: userId } : {}) },
    orderBy: { id: "asc" },
  });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: user.email, password });
  if (response.status !== 200) throw new Error(`Fixture login failed with status ${response.status}`);
  let csrfToken = response.body.data.csrfToken as string;
  if (response.body.data.mustChangePassword) {
    const changed = await agent.post("/api/auth/change-password").set("X-CSRF-Token", csrfToken).send({ currentPassword: password, newPassword: password, confirmPassword: password });
    if (changed.status !== 200) throw new Error(`Fixture password change failed with status ${changed.status}`);
    csrfToken = changed.body.data.csrfToken as string;
  }
  return { agent, userId: user.id, csrfToken };
}