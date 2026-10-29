import { afterAll, describe, expect, it } from "vitest";
import {
  LAB3_TICKET_FIXTURES,
  LAB4_ACTION_FIXTURES,
  seedReferenceData,
} from "../../prisma/seed-data.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("Lab 4 synthetic Action seed", () => {
  it("is repeat-safe and supplies the zero, one, and multiple Action cases", async () => {
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
      include: { actions: true },
    });
    expect(tickets.find((ticket) => ticket.submissionKey === "lab3-demo-001")?.actions).toEqual([]);
    expect(tickets.find((ticket) => ticket.submissionKey === "lab3-demo-003")?.actions).toHaveLength(2);
  });
});
