import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../../src/prisma.js";
import { loginAsRequester, loginAsStaff } from "./auth-fixtures.js";

const prisma = getPrisma();
let ticketId = 0;
let staffFixture: Awaited<ReturnType<typeof loginAsStaff>>;
let requesterFixture: Awaited<ReturnType<typeof loginAsRequester>>;

beforeAll(async () => {
  const requester = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" } });
  const staff = await prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" } });
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: "TKT-DETAIL-" + randomUUID().slice(0, 8),
      submissionKey: randomUUID(),
      submissionHash: randomUUID(),
      requesterId: requester.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Staff detail fixture",
      description: "A ticket used to verify the operational detail workflow.",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
    },
  });
  ticketId = ticket.id;
  staffFixture = await loginAsStaff(staff.id);
  requesterFixture = await loginAsRequester(requester.id);
});

afterAll(async () => {
  await prisma.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe.sequential("Lab 3 Staff Ticket Detail API", () => {
  it("returns operational detail and keeps it outside Requester access", async () => {
    const detail = await staffFixture.agent.get("/api/staff/tickets/" + ticketId);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: ticketId, requestedPriority: "MEDIUM", itPriority: "MEDIUM", ownerId: null });
    expect(detail.body.data).toHaveProperty("attachments");
    expect(detail.body.data).toHaveProperty("publicComments");
    expect(detail.body.data).toHaveProperty("internalNotes");
    const denied = await requesterFixture.agent.get("/api/staff/tickets/" + ticketId);
    expect(denied.status).toBe(403);
  });

  it("updates priority and enforces the approved status transition conditions", async () => {
    const priority = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/priority").set("X-CSRF-Token", staffFixture.csrfToken).send({ itPriority: "URGENT" });
    expect(priority.status).toBe(200);
    expect(priority.body.data.itPriority).toBe("URGENT");
    const missingConfirmation = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/status").set("X-CSRF-Token", staffFixture.csrfToken).send({ status: "CANCELLED" });
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe("VALIDATION_ERROR");
    const invalid = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/status").set("X-CSRF-Token", staffFixture.csrfToken).send({ status: "CLOSED", confirmation: true });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_TRANSITION");
    const claim = await staffFixture.agent.post("/api/staff/tickets/" + ticketId + "/claim").set("X-CSRF-Token", staffFixture.csrfToken).send({});
    expect(claim.status).toBe(200);
    const open = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/status").set("X-CSRF-Token", staffFixture.csrfToken).send({ status: "OPEN" });
    expect(open.status).toBe(200);
    const inProgress = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/status").set("X-CSRF-Token", staffFixture.csrfToken).send({ status: "IN_PROGRESS" });
    expect(inProgress.status).toBe(200);
    const resolved = await staffFixture.agent.patch("/api/staff/tickets/" + ticketId + "/status").set("X-CSRF-Token", staffFixture.csrfToken).send({ status: "RESOLVED", confirmation: true });
    expect(resolved.status).toBe(200);
  });

  it("keeps Public Comments and Internal Notes append-only and role-visible", async () => {
    const comment = await staffFixture.agent.post("/api/staff/tickets/" + ticketId + "/comments").set("X-CSRF-Token", staffFixture.csrfToken).send({ body: "  Staff update  " });
    expect(comment.status).toBe(201);
    expect(comment.body.data.body).toBe("Staff update");
    const note = await staffFixture.agent.post("/api/staff/tickets/" + ticketId + "/internal-notes").set("X-CSRF-Token", staffFixture.csrfToken).send({ body: "  Private triage note  " });
    expect(note.status).toBe(201);
    expect(note.body.data.body).toBe("Private triage note");
    const staffDetail = await staffFixture.agent.get("/api/staff/tickets/" + ticketId);
    expect(staffDetail.body.data.publicComments.some((entry: { body: string }) => entry.body === "Staff update")).toBe(true);
    expect(staffDetail.body.data.internalNotes.some((entry: { body: string }) => entry.body === "Private triage note")).toBe(true);
    const requesterDetail = await requesterFixture.agent.get("/api/tickets/" + ticketId);
    expect(JSON.stringify(requesterDetail.body)).not.toContain("Private triage note");
  });
});
