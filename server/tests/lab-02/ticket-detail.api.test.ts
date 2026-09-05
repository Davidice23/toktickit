import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
let ownerId: number;
let otherOwnerId: number;
let ticketId: number;

beforeAll(async () => {
  const requesters = await prisma.requesterUser.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  ownerId = requesters[0].id; otherOwnerId = requesters[1].id;
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-TEST-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: ownerId, categoryId: category.id, relatedSystemId: system.id, summary: "Detail test ticket", description: "A ticket used to verify owned detail responses.", requestedPriority: "LOW" } });
  ticketId = ticket.id;
});

afterAll(async () => { await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined); await prisma.$disconnect(); });

describe("GET /api/tickets/:ticketId", () => {
  it("returns a read-only owned detail", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(ownerId));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ticketId);
    expect(res.body.data.attachments).toEqual([]);
  });

  it("uses the same safe 404 for cross-owner and missing tickets", async () => {
    const crossOwner = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(otherOwnerId));
    const missing = await request(app).get("/api/tickets/999999").set("X-Requester-Id", String(ownerId));
    expect(crossOwner.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
  });
});
