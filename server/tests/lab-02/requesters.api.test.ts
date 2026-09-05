import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import * as prismaModule from "../../src/prisma.js";

afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prismaModule.getPrisma().$disconnect(); });

describe("GET /api/requesters", () => {
  it("returns only active requesters in name/ID order", async () => {
    const res = await request(app).get("/api/requesters?active=true");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.every((requester: { isActive: boolean }) => requester.isActive)).toBe(true);
    expect(res.body.map((requester: { name: string }) => requester.name)).toEqual([
      "Anan Chaiya", "Kanya Prasert", "Narin Sombat", "Pimchanok Dee",
    ]);
  });

  it("returns a safe error when the database is unavailable", async () => {
    vi.spyOn(prismaModule, "getPrisma").mockReturnValue({
      requesterUser: { findMany: vi.fn().mockRejectedValue(new Error("sensitive details")) },
    } as unknown as ReturnType<typeof prismaModule.getPrisma>);

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Unable to load Development Requesters" });
    expect(JSON.stringify(res.body)).not.toContain("sensitive details");
  });
});
