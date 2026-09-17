import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const password = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";

describe.sequential("Lab 3 authentication/session contract", () => {
  const agent = request.agent(app);
  let csrfToken = "";
  let email = "";

  beforeAll(async () => {
    const user = await getPrisma().requesterUser.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
    email = user.email;
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("logs in with a safe User response and HttpOnly session cookie", async () => {
    const response = await agent.post("/api/auth/login").send({ email, password });
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    const cookies = response.headers["set-cookie"]?.join(";") ?? "";
    expect(cookies).toContain("toktickit_session=");
    expect(cookies).toContain("HttpOnly");
    csrfToken = response.body.data.csrfToken;
  });

  it("returns the authenticated user and rotates a CSRF token", async () => {
    const response = await agent.get("/api/auth/me");
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    csrfToken = response.body.data.csrfToken;
  });

  it("requires CSRF for authenticated mutations", async () => {
    const response = await agent.post("/api/auth/logout");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("logs out and revokes the old session", async () => {
    const response = await agent.post("/api/auth/logout").set("X-CSRF-Token", csrfToken);
    expect(response.status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("does not disclose whether an account exists", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "missing@example.test", password });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
