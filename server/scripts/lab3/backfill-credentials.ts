import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";
import { backfillLab3 } from "../../src/lab3-migration.js";

const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD;
if (!initialPassword) throw new Error("LAB3_SEED_INITIAL_PASSWORD is required for Lab 3 credential backfill");

const prisma = getPrisma();
try {
  const passwordHash = await hashPassword(initialPassword);
  await backfillLab3(prisma, passwordHash);
} finally {
  await prisma.$disconnect();
}
