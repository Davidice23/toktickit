import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";

async function loginFixture(userId: number) {
  const user = await prisma.requesterUser.findUniqueOrThrow({ where: { id: userId } });
  if (user.mustChangePassword) await prisma.requesterUser.update({ where: { id: userId }, data: { mustChangePassword: false } });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: user.email, password: initialPassword });
  if (response.status !== 200) throw new Error("Lab 4 API fixture login failed with status " + response.status);
  return { agent, userId, csrfToken: response.body.data.csrfToken as string };
}

type Login = Awaited<ReturnType<typeof loginFixture>>;
let staff: Login;
let requesterA: Login;
let requesterB: Login;
let admin: Login;
let inactiveStaffId = 0;
let categoryId = 0;
let relatedSystemId = 0;
let setupReady = false;
const fixtureTicketIds: number[] = [];

function assertDisposableTestDatabase() {
  try {
    const raw = process.env.DATABASE_URL;
    if (process.env.NODE_ENV !== "test" || !raw) throw new Error();
    const database = new URL(raw);
    const name = decodeURIComponent(database.pathname.replace(/^\//, ""));
    if (!new Set(["localhost", "127.0.0.1", "::1"]).has(database.hostname) || name !== "toktickit_test") throw new Error();
  } catch {
    throw new Error("Lab 4 API integration tests require NODE_ENV=test and the disposable local toktickit_test database; no data was changed.");
  }
}

async function makeTicket(requesterId = requesterA.userId) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-L4-ACTION-${randomUUID().slice(0, 8)}`,
      submissionKey: randomUUID(),
      submissionHash: randomUUID(),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Lab 4 Action API fixture",
      description: "Disposable ticket created by the isolated Lab 4 API integration test.",
      requestedPriority: "MEDIUM",
    },
    select: { id: true },
  });
  fixtureTicketIds.push(ticket.id);
  return ticket.id;
}

async function createAction(ticketId: number, key = randomUUID(), overrides: Record<string, unknown> = {}) {
  return staff.agent
    .post(`/api/staff/tickets/${ticketId}/actions`)
    .set("X-CSRF-Token", staff.csrfToken)
    .set("Idempotency-Key", key)
    .send({
      expectedTicketVersion: 1,
      assigneeId: staff.userId,
      description: "  Inspect the reported issue.  ",
      followUpRequired: false,
      ...overrides,
    });
}

async function cleanupFixtureTickets() {
  for (const ticketId of fixtureTicketIds.splice(0)) {
    const actions = await prisma.actionTaken.findMany({ where: { ticketId }, select: { id: true } });
    const actionIds = actions.map((action) => action.id);
    if (actionIds.length) {
      await prisma.actionCreateReceipt.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTakenEvent.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTaken.deleteMany({ where: { id: { in: actionIds } } });
    }
    await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
}

beforeAll(async () => {
  assertDisposableTestDatabase();
  const [requesters, staffUser, adminUser, inactive, category, system] = await Promise.all([
    prisma.requesterUser.findMany({ where: { isActive: true, role: "REQUESTER" }, orderBy: { id: "asc" }, take: 2, select: { id: true } }),
    prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "IT_STAFF" }, orderBy: { id: "asc" }, select: { id: true } }),
    prisma.requesterUser.findFirstOrThrow({ where: { isActive: true, role: "ADMINISTRATOR" }, orderBy: { id: "asc" }, select: { id: true } }),
    prisma.requesterUser.findFirstOrThrow({ where: { isActive: false, role: "IT_STAFF" }, orderBy: { id: "asc" }, select: { id: true } }),
    prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
  ]);
  if (requesters.length !== 2) throw new Error("Lab 4 API tests require two active Requester fixtures");
  [requesterA, requesterB, staff, admin] = await Promise.all([
    loginFixture(requesters[0].id),
    loginFixture(requesters[1].id),
    loginFixture(staffUser.id),
    loginFixture(adminUser.id),
  ]);
  inactiveStaffId = inactive.id;
  categoryId = category.id;
  relatedSystemId = system.id;
  setupReady = true;
});

afterEach(async () => {
  if (setupReady) await cleanupFixtureTickets();
});

afterAll(async () => {
  if (setupReady) await prisma.$disconnect();
});

describe.sequential("Lab 4 Actions Taken API and authorization", () => {
  it("lists only active operational assignees to Staff/Admin without exposing account details", async () => {
    const anonymous = await request(app).get("/api/staff/operational-users");
    expect(anonymous.status).toBe(401);
    const requesterDenied = await requesterA.agent.get("/api/staff/operational-users");
    expect(requesterDenied.status).toBe(403);

    const staffName = await prisma.requesterUser.findUniqueOrThrow({ where: { id: staff.userId }, select: { name: true } });
    const search = encodeURIComponent(staffName.name.slice(0, 6));
    const staffResponse = await staff.agent.get(`/api/staff/operational-users?search=${search}&pageSize=10`);
    const adminResponse = await admin.agent.get(`/api/staff/operational-users?search=${search}&pageSize=10`);
    expect(staffResponse.status).toBe(200);
    expect(adminResponse.status).toBe(200);
    expect(staffResponse.body).toEqual(adminResponse.body);
    expect(staffResponse.body.data).toContainEqual({ id: staff.userId, name: staffName.name, role: "IT_STAFF" });
    expect(staffResponse.body.data.every((candidate: { role: string }) => ["IT_STAFF", "ADMINISTRATOR"].includes(candidate.role))).toBe(true);
    expect(staffResponse.body.data[0]).not.toHaveProperty("email");
    expect(staffResponse.body.data[0]).not.toHaveProperty("isActive");

    const fullDirectory = await staff.agent.get("/api/staff/operational-users?pageSize=50");
    expect(fullDirectory.body.data).toContainEqual(expect.objectContaining({ id: staff.userId, role: "IT_STAFF" }));
    expect(fullDirectory.body.data).toContainEqual(expect.objectContaining({ id: admin.userId, role: "ADMINISTRATOR" }));
    expect(fullDirectory.body.data).not.toContainEqual(expect.objectContaining({ id: inactiveStaffId }));

    const invalidPageSize = await staff.agent.get("/api/staff/operational-users?pageSize=100");
    expect(invalidPageSize.status).toBe(400);
    expect(invalidPageSize.body.error.fields.pageSize).toBeTruthy();
  });

  it("requires a session, role, and CSRF for writes", async () => {
    const ticketId = await makeTicket();
    const noSession = await request(app).get(`/api/staff/tickets/${ticketId}/actions`);
    expect(noSession.status).toBe(401);
    const requesterDenied = await requesterA.agent.get(`/api/staff/tickets/${ticketId}/actions`);
    expect(requesterDenied.status).toBe(403);
    const requesterMutation = await requesterA.agent.post(`/api/staff/tickets/${ticketId}/actions`)
      .set("X-CSRF-Token", requesterA.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedTicketVersion: 1, assigneeId: staff.userId, description: "Must remain forbidden" });
    expect(requesterMutation.status).toBe(403);
    const missingCsrf = await staff.agent.post(`/api/staff/tickets/${ticketId}/actions`).set("Idempotency-Key", randomUUID()).send({});
    expect(missingCsrf.status).toBe(403);
  });

  it("creates a session-authored Action and safely supports an idempotent retry", async () => {
    const ticketId = await makeTicket();
    const ticketOwner = await prisma.requesterUser.findFirstOrThrow({ where: { id: { not: staff.userId }, isActive: true, role: "IT_STAFF" }, select: { id: true } });
    await prisma.ticket.update({ where: { id: ticketId }, data: { ownerId: ticketOwner.id } });
    const key = randomUUID();
    const payload = {
      expectedTicketVersion: 1,
      assigneeId: staff.userId,
      description: "  Inspect the reported issue.  ",
      followUpRequired: false,
    };
    const created = await createAction(ticketId, key, payload);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      ticketId,
      status: "PLANNED",
      description: "Inspect the reported issue.",
      followUpRequired: false,
      assignee: { id: staff.userId },
      performedBy: null,
      version: 1,
    });
    expect(created.body).not.toHaveProperty("data.createdById");
    expect(created.body.meta.ticketVersion).toBe(2);
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { ownerId: true } });
    expect(ticket.ownerId).toBe(ticketOwner.id);
    expect(ticket.ownerId).not.toBe(created.body.data.assignee.id);

    const replay = await createAction(ticketId, key, payload);
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(created.body.data.id);
    expect(replay.body.meta.ticketVersion).toBe(2);
    const changedReplay = await createAction(ticketId, key, { ...payload, description: "A different request." });
    expect(changedReplay.status).toBe(409);
    expect(changedReplay.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    const staleCreate = await createAction(ticketId, randomUUID(), payload);
    expect(staleCreate.status).toBe(409);
    expect(staleCreate.body.error.code).toBe("STALE_VERSION");

    const requesterList = await requesterA.agent.get(`/api/tickets/${ticketId}/actions`);
    expect(requesterList.status).toBe(200);
    expect(requesterList.body.data).toHaveLength(1);
    expect(requesterList.body.data[0].assignee).toEqual({ id: staff.userId, name: expect.any(String) });
    expect(requesterList.body.data[0].assignee).not.toHaveProperty("role");
    expect(requesterList.body.data[0].assignee).not.toHaveProperty("isActive");
    expect(JSON.stringify(requesterList.body)).not.toContain("createdById");
    expect(JSON.stringify(requesterList.body)).not.toContain("requestFingerprint");
    const hiddenTicket = await requesterB.agent.get(`/api/tickets/${ticketId}/actions`);
    expect(hiddenTicket.status).toBe(404);
    const invalidPage = await requesterA.agent.get(`/api/tickets/${ticketId}/actions?pageSize=100`);
    expect(invalidPage.status).toBe(400);
    expect(invalidPage.body.error.fields.pageSize).toBeTruthy();
    const staffList = await admin.agent.get(`/api/staff/tickets/${ticketId}/actions`);
    expect(staffList.status).toBe(200);
    expect(staffList.body.meta.totalItems).toBe(1);
    const history = await staff.agent.get(`/api/staff/tickets/${ticketId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ source: "ACTION", kind: "CREATED", actor: { id: staff.userId } });
    await prisma.internalNote.create({ data: { ticketId, authorId: staff.userId, body: "Private note must never appear in Action history" } });
    const historyWithPrivateNotePresent = await staff.agent.get(`/api/staff/tickets/${ticketId}/history`);
    expect(JSON.stringify(historyWithPrivateNotePresent.body)).not.toContain("Private note must never appear");
    const requesterHistory = await requesterA.agent.get(`/api/staff/tickets/${ticketId}/history`);
    expect(requesterHistory.status).toBe(403);

    const edit = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${created.body.data.id}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, description: "Edited after creation" });
    expect(edit.status).toBe(200);
    const retryAfterEdit = await createAction(ticketId, key, payload);
    expect(retryAfterEdit.status).toBe(200);
    expect(retryAfterEdit.body).toEqual(created.body);
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
    expect(await prisma.actionTakenEvent.count({ where: { actionId: created.body.data.id } })).toBe(2);

    const adminTicketId = await makeTicket();
    const adminCreated = await admin.agent.post(`/api/staff/tickets/${adminTicketId}/actions`)
      .set("X-CSRF-Token", admin.csrfToken)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedTicketVersion: 1, assigneeId: staff.userId, description: "Administrator-created Action" });
    expect(adminCreated.status).toBe(201);
    const adminAction = await prisma.actionTaken.findUniqueOrThrow({ where: { id: adminCreated.body.data.id }, select: { createdById: true } });
    expect(adminAction.createdById).toBe(admin.userId);
  });

  it("lets an owner and Staff read Actions beyond the first 100 pages", async () => {
    const ticketId = await makeTicket();
    await prisma.actionTaken.createMany({ data: Array.from({ length: 1001 }, (_, index) => ({
      ticketId, assigneeId: staff.userId, createdById: staff.userId,
      description: `Pagination fixture ${index}`, idempotencyKey: randomUUID(), requestFingerprint: randomUUID(),
    })) });
    const ownerPage = await requesterA.agent.get(`/api/tickets/${ticketId}/actions?page=101&pageSize=10`);
    expect(ownerPage.status).toBe(200);
    expect(ownerPage.body.data).toHaveLength(1);
    expect(ownerPage.body.meta).toMatchObject({ page: 101, totalItems: 1001, totalPages: 101, hasNextPage: false });
    const staffPage = await staff.agent.get(`/api/staff/tickets/${ticketId}/actions?page=101&pageSize=10`);
    expect(staffPage.status).toBe(200);
    expect(staffPage.body.data[0].id).toBe(ownerPage.body.data[0].id);
    const otherRequester = await requesterB.agent.get(`/api/tickets/${ticketId}/actions?page=101&pageSize=10`);
    expect(otherRequester.status).toBe(404);
  });

  it("fails closed if a matching historical Action has no original retry receipt", async () => {
    const ticketId = await makeTicket();
    const key = randomUUID();
    const created = await createAction(ticketId, key);
    expect(created.status).toBe(201);
    await prisma.actionCreateReceipt.delete({ where: { actionId: created.body.data.id } });
    const replay = await createAction(ticketId, key);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("IDEMPOTENCY_RECEIPT_UNAVAILABLE");
    expect(await prisma.actionTaken.count({ where: { ticketId } })).toBe(1);
  });

  it("enforces consistent follow-up and attachment-note rules without invalid writes", async () => {
    const ticketId = await makeTicket();
    const rejectedCreate = await createAction(ticketId, randomUUID(), { followUpRequired: false, followUpNote: "Unexpected note" });
    expect(rejectedCreate.status).toBe(400);
    expect(rejectedCreate.body.error.fields.followUpNote).toBeTruthy();
    const blankAttachment = await createAction(ticketId, randomUUID(), { attachmentNotes: "   " });
    expect(blankAttachment.status).toBe(201);
    expect(blankAttachment.body.data.attachmentNotes).toBeNull();
    const actionId = blankAttachment.body.data.id;
    const rejectedPatch = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, followUpNote: "Unexpected note" });
    expect(rejectedPatch.status).toBe(400);
    const rejectedComplete = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "COMPLETED", result: "Done", followUpNote: "Unexpected note" });
    expect(rejectedComplete.status).toBe(400);
    const unchanged = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { workflowVersion: true, actions: { select: { followUpRequired: true, followUpNote: true, version: true } } } });
    expect(unchanged).toMatchObject({ workflowVersion: 2, actions: [{ followUpRequired: false, followUpNote: null, version: 1 }] });

    // Preserve any pre-existing inconsistent note until the user explicitly clears it.
    await prisma.actionTaken.update({ where: { id: actionId }, data: { followUpNote: "Legacy note" } });
    const legacyEdit = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, description: "Do not silently erase note" });
    expect(legacyEdit.status).toBe(400);
    const legacyComplete = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "COMPLETED", result: "Done" });
    expect(legacyComplete.status).toBe(400);
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } })).followUpNote).toBe("Legacy note");
    const explicitClear = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, followUpNote: null });
    expect(explicitClear.status).toBe(200);
    expect(explicitClear.body.data.followUpNote).toBeNull();

    const secondTicket = await makeTicket();
    const withAttachment = await createAction(secondTicket, randomUUID(), { attachmentNotes: "Original note" });
    const cleared = await staff.agent.patch(`/api/staff/tickets/${secondTicket}/actions/${withAttachment.body.data.id}`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, attachmentNotes: "  " });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.attachmentNotes).toBeNull();
  });

  it("returns mixed-source history past page 100 with consistent fields and deterministic ties", async () => {
    const ticketId = await makeTicket();
    const created = await createAction(ticketId);
    expect(created.status).toBe(201);
    const sameTime = new Date("2025-01-01T00:00:00.000Z");
    await prisma.actionTakenEvent.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
      actionId: created.body.data.id as number, actorId: staff.userId, kind: "EDITED" as const,
      fieldName: "description", newValue: `History fixture ${index}`, createdAt: sameTime,
    })) });
    const ticketEvent = await prisma.ticketWorkflowEvent.create({ data: { ticketId, actorId: staff.userId, previousStatus: "NEW", currentStatus: "OPEN", confirmation: true, createdAt: sameTime } });
    const first = await staff.agent.get(`/api/staff/tickets/${ticketId}/history?page=1&pageSize=10`);
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(10);
    expect(first.body.data.every((row: { source: string; confirmation: boolean | null }) => row.source === "ACTION" && row.confirmation === null)).toBe(true);
    const last = await staff.agent.get(`/api/staff/tickets/${ticketId}/history?page=101&pageSize=10`);
    expect(last.status).toBe(200);
    expect(last.body.meta).toMatchObject({ totalItems: 1002, page: 101, totalPages: 101 });
    expect(last.body.data).toHaveLength(2);
    expect(last.body.data[0]).toMatchObject({ id: `ticket:${ticketEvent.id}`, source: "TICKET", confirmation: true });
    expect(last.body.data[1]).toMatchObject({ source: "ACTION", kind: "CREATED", confirmation: null });
    const requester = await requesterA.agent.get(`/api/staff/tickets/${ticketId}/history?page=101&pageSize=10`);
    expect(requester.status).toBe(403);
  });

  it("rejects inactive assignees, invalid content, and client-controlled audit fields without writes", async () => {
    const ticketId = await makeTicket();
    const inactive = await createAction(ticketId, randomUUID(), { assigneeId: inactiveStaffId });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.fields.assigneeId).toBeTruthy();
    const requesterAssignee = await createAction(ticketId, randomUUID(), { assigneeId: requesterA.userId });
    expect(requesterAssignee.status).toBe(400);
    expect(requesterAssignee.body.error.fields.assigneeId).toBeTruthy();
    const blank = await createAction(ticketId, randomUUID(), { description: "   " });
    expect(blank.status).toBe(400);
    const tooLong = await createAction(ticketId, randomUUID(), { description: "x".repeat(2001) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.fields.description).toBeTruthy();
    const spoof = await createAction(ticketId, randomUUID(), { createdById: requesterA.userId, performedById: requesterA.userId });
    expect(spoof.status).toBe(400);
    const snapshot = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { workflowVersion: true, actions: { select: { id: true } } } });
    expect(snapshot).toMatchObject({ workflowVersion: 1, actions: [] });
  });

  it("serializes concurrent Action creates through the parent Ticket version", async () => {
    const ticketId = await makeTicket();
    const [first, second] = await Promise.all([
      createAction(ticketId, randomUUID()),
      createAction(ticketId, randomUUID(), { description: "A concurrent diagnostic plan." }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.body.error.code).toBe("STALE_VERSION");
    const persisted = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { workflowVersion: true, actions: { select: { id: true, events: { select: { id: true } } } } },
    });
    expect(persisted.workflowVersion).toBe(2);
    expect(persisted.actions).toHaveLength(1);
    expect(persisted.actions[0].events).toHaveLength(1);
  });

  it("edits and reassigns a non-terminal Action atomically with version checks and events", async () => {
    const ticketId = await makeTicket();
    const created = await createAction(ticketId);
    expect(created.status).toBe(201);
    const actionId = created.body.data.id as number;
    const secondStaff = await prisma.requesterUser.findFirstOrThrow({ where: { id: { not: staff.userId }, isActive: true, role: "IT_STAFF" }, select: { id: true } });
    const edited = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, assigneeId: secondStaff.id, description: "Updated diagnostic plan", followUpRequired: true, followUpNote: "Requester will verify the change." });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ version: 2, description: "Updated diagnostic plan", followUpRequired: true, assignee: { id: secondStaff.id } });
    expect(edited.body.meta.ticketVersion).toBe(3);
    const events = await prisma.actionTakenEvent.findMany({ where: { actionId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    // BR-17 specifies chronological order with an ID tie-break, not a priority
    // between fields changed by the same atomic update. Verify the actual
    // audit contents as well as the order exposed by the history endpoint.
    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ kind: "CREATED", actorId: staff.userId, toStatus: "PLANNED" });
    expect(events.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "ASSIGNED", actorId: staff.userId, fieldName: "assigneeId", oldValue: staff.userId, newValue: secondStaff.id }),
      expect.objectContaining({ kind: "EDITED", actorId: staff.userId, fieldName: "description", oldValue: "Inspect the reported issue.", newValue: "Updated diagnostic plan" }),
      expect.objectContaining({ kind: "EDITED", actorId: staff.userId, fieldName: "followUpRequired", oldValue: false, newValue: true }),
      expect.objectContaining({ kind: "EDITED", actorId: staff.userId, fieldName: "followUpNote", oldValue: null, newValue: "Requester will verify the change." }),
    ]));
    const sortedEvents = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
    expect(events.map((event) => event.id)).toEqual(sortedEvents.map((event) => event.id));
    const history = await staff.agent.get(`/api/staff/tickets/${ticketId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.data.map((event: { id: string }) => event.id)).toEqual(events.map((event) => `action:${event.id}`));

    const followUpCleared = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 3, expectedActionVersion: 2, followUpRequired: false });
    expect(followUpCleared.status).toBe(200);
    expect(followUpCleared.body.data).toMatchObject({ followUpRequired: false, followUpNote: null, version: 3 });
    expect(followUpCleared.body.meta.ticketVersion).toBe(4);

    const staleAction = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, description: "Stale overwrite" });
    expect(staleAction.status).toBe(409);
    expect(staleAction.body.error.code).toBe("STALE_VERSION");
    const inactiveReassignment = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 4, expectedActionVersion: 3, assigneeId: inactiveStaffId });
    expect(inactiveReassignment.status).toBe(400);
    expect(inactiveReassignment.body.error.fields.assigneeId).toBeTruthy();
  });

  it("enforces the Action lifecycle, completion/cancellation requirements, and append-only events", async () => {
    const ticketId = await makeTicket();
    const created = await createAction(ticketId);
    const actionId = created.body.data.id as number;
    const inProgress = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "IN_PROGRESS" });
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.data.status).toBe("IN_PROGRESS");
    const incomplete = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 3, expectedActionVersion: 2, status: "COMPLETED" });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error.fields.result).toBeTruthy();
    const noFollowUpNote = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 3, expectedActionVersion: 2, status: "COMPLETED", result: "Diagnostics collected.", followUpRequired: true });
    expect(noFollowUpNote.status).toBe(400);
    expect(noFollowUpNote.body.error.fields.followUpNote).toBeTruthy();
    const complete = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 3, expectedActionVersion: 2, status: "COMPLETED", result: "Diagnostics collected.", followUpRequired: true, followUpNote: "Requester will confirm the fix." });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ status: "COMPLETED", result: "Diagnostics collected.", performedBy: { id: staff.userId }, followUpRequired: true });
    expect(complete.body.data.actionAt).toBeTruthy();
    const requesterActions = await requesterA.agent.get(`/api/tickets/${ticketId}/actions`);
    expect(requesterActions.status).toBe(200);
    expect(requesterActions.body.data[0].performedBy).toEqual({ id: staff.userId, name: expect.any(String) });
    expect(requesterActions.body.data[0].performedBy).not.toHaveProperty("role");
    expect(requesterActions.body.data[0].performedBy).not.toHaveProperty("isActive");
    const terminalEdit = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 4, expectedActionVersion: 3, description: "Cannot alter completed record" });
    expect(terminalEdit.status).toBe(409);
    expect(terminalEdit.body.error.code).toBe("ACTION_TERMINAL");
    const invalidTransition = await staff.agent.patch(`/api/staff/tickets/${ticketId}/actions/${actionId}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 4, expectedActionVersion: 3, status: "IN_PROGRESS" });
    expect(invalidTransition.status).toBe(409);
    expect(invalidTransition.body.error.code).toBe("INVALID_TRANSITION");

    const cancelTicketId = await makeTicket();
    const planned = await createAction(cancelTicketId);
    const missingReason = await staff.agent.patch(`/api/staff/tickets/${cancelTicketId}/actions/${planned.body.data.id}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "CANCELLED" });
    expect(missingReason.status).toBe(400);
    expect(missingReason.body.error.fields.cancellationReason).toBeTruthy();
    const cancelled = await staff.agent.patch(`/api/staff/tickets/${cancelTicketId}/actions/${planned.body.data.id}/status`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, expectedActionVersion: 1, status: "CANCELLED", cancellationReason: "Duplicate diagnostic request." });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data).toMatchObject({ status: "CANCELLED", cancellationReason: "Duplicate diagnostic request." });
    const cancelEvent = await prisma.actionTakenEvent.findFirstOrThrow({ where: { actionId: planned.body.data.id }, orderBy: { id: "desc" } });
    expect(cancelEvent.kind).toBe("CANCELLED");
  });

  it("hides cross-Ticket Action identifiers and returns safe not-found responses", async () => {
    const firstTicketId = await makeTicket();
    const secondTicketId = await makeTicket();
    const action = await createAction(firstTicketId);
    const response = await staff.agent.patch(`/api/staff/tickets/${secondTicketId}/actions/${action.body.data.id}`)
      .set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 1, expectedActionVersion: 1, description: "Cross-Ticket attempt" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ACTION_NOT_FOUND");
    const stillSame = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.body.data.id }, select: { description: true, version: true } });
    expect(stillSame).toMatchObject({ description: "Inspect the reported issue.", version: 1 });
  });
});
