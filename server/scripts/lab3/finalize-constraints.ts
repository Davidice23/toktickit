import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
try {
  const [missingCredentials, missingPriorities] = await Promise.all([
    prisma.requesterUser.count({ where: { passwordHash: null } }),
    prisma.ticket.count({ where: { itPriority: null } }),
  ]);
  if (missingCredentials || missingPriorities) {
    throw new Error(`Cannot finalize migration: ${missingCredentials} credentials and ${missingPriorities} IT priorities remain null`);
  }
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL');
  await prisma.$executeRawUnsafe('ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL');
} finally {
  await prisma.$disconnect();
}
