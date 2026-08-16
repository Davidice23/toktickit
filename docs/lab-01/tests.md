# Lab 1 - Test Plan and Evidence

All automated tests are stored under `client/tests/lab-01/` or `server/tests/lab-01/`.

## Test inventory

| ID | Test file | Tool | Test description | Final result |
|---|---|---|---|---|
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest + Vitest | `GET /api/health` returns HTTP 200 and the required JSON. | Passed |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest + Vitest | `GET /api/categories` returns the four seeded categories in ID order. | Passed |
| API-03 | `server/tests/lab-01/categories.test.ts` | Supertest + Vitest | A database failure returns HTTP 500 without exposing internal details. | Passed |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Testing Library + Vitest | The TokTickIT heading renders. | Passed |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Testing Library + Vitest | Clicking Check System displays the loading state and disables the button. | Passed |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Testing Library + Vitest | An API failure displays Offline and a useful error message. | Passed |
| UI-04 | `client/tests/lab-01/App.test.tsx` | Testing Library + Vitest | A successful request displays Online and all four API-provided categories. | Passed |

## Final main-branch verification

Verification was performed on 16 August 2026 using released `main` commit
`47fb824`, a clean dependency installation, and an isolated PostgreSQL 18
database. The later documentation-only evidence update does not change the
application, database schema, or tests.

Database preparation:

```text
1 migration found in prisma/migrations
Applying migration `20260815163000_init`
All migrations have been successfully applied.

Seed run 1: Seeded 4 IT request categories.
Seed run 2: Seeded 4 IT request categories.
```

Server test output:

```text
Test Files  2 passed (2)
Tests       3 passed (3)
```

Client test output:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Production builds:

```text
Server: npm run build - passed
Client: npm run build - passed
```

Direct HTTP verification:

```text
GET /api/health
status: ok
service: TokTickIT API

GET /api/categories
count: 4
Account and Access, Hardware, Software, Network
```

All commands above passed on `main`. The final submission PDF includes copied
output and browser screenshots for both the success and failure cases.
