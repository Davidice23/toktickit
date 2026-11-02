import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

/**
 * These tests prove that the Lab 4 test command discovers executable checks
 * without claiming that the future Actions Taken feature already exists.
 * Neither request carries a session cookie, so this smoke test must not open
 * or mutate a database connection.
 */
describe("Lab 4 CI foundation smoke", () => {
  it("keeps the API health contract available", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "TokTickIT API" });
  });

  it("rejects an anonymous request before protected Ticket data is read", async () => {
    const response = await request(app).get("/api/tickets");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication is required" },
    });
  });
});
