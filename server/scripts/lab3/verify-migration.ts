import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
try {
  const [users, tickets, attachments, categories, systems] = await Promise.all([
    prisma.requesterUser.findMany({ select: { id: true, passwordHash: true } }),
    prisma.ticket.findMany({ select: { id: true, requesterId: true, itPriority: true } }),
    prisma.attachment.findMany({ select: { id: true, ticketId: true, storedName: true } }),
    prisma.category.findMany({ select: { id: true } }),
    prisma.relatedSystem.findMany({ select: { id: true } }),
  ]);
  if (users.some((user) => !user.passwordHash)) throw new Error("Migration verification failed: a User has no credential");
  if (tickets.some((ticket) => !ticket.itPriority || !users.some((user) => user.id === ticket.requesterId))) {
    throw new Error("Migration verification failed: Ticket ownership or IT Priority is incomplete");
  }
  if (attachments.some((attachment) => !attachment.storedName || !tickets.some((ticket) => ticket.id === attachment.ticketId))) {
    throw new Error("Migration verification failed: Attachment ownership is incomplete");
  }
  console.log(`Verified ${users.length} users, ${tickets.length} tickets, ${attachments.length} attachments, ${categories.length} categories, and ${systems.length} related systems.`);
} finally {
  await prisma.$disconnect();
}
