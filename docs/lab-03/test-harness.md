# Lab 3 Test Harness Foundation

Issue #37 establishes the runnable test structure before feature
implementation. The approved Contract remains the source of truth for the
test IDs and acceptance-criterion mapping.

## Current baseline

- Server: existing Lab 1/Lab 2 Vitest and Supertest suites continue to run
  against a PostgreSQL service in CI.
- Client: existing Vitest/Testing Library build and tests continue to run.
- E2E: Playwright is pinned under `e2e/`; the five Lab 3 specs currently contain
  explicit skipped placeholders because authentication and application routes
  are implemented by later issues.
- Playwright owns the client dev-server lifecycle through `webServer`; the E2E CI
  job installs the client dependencies before running the harness. This keeps the
  first unskipped browser test from failing because the Vite server was never
  started. API startup and disposable database wiring will be extended when the
  authentication/migration E2E scenarios become executable.
- Lab 3 server/client test paths exist as `describe.todo` entry points. They
  become red/green TDD tests when their dependent implementation issue starts.

## Contract gate clarification

PR #38 is test/CI scaffolding only: it adds no authentication, migration, role,
or ticket behavior. It was reviewed after the Contract PR was approved and does
not bypass the Contract implementation gate. Feature implementation starts only
after the Contract approval is recorded in `reviewer.md`.

## Isolation rules

CI uses a disposable PostgreSQL database named `toktickit_test`.
Integration tests must use `LAB3_TEST_DATABASE_URL` or the CI `DATABASE_URL`
and must never use a personal database. Attachment tests use a temporary
storage directory. Session cookies, CSRF tokens, passwords, and seed secrets
must not be logged.

## Gate for migration tests

The migration issue must add and exercise `npm run lab3:upgrade`, including
credential backfill, verification, and final constraints. Until then, CI only
runs the current Lab 2 migration/seed baseline and does not claim Lab 3
migration behavior passes.
