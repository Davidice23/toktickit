import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth.js";

export const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

export const RELATED_SYSTEM_NAMES = [
  "Email and Collaboration",
  "Enterprise Resource Planning",
  "Human Resources Information System",
  "Learning Management System",
  "Network and VPN",
  "Student Information System",
] as const;

export const REQUESTERS = [
  { name: "Anan Chaiya", email: "anan.chaiya@example.test", isActive: true },
  { name: "Kanya Prasert", email: "kanya.prasert@example.test", isActive: true },
  { name: "Narin Sombat", email: "narin.sombat@example.test", isActive: true },
  { name: "Pimchanok Dee", email: "pimchanok.dee@example.test", isActive: true },
  { name: "Retired Requester", email: "retired.requester@example.test", isActive: false },
] as const;

export const OPERATIONAL_USERS = [
  { name: "IT Staff One", email: "it.staff.one@example.test", role: "IT_STAFF" as const, isActive: true },
  { name: "IT Staff Two", email: "it.staff.two@example.test", role: "IT_STAFF" as const, isActive: true },
  { name: "IT Staff Three", email: "it.staff.three@example.test", role: "IT_STAFF" as const, isActive: true },
  { name: "Inactive IT Staff", email: "inactive.staff@example.test", role: "IT_STAFF" as const, isActive: false },
  { name: "System Administrator", email: "admin@example.test", role: "ADMINISTRATOR" as const, isActive: true },
] as const;

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD ?? "local-only-password";
  const passwordHash = await hashPassword(initialPassword);
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: { ...requester, passwordHash, role: "REQUESTER", mustChangePassword: true },
    });
  }

  for (const user of OPERATIONAL_USERS) {
    await prisma.requesterUser.upsert({
      where: { email: user.email },
      update: { name: user.name, isActive: user.isActive, role: user.role },
      create: { ...user, passwordHash, mustChangePassword: true },
    });
  }
}
