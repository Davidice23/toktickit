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

The schema and migration/seed/recovery suites passed in PR [#77 CI](https://github.com/Davidice23/toktickit/actions/runs/40923264624) on head `503e3af` using its disposable PostgreSQL service. The PR merged as `be1b800`. These results apply to that exact head; follow-up findings below remain open and must not be described as fixed by the green run.

## Follow-ups recorded from PR #77 review

These items were identified after the #70 implementation and remain visible for
downstream work; no historical workflow identity or resolution time is
fabricated.

- Seeded `RESOLVED`/`CLOSED` Tickets currently have no `resolvedAt`, and the
  seed does not create baseline `TicketWorkflowEvent` rows. Existing Lab 1-3
  Tickets also start with `resolvedAt = NULL` and no workflow history. Before
  #72, decide and document whether legacy resolved rows get an approximate
  migration timestamp (`updatedAt`) or intentionally remain outside the
  “recently resolved” metric; add explicit fixture and migration assertions.
- The seeded cancelled Action currently records its lifecycle event as
  `STATUS_CHANGED`; runtime API writes use `CANCELLED`. Normalize seed events
  and assert matching event kinds before final evidence.
- The migration does not currently have cross-field SQL `CHECK` constraints.
  Issue #66 enforces lifecycle invariants at the service boundary; direct SQL
  writers can still bypass them. Before release, either add a reviewed forward
  migration with compatible constraints and raw-SQL violation tests, or obtain
  an explicit, documented decision to rely solely on the service boundary.
- The migration integration helper currently splits SQL on semicolons. Keep
  migrations free of dollar-quoted blocks until the helper is replaced with a
  robust execution approach. Direct FK `RESTRICT` and scoped idempotency
  uniqueness assertions are still needed in the migration test suite.
