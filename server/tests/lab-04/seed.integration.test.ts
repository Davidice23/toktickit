import { afterAll, describe, expect, it } from "vitest";
import {
  LAB3_TICKET_FIXTURES,
  LAB4_ACTION_FIXTURES,
  seedReferenceData,
} from "../../prisma/seed-data.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
let restoreReopenedFixture: (() => Promise<void>) | undefined;

afterAll(async () => {
  try {
    await restoreReopenedFixture?.();
  } finally {
    await prisma.$disconnect();
  }
});

describe.sequential("Lab 4 synthetic Action seed", () => {
  it("is repeat-safe, supplies Action examples, and labels only synthetic Ticket baselines", async () => {
    await seedReferenceData(prisma);
    const first = await prisma.actionTaken.findMany({
      where: { idempotencyKey: { in: LAB4_ACTION_FIXTURES.map((fixture) => fixture.key) } },
      select: { id: true, idempotencyKey: true },
      orderBy: { idempotencyKey: "asc" },
    });

    await seedReferenceData(prisma);
    const actions = await prisma.actionTaken.findMany({
      where: { idempotencyKey: { in: LAB4_ACTION_FIXTURES.map((fixture) => fixture.key) } },
      include: { events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, ticket: true },
      orderBy: { idempotencyKey: "asc" },
    });

    expect(actions.map((action) => ({ id: action.id, idempotencyKey: action.idempotencyKey }))).toEqual(first);
    expect(actions).toHaveLength(LAB4_ACTION_FIXTURES.length);
    expect(new Set(actions.map((action) => action.status))).toEqual(new Set(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]));
    expect(actions.some((action) => action.followUpRequired && Boolean(action.followUpNote))).toBe(true);
    expect(actions.some((action) => action.status === "COMPLETED" && action.performedById !== null && action.actionAt !== null && Boolean(action.result))).toBe(true);
    expect(actions.some((action) => action.status === "CANCELLED" && action.cancelledAt !== null && Boolean(action.cancellationReason))).toBe(true);
    expect(actions.every((action) => action.events.length >= 1)).toBe(true);

    const tickets = await prisma.ticket.findMany({
      where: { submissionKey: { in: LAB3_TICKET_FIXTURES.map((fixture) => fixture.key) } },
      include: { actions: true, workflowEvents: { where: { reason: { startsWith: "synthetic-seed:" } } } },
      orderBy: { submissionKey: "asc" },
    });
    expect(tickets.find((ticket) => ticket.submissionKey === "lab3-demo-001")?.actions).toEqual([]);
    expect(tickets.find((ticket) => ticket.submissionKey === "lab3-demo-003")?.actions).toHaveLength(2);
    expect(tickets).toHaveLength(LAB3_TICKET_FIXTURES.length);
    expect(tickets.every((ticket) => ticket.workflowEvents.length === 1)).toBe(true);
    expect(tickets.every((ticket) => ticket.workflowEvents[0]?.previousStatus === null)).toBe(true);
    expect(tickets.every((ticket) => ticket.workflowEvents[0]?.currentStatus === ticket.currentStatus)).toBe(true);
    expect(tickets.every((ticket) => ticket.workflowEvents[0]?.reason === `synthetic-seed:${ticket.submissionKey}:baseline`)).toBe(true);

    const resolved = tickets.find((ticket) => ticket.submissionKey === "lab3-demo-005");
    const closed = tickets.find((ticket) => ticket.submissionKey === "lab3-demo-006");
    expect(resolved).toMatchObject({ currentStatus: "RESOLVED" });
    expect(resolved?.resolvedAt).toBeInstanceOf(Date);
    expect(closed).toMatchObject({ currentStatus: "CLOSED" });
    expect(closed?.resolvedAt).toBeInstanceOf(Date);

    const firstBaselines = tickets.map((ticket) => ({
      submissionKey: ticket.submissionKey,
      resolvedAt: ticket.resolvedAt,
      eventId: ticket.workflowEvents[0]?.id,
      eventCreatedAt: ticket.workflowEvents[0]?.createdAt,
    }));
    await seedReferenceData(prisma);
    const repeated = await prisma.ticket.findMany({
      where: { submissionKey: { in: LAB3_TICKET_FIXTURES.map((fixture) => fixture.key) } },
      include: { workflowEvents: { where: { reason: { startsWith: "synthetic-seed:" } } } },
      orderBy: { submissionKey: "asc" },
    });
    expect(repeated.map((ticket) => ({
      submissionKey: ticket.submissionKey,
      resolvedAt: ticket.resolvedAt,
      eventId: ticket.workflowEvents[0]?.id,
      eventCreatedAt: ticket.workflowEvents[0]?.createdAt,
    }))).toEqual(firstBaselines);

    const administrator = await prisma.requesterUser.findUniqueOrThrow({
      where: { email: "admin@example.test" },
      select: { id: true },
    });
    const reopenedFixture = repeated.find((ticket) => ticket.submissionKey === "lab3-demo-005");
    expect(reopenedFixture).toBeDefined();
    restoreReopenedFixture = async () => {
      await prisma.ticketWorkflowEvent.deleteMany({
        where: { ticketId: reopenedFixture!.id, reason: "integration-test:reopen-synthetic-fixture" },
      });
      await prisma.ticket.update({
        where: { id: reopenedFixture!.id },
        data: { currentStatus: reopenedFixture!.currentStatus, resolvedAt: reopenedFixture!.resolvedAt },
      });
    };
    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: reopenedFixture!.id },
        data: { currentStatus: "REOPENED", resolvedAt: null },
      });
      await tx.ticketWorkflowEvent.create({
        data: {
          ticketId: reopenedFixture!.id,
          actorId: administrator.id,
          previousStatus: "RESOLVED",
          currentStatus: "REOPENED",
          reason: "integration-test:reopen-synthetic-fixture",
        },
      });
    });
    await seedReferenceData(prisma);
    const preservedFixture = await prisma.ticket.findUniqueOrThrow({
      where: { id: reopenedFixture!.id },
      include: { workflowEvents: true },
    });
    expect(preservedFixture).toMatchObject({ currentStatus: "REOPENED", resolvedAt: null });
    expect(preservedFixture.workflowEvents).toHaveLength(2);
    expect(preservedFixture.workflowEvents.filter((event) => event.reason?.startsWith("synthetic-seed:"))).toHaveLength(1);
  });
});
