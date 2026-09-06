import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma(); let ownerId: number; let otherOwnerId: number; const ticketIds: number[] = [];
beforeAll(async () => { const requesters = await prisma.requesterUser.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 }); const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }); const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }); ownerId = requesters[0].id; otherOwnerId = requesters[1].id; for (const summary of ["VPN access issue", "Laptop hardware issue"]) { const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-LIST-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: ownerId, categoryId: category.id, relatedSystemId: system.id, summary, description: `${summary} description`, requestedPriority: "HIGH" } }); ticketIds.push(ticket.id); } const other = await prisma.ticket.create({ data: { ticketNumber: `TKT-OTHER-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: otherOwnerId, categoryId: category.id, relatedSystemId: system.id, summary: "Other requester ticket", description: "Should not be visible", requestedPriority: "LOW" } }); ticketIds.push(other.id); });
afterAll(async () => { await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } }); await prisma.$disconnect(); });

describe("GET /api/tickets", () => {
  it("returns only owned tickets and supports search/filter/sort metadata", async () => { const res = await request(app).get("/api/tickets").set("X-Requester-Id", String(ownerId)).query({ search: "vpn", requestedPriority: "HIGH", sortBy: "summary", sortDirection: "asc", page: 1, pageSize: 10 }); expect(res.status).toBe(200); expect(res.body.data).toHaveLength(1); expect(res.body.data[0].summary).toBe("VPN access issue"); expect(res.body.meta.page).toBe(1); });
  it("does not expose another Requester's ticket", async () => { const res = await request(app).get("/api/tickets").set("X-Requester-Id", String(ownerId)).query({ search: "other requester" }); expect(res.status).toBe(200); expect(res.body.data).toEqual([]); });
});
