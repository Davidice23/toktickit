import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
let requesterId: number;
let categoryId: number;
let relatedSystemId: number;

beforeAll(async () => {
  const [requester, category, system] = await Promise.all([
    prisma.requesterUser.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
  ]);
  requesterId = requester.id;
  categoryId = category.id;
  relatedSystemId = system.id;
});

afterAll(async () => { await prisma.$disconnect(); });

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId,
    relatedSystemId,
    summary: "Laptop battery drains quickly",
    description: "Battery capacity falls from 100% to 20% in one hour.",
    requestedPriority: "MEDIUM",
    ...overrides,
  };
}

describe("POST /api/tickets", () => {
  it("creates one owned NEW Ticket with a backend number", async () => {
    const key = randomUUID();
    const res = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).set("Idempotency-Key", key).send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");
    expect(res.body.data.requesterId).toBe(requesterId);
  });

  it("replays the same key and rejects a changed payload", async () => {
    const key = randomUUID();
    const first = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).set("Idempotency-Key", key).send(validBody({ summary: "Printer cannot connect" }));
    const replay = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).set("Idempotency-Key", key).send(validBody({ summary: "Printer cannot connect" }));
    const conflict = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).set("Idempotency-Key", key).send(validBody({ summary: "Different request" }));
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotent-replay"]).toBe("true");
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(conflict.status).toBe(409);
  });

  it("returns field-level validation and never creates an invalid row", async () => {
    const res = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).set("Idempotency-Key", randomUUID()).send(validBody({ summary: "x", requestedPriority: "INVALID" }));
    expect(res.status).toBe(400);
    expect(res.body.fields).toMatchObject({ summary: expect.any(String), requestedPriority: expect.any(String) });
  });
});
