# Lab 4 Data Foundation: migration, recovery, and synthetic fixtures

Issue #70 introduces the additive persistence layer required before any Lab 4
Action, workflow, or dashboard endpoint is implemented. It deliberately does
not add runtime routes or UI controls.

## What changes

- `Ticket` gains `workflowVersion` (starting at `1`) and nullable `resolvedAt`.
  Existing `updatedAt` remains an audit timestamp, not a concurrency token.
- `ActionTaken` stores the current safe Action snapshot, its separate assignee,
  automatic future performer, lifecycle fields, idempotency scope, request
  fingerprint, and an Action-level version.
- `ActionTakenEvent` and `TicketWorkflowEvent` provide append-only history.
  Their foreign keys use `RESTRICT`, so audit records cannot be silently
  orphaned by a delete.
- Indexes cover a Ticket's deterministic Action/history order, active work per
  assignee, completed work per performer, dashboard Ticket queries, and
  idempotency lookup. These choices implement Contract rationales 2--4:
  parent workflow coordination, append-only auditability, and stable
  resolution/dashboard semantics.

The migration only creates tables, types, indexes, and nullable/defaulted
columns. It does not rename or rewrite `User`, `Ticket`, `Attachment`,
`PublicComment`, or `InternalNote`; a legacy Ticket with no Action remains a
valid row.

## Safe migration and recovery procedure

Run this only with a disposable PostgreSQL target. Never use `prisma db push`,
`migrate reset`, or a shared/personal course database for this verification.

1. Set a redacted, allowlisted `DATABASE_URL` that points to a disposable
   database or isolated test schema.
2. From `server`, run `npm run prisma:migrate:deploy`, followed by
   `npm run prisma:seed`. Re-running either command must not create duplicate
   Lab 4 fixture Actions.
3. Run `npm run test:lab4`. The migration integration suite bootstraps a fresh
   schema, upgrades a Lab 3-shaped source snapshot, rehydrates that verified
   snapshot into a separate recovery schema, and checks user/Ticket IDs,
   ownership, Attachment metadata and bytes, Public Comments, Internal Notes,
   zero-Action legacy Tickets, new tables, and indexes.
4. If a production-like migration fails after a verified backup, restore that
   backup into a separate disposable target and execute the same integrity
   checks. Do not roll back by deleting new data; prepare a reviewed forward
   fix only after analysing the failure.

The automated recovery test intentionally keeps all schemas uniquely named and
drops only the schemas it created. It never targets a normal user schema.

## Fixture policy

`LAB4_ACTION_FIXTURES` is synthetic and namespace-scoped by each Action's
`idempotencyKey`. It adds planned, in-progress, completed, and cancelled
Actions; zero-, one-, and multiple-Action Tickets; a follow-up case; distinct
assignee and performer examples; and existing active/inactive operational
personas from Lab 3. Upserts use an empty update so a second seed run neither
duplicates Actions nor resets credentials, roles, activation, or unrelated
records.

## Evidence status

The schema validates and the server TypeScript build has been run locally.
Database-backed migration/seed execution is intentionally deferred to the
disposable PostgreSQL GitHub Actions job. Its exact URL, commit SHA, and pass
totals are recorded on the Issue #70 pull request after CI completes.
