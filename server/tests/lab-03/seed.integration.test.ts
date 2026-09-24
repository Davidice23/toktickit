import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  LAB3_MESSAGE_FIXTURES,
  LAB3_ATTACHMENT_FIXTURE,
  LAB3_TICKET_FIXTURES,
  OPERATIONAL_USERS,
  REQUESTERS,
  seedReferenceData,
} from "../../prisma/seed-data.js";

const prisma = getPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("Lab 3 local seed fixtures", () => {
  it("is repeat-safe and supplies the role, queue, comment, and note examples", async () => {
    await seedReferenceData(prisma);
    const first = await prisma.ticket.findMany({
      where: { submissionKey: { in: LAB3_TICKET_FIXTURES.map((fixture) => fixture.key) } },
      select: { id: true, submissionKey: true },
      orderBy: { submissionKey: "asc" },
    });
    expect(first).toHaveLength(LAB3_TICKET_FIXTURES.length);

    await seedReferenceData(prisma);
    const second = await prisma.ticket.findMany({
      where: { submissionKey: { in: LAB3_TICKET_FIXTURES.map((fixture) => fixture.key) } },
      include: { publicComments: true, internalNotes: true, attachments: true },
      orderBy: { submissionKey: "asc" },
    });
    expect(second.map(({ id, submissionKey }) => ({ id, submissionKey }))).toEqual(first);
    expect(new Set(second.map((ticket) => ticket.requesterId)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(second.map((ticket) => ticket.currentStatus)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(second.map((ticket) => ticket.requestedPriority)).size).toBe(4);
    expect(second.some((ticket) => ticket.ownerId === null)).toBe(true);
    expect(second.some((ticket) => ticket.ownerId !== null)).toBe(true);
    expect(second.reduce((sum, ticket) => sum + ticket.publicComments.length + ticket.internalNotes.length, 0))
      .toBe(LAB3_MESSAGE_FIXTURES.length);
    expect(second.flatMap((ticket) => ticket.attachments.map((attachment) => attachment.storedName)))
      .toEqual([LAB3_ATTACHMENT_FIXTURE.storedName]);

    const users = await prisma.requesterUser.findMany({
      where: { email: { in: [...REQUESTERS, ...OPERATIONAL_USERS].map((user) => user.email) } },
      select: { email: true, role: true, isActive: true, passwordHash: true },
    });
    expect(users).toHaveLength(REQUESTERS.length + OPERATIONAL_USERS.length);
    expect(users.filter((user) => user.role === "REQUESTER" && user.isActive)).toHaveLength(4);
    expect(users.filter((user) => user.role === "REQUESTER" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
    expect(users.filter((user) => user.role === "IT_STAFF" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "ADMINISTRATOR" && user.isActive)).toHaveLength(1);
    // Another parallel API test may already have completed a first-password change.
    // Re-seeding must not reset that user state or replace an existing credential.
    expect(users.every((user) => Boolean(user.passwordHash))).toBe(true);
  });
});
