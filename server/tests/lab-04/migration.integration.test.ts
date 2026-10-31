import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migrations = [
  "20260815163000_init",
  "20260905083000_lab2_data_model",
  "20260917090000_lab3_auth_foundation",
  "20261030003000_lab4_actions_data_foundation",
  "20261030020000_lab4_action_create_receipts",
] as const;

type LegacySnapshot = {
  category: { id: number; name: string };
  system: { id: number; name: string };
  user: { id: number; name: string; email: string; passwordHash: string; role: string; isActive: boolean; mustChangePassword: boolean };
  ticket: { id: number; ticketNumber: string; submissionKey: string; submissionHash: string; requesterId: number; categoryId: number; relatedSystemId: number; summary: string; description: string; requestedPriority: string };
  attachment: { id: number; ticketId: number; originalName: string; storedName: string; mimeType: string; sizeBytes: number };
  publicComment: { id: number; ticketId: number; authorId: number; body: string };
  internalNote: { id: number; ticketId: number; authorId: number; body: string };
};

async function applyMigration(client: PrismaClient, name: string): Promise<void> {
  const sql = await readFile(resolve(process.cwd(), "prisma", "migrations", name, "migration.sql"), "utf8");
  // The checked-in migrations contain statements and comments only. Execute one
  // statement at a time so PostgreSQL enum changes are committed before use.
  const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await client.$executeRawUnsafe(statement);
}

function schemaName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function schemaClient(baseUrl: string, schema: string): PrismaClient {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}

async function installLegacyFixture(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe('INSERT INTO "Category" ("id", "name") VALUES (51, \'Legacy category\')');
  await client.$executeRawUnsafe('INSERT INTO "RelatedSystem" ("id", "name") VALUES (52, \'Legacy system\')');
  await client.$executeRawUnsafe(`INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword") VALUES (53, 'Legacy requester', 'legacy@example.test', 'legacy-password-hash', 'REQUESTER', true, false)`);
  await client.$executeRawUnsafe(`INSERT INTO "Ticket" ("id", "ticketNumber", "submissionKey", "submissionHash", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority") VALUES (54, 'LEGACY-54', 'legacy-submission', 'legacy-hash', 53, 51, 52, 'Legacy ticket', 'Keep this ticket and its ownership', 'HIGH')`);
  await client.$executeRawUnsafe(`INSERT INTO "Attachment" ("id", "ticketId", "originalName", "storedName", "mimeType", "sizeBytes") VALUES (55, 54, 'legacy.txt', 'legacy-fixture-55.txt', 'text/plain', 16)`);
  await client.$executeRawUnsafe(`INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "body") VALUES (56, 54, 53, 'Legacy public comment')`);
  await client.$executeRawUnsafe(`INSERT INTO "InternalNote" ("id", "ticketId", "authorId", "body") VALUES (57, 54, 53, 'Legacy internal note')`);
}

async function captureLegacySnapshot(client: PrismaClient): Promise<LegacySnapshot> {
  const [category] = await client.$queryRawUnsafe<LegacySnapshot["category"][]>('SELECT "id", "name" FROM "Category" WHERE "id" = 51');
  const [system] = await client.$queryRawUnsafe<LegacySnapshot["system"][]>('SELECT "id", "name" FROM "RelatedSystem" WHERE "id" = 52');
  const [user] = await client.$queryRawUnsafe<LegacySnapshot["user"][]>('SELECT "id", "name", "email", "passwordHash", "role"::text AS "role", "isActive", "mustChangePassword" FROM "User" WHERE "id" = 53');
  const [ticket] = await client.$queryRawUnsafe<LegacySnapshot["ticket"][]>('SELECT "id", "ticketNumber", "submissionKey", "submissionHash", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority"::text AS "requestedPriority" FROM "Ticket" WHERE "id" = 54');
  const [attachment] = await client.$queryRawUnsafe<LegacySnapshot["attachment"][]>('SELECT "id", "ticketId", "originalName", "storedName", "mimeType", "sizeBytes" FROM "Attachment" WHERE "id" = 55');
  const [publicComment] = await client.$queryRawUnsafe<LegacySnapshot["publicComment"][]>('SELECT "id", "ticketId", "authorId", "body" FROM "PublicComment" WHERE "id" = 56');
  const [internalNote] = await client.$queryRawUnsafe<LegacySnapshot["internalNote"][]>('SELECT "id", "ticketId", "authorId", "body" FROM "InternalNote" WHERE "id" = 57');
  if (!category || !system || !user || !ticket || !attachment || !publicComment || !internalNote) throw new Error("Legacy snapshot was incomplete");
  return { category, system, user, ticket, attachment, publicComment, internalNote };
}

async function restoreLegacySnapshot(client: PrismaClient, snapshot: LegacySnapshot): Promise<void> {
  await client.$executeRawUnsafe('INSERT INTO "Category" ("id", "name") VALUES ($1, $2)', snapshot.category.id, snapshot.category.name);
  await client.$executeRawUnsafe('INSERT INTO "RelatedSystem" ("id", "name") VALUES ($1, $2)', snapshot.system.id, snapshot.system.name);
  await client.$executeRawUnsafe('INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword") VALUES ($1, $2, $3, $4, $5::"Role", $6, $7)', snapshot.user.id, snapshot.user.name, snapshot.user.email, snapshot.user.passwordHash, snapshot.user.role, snapshot.user.isActive, snapshot.user.mustChangePassword);
  await client.$executeRawUnsafe('INSERT INTO "Ticket" ("id", "ticketNumber", "submissionKey", "submissionHash", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::"RequestedPriority")', snapshot.ticket.id, snapshot.ticket.ticketNumber, snapshot.ticket.submissionKey, snapshot.ticket.submissionHash, snapshot.ticket.requesterId, snapshot.ticket.categoryId, snapshot.ticket.relatedSystemId, snapshot.ticket.summary, snapshot.ticket.description, snapshot.ticket.requestedPriority);
  await client.$executeRawUnsafe('INSERT INTO "Attachment" ("id", "ticketId", "originalName", "storedName", "mimeType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6)', snapshot.attachment.id, snapshot.attachment.ticketId, snapshot.attachment.originalName, snapshot.attachment.storedName, snapshot.attachment.mimeType, snapshot.attachment.sizeBytes);
  await client.$executeRawUnsafe('INSERT INTO "PublicComment" ("id", "ticketId", "authorId", "body") VALUES ($1, $2, $3, $4)', snapshot.publicComment.id, snapshot.publicComment.ticketId, snapshot.publicComment.authorId, snapshot.publicComment.body);
  await client.$executeRawUnsafe('INSERT INTO "InternalNote" ("id", "ticketId", "authorId", "body") VALUES ($1, $2, $3, $4)', snapshot.internalNote.id, snapshot.internalNote.ticketId, snapshot.internalNote.authorId, snapshot.internalNote.body);
}

async function expectPostMigrationIntegrity(client: PrismaClient, snapshot: LegacySnapshot, attachmentPath: string): Promise<void> {
  const user = await client.requesterUser.findUniqueOrThrow({ where: { id: snapshot.user.id } });
  const ticket = await client.ticket.findUniqueOrThrow({
    where: { id: snapshot.ticket.id },
    include: { attachments: true, publicComments: true, internalNotes: true, actions: true, workflowEvents: true },
  });
  expect(user).toMatchObject({ id: 53, email: "legacy@example.test", role: "REQUESTER", passwordHash: "legacy-password-hash", mustChangePassword: false });
  expect(ticket).toMatchObject({ id: 54, requesterId: 53, categoryId: 51, relatedSystemId: 52, workflowVersion: 1, resolvedAt: null });
  expect(ticket.attachments).toEqual([expect.objectContaining({ id: 55, ticketId: 54, storedName: "legacy-fixture-55.txt", sizeBytes: 16 })]);
  expect(ticket.publicComments).toEqual([expect.objectContaining({ id: 56, authorId: 53, body: "Legacy public comment" })]);
  expect(ticket.internalNotes).toEqual([expect.objectContaining({ id: 57, authorId: 53, body: "Legacy internal note" })]);
  expect(ticket.actions).toEqual([]);
  expect(ticket.workflowEvents).toEqual([]);
  expect(await client.actionTakenEvent.count()).toBe(0);
  expect(await readFile(attachmentPath, "utf8")).toBe("legacy attachment\n");
}

describe.sequential("Lab 4 additive migration and recovery", () => {
  it("bootstraps fresh, upgrades a Lab 3 snapshot, and restores it into a disposable schema", async () => {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) throw new Error("DATABASE_URL is required for the migration integration test");
    const sourceSchema = schemaName("lab4_source");
    const recoverySchema = schemaName("lab4_recovery");
    const freshSchema = schemaName("lab4_fresh");
    const admin = new PrismaClient();
    const source = schemaClient(baseUrl, sourceSchema);
    const recovery = schemaClient(baseUrl, recoverySchema);
    const fresh = schemaClient(baseUrl, freshSchema);
    const attachmentDirectory = await mkdtemp(resolve(tmpdir(), "toktickit-lab4-recovery-"));
    const attachmentPath = resolve(attachmentDirectory, "legacy-fixture-55.txt");
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${sourceSchema}"`);
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${recoverySchema}"`);
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${freshSchema}"`);

      for (const migration of migrations.slice(0, 3)) await applyMigration(source, migration);
      await installLegacyFixture(source);
      await writeFile(attachmentPath, "legacy attachment\n");
      const snapshot = await captureLegacySnapshot(source);
      await applyMigration(source, migrations[3]);
      await expectPostMigrationIntegrity(source, snapshot, attachmentPath);
      // A pre-receipt Action survives the additive migration without a fabricated response.
      const priorAction = await source.actionTaken.create({ data: {
        ticketId: 54, assigneeId: 53, createdById: 53, description: "Historical migration fixture",
        idempotencyKey: "legacy-action-key", requestFingerprint: "legacy-action-fingerprint",
      }, select: { id: true, description: true } });
      await applyMigration(source, migrations[4]);
      const preserved = await source.actionTaken.findUniqueOrThrow({ where: { id: priorAction.id }, include: { createReceipt: true } });
      expect(preserved).toMatchObject({ id: priorAction.id, description: priorAction.description, createReceipt: null });

      for (const migration of migrations.slice(0, 3)) await applyMigration(recovery, migration);
      await restoreLegacySnapshot(recovery, snapshot);
      await applyMigration(recovery, migrations[3]);
      await expectPostMigrationIntegrity(recovery, snapshot, attachmentPath);
      await applyMigration(recovery, migrations[4]);
      expect(await recovery.actionCreateReceipt.count()).toBe(0);

      for (const migration of migrations) await applyMigration(fresh, migration);
      expect(await fresh.actionTaken.count()).toBe(0);
      expect(await fresh.actionCreateReceipt.count()).toBe(0);
      expect(await fresh.actionTakenEvent.count()).toBe(0);
      expect(await fresh.ticketWorkflowEvent.count()).toBe(0);
      const indexes = await fresh.$queryRawUnsafe<Array<{ indexname: string }>>("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()");
      expect(indexes.map((index) => index.indexname)).toEqual(expect.arrayContaining([
        "ActionTaken_ticketId_status_id_idx",
        "ActionTaken_assigneeId_status_updatedAt_idx",
        "ActionTakenEvent_actionId_createdAt_id_idx",
        "TicketWorkflowEvent_ticketId_createdAt_id_idx",
        "Ticket_resolvedAt_requesterId_idx",
      ]));
    } finally {
      await source.$disconnect();
      await recovery.$disconnect();
      await fresh.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${sourceSchema}" CASCADE`);
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${recoverySchema}" CASCADE`);
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${freshSchema}" CASCADE`);
      await admin.$disconnect();
      await rm(attachmentDirectory, { recursive: true, force: true });
    }
  });
});
