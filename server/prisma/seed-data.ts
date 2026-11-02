import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

// These stable submission keys keep the demo queue repeat-safe without touching
// Tickets created by a student or migrated from Lab 2.
export const LAB3_TICKET_FIXTURES = [
  { key: "lab3-demo-001", number: "L3-DEMO-001", requesterEmail: REQUESTERS[0].email, ownerEmail: null, category: "Account and Access", system: "Email and Collaboration", summary: "Cannot sign in to webmail", description: "The sign-in page rejects the local lab account on a shared workstation.", requestedPriority: "HIGH", status: "NEW" },
  { key: "lab3-demo-002", number: "L3-DEMO-002", requesterEmail: REQUESTERS[1].email, ownerEmail: OPERATIONAL_USERS[0].email, category: "Hardware", system: "Student Information System", summary: "Laptop will not start", description: "The device shows a blank screen after power-on; a loaner may be needed.", requestedPriority: "URGENT", status: "OPEN" },
  { key: "lab3-demo-003", number: "L3-DEMO-003", requesterEmail: REQUESTERS[2].email, ownerEmail: OPERATIONAL_USERS[1].email, category: "Software", system: "Learning Management System", summary: "Course files fail to upload", description: "A small PDF upload fails after the progress bar reaches the end.", requestedPriority: "MEDIUM", status: "IN_PROGRESS" },
  { key: "lab3-demo-004", number: "L3-DEMO-004", requesterEmail: REQUESTERS[3].email, ownerEmail: OPERATIONAL_USERS[2].email, category: "Network", system: "Network and VPN", summary: "VPN connection drops", description: "The connection ends after a few minutes and needs a diagnostic log from the requester.", requestedPriority: "LOW", status: "WAITING_FOR_REQUESTER" },
  { key: "lab3-demo-005", number: "L3-DEMO-005", requesterEmail: REQUESTERS[0].email, ownerEmail: OPERATIONAL_USERS[0].email, category: "Software", system: "Enterprise Resource Planning", summary: "Report export fails", description: "The CSV export was repaired and is ready for requester confirmation.", requestedPriority: "MEDIUM", status: "RESOLVED" },
  { key: "lab3-demo-006", number: "L3-DEMO-006", requesterEmail: REQUESTERS[1].email, ownerEmail: OPERATIONAL_USERS[1].email, category: "Account and Access", system: "Human Resources Information System", summary: "Access restored to payroll portal", description: "The access issue was resolved and the ticket was formally closed.", requestedPriority: "LOW", status: "CLOSED" },
  { key: "lab3-demo-007", number: "L3-DEMO-007", requesterEmail: REQUESTERS[2].email, ownerEmail: OPERATIONAL_USERS[2].email, category: "Network", system: "Network and VPN", summary: "Wireless issue returned", description: "The issue returned after an earlier resolution and needs another inspection.", requestedPriority: "HIGH", status: "REOPENED" },
  { key: "lab3-demo-008", number: "L3-DEMO-008", requesterEmail: REQUESTERS[3].email, ownerEmail: null, category: "Hardware", system: "Student Information System", summary: "Duplicate docking-station request", description: "The requester cancelled this duplicate request before work began.", requestedPriority: "LOW", status: "CANCELLED" },
] as const;

export const LAB3_MESSAGE_FIXTURES = [
  { ticketKey: "lab3-demo-003", authorEmail: OPERATIONAL_USERS[1].email, kind: "public", body: "Demo update: we are checking the upload failure with a small test file." },
  { ticketKey: "lab3-demo-004", authorEmail: OPERATIONAL_USERS[2].email, kind: "public", body: "Demo update: please provide the approximate time of the last disconnect." },
  { ticketKey: "lab3-demo-003", authorEmail: OPERATIONAL_USERS[1].email, kind: "internal", body: "Demo internal note: reproduce in the lab environment before changing configuration." },
  { ticketKey: "lab3-demo-004", authorEmail: OPERATIONAL_USERS[2].email, kind: "internal", body: "Demo internal note: review the local VPN test log; do not post it publicly." },
] as const;

export const LAB3_ATTACHMENT_FIXTURE = {
  ticketKey: "lab3-demo-003",
  storedName: "lab3-seed-diagnostic.txt",
  originalName: "demo-diagnostic.txt",
  body: "Synthetic Lab 3 diagnostic attachment. No personal or production information.\n",
} as const;

// Lab 4 fixtures are deliberately namespaced by their idempotency keys. They
// augment the Lab 3 queue without rewriting a student's existing records.
// The set provides zero-, one-, and multiple-Action Tickets plus every Action
// status required by the dashboard and lifecycle test matrix.
export const LAB4_ACTION_FIXTURES = [
  {
    key: "lab4-action-001",
    ticketKey: "lab3-demo-002",
    createdByEmail: OPERATIONAL_USERS[0].email,
    assigneeEmail: OPERATIONAL_USERS[1].email,
    performedByEmail: null,
    status: "PLANNED",
    description: "Inspect the startup sequence and collect the device diagnostics.",
    result: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: "Use the existing hardware diagnostic attachment if the requester provides one.",
    actionAt: null,
    cancelledAt: null,
    cancellationReason: null,
  },
  {
    key: "lab4-action-002",
    ticketKey: "lab3-demo-003",
    createdByEmail: OPERATIONAL_USERS[0].email,
    assigneeEmail: OPERATIONAL_USERS[0].email,
    performedByEmail: null,
    status: "IN_PROGRESS",
    description: "Reproduce the course-file upload failure with a minimal PDF.",
    result: null,
    followUpRequired: true,
    followUpNote: "Requester will retry the upload after the service-side fix is deployed.",
    attachmentNotes: "Refer to the existing synthetic diagnostic text attachment.",
    actionAt: null,
    cancelledAt: null,
    cancellationReason: null,
  },
  {
    key: "lab4-action-003",
    ticketKey: "lab3-demo-003",
    createdByEmail: OPERATIONAL_USERS[1].email,
    assigneeEmail: OPERATIONAL_USERS[1].email,
    performedByEmail: OPERATIONAL_USERS[1].email,
    status: "COMPLETED",
    description: "Verify the configured upload-size limit in the test environment.",
    result: "The configured limit accepts the representative PDF upload.",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    actionAt: "2026-10-30T00:00:00.000Z",
    cancelledAt: null,
    cancellationReason: null,
  },
  {
    key: "lab4-action-004",
    ticketKey: "lab3-demo-004",
    createdByEmail: OPERATIONAL_USERS[2].email,
    assigneeEmail: OPERATIONAL_USERS[2].email,
    performedByEmail: null,
    status: "CANCELLED",
    description: "Arrange an on-site VPN observation session.",
    result: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    actionAt: null,
    cancelledAt: "2026-10-30T00:01:00.000Z",
    cancellationReason: "The requester supplied enough timestamps for remote analysis instead.",
  },
] as const;

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  // This timestamp labels the synthetic snapshot written below; it is not a
  // claim about when a real Ticket was resolved or when a transition occurred.
  const syntheticSnapshotAt = new Date();
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


  const userIds = new Map(
    (await prisma.requesterUser.findMany({
      where: { email: { in: [...REQUESTERS, ...OPERATIONAL_USERS].map((user) => user.email) } },
      select: { id: true, email: true },
    })).map((user) => [user.email, user.id]),
  );
  const categoryIds = new Map(
    (await prisma.category.findMany({ where: { name: { in: [...CATEGORY_NAMES] } }, select: { id: true, name: true } }))
      .map((category) => [category.name, category.id]),
  );
  const systemIds = new Map(
    (await prisma.relatedSystem.findMany({ where: { name: { in: [...RELATED_SYSTEM_NAMES] } }, select: { id: true, name: true } }))
      .map((system) => [system.name, system.id]),
  );
  const requiredId = (id: number | undefined, label: string): number => {
    if (id === undefined) throw new Error(`Missing Lab 3 seed reference: ${label}`);
    return id;
  };

  const ticketIds = new Map<string, number>();
  for (const fixture of LAB3_TICKET_FIXTURES) {
    const requesterId = requiredId(userIds.get(fixture.requesterEmail), fixture.requesterEmail);
    const ticket = await prisma.ticket.upsert({
      where: { requesterId_submissionKey: { requesterId, submissionKey: fixture.key } },
      update: {},
      create: {
        ticketNumber: fixture.number,
        submissionKey: fixture.key,
        submissionHash: `local-demo-${fixture.key}`,
        requesterId,
        ownerId: fixture.ownerEmail ? requiredId(userIds.get(fixture.ownerEmail), fixture.ownerEmail) : null,
        categoryId: requiredId(categoryIds.get(fixture.category), fixture.category),
        relatedSystemId: requiredId(systemIds.get(fixture.system), fixture.system),
        summary: fixture.summary,
        description: fixture.description,
        requestedPriority: fixture.requestedPriority,
        itPriority: fixture.requestedPriority,
        currentStatus: fixture.status,
      },
      select: { id: true, currentStatus: true, resolvedAt: true },
    });
    ticketIds.set(fixture.key, ticket.id);

    // Stable submission keys identify only the deterministic demo fixtures.
    // Never infer historical data for an ordinary/migrated Ticket. Preserve
    // any workflow history or resolution timestamp already written by the app.
    if (ticket.currentStatus === fixture.status) {
      const baselineReason = `synthetic-seed:${fixture.key}:baseline`;
      const workflowEvents = await prisma.ticketWorkflowEvent.findMany({
        where: { ticketId: ticket.id },
        select: { reason: true },
      });
      const hasHistoryBeyondBaseline = workflowEvents.some((event) => event.reason !== baselineReason);
      const hasBaseline = workflowEvents.some((event) => event.reason === baselineReason);
      if (!hasBaseline && workflowEvents.length === 0) {
        await prisma.ticketWorkflowEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: requiredId(userIds.get(OPERATIONAL_USERS[4].email), OPERATIONAL_USERS[4].email),
            previousStatus: null,
            currentStatus: ticket.currentStatus,
            reason: baselineReason,
            createdAt: syntheticSnapshotAt,
          },
        });
      }

      if (
        !hasHistoryBeyondBaseline &&
        (fixture.status === "RESOLVED" || fixture.status === "CLOSED") &&
        ticket.resolvedAt === null
      ) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { resolvedAt: syntheticSnapshotAt },
        });
      }
    }
  }

  for (const fixture of LAB3_MESSAGE_FIXTURES) {
    const ticketId = requiredId(ticketIds.get(fixture.ticketKey), fixture.ticketKey);
    const authorId = requiredId(userIds.get(fixture.authorEmail), fixture.authorEmail);
    if (fixture.kind === "public") {
      const existing = await prisma.publicComment.findFirst({
        where: { ticketId, authorId, body: fixture.body },
        select: { id: true },
      });
      if (!existing) await prisma.publicComment.create({ data: { ticketId, authorId, body: fixture.body } });
    } else {
      const existing = await prisma.internalNote.findFirst({
        where: { ticketId, authorId, body: fixture.body },
        select: { id: true },
      });
      if (!existing) await prisma.internalNote.create({ data: { ticketId, authorId, body: fixture.body } });
    }
  }

  const attachmentRoot = path.resolve(process.cwd(), "storage", "attachments");
  await mkdir(attachmentRoot, { recursive: true });
  const attachmentPath = path.join(attachmentRoot, LAB3_ATTACHMENT_FIXTURE.storedName);
  try {
    await writeFile(attachmentPath, LAB3_ATTACHMENT_FIXTURE.body, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readFile(attachmentPath, "utf8") !== LAB3_ATTACHMENT_FIXTURE.body) {
      throw new Error("Existing Lab 3 demo attachment differs from the expected synthetic fixture");
    }
  }
  await prisma.attachment.upsert({
    where: { storedName: LAB3_ATTACHMENT_FIXTURE.storedName },
    update: {},
    create: {
      ticketId: requiredId(ticketIds.get(LAB3_ATTACHMENT_FIXTURE.ticketKey), LAB3_ATTACHMENT_FIXTURE.ticketKey),
      originalName: LAB3_ATTACHMENT_FIXTURE.originalName,
      storedName: LAB3_ATTACHMENT_FIXTURE.storedName,
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(LAB3_ATTACHMENT_FIXTURE.body),
    },
  });

  for (const fixture of LAB4_ACTION_FIXTURES) {
    const ticketId = requiredId(ticketIds.get(fixture.ticketKey), fixture.ticketKey);
    const createdById = requiredId(userIds.get(fixture.createdByEmail), fixture.createdByEmail);
    const action = await prisma.actionTaken.upsert({
      where: {
        ticketId_createdById_idempotencyKey: {
          ticketId,
          createdById,
          idempotencyKey: fixture.key,
        },
      },
      update: {},
      create: {
        ticketId,
        createdById,
        assigneeId: requiredId(userIds.get(fixture.assigneeEmail), fixture.assigneeEmail),
        performedById: fixture.performedByEmail
          ? requiredId(userIds.get(fixture.performedByEmail), fixture.performedByEmail)
          : null,
        status: fixture.status,
        description: fixture.description,
        result: fixture.result,
        followUpRequired: fixture.followUpRequired,
        followUpNote: fixture.followUpNote,
        attachmentNotes: fixture.attachmentNotes,
        actionAt: fixture.actionAt ? new Date(fixture.actionAt) : null,
        cancelledAt: fixture.cancelledAt ? new Date(fixture.cancelledAt) : null,
        cancellationReason: fixture.cancellationReason,
        idempotencyKey: fixture.key,
        requestFingerprint: `seed:${fixture.key}`,
      },
      select: { id: true },
    });

    const createdReason = `seed:${fixture.key}:created`;
    const createdEvent = await prisma.actionTakenEvent.findFirst({
      where: { actionId: action.id, kind: "CREATED", reason: createdReason },
      select: { id: true },
    });
    if (!createdEvent) {
      await prisma.actionTakenEvent.create({
        data: {
          actionId: action.id,
          actorId: createdById,
          kind: "CREATED",
          toStatus: "PLANNED",
          reason: createdReason,
        },
      });
    }

    if (fixture.status !== "PLANNED") {
      const lifecycleReason = `seed:${fixture.key}:${fixture.status}`;
      const lifecycleEvent = await prisma.actionTakenEvent.findFirst({
        where: { actionId: action.id, kind: "STATUS_CHANGED", toStatus: fixture.status, reason: lifecycleReason },
        select: { id: true },
      });
      if (!lifecycleEvent) {
        await prisma.actionTakenEvent.create({
          data: {
            actionId: action.id,
            actorId: fixture.performedByEmail
              ? requiredId(userIds.get(fixture.performedByEmail), fixture.performedByEmail)
              : createdById,
            kind: "STATUS_CHANGED",
            fromStatus: "PLANNED",
            toStatus: fixture.status,
            reason: lifecycleReason,
          },
        });
      }
    }
  }
}
