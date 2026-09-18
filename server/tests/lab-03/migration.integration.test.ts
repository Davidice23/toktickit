import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 migration foundation", () => {
  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("renames the identity table and preserves ownership/priority invariants", async () => {
    const prisma = getPrisma();
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('User', 'RequesterUser', 'Session')
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual(["Session", "User"]);

    const [users, tickets, nullPriorities] = await Promise.all([
      prisma.requesterUser.count(),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { itPriority: null } }),
    ]);
    expect(users).toBeGreaterThanOrEqual(5);
    expect(tickets).toBeGreaterThanOrEqual(0);
    expect(nullPriorities).toBe(0);
  });
});
