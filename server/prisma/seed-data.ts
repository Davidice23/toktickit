import type { PrismaClient } from "@prisma/client";

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

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
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
      create: requester,
    });
  }
}
