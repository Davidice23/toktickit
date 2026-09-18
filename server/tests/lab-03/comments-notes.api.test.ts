import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRequester } from "./auth-fixtures.js";

const prisma = getPrisma();
let ticketId = 0;
let requesterId = 0;
let fixture: Awaited<ReturnType<typeof loginAsRequester>>;

beforeAll(async () => {
  const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  requesterId = requester.id;
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-COMMENT-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId, categoryId: category.id, relatedSystemId: system.id, summary: "Comment contract test", description: "Verifies public comments and requester resolution.", requestedPriority: "LOW" } });
  ticketId = ticket.id;
  await prisma.internalNote.create({ data: { ticketId, authorId: requesterId, body: "Requester must never receive this internal note." } });
  fixture = await loginAsRequester(requesterId);
});

afterAll(async () => { await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined); await prisma.$disconnect(); });

describe.sequential("Lab 3 Public Comment and requester resolution contract", () => {
  it("creates and reads an owned Public Comment in oldest-first order", async () => {
    const created = await fixture.agent.post(`/api/tickets/${ticketId}/comments`).set("X-CSRF-Token", fixture.csrfToken).send({ body: "  Please let me know when this is resolved.  " });
    expect(created.status).toBe(201);
    expect(created.body.data.body).toBe("Please let me know when this is resolved.");
    const listed = await fixture.agent.get(`/api/tickets/${ticketId}/comments`);
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].body).toBe("Please let me know when this is resolved.");
  });

  it("keeps Internal Notes out of Requester detail and rejects blank/oversized comments", async () => {
    const detail = await fixture.agent.get(`/api/tickets/${ticketId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.publicComments).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toContain("Requester must never receive this internal note.");
    const blank = await fixture.agent.post(`/api/tickets/${ticketId}/comments`).set("X-CSRF-Token", fixture.csrfToken).send({ body: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.error.code).toBe("CONTENT_REQUIRED");
    const long = await fixture.agent.post(`/api/tickets/${ticketId}/comments`).set("X-CSRF-Token", fixture.csrfToken).send({ body: "x".repeat(2001) });
    expect(long.status).toBe(400);
    expect(long.body.error.code).toBe("CONTENT_TOO_LONG");
  });

  it("records requester resolution idempotently without changing formal status", async () => {
    const first = await fixture.agent.post(`/api/tickets/${ticketId}/requester-resolution`).set("X-CSRF-Token", fixture.csrfToken).send({});
    const second = await fixture.agent.post(`/api/tickets/${ticketId}/requester-resolution`).set("X-CSRF-Token", fixture.csrfToken).send({});
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.requesterConfirmedResolved).toBe(true);
    expect(second.body.data.requesterConfirmedResolved).toBe(true);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { currentStatus: true, requesterConfirmedResolved: true } });
    expect(stored.currentStatus).toBe("NEW");
    expect(stored.requesterConfirmedResolved).toBe(true);
  });
});