import type { PrismaClient } from "@prisma/client";

export async function backfillLab3(prisma: PrismaClient, passwordHash: string): Promise<void> {
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
}
