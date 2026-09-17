import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SuperAgentTest } from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRequester } from "../lab-03/auth-fixtures.js";

const prisma = getPrisma();
let ownerId: number;
let ticketId: number;
let attachmentId: number;
let agent: SuperAgentTest;
let csrfToken = "";

beforeAll(async () => {
  const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  ownerId = requester.id;
  const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-ATT-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: ownerId, categoryId: category.id, relatedSystemId: system.id, summary: "Attachment test", description: "Attachment lifecycle test", requestedPriority: "LOW" } });
  ticketId = ticket.id;
  const fixture = await loginAsRequester(ownerId);
  agent = fixture.agent;
  csrfToken = fixture.csrfToken;
});

afterAll(async () => { await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined); await prisma.$disconnect(); });

describe("Attachment lifecycle", () => {
  it("uploads, downloads, and soft-removes an owned attachment", async () => {
    const upload = await agent.post(`/api/tickets/${ticketId}/attachments`).set("X-CSRF-Token", csrfToken).attach("files", Buffer.from("%PDF-1.4\nhello"), { filename: "hello.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201); attachmentId = upload.body.data[0].id;
    const download = await agent.get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`);
    expect(download.status).toBe(200); expect(download.headers["content-disposition"]).toContain("hello.pdf");
    const removed = await agent.delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`).set("X-CSRF-Token", csrfToken).send({ reason: "No longer needed" });
    expect(removed.status).toBe(200);
    expect((await agent.get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`)).status).toBe(404);
  });

  it("rejects unsupported types", async () => { const res = await agent.post(`/api/tickets/${ticketId}/attachments`).set("X-CSRF-Token", csrfToken).attach("files", Buffer.from("hello"), { filename: "hello.exe", contentType: "application/octet-stream" }); expect(res.status).toBe(400); expect(res.body.error.code).toBe("VALIDATION_ERROR"); });
});