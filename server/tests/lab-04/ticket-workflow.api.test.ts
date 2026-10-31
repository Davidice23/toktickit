import request from "supertest";
import { randomUUID } from "node:crypto";
import { TicketStatus } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../src/auth.js";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { loginAsAdministrator, loginAsRequester, loginAsStaff } from "../lab-03/auth-fixtures.js";

const prisma = getPrisma();
let staff: Awaited<ReturnType<typeof loginAsStaff>>;
let admin: Awaited<ReturnType<typeof loginAsAdministrator>>;
let requester: Awaited<ReturnType<typeof loginAsRequester>>;
let otherRequester: Awaited<ReturnType<typeof loginAsRequester>>;
let categoryId = 0;
let systemId = 0;
let inactiveStaffId = 0;
let ready = false;
const ticketIds: number[] = [];
const syntheticUserIds: number[] = [];

function assertDisposableDatabase() {
  const raw = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || process.env.LAB4_DISPOSABLE_DB !== "1" || !raw) {
    throw new Error("Workflow tests require NODE_ENV=test and LAB4_DISPOSABLE_DB=1 for an explicitly disposable test database");
  }
  const url = new URL(raw);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== "toktickit_test") {
    throw new Error("Workflow tests require the disposable local toktickit_test database");
  }
}

async function makeTicket(status: TicketStatus = "NEW", ownerId: number | null = staff.userId) {
  const ticket = await prisma.ticket.create({ data: {
    ticketNumber: `TKT-L4-WF-${randomUUID().slice(0, 8)}`, submissionKey: randomUUID(), submissionHash: randomUUID(),
    requesterId: requester.userId, categoryId, relatedSystemId: systemId, summary: "Workflow test fixture",
    description: "Synthetic fixture for isolated workflow tests", requestedPriority: "MEDIUM", currentStatus: status, ownerId,
  } });
  ticketIds.push(ticket.id);
  return ticket;
}

async function makeAction(ticketId: number, status: "PLANNED" | "COMPLETED", result: string | null = null) {
  return prisma.actionTaken.create({ data: {
    ticketId, assigneeId: staff.userId, createdById: staff.userId, status, description: "Synthetic work",
    result, ...(status === "COMPLETED" ? { performedById: staff.userId, actionAt: new Date() } : {}),
    idempotencyKey: randomUUID(), requestFingerprint: randomUUID(),
  } });
}

async function controlledRace(table: "Ticket" | "User", id: number, start: () => [Promise<{ status: number }>, Promise<{ status: number }>]) {
  let signalReady!: (pid: number) => void;
  let releaseLock!: () => void;
  const readyLock = new Promise<number>((resolve) => { signalReady = resolve; });
  const release = new Promise<void>((resolve) => { releaseLock = resolve; });
  const locker = prisma.$transaction(async (tx) => {
    const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    if (table === "Ticket") await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
    signalReady(backend.pid);
    await release;
  }, { timeout: 20000 });
  const blockerPid = await readyLock;
  const requests = start();
  let observedBoth = false;
  try {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const [state] = await prisma.$queryRaw<Array<{ waiting: number }>>`
        WITH RECURSIVE blocked(pid) AS (
          SELECT ${blockerPid}::integer
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT count(DISTINCT a.pid)::integer AS "waiting"
        FROM pg_stat_activity a JOIN blocked b ON a.pid = b.pid
        WHERE a.wait_event_type = 'Lock' AND a.query LIKE ${`%"${table}"%`}
      `;
      if (state.waiting >= 2) { observedBoth = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    releaseLock();
  }
  await locker;
  const results = await Promise.all(requests);
  expect(observedBoth, `Expected two requests to wait on the synthetic ${table} lock`).toBe(true);
  return results;
}

beforeAll(async () => {
  assertDisposableDatabase();
  [staff, admin, requester] = await Promise.all([loginAsStaff(), loginAsAdministrator(), loginAsRequester()]);
  const other = await prisma.requesterUser.findFirstOrThrow({ where: { role: "REQUESTER", isActive: true, id: { not: requester.userId } }, orderBy: { id: "asc" } });
  otherRequester = await loginAsRequester(other.id);
  const [category, system, inactive] = await Promise.all([prisma.category.findFirstOrThrow({ where: { isActive: true } }), prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }), prisma.requesterUser.findFirstOrThrow({ where: { role: "IT_STAFF", isActive: false } })]);
  categoryId = category.id;
  systemId = system.id;
  inactiveStaffId = inactive.id;
  ready = true;
});

afterEach(async () => {
  if (!ready) return;
  for (const ticketId of ticketIds.splice(0)) {
    await prisma.actionCreateReceipt.deleteMany({ where: { action: { ticketId } } });
    await prisma.actionTakenEvent.deleteMany({ where: { action: { ticketId } } });
    await prisma.actionTaken.deleteMany({ where: { ticketId } });
    await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
  if (syntheticUserIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: syntheticUserIds.splice(0) } } });
}, 30000);
afterAll(async () => { if (ready) await prisma.$disconnect(); });

const edges: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"], CANCELLED: ["REOPENED"],
};

describe.sequential("Lab 4 Ticket workflow API", () => {
  it("enforces all 64 status edges for Staff and Administrator through the backend", async () => {
    for (const actor of [staff, admin]) {
      for (const from of Object.values(TicketStatus)) {
        for (const to of Object.values(TicketStatus)) {
        const ticket = await makeTicket(from);
        await makeAction(ticket.id, "COMPLETED", "Verified fixture result");
        const response = await actor.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", actor.csrfToken)
          .send({ expectedTicketVersion: 1, status: to, reason: "Synthetic transition reason", confirmation: true });
        const allowed = edges[from].includes(to);
        expect(response.status, `${from} -> ${to}`).toBe(allowed ? 200 : 409);
        const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { workflowEvents: true } });
        expect(persisted.currentStatus).toBe(allowed ? to : from);
        expect(persisted.workflowVersion).toBe(allowed ? 2 : 1);
        expect(persisted.workflowEvents).toHaveLength(allowed ? 1 : 0);
        if (allowed) expect(persisted.workflowEvents[0].actorId).toBe(actor.userId);
        }
      }
    }
  }, 60000);

  it("enforces the resolution gate while keeping the requester advisory optional", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const first = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken).send({ expectedTicketVersion: 1, status: "RESOLVED" });
    expect(first.status).toBe(422);
    expect(first.body.error.fields.completedAction).toBeTruthy();
    await makeAction(ticket.id, "COMPLETED", "Completed diagnosis");
    const active = await makeAction(ticket.id, "PLANNED");
    const blocked = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken).send({ expectedTicketVersion: 1, status: "RESOLVED" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.fields.activeActions).toBeTruthy();
    await prisma.actionTaken.update({ where: { id: active.id }, data: { status: "CANCELLED", cancellationReason: "Synthetic fixture", cancelledAt: new Date() } });
    const resolved = await admin.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", admin.csrfToken).send({ expectedTicketVersion: 1, status: "RESOLVED" });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toMatchObject({ currentStatus: "RESOLVED", workflowVersion: 2, resolvedAt: expect.any(String) });
    const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { workflowEvents: true } });
    expect(persisted.requesterConfirmedResolved).toBe(false);
    expect(persisted.workflowEvents).toEqual([expect.objectContaining({ actorId: admin.userId, previousStatus: "IN_PROGRESS", currentStatus: "RESOLVED" })]);
  });

  it("keeps requester advisory separate and forbids requester formal status changes", async () => {
    const ticket = await makeTicket("OPEN");
    const advisory = await requester.agent.post(`/api/tickets/${ticket.id}/requester-resolution`).set("X-CSRF-Token", requester.csrfToken).send({});
    expect(advisory.status).toBe(200);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("OPEN");
    const denied = await requester.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", requester.csrfToken).send({ expectedTicketVersion: 1, status: "IN_PROGRESS" });
    expect(denied.status).toBe(403);
    const otherDenied = await otherRequester.agent.post(`/api/tickets/${ticket.id}/requester-resolution`).set("X-CSRF-Token", otherRequester.csrfToken).send({});
    expect(otherDenied.status).toBe(404);
  });

  it("enforces session, role, and CSRF for Ticket mutations", async () => {
    const ticket = await makeTicket("OPEN");
    const anonymous = await request(app).patch(`/api/staff/tickets/${ticket.id}/priority`).send({ expectedTicketVersion: 1, itPriority: "HIGH" });
    expect(anonymous.status).toBe(401);
    const noCsrf = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/priority`).send({ expectedTicketVersion: 1, itPriority: "HIGH" });
    expect(noCsrf.status).toBe(403);
    const denied = await requester.agent.patch(`/api/staff/tickets/${ticket.id}/priority`).set("X-CSRF-Token", requester.csrfToken).send({ expectedTicketVersion: 1, itPriority: "HIGH" });
    expect(denied.status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).workflowVersion).toBe(1);
  });

  it("rejects resolution when the owner is inactive or missing", async () => {
    for (const ownerId of [null, inactiveStaffId]) {
      const ticket = await makeTicket("IN_PROGRESS", ownerId);
      await makeAction(ticket.id, "COMPLETED", "Completed work");
      const response = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: "RESOLVED" });
      expect(response.status).toBe(422);
      expect(response.body.error.fields.ownerId).toBeTruthy();
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("IN_PROGRESS");
      expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
    }
  });

  it("requires a reason for cancellation/reopening and confirmation for closure", async () => {
    for (const [from, to, body] of [
      ["NEW", "CANCELLED", { confirmation: true }],
      ["CLOSED", "REOPENED", {}],
      ["RESOLVED", "CLOSED", {}],
    ] as const) {
      const ticket = await makeTicket(from);
      const response = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: to, ...body });
      expect(response.status).toBe(400);
      expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: ticket.id } })).toBe(0);
    }
  });

  it("rejects deactivation or demotion while a Ticket is in progress, then allows it after reassignment", async () => {
    const user = await prisma.requesterUser.create({ data: { name: "Synthetic owner", email: `lab4-owner-${randomUUID()}@example.test`, passwordHash: await hashPassword(randomUUID()), role: "IT_STAFF", isActive: true } });
    syntheticUserIds.push(user.id);
    const ticket = await makeTicket("IN_PROGRESS", user.id);
    for (const patch of [{ isActive: false }, { role: "REQUESTER" }]) {
      const blocked = await admin.agent.patch(`/api/admin/users/${user.id}`).set("X-CSRF-Token", admin.csrfToken).send(patch);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe("ACTIVE_TICKET_OWNERSHIP");
    }
    const reassigned = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/assignment`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 1, ownerId: staff.userId });
    expect(reassigned.status).toBe(200);
    const deactivate = await admin.agent.patch(`/api/admin/users/${user.id}`).set("X-CSRF-Token", admin.csrfToken).send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);
  });

  it("preserves historical owners for resolved/closed Tickets and requires an active owner to close", async () => {
    const resolvedOwner = await prisma.requesterUser.create({ data: { name: "Resolved historical owner", email: `lab4-resolved-owner-${randomUUID()}@example.test`, passwordHash: await hashPassword(randomUUID()), role: "IT_STAFF", isActive: true } });
    syntheticUserIds.push(resolvedOwner.id);
    const resolvedTicket = await makeTicket("RESOLVED", resolvedOwner.id);
    const demoted = await admin.agent.patch(`/api/admin/users/${resolvedOwner.id}`).set("X-CSRF-Token", admin.csrfToken).send({ role: "REQUESTER" });
    expect(demoted.status).toBe(200);
    expect(demoted.body.data).toMatchObject({ role: "REQUESTER", isActive: true });

    const blockedClose = await staff.agent.patch(`/api/staff/tickets/${resolvedTicket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 1, status: "CLOSED", confirmation: true });
    expect(blockedClose.status).toBe(422);
    expect(blockedClose.body.error.fields.ownerId).toBeTruthy();

    const reassigned = await staff.agent.patch(`/api/staff/tickets/${resolvedTicket.id}/assignment`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 1, ownerId: staff.userId });
    expect(reassigned.status).toBe(200);
    const closed = await staff.agent.patch(`/api/staff/tickets/${resolvedTicket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, status: "CLOSED", confirmation: true });
    expect(closed.status).toBe(200);

    const closedOwner = await prisma.requesterUser.create({ data: { name: "Closed historical owner", email: `lab4-closed-owner-${randomUUID()}@example.test`, passwordHash: await hashPassword(randomUUID()), role: "IT_STAFF", isActive: true } });
    syntheticUserIds.push(closedOwner.id);
    const closedTicket = await makeTicket("CLOSED", closedOwner.id);
    const deactivated = await admin.agent.patch(`/api/admin/users/${closedOwner.id}`).set("X-CSRF-Token", admin.csrfToken).send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: closedTicket.id } })).ownerId).toBe(closedOwner.id);
  });

  it("records reason and actor in append-only history and clears resolvedAt on reopening", async () => {
    const ticket = await makeTicket("RESOLVED");
    await prisma.ticket.update({ where: { id: ticket.id }, data: { resolvedAt: new Date("2026-01-01T00:00:00.000Z") } });
    const reopened = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 1, status: "REOPENED", reason: "  Issue returned  " });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data).toMatchObject({ currentStatus: "REOPENED", workflowVersion: 2, resolvedAt: null });
    const resumed = await staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
      .send({ expectedTicketVersion: 2, status: "IN_PROGRESS" });
    expect(resumed.status).toBe(200);
    const events = await prisma.ticketWorkflowEvent.findMany({ where: { ticketId: ticket.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ actorId: staff.userId, previousStatus: "RESOLVED", currentStatus: "REOPENED", reason: "Issue returned" });
    expect(events[1]).toMatchObject({ actorId: staff.userId, previousStatus: "REOPENED", currentStatus: "IN_PROGRESS" });
  });

  it("serializes Resolve versus Action create with verified database lock overlap", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    await makeAction(ticket.id, "COMPLETED", "Completed prerequisite");
    const [resolved, created] = await controlledRace("Ticket", ticket.id, () => [
      staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: "RESOLVED" }).then((response) => response),
      staff.agent.post(`/api/staff/tickets/${ticket.id}/actions`).set("X-CSRF-Token", staff.csrfToken)
        .set("Idempotency-Key", randomUUID()).send({ expectedTicketVersion: 1, assigneeId: staff.userId, description: "Concurrent action" }).then((response) => response),
    ]);
    expect([resolved.status, created.status].filter((status) => status >= 200 && status < 300)).toHaveLength(1);
    expect([resolved.status, created.status]).toContain(409);
    const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { actions: true } });
    const active = finalTicket.actions.filter((action) => action.status === "PLANNED" || action.status === "IN_PROGRESS");
    expect(finalTicket.workflowVersion).toBe(2);
    if (resolved.status === 200) {
      expect(created.status).toBe(409);
      expect(finalTicket.currentStatus).toBe("RESOLVED");
      expect(active).toHaveLength(0);
    } else {
      expect(resolved.status).toBe(409);
      expect(created.status).toBe(201);
      expect(finalTicket.currentStatus).toBe("IN_PROGRESS");
      expect(active).toHaveLength(1);
    }
  }, 30000);

  it("serializes Action completion versus cancellation with verified lock overlap", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const action = await makeAction(ticket.id, "PLANNED");
    const [completed, cancelled] = await controlledRace("Ticket", ticket.id, () => [
      staff.agent.patch(`/api/staff/tickets/${ticket.id}/actions/${action.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, expectedActionVersion: 1, status: "COMPLETED", result: "Work completed" }).then((response) => response),
      admin.agent.patch(`/api/staff/tickets/${ticket.id}/actions/${action.id}/status`).set("X-CSRF-Token", admin.csrfToken)
        .send({ expectedTicketVersion: 1, expectedActionVersion: 1, status: "CANCELLED", cancellationReason: "Duplicate" }).then((response) => response),
    ]);
    expect([completed.status, cancelled.status].sort()).toEqual([200, 409]);
    const updated = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id }, include: { events: true } });
    expect(updated.status).toBe(completed.status === 200 ? "COMPLETED" : "CANCELLED");
    expect(updated.version).toBe(2);
    expect(updated.events).toHaveLength(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).workflowVersion).toBe(2);
  }, 30000);

  it("prevents Resolve racing Action start, edit, completion, or cancellation", async () => {
    for (const operation of ["start", "edit", "complete", "cancel"] as const) {
      const ticket = await makeTicket("IN_PROGRESS");
      await makeAction(ticket.id, "COMPLETED", "Existing prerequisite");
      const active = await makeAction(ticket.id, "PLANNED");
      const [resolved, changed] = await controlledRace("Ticket", ticket.id, () => {
        const resolveRequest = staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
          .send({ expectedTicketVersion: 1, status: "RESOLVED" }).then((response) => response);
        const path = operation === "edit" ? `/api/staff/tickets/${ticket.id}/actions/${active.id}` : `/api/staff/tickets/${ticket.id}/actions/${active.id}/status`;
        const fields = operation === "edit" ? { description: "Edited work" }
          : operation === "start" ? { status: "IN_PROGRESS" }
            : operation === "complete" ? { status: "COMPLETED", result: "Finished work" }
              : { status: "CANCELLED", cancellationReason: "Duplicate work" };
        const changeRequest = admin.agent.patch(path).set("X-CSRF-Token", admin.csrfToken)
          .send({ expectedTicketVersion: 1, expectedActionVersion: 1, ...fields }).then((response) => response);
        return [resolveRequest, changeRequest];
      });
      expect([409, 422], operation).toContain(resolved.status);
      expect(changed.status, operation).toBe(200);
      const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { actions: true, workflowEvents: true } });
      expect(persisted.currentStatus, operation).toBe("IN_PROGRESS");
      expect(persisted.workflowVersion, operation).toBe(2);
      expect(persisted.workflowEvents, operation).toHaveLength(0);
      const changedAction = persisted.actions.find((action) => action.id === active.id);
      expect(changedAction?.version, operation).toBe(2);
    }
  }, 60000);

  it("serializes Ticket reassignment versus Resolve with verified lock overlap", async () => {
    const ticket = await makeTicket("IN_PROGRESS", staff.userId);
    await makeAction(ticket.id, "COMPLETED", "Verified work");
    const [resolved, reassigned] = await controlledRace("Ticket", ticket.id, () => [
      staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: "RESOLVED" }).then((response) => response),
      admin.agent.patch(`/api/staff/tickets/${ticket.id}/assignment`).set("X-CSRF-Token", admin.csrfToken)
        .send({ expectedTicketVersion: 1, ownerId: admin.userId }).then((response) => response),
    ]);
    expect([resolved.status, reassigned.status].sort()).toEqual([200, 409]);
    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.workflowVersion).toBe(2);
    expect(updated.currentStatus).toBe(resolved.status === 200 ? "RESOLVED" : "IN_PROGRESS");
    expect(updated.ownerId).toBe(reassigned.status === 200 ? admin.userId : staff.userId);
  }, 30000);

  it("serializes Ticket priority versus status with verified lock overlap", async () => {
    const ticket = await makeTicket("NEW", staff.userId);
    const initialPriority = ticket.itPriority;
    const [status, priority] = await controlledRace("Ticket", ticket.id, () => [
      staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: "OPEN" }).then((response) => response),
      admin.agent.patch(`/api/staff/tickets/${ticket.id}/priority`).set("X-CSRF-Token", admin.csrfToken)
        .send({ expectedTicketVersion: 1, itPriority: "HIGH" }).then((response) => response),
    ]);
    expect([status.status, priority.status].sort()).toEqual([200, 409]);
    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.workflowVersion).toBe(2);
    expect(updated.currentStatus).toBe(status.status === 200 ? "OPEN" : "NEW");
    expect(updated.itPriority).toBe(priority.status === 200 ? "HIGH" : initialPriority);
  }, 30000);

  it("serializes owner deactivation against Resolve through a verified User lock", async () => {
    const user = await prisma.requesterUser.create({ data: { name: "Race owner", email: `lab4-race-${randomUUID()}@example.test`, passwordHash: await hashPassword(randomUUID()), role: "IT_STAFF", isActive: true } });
    syntheticUserIds.push(user.id);
    const ticket = await makeTicket("IN_PROGRESS", user.id);
    await makeAction(ticket.id, "COMPLETED", "Verified work");
    const [resolved, deactivated] = await controlledRace("User", user.id, () => [
      staff.agent.patch(`/api/staff/tickets/${ticket.id}/status`).set("X-CSRF-Token", staff.csrfToken)
        .send({ expectedTicketVersion: 1, status: "RESOLVED" }).then((response) => response),
      admin.agent.patch(`/api/admin/users/${user.id}`).set("X-CSRF-Token", admin.csrfToken)
        .send({ isActive: false }).then((response) => response),
    ]);
    expect(resolved.status).toBe(200);
    expect([200, 409]).toContain(deactivated.status);
    const finalUser = await prisma.requesterUser.findUniqueOrThrow({ where: { id: user.id } });
    const finalTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(finalTicket.currentStatus).toBe("RESOLVED");
    if (deactivated.status === 200) expect(finalUser.isActive).toBe(false);
    else expect(finalUser.isActive).toBe(true);
  }, 30000);

  it("rejects stale updates without overwriting the current owner, priority, or status", async () => {
    const ticket = await makeTicket("NEW", null);
    const initialPriority = ticket.itPriority;
    const claim = await staff.agent.post(`/api/staff/tickets/${ticket.id}/claim`).set("X-CSRF-Token", staff.csrfToken).send({ expectedTicketVersion: 1 });
    expect(claim.status).toBe(200);
    const stale = await admin.agent.patch(`/api/staff/tickets/${ticket.id}/priority`).set("X-CSRF-Token", admin.csrfToken).send({ expectedTicketVersion: 1, itPriority: "URGENT" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_VERSION");
    const persisted = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(persisted).toMatchObject({ ownerId: staff.userId, workflowVersion: 2, itPriority: initialPriority, currentStatus: "NEW" });
  });
});
