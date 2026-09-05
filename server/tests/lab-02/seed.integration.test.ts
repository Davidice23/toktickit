import { afterAll, describe, expect, it } from "vitest";
import {
  CATEGORY_NAMES,
  RELATED_SYSTEM_NAMES,
  REQUESTERS,
  seedReferenceData,
} from "../../prisma/seed-data.js";
import { getPrisma } from "../../src/prisma.js";

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("Lab 2 reference-data seed", () => {
  it("is repeat-safe and preserves the required active/inactive fixtures", async () => {
    const prisma = getPrisma();

    await seedReferenceData(prisma);
    await seedReferenceData(prisma);

    const [categories, relatedSystems, requesters] = await Promise.all([
      prisma.category.findMany({
        where: { name: { in: [...CATEGORY_NAMES] } },
        orderBy: { name: "asc" },
      }),
      prisma.relatedSystem.findMany({
        where: { name: { in: [...RELATED_SYSTEM_NAMES] } },
        orderBy: { name: "asc" },
      }),
      prisma.requesterUser.findMany({
        where: { email: { in: REQUESTERS.map(({ email }) => email) } },
        orderBy: { email: "asc" },
      }),
    ]);

    expect(categories).toHaveLength(4);
    expect(categories.every(({ isActive }) => isActive)).toBe(true);
    expect(relatedSystems).toHaveLength(6);
    expect(relatedSystems.every(({ isActive }) => isActive)).toBe(true);
    expect(requesters).toHaveLength(5);
    expect(requesters.filter(({ isActive }) => isActive)).toHaveLength(4);
    expect(requesters.filter(({ isActive }) => !isActive)).toHaveLength(1);
    expect(new Set(requesters.map(({ email }) => email)).size).toBe(5);
  });
});
