import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma(); let ownerId: number; let ticketId: number; let attachmentId: number;
beforeAll(async () => { const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }); const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }); const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }); ownerId = requester.id; const ticket = await prisma.ticket.create({ data: { ticketNumber: `TKT-ATT-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(), requesterId: ownerId, categoryId: category.id, relatedSystemId: system.id, summary: "Attachment test", description: "Attachment lifecycle test", requestedPriority: "LOW" } }); ticketId = ticket.id; });
afterAll(async () => { await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined); await prisma.$disconnect(); });

describe("Attachment lifecycle", () => {
  it("uploads, downloads, and soft-removes an owned attachment", async () => {
    const upload = await request(app).post(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(ownerId)).attach("files", Buffer.from("hello"), { filename: "hello.txt", contentType: "application/pdf" });
    expect(upload.status).toBe(201); attachmentId = upload.body.data[0].id;
    const download = await request(app).get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`).set("X-Requester-Id", String(ownerId));
    expect(download.status).toBe(200); expect(download.headers["content-disposition"]).toContain("hello.txt");
    const removed = await request(app).delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`).set("X-Requester-Id", String(ownerId)).send({ reason: "No longer needed" });
    expect(removed.status).toBe(200);
    expect((await request(app).get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`).set("X-Requester-Id", String(ownerId))).status).toBe(404);
  });

  it("rejects unsupported types", async () => { const res = await request(app).post(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(ownerId)).attach("files", Buffer.from("hello"), { filename: "hello.exe", contentType: "application/octet-stream" }); expect(res.status).toBe(400); });
});
