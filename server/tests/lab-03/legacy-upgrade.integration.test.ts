import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../../src/auth.js";
import { backfillLab3 } from "../../src/lab3-migration.js";

const migrations = [
  "20260815163000_init",
  "20260905083000_lab2_data_model",
  "20260917090000_lab3_auth_foundation",
] as const;

async function applyMigration(client: PrismaClient, name: string): Promise<void> {
  const sql = await readFile(resolve(process.cwd(), "prisma", "migrations", name, "migration.sql"), "utf8");
  // These checked-in migrations contain statements and line comments only;
  // execute each statement separately so PostgreSQL enum additions are committed.
  const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) await client.$executeRawUnsafe(statement);
}

describe("Lab 2 to Lab 3 legacy-data migration", () => {
  it("preserves User, Ticket, Attachment IDs and requester ownership", async () => {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) throw new Error("DATABASE_URL is required for the migration integration test");
    const schema = `lab3_migration_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    if (!/^lab3_migration_test_[a-f0-9]{12}$/.test(schema)) throw new Error("Unsafe test schema name");
    const admin = new PrismaClient();
    const shadowUrl = new URL(baseUrl);
    shadowUrl.searchParams.set("schema", schema);
    const shadow = new PrismaClient({ datasources: { db: { url: shadowUrl.toString() } } });
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await applyMigration(shadow, migrations[0]);
      await applyMigration(shadow, migrations[1]);
      await shadow.$executeRawUnsafe('INSERT INTO "Category" ("id", "name") VALUES (51, \'Legacy category\')');
      await shadow.$executeRawUnsafe('INSERT INTO "RelatedSystem" ("id", "name") VALUES (52, \'Legacy system\')');
      await shadow.$executeRawUnsafe('INSERT INTO "RequesterUser" ("id", "name", "email") VALUES (53, \'Legacy requester\', \'legacy@example.test\')');
      await shadow.$executeRawUnsafe(`INSERT INTO "Ticket" ("id", "ticketNumber", "submissionKey", "submissionHash", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority") VALUES (54, 'LEGACY-54', 'legacy-submission', 'legacy-hash', 53, 51, 52, 'Legacy ticket', 'Keep this ticket and its owner', 'HIGH')`);
      await shadow.$executeRawUnsafe(`INSERT INTO "Attachment" ("id", "ticketId", "originalName", "storedName", "mimeType", "sizeBytes") VALUES (55, 54, 'legacy.txt', 'legacy-fixture-55.txt', 'text/plain', 16)`);

      await applyMigration(shadow, migrations[2]);
      const beforeBackfill = await shadow.ticket.findUniqueOrThrow({ where: { id: 54 } });
      expect(beforeBackfill.itPriority).toBeNull();
      const passwordHash = await hashPassword("local-migration-test-password");
      await backfillLab3(shadow, passwordHash);
      await backfillLab3(shadow, passwordHash);

      const user = await shadow.requesterUser.findUniqueOrThrow({ where: { id: 53 } });
      const ticket = await shadow.ticket.findUniqueOrThrow({ where: { id: 54 }, include: { attachments: true } });
      expect(user).toMatchObject({ id: 53, email: "legacy@example.test", role: "REQUESTER", mustChangePassword: true, passwordHash });
      expect(ticket).toMatchObject({ id: 54, requesterId: 53, categoryId: 51, relatedSystemId: 52, requestedPriority: "HIGH", itPriority: "HIGH" });
      expect(ticket.attachments).toEqual([expect.objectContaining({ id: 55, ticketId: 54, storedName: "legacy-fixture-55.txt" })]);
    } finally {
      await shadow.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  });
});
