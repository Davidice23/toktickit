import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { app } from "../../src/app.js";
import { loginAsRequester } from "./auth-fixtures.js";

const prisma = getPrisma();
let ownerId = 0;
let otherOwnerId = 0;
let ticketId = 0;
let ownerAgent: Awaited<ReturnType<typeof loginAsRequester>>;
let otherAgent: Awaited<ReturnType<typeof loginAsRequester>>;

beforeAll(async () => {
  const users = await prisma.requesterUser.findMany({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" }, take: 2 });
  ownerId = users[0].id;
  otherOwnerId = users[1].id;
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-AUTH-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: ownerId, categoryId: category.id, relatedSystemId: system.id, summary: "Authenticated ownership test", description: "Verifies that ownership is taken from the current session.", requestedPriority: "LOW" } });
  ticketId = ticket.id;
  ownerAgent = await loginAsRequester(ownerId);
  otherAgent = await loginAsRequester(otherOwnerId);
});

afterAll(async () => { await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined); await prisma.$disconnect(); });

describe.sequential("Lab 3 requester authorization", () => {
  it("rejects an unauthenticated Ticket request", async () => {
    const response = await (await import("supertest")).default(app).get(`/api/tickets/${ticketId}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("derives ownership from the session and ignores a spoofed legacy header", async () => {
    const response = await ownerAgent.agent.get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(otherOwnerId));
    expect(response.status).toBe(200);
    expect(response.body.data.requesterId).toBe(ownerId);
  });

  it("returns the same safe 404 for a cross-owner resource", async () => {
    const response = await otherAgent.agent.get(`/api/tickets/${ticketId}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("requires the session CSRF token for Ticket creation", async () => {
    const response = await ownerAgent.agent.post("/api/tickets").set("Idempotency-Key", randomUUID()).send({ categoryId: 1, relatedSystemId: 1, summary: "Missing CSRF", description: "This request should be rejected before validation.", requestedPriority: "LOW" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });
});