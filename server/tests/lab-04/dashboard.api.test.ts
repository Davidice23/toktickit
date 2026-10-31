import { ActionStatus, Prisma, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const testPassword = "dashboard-test-password-2026";
const openStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
const day = 24 * 60 * 60 * 1000;

type Login = { agent: ReturnType<typeof request.agent>; userId: number };
type Fixtures = { requesterA: Login; requesterB: Login; staff: Login; otherStaff: Login; admin: Login };
let fixtures: Fixtures;
let fixtureUserIds: number[] = [];
let fixtureTicketIds: number[] = [];
let setupReady = false;

function assertDisposableTestDatabase() {
  try {
    const raw = process.env.DATABASE_URL;
    if (process.env.NODE_ENV !== "test" || !raw) throw new Error();
    const database = new URL(raw);
    const name = decodeURIComponent(database.pathname.replace(/^\//, ""));
    if (!new Set(["localhost", "127.0.0.1", "::1"]).has(database.hostname) || name !== "toktickit_test") throw new Error();
  } catch {
    throw new Error("Lab 4 dashboard integration tests require NODE_ENV=test and the disposable local toktickit_test database; no data was changed.");
  }
}

async function loginFixture(userId: number): Promise<Login> {
  const user = await prisma.requesterUser.findUniqueOrThrow({ where: { id: userId } });
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: user.email, password: testPassword });
  if (response.status !== 200) throw new Error("Dashboard API fixture login failed with status " + response.status);
  return { agent, userId };
}

async function createTicket(requesterId: number, overrides: Partial<Prisma.TicketUncheckedCreateInput> = {}) {
  const now = new Date();
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-L4-DASH-${randomUUID().slice(0, 8)}`,
      submissionKey: randomUUID(),
      submissionHash: randomUUID(),
      requesterId,
      categoryId: await prisma.category.findFirstOrThrow({ where: { isActive: true }, select: { id: true } }).then((row) => row.id),
      relatedSystemId: await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, select: { id: true } }).then((row) => row.id),
      summary: "Lab 4 dashboard fixture",
      description: "Disposable fixture used by the dashboard integration test.",
      requestedPriority: "MEDIUM",
      currentStatus: TicketStatus.NEW,
      itPriority: "LOW",
      ownerId: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    select: { id: true },
  });
  fixtureTicketIds.push(ticket.id);
  return ticket.id;
}

async function createAction(
  ticketId: number,
  input: { assigneeId: number; status: ActionStatus; performedById?: number | null; actionAt?: Date | null },
) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      assigneeId: input.assigneeId,
      createdById: fixtures.staff.userId,
      performedById: input.performedById ?? null,
      status: input.status,
      description: "Dashboard test Action",
      result: input.status === ActionStatus.COMPLETED ? "Verified in disposable test fixture." : null,
      followUpRequired: false,
      actionAt: input.actionAt ?? null,
      idempotencyKey: randomUUID(),
      requestFingerprint: randomUUID(),
    },
    select: { id: true, ticketId: true },
  });
}

async function cleanupTickets() {
  for (const ticketId of fixtureTicketIds.splice(0)) {
    const actionIds = (await prisma.actionTaken.findMany({ where: { ticketId }, select: { id: true } })).map((row) => row.id);
    if (actionIds.length) {
      await prisma.actionCreateReceipt.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTakenEvent.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTaken.deleteMany({ where: { id: { in: actionIds } } });
    }
    await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId } });
    await prisma.internalNote.deleteMany({ where: { ticketId } });
    await prisma.publicComment.deleteMany({ where: { ticketId } });
    await prisma.attachment.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  }
}

beforeAll(async () => {
  assertDisposableTestDatabase();
  const passwordHash = await hashPassword(testPassword);
  const suffix = randomUUID();
  const roles = ["REQUESTER", "REQUESTER", "IT_STAFF", "IT_STAFF", "ADMINISTRATOR"] as const;
  const users = [];
  for (const [index, role] of roles.entries()) {
    const user = await prisma.requesterUser.create({
      data: {
        name: `Lab 4 Dashboard ${role} ${index + 1}`,
        email: `lab4-dashboard-${index + 1}-${suffix}@example.test`,
        passwordHash,
        role,
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    users.push(user);
    fixtureUserIds.push(user.id);
  }
  const logins: Login[] = [];
  for (const { id } of users) logins.push(await loginFixture(id));
  const [requesterA, requesterB, staff, otherStaff, admin] = logins;
  fixtures = { requesterA, requesterB, staff, otherStaff, admin };
  setupReady = true;
});

afterEach(async () => {
  if (setupReady) await cleanupTickets();
});

afterAll(async () => {
  if (fixtureTicketIds.length) await cleanupTickets();
  if (fixtureUserIds.length) {
    await prisma.session.deleteMany({ where: { userId: { in: fixtureUserIds } } });
    await prisma.requesterUser.deleteMany({ where: { id: { in: fixtureUserIds } } });
  }
  await prisma.$disconnect();
});

describe.sequential("Lab 4 dashboards and drill-down filters", () => {
  it("enforces session and role boundaries for both dashboards", async () => {
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/staff")).status).toBe(401);
    expect((await fixtures.requesterA.agent.get("/api/dashboard/staff")).status).toBe(403);
    expect((await fixtures.staff.agent.get("/api/dashboard/requester")).status).toBe(403);
    expect((await fixtures.staff.agent.get("/api/dashboard/staff")).status).toBe(200);
    expect((await fixtures.admin.agent.get("/api/dashboard/staff")).status).toBe(200);
  });

  it("calculates Requester metrics from owned Tickets and keeps every drill-down server-scoped", async () => {
    const now = Date.now();
    const openId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.NEW });
    const waitingId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.WAITING_FOR_REQUESTER });
    const reopenedId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.REOPENED, resolvedAt: new Date(now - day) });
    const resolvedId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.RESOLVED, resolvedAt: new Date(now - day) });
    const closedId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.CLOSED, resolvedAt: new Date(now - 2 * day) });
    const oldId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.RESOLVED, resolvedAt: new Date(now - 15 * day), updatedAt: new Date(now - 15 * day) });
    const cancelledId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.CANCELLED });
    const otherRequesterId = await createTicket(fixtures.requesterB.userId, { currentStatus: TicketStatus.NEW });
    await prisma.ticket.updateMany({ where: { id: { in: [openId, waitingId, reopenedId, resolvedId, closedId, cancelledId] } }, data: { updatedAt: new Date(now - 60_000) } });

    const dashboard = await fixtures.requesterA.agent.get("/api/dashboard/requester");
    expect(dashboard.status).toBe(200);
    const { data } = dashboard.body;
    expect(data.metrics).toEqual({ openTickets: 3, waitingForRequester: 1, recentlyUpdated: 6, recentlyResolved: 2 });
    expect(data.asOf).toEqual(expect.any(String));
    expect(data.attentionTickets.map((row: { id: number }) => row.id)).toContain(waitingId);
    expect(data.recentlyResolvedTickets.map((row: { id: number }) => row.id)).toEqual([resolvedId, closedId]);
    expect(data.recentlyResolvedTickets.map((row: { id: number }) => row.id)).not.toContain(reopenedId);
    expect(data.recentlyResolvedTickets.map((row: { id: number }) => row.id)).not.toContain(oldId);
    expect(data.recentlyUpdatedTickets.map((row: { id: number }) => row.id)).not.toContain(otherRequesterId);
    expect(data.recentlyUpdatedTickets.map((row: { id: number }) => row.id)).toEqual([openId, waitingId, reopenedId, resolvedId, closedId, cancelledId].sort((a, b) => b - a).slice(0, 5));
    for (const rows of [data.attentionTickets, data.recentlyUpdatedTickets, data.recentlyResolvedTickets]) expect(rows.length).toBeLessThanOrEqual(5);
    expect(data.drillDown).toMatchObject({
      openTickets: "/my-tickets?scope=open",
      waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER",
      recentlyUpdated: `/my-tickets?scope=recently-updated&asOf=${encodeURIComponent(data.asOf)}`,
      recentlyResolved: `/my-tickets?scope=recently-resolved&asOf=${encodeURIComponent(data.asOf)}`,
    });

    const [openOracle, waitingOracle, updatedOracle, resolvedOracle] = await Promise.all([
      prisma.ticket.count({ where: { requesterId: fixtures.requesterA.userId, currentStatus: { in: [...openStatuses] } } }),
      prisma.ticket.count({ where: { requesterId: fixtures.requesterA.userId, currentStatus: TicketStatus.WAITING_FOR_REQUESTER } }),
      prisma.ticket.count({ where: { requesterId: fixtures.requesterA.userId, updatedAt: { gte: new Date(Date.parse(data.asOf) - 14 * day), lt: new Date(data.asOf) } } }),
      prisma.ticket.count({ where: { requesterId: fixtures.requesterA.userId, currentStatus: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, resolvedAt: { gte: new Date(Date.parse(data.asOf) - 14 * day), lt: new Date(data.asOf) } } }),
    ]);
    expect(data.metrics).toEqual({ openTickets: openOracle, waitingForRequester: waitingOracle, recentlyUpdated: updatedOracle, recentlyResolved: resolvedOracle });

    const [openQueue, waitingQueue, updatedQueue, resolvedQueue, requesterBQueue] = await Promise.all([
      fixtures.requesterA.agent.get("/api/tickets?scope=open&pageSize=10"),
      fixtures.requesterA.agent.get("/api/tickets?status=WAITING_FOR_REQUESTER&pageSize=10"),
      fixtures.requesterA.agent.get(`/api/tickets?scope=recently-updated&asOf=${encodeURIComponent(data.asOf)}&pageSize=10`),
      fixtures.requesterA.agent.get(`/api/tickets?scope=recently-resolved&asOf=${encodeURIComponent(data.asOf)}&pageSize=10`),
      fixtures.requesterB.agent.get("/api/tickets?scope=open&pageSize=10"),
    ]);
    expect(openQueue.body.data.map((row: { id: number }) => row.id)).toContain(openId);
    expect(openQueue.body.data.map((row: { id: number }) => row.id)).not.toContain(cancelledId);
    expect(waitingQueue.body.meta.totalItems).toBe(data.metrics.waitingForRequester);
    expect(updatedQueue.body.meta.totalItems).toBe(data.metrics.recentlyUpdated);
    expect(resolvedQueue.body.meta.totalItems).toBe(data.metrics.recentlyResolved);
    expect(resolvedQueue.body.data.map((row: { id: number }) => row.id)).not.toContain(reopenedId);
    expect(requesterBQueue.body.data.map((row: { id: number }) => row.id)).toEqual([otherRequesterId]);
  });

  it("uses a reproducible half-open 14-day window for timestamp drill-downs", async () => {
    const initial = await fixtures.requesterA.agent.get("/api/dashboard/requester");
    const asOf = new Date(initial.body.data.asOf as string);
    const start = new Date(asOf.getTime() - 14 * day);
    const atStartUpdateId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.NEW, createdAt: new Date(start.getTime() - day), updatedAt: start });
    const atEndUpdateId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.NEW, createdAt: new Date(asOf.getTime() - day), updatedAt: asOf });
    const atStartResolutionId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.RESOLVED, createdAt: new Date(start.getTime() - day), resolvedAt: start, updatedAt: start });
    const atEndResolutionId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.CLOSED, createdAt: new Date(asOf.getTime() - day), resolvedAt: asOf, updatedAt: asOf });
    const queryAsOf = encodeURIComponent(asOf.toISOString());

    const [recentlyUpdated, recentlyResolved, malformed] = await Promise.all([
      fixtures.requesterA.agent.get(`/api/tickets?scope=recently-updated&asOf=${queryAsOf}&pageSize=10`),
      fixtures.requesterA.agent.get(`/api/tickets?scope=recently-resolved&asOf=${queryAsOf}&pageSize=10`),
      fixtures.requesterA.agent.get("/api/tickets?scope=recently-updated&asOf=not-a-date"),
    ]);
    const updatedIds = recentlyUpdated.body.data.map((row: { id: number }) => row.id);
    const resolvedIds = recentlyResolved.body.data.map((row: { id: number }) => row.id);
    expect(updatedIds).toContain(atStartUpdateId);
    expect(updatedIds).not.toContain(atEndUpdateId);
    expect(resolvedIds).toContain(atStartResolutionId);
    expect(resolvedIds).not.toContain(atEndResolutionId);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.fields.asOf).toBeTruthy();
  });

  it("calculates operational counts once per Action/Ticket, scopes Actions to the logged-in Staff, and exposes filters", async () => {
    const unassignedUrgentId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.OPEN, requestedPriority: "MEDIUM", itPriority: "URGENT" });
    const otherOwnedUrgentId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.IN_PROGRESS, ownerId: fixtures.otherStaff.userId, requestedPriority: "URGENT", itPriority: "URGENT" });
    const myOwnedId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.REOPENED, ownerId: fixtures.staff.userId, requestedPriority: "MEDIUM", itPriority: "LOW" });
    const completedTicketId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.OPEN, ownerId: fixtures.otherStaff.userId });
    const closedUrgentId = await createTicket(fixtures.requesterA.userId, { currentStatus: TicketStatus.CLOSED, requestedPriority: "URGENT", itPriority: "URGENT", resolvedAt: new Date() });

    const activeA = await createAction(otherOwnedUrgentId, { assigneeId: fixtures.staff.userId, status: ActionStatus.PLANNED });
    const activeB = await createAction(otherOwnedUrgentId, { assigneeId: fixtures.staff.userId, status: ActionStatus.IN_PROGRESS });
    await prisma.actionTaken.updateMany({ where: { id: { in: [activeA.id, activeB.id] } }, data: { updatedAt: new Date(Date.now() - 60_000) } });
    await createAction(myOwnedId, { assigneeId: fixtures.otherStaff.userId, status: ActionStatus.PLANNED });
    const completed = await createAction(completedTicketId, { assigneeId: fixtures.otherStaff.userId, status: ActionStatus.COMPLETED, performedById: fixtures.staff.userId, actionAt: new Date(Date.now() - day) });

    const dashboard = await fixtures.staff.agent.get("/api/dashboard/staff");
    expect(dashboard.status).toBe(200);
    const { data } = dashboard.body;
    expect(data.metrics.myOwnedOpenTickets).toBe(1);
    expect(data.metrics.myActiveActions).toBe(2);
    expect(data.metrics.myRecentlyCompletedActions).toBe(1);
    expect(data.metrics.unassignedOpenTickets).toBeGreaterThanOrEqual(1);
    expect(data.metrics.urgentOpenTickets).toBeGreaterThanOrEqual(2);
    expect(data.myActiveActions.map((row: { id: number }) => row.id)).toEqual([activeB.id, activeA.id]);
    expect(data.myRecentlyCompletedActions.map((row: { id: number }) => row.id)).toEqual([completed.id]);
    expect(data.recentOrUrgentTickets.map((row: { id: number }) => row.id)).not.toContain(closedUrgentId);
    for (const rows of [data.myActiveActions, data.myRecentlyCompletedActions, data.recentOrUrgentTickets]) expect(rows.length).toBeLessThanOrEqual(5);
    expect(data.adminAccountSummary).toBeNull();
    expect(data.drillDown.myRecentlyCompletedActions).toBe(`/staff-tickets?scope=my-recently-completed-actions&asOf=${encodeURIComponent(data.asOf)}`);

    const [unassignedQueue, ownedQueue, activeQueue, completedQueue, urgentQueue] = await Promise.all([
      fixtures.staff.agent.get("/api/staff/tickets?scope=unassigned-open&pageSize=10"),
      fixtures.staff.agent.get("/api/staff/tickets?scope=my-owned-open&pageSize=10"),
      fixtures.staff.agent.get("/api/staff/tickets?scope=my-active-actions&pageSize=10"),
      fixtures.staff.agent.get(`/api/staff/tickets?scope=my-recently-completed-actions&asOf=${encodeURIComponent(data.asOf)}&pageSize=10`),
      fixtures.staff.agent.get("/api/staff/tickets?scope=urgent-open&pageSize=10"),
    ]);
    expect(unassignedQueue.body.data.map((row: { id: number }) => row.id)).toContain(unassignedUrgentId);
    expect(unassignedQueue.body.data.every((row: { ownerId: number | null; currentStatus: string }) => row.ownerId === null && openStatuses.includes(row.currentStatus as typeof openStatuses[number]))).toBe(true);
    expect(ownedQueue.body.data.map((row: { id: number }) => row.id)).toEqual([myOwnedId]);
    expect(activeQueue.body.data.map((row: { id: number }) => row.id)).toEqual([otherOwnedUrgentId]);
    expect(activeQueue.body.meta.totalItems).toBe(1);
    expect(completedQueue.body.data.map((row: { id: number }) => row.id)).toEqual([completedTicketId]);
    expect(urgentQueue.body.data.map((row: { id: number }) => row.id)).toContain(unassignedUrgentId);
    expect(urgentQueue.body.data.map((row: { id: number }) => row.id)).toContain(otherOwnedUrgentId);

    const admin = await fixtures.admin.agent.get("/api/dashboard/staff");
    const adminGroups = await prisma.requesterUser.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
    expect(Object.fromEntries(admin.body.data.adminAccountSummary.map(({ role, activeUsers }: { role: string; activeUsers: number }) => [role, activeUsers])))
      .toEqual(Object.fromEntries(adminGroups.map(({ role, _count }) => [role, _count._all])));

    const [unassignedOracle, ownedOracle, activeOracle, completedOracle, urgentOracle] = await Promise.all([
      prisma.ticket.count({ where: { ownerId: null, currentStatus: { in: [...openStatuses] } } }),
      prisma.ticket.count({ where: { ownerId: fixtures.staff.userId, currentStatus: { in: [...openStatuses] } } }),
      prisma.actionTaken.count({ where: { assigneeId: fixtures.staff.userId, status: { in: [ActionStatus.PLANNED, ActionStatus.IN_PROGRESS] } } }),
      prisma.actionTaken.count({ where: { performedById: fixtures.staff.userId, status: ActionStatus.COMPLETED, actionAt: { gte: new Date(Date.parse(data.asOf) - 14 * day), lt: new Date(data.asOf) } } }),
      prisma.ticket.count({ where: { currentStatus: { in: [...openStatuses] }, OR: [{ itPriority: "URGENT" }, { itPriority: null, requestedPriority: "URGENT" }] } }),
    ]);
    expect(unassignedQueue.body.meta.totalItems).toBe(unassignedOracle);
    expect(ownedOracle).toBe(1);
    expect(activeOracle).toBe(2);
    expect(completedOracle).toBe(1);
    expect(urgentQueue.body.meta.totalItems).toBe(urgentOracle);
    expect(data.metrics).toEqual({ unassignedOpenTickets: unassignedOracle, myOwnedOpenTickets: ownedOracle, myActiveActions: activeOracle, myRecentlyCompletedActions: completedOracle, urgentOpenTickets: urgentOracle });
  });

  it("returns explicit empty collections for a Requester with no Tickets and rejects unknown scopes", async () => {
    const response = await fixtures.requesterB.agent.get("/api/dashboard/requester");
    expect(response.status).toBe(200);
    expect(response.body.data.metrics).toEqual({ openTickets: 0, waitingForRequester: 0, recentlyUpdated: 0, recentlyResolved: 0 });
    expect(response.body.data.attentionTickets).toEqual([]);
    expect(response.body.data.recentlyUpdatedTickets).toEqual([]);
    expect(response.body.data.recentlyResolvedTickets).toEqual([]);
    expect((await fixtures.requesterA.agent.get("/api/tickets?scope=all")).status).toBe(400);
    expect((await fixtures.staff.agent.get("/api/staff/tickets?scope=all")).status).toBe(400);
  });
});
