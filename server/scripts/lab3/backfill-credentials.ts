import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD;
if (!initialPassword) throw new Error("LAB3_SEED_INITIAL_PASSWORD is required for Lab 3 credential backfill");

const prisma = getPrisma();
try {
  const passwordHash = await hashPassword(initialPassword);
  await prisma.$transaction(async (tx) => {
    const users = await tx.requesterUser.findMany({ select: { id: true, passwordHash: true } });
    for (const user of users) {
      if (!user.passwordHash) {
        await tx.requesterUser.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true } });
      }
    }

    const tickets = await tx.ticket.findMany({ select: { id: true, requestedPriority: true, itPriority: true } });
    for (const ticket of tickets) {
      if (!ticket.itPriority) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { itPriority: ticket.requestedPriority } });
      }
    }
  });
} finally {
  await prisma.$disconnect();
}
