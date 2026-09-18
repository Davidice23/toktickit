import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRequester, loginAsStaff } from "./auth-fixtures.js";

const prisma = getPrisma();
let ticketId = 0;
let requesterFixture: Awaited<ReturnType<typeof loginAsRequester>>;
let staffFixture: Awaited<ReturnType<typeof loginAsStaff>>;
let secondStaffFixture: Awaited<ReturnType<typeof loginAsStaff>>;

beforeAll(async () => {
  const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
  const staff = await prisma.requesterUser.findMany({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" }, take: 2 });
  if (staff.length < 2) throw new Error("Staff queue fixtures require two active IT Staff users");
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: "TKT-STAFF-" + randomUUID().slice(0, 8),
      submissionKey: randomUUID(),
      submissionHash: randomUUID(),
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Staff queue fixture",
      description: "A ticket used to verify staff queue filtering and ownership.",
      requestedPriority: "HIGH",
      itPriority: "HIGH",
    },
  });
  ticketId = ticket.id;
  requesterFixture = await loginAsRequester(requester.id);
  staffFixture = await loginAsStaff(staff[0].id);
  secondStaffFixture = await loginAsStaff(staff[1].id);
});

afterAll(async () => {
  await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe.sequential("Lab 3 Staff Queue API", () => {
  it("requires authentication and denies Requester access", async () => {
    expect((await request(app).get("/api/staff/tickets")).status).toBe(401);
    const denied = await requesterFixture.agent.get("/api/staff/tickets");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
  });

  it("returns queue rows with deterministic pagination and filters", async () => {
    const response = await staffFixture.agent.get("/api/staff/tickets?pageSize=10&owner=unassigned&search=Staff%20queue");
    expect(response.status).toBe(200);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 10 });
    expect(response.body.data.some((row: { id: number }) => row.id === ticketId)).toBe(true);
    expect(response.body.data[0]).toMatchObject({ requestedPriority: "HIGH", itPriority: "HIGH", ownerId: null });
  });

  it("rejects invalid queue parameters with a structured validation error", async () => {
    const response = await staffFixture.agent.get("/api/staff/tickets?pageSize=15&sortBy=unknown");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toMatchObject({ pageSize: expect.any(String), sortBy: expect.any(String) });
  });

  it("atomically claims once and reports a claim conflict", async () => {
    const claimed = await staffFixture.agent.post("/api/staff/tickets/" + ticketId + "/claim").set("X-CSRF-Token", staffFixture.csrfToken).send({});
    expect(claimed.status).toBe(200);
    expect(claimed.body.data.owner.id).toBe(staffFixture.userId);
    const conflict = await secondStaffFixture.agent.post("/api/staff/tickets/" + ticketId + "/claim").set("X-CSRF-Token", secondStaffFixture.csrfToken).send({});
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CLAIM_CONFLICT");
  });
});
