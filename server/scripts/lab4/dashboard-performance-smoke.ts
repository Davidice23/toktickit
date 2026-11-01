import { ActionStatus, Prisma, TicketStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import request from "supertest";
import { hashPassword } from "../../src/auth.js";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const ticketCount = 1_000;
const actionsPerTicket = 5;
const actionCount = ticketCount * actionsPerTicket;
const warmupRequests = 3;
const measuredRequests = 20;
const thresholdMs = 2_000;
const runId = randomUUID().replaceAll("-", "");
const ticketNumberPrefix = `L4PERF-${runId}-`;
const fixtureEmail = `lab4-perf-${runId}@example.test`;
let fixtureUserId: number | null = null;

function assertDisposableDatabase() {
  try {
    const raw = process.env.DATABASE_URL;
    if (process.env.NODE_ENV !== "test" || process.env.LAB4_DISPOSABLE_DB !== "1" || !raw) throw new Error();
    const database = new URL(raw);
    const name = decodeURIComponent(database.pathname.replace(/^\//, ""));
    if (!new Set(["localhost", "127.0.0.1", "::1"]).has(database.hostname) || name !== "toktickit_test") throw new Error();
  } catch {
    throw new Error("Lab 4 performance smoke requires NODE_ENV=test, LAB4_DISPOSABLE_DB=1, and the disposable local toktickit_test database; no data was changed.");
  }
}

async function cleanup() {
  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: ticketNumberPrefix } },
    select: { id: true },
  });
  const ticketIds = tickets.map(({ id }) => id);
  if (ticketIds.length) {
    const actions = await prisma.actionTaken.findMany({ where: { ticketId: { in: ticketIds } }, select: { id: true } });
    const actionIds = actions.map(({ id }) => id);
    if (actionIds.length) {
      await prisma.actionCreateReceipt.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTakenEvent.deleteMany({ where: { actionId: { in: actionIds } } });
      await prisma.actionTaken.deleteMany({ where: { id: { in: actionIds } } });
    }
    await prisma.ticketWorkflowEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  }
  if (fixtureUserId !== null) {
    await prisma.session.deleteMany({ where: { userId: fixtureUserId } });
    await prisma.requesterUser.deleteMany({ where: { id: fixtureUserId } });
    fixtureUserId = null;
  }
}

async function createSyntheticWorkload() {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findFirstOrThrow({ where: { isActive: true }, select: { id: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, select: { id: true } }),
  ]);
  const now = new Date();
  const user = await prisma.requesterUser.create({
    data: {
      name: "Lab 4 disposable performance smoke",
      email: fixtureEmail,
      passwordHash: await hashPassword(`Lab4-${runId}-only`),
      role: "IT_STAFF",
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true },
  });
  fixtureUserId = user.id;

  for (let offset = 0; offset < ticketCount; offset += 250) {
    const rows: Prisma.TicketCreateManyInput[] = Array.from({ length: Math.min(250, ticketCount - offset) }, (_, index) => {
      const number = offset + index;
      return {
        ticketNumber: `${ticketNumberPrefix}${number}`,
        submissionKey: `perf-${runId}-${number}`,
        submissionHash: `perf-hash-${runId}-${number}`,
        requesterId: user.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: `Disposable performance Ticket ${number}`,
        description: "Synthetic CI-only dashboard performance fixture.",
        requestedPriority: number % 10 === 0 ? "URGENT" : "MEDIUM",
        currentStatus: TicketStatus.NEW,
        itPriority: number % 10 === 0 ? "URGENT" : "MEDIUM",
        ownerId: null,
        createdAt: now,
        updatedAt: now,
      };
    });
    await prisma.ticket.createMany({ data: rows });
  }

  const tickets = await prisma.ticket.findMany({
    where: { ticketNumber: { startsWith: ticketNumberPrefix } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (tickets.length !== ticketCount) throw new Error(`Expected ${ticketCount} synthetic Tickets; found ${tickets.length}.`);

  for (let offset = 0; offset < tickets.length; offset += 250) {
    const rows: Prisma.ActionTakenCreateManyInput[] = [];
    for (const { id: ticketId } of tickets.slice(offset, offset + 250)) {
      for (let actionIndex = 0; actionIndex < actionsPerTicket; actionIndex += 1) {
        const completed = actionIndex >= 3;
        rows.push({
          ticketId,
          assigneeId: user.id,
          createdById: user.id,
          performedById: completed ? user.id : null,
          status: completed ? ActionStatus.COMPLETED : actionIndex === 0 ? ActionStatus.PLANNED : ActionStatus.IN_PROGRESS,
          description: "Synthetic CI-only dashboard performance Action.",
          result: completed ? "Synthetic completion for performance smoke." : null,
          followUpRequired: false,
          actionAt: completed ? new Date(now.getTime() - 60_000) : null,
          idempotencyKey: `perf-${runId}-${ticketId}-${actionIndex}`,
          requestFingerprint: `perf-fingerprint-${runId}-${ticketId}-${actionIndex}`,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    await prisma.actionTaken.createMany({ data: rows });
  }

  const [ticketRows, actionRows] = await Promise.all([
    prisma.ticket.count({ where: { ticketNumber: { startsWith: ticketNumberPrefix } } }),
    prisma.actionTaken.count({ where: { ticket: { ticketNumber: { startsWith: ticketNumberPrefix } } } }),
  ]);
  if (ticketRows !== ticketCount || actionRows !== actionCount) {
    throw new Error(`Synthetic workload mismatch: expected ${ticketCount} Tickets / ${actionCount} Actions; found ${ticketRows} / ${actionRows}.`);
  }

  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email: fixtureEmail, password: `Lab4-${runId}-only` });
  if (login.status !== 200) throw new Error(`Disposable Staff fixture login failed with status ${login.status}.`);
  return agent;
}

async function measureDashboard(agent: ReturnType<typeof request.agent>): Promise<number> {
  const startedAt = performance.now();
  const response = await agent.get("/api/dashboard/staff");
  const elapsedMs = performance.now() - startedAt;
  if (response.status !== 200) throw new Error(`Staff dashboard returned ${response.status}.`);
  if (response.body?.data?.metrics?.myActiveActions !== 3_000 || response.body?.data?.metrics?.myRecentlyCompletedActions !== 2_000) {
    throw new Error("Staff dashboard did not return the expected synthetic Action workload metrics.");
  }
  if (response.body?.data?.myActiveActions?.length > 5 || response.body?.data?.myRecentlyCompletedActions?.length > 5) {
    throw new Error("Staff dashboard exceeded its bounded Action-row limit.");
  }
  return elapsedMs;
}

async function main() {
  assertDisposableDatabase();
  let measurements: number[] = [];
  try {
    const agent = await createSyntheticWorkload();
    for (let index = 0; index < warmupRequests; index += 1) await measureDashboard(agent);
    for (let index = 0; index < measuredRequests; index += 1) measurements.push(await measureDashboard(agent));
    measurements.sort((left, right) => left - right);
    const p95Ms = measurements[Math.ceil(0.95 * measurements.length) - 1];
    const maxMs = measurements.at(-1);
    console.log(JSON.stringify({
      test: "Lab 4 observation-only dashboard performance smoke",
      syntheticWorkload: { tickets: ticketCount, actions: actionCount },
      sampling: { warmupRequests, measuredRequests },
      p95Ms: Number(p95Ms.toFixed(2)),
      maxMs: Number(maxMs?.toFixed(2)),
      thresholdMs,
      result: p95Ms < thresholdMs ? "PASS" : "FAIL",
      scope: "CI smoke observation only; not a production load test or production SLA",
    }, null, 2));
    if (p95Ms >= thresholdMs) throw new Error(`Dashboard p95 ${p95Ms.toFixed(2)} ms did not meet the strict < ${thresholdMs} ms threshold.`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Lab 4 performance smoke failed.");
  process.exitCode = 1;
});
