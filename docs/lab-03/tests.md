# Lab 3 Test Plan and Traceability

> Contract status: Approved by Sxr1n; implementation and final verification may proceed.

Historical status: PR #58 and the post-#59 final-main CI passed their server,
client, and browser jobs on 2026-09-18. That browser suite had 7 tests. The
52-row table below is the **contract test inventory**, not proof that every
described assertion ran. A later remediation branch has stronger local tests;
it still needs its own PR, review, and final-main CI rerun.

## 1. Test strategy

Lab 3 uses Spec DD, Test DD, and TDD. For each feature, write or finalize the mapped test first, capture the initial red reason in the PR, implement the smallest conforming behavior, then refactor while retaining the contract.

Coverage layers:

- Unit tests for password rules, normalization, session expiry, CSRF, role checks, status transitions, queue query parsing, comment/note validation, and Administrator safety predicates.
- API/integration tests with Supertest and PostgreSQL for migrations, seed repeatability, authentication, authorization, ownership, queue/detail workflows, comments/notes, Attachments, and User Management.
- React component tests with Testing Library for controls, role navigation, feedback states, validation, focus, badges, and safe failures.
- Regression tests for every retained Lab 2 Requester and Attachment capability after removal of the Development Requester selector.
- End-to-end tests with the real client, server, test database, seeded roles, session cookie, and representative workflows.
- Manual/automated responsive and accessibility inspection at 1440px, 820px, and 390px.

Rows below retain the pre-implementation Spec DD / Test DD plan. Their status
means the named file ran in the historical CI job, not that every sentence in
the row was separately asserted. Section 10 records the newer executed checks.

## 2. Test environment and isolation

- Use a dedicated Lab 3 PostgreSQL database, never a personal or production database.
- Apply committed Prisma migrations before the server suite.
- Run the idempotent seed twice and verify stable role, user, Ticket, comment, note, and Attachment fixtures.
- Use factories for unique test users/Tickets and cleanup transactions or scoped deletes.
- Keep the session cookie and CSRF token in test-local variables; never log them.
- Use a temporary Attachment storage directory and remove it after the suite.
- Run database integration files serially or isolate their fixtures to avoid cross-file mutation.
- Client tests mock only the HTTP boundary and verify credentials/error handling through the shared API helper.
- E2E starts the real client and API against the dedicated test database.

## 3. Required test files

### Server API/integration

- server/tests/lab-03/auth.api.test.ts
- server/tests/lab-03/authorization.api.test.ts
- server/tests/lab-03/staff-queue.api.test.ts
- server/tests/lab-03/staff-ticket-detail.api.test.ts
- server/tests/lab-03/comments-notes.api.test.ts
- server/tests/lab-03/users-admin.api.test.ts

### Client component/UI

- client/tests/lab-03/Login.test.tsx
- client/tests/lab-03/ChangePassword.test.tsx
- client/tests/lab-03/StaffTicketQueue.test.tsx
- client/tests/lab-03/StaffTicketDetail.test.tsx
- client/tests/lab-03/UserManagement.test.tsx

### Browser end-to-end

- e2e/lab-03/authentication.spec.ts
- e2e/lab-03/staff-ticket-flow.spec.ts
- e2e/lab-03/user-administration.spec.ts

Additional planned files (allowed alongside the minimum Lab set):

- server/tests/lab-03/migration.integration.test.ts
- server/tests/lab-03/seed.integration.test.ts
- client/tests/lab-03/RequesterRegression.test.tsx
- client/tests/lab-03/RoleNavigation.test.tsx
- e2e/lab-03/requester-regression.spec.ts
- e2e/lab-03/responsive-visual.spec.ts
- e2e/lab-03/evidence-capture.spec.ts (new desktop/tablet/mobile screenshots)
- server/tests/lab-03/legacy-upgrade.integration.test.ts (new real legacy-schema test)

## 4. Planned test inventory

| Test ID | Type | Requirement | Planned check | File | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-02, BR-05 | Email normalization and password boundaries | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| UNIT-02 | Unit | BR-06, BR-08 | Session expiry, revoke, token and CSRF validation | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| UNIT-03 | Unit | BR-18 | Status transition matrix accepts/rejects exact edges | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| UNIT-04 | Unit | BR-23, BR-24 | Comment/note trim, blank and length limits | server/tests/lab-03/comments-notes.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| UNIT-05 | Unit | BR-26, BR-27 | Self-deactivation and last-admin safety predicates | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-01 | API | FR-01, AC-01 | Valid active login establishes session and safe User response | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-02 | API | BR-03, AC-02 | Invalid and inactive credentials share safe 401 response | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-03 | API | FR-03, AC-04 | Current user, logout, revoked session, and expired session | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-04 | API | FR-04, AC-03 | Initial password blocks normal routes until valid change | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-05 | API | BR-08 | Missing/invalid CSRF token blocks mutations | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-06 | API | FR-07, BR-10, AC-06 | Requester creation derives owner from session despite spoofed header/body | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-07 | API | FR-08, FR-09, AC-07 | Authenticated Requester list/detail/Attachment regression | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-08 | API | BR-11, BR-12 | Cross-owner Ticket and Attachment resources use safe ownership response | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-09 | API | FR-12, AC-09 | Staff Queue search, filters, sorting, pagination, metadata | server/tests/lab-03/staff-queue.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-10 | API | FR-13, AC-10 | Staff Ticket Detail includes permitted operational data | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-11 | API | FR-14, BR-13, BR-14, AC-11 | Atomic claim and separate reassign/unassign validate active allowed owner and conflicts | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-12 | API | FR-15, BR-15, BR-16, AC-12 | IT Priority differs from Requested Priority and is restricted to IT Staff/Administrator | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-13 | API | FR-16, BR-17, BR-18, AC-12 | Valid status transition and invalid transition rejection | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-14 | API | FR-18, FR-19, BR-21, BR-22, AC-13 | Public/Internal visibility and role authorization | server/tests/lab-03/comments-notes.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-15 | API | FR-20, BR-23, BR-24 | Append-only comments/notes reject blank/oversized content | server/tests/lab-03/comments-notes.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-16 | API | FR-10, FR-21, AC-08 | Requester resolution indication cannot set formal status | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-17 | API | FR-23, AC-15 | Administrator list/search/optional role filter | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-18 | API | FR-24, AC-16 | Administrator creates one-role user with initial password | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-19 | API | FR-25, AC-17 | Administrator edits name/email/role/active state | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-20 | API | FR-27, AC-18 | Duplicate email, invalid role, and invalid input are safe conflicts/validation | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-21 | API | FR-26, BR-29, AC-19 | Initial password reset forces next-login change and revokes sessions | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-22 | API | FR-27, BR-26, BR-27, AC-20 | Self-deactivation and last-admin removal are prevented transactionally | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-23 | API | FR-06, AC-21 | Non-Administrators cannot access User Management | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-24 | Integration | BR-31, BR-32, AC-24 | Migration preserves IDs/data | server/tests/lab-03/migration.integration.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-25 | Integration | BR-32, AC-24 | Seed runs twice without duplicate users, Tickets, comments, notes, or references | server/tests/lab-03/seed.integration.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-26 | Authorization | FR-12-FR-17, AC-09-AC-13 | Administrator can use the operational queue, assignment, priority, status, comments, and notes allowed by the matrix | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-27 | Security | BR-04, AC-02 | Login throttles after five failures per email/IP window and returns 429 with Retry-After | server/tests/lab-03/auth.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-28 | Migration | BR-16, BR-31, AC-24 | Existing Tickets receive IT Priority copied from Requested Priority without changing IDs or ownership | server/tests/lab-03/migration.integration.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-29 | Security | BR-28, AC-17 | Administrator deactivation revokes existing sessions and blocks subsequent access | server/tests/lab-03/users-admin.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-30 | API | BR-23, AC-13 | Public Comments and Internal Notes have no edit/delete endpoint and remain append-only | server/tests/lab-03/comments-notes.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-31 | Authorization | FR-22, AC-10 | Requester upload/remove versus Staff/Administrator metadata/download Attachment policy | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-32 | Authorization | FR-06, AC-05 | Exhaustive role matrix checks: unauthenticated, Requester-to-Staff, Staff-to-Admin, Admin staff operations, and Requester ownership | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| API-33 | Error handling | BR-30, AC-14 | Unexpected server failure returns safe 500 envelope with correlationId and no stack/detail leak | server/tests/lab-03/authorization.api.test.ts | Planned scenario; source file ran in PR #58 CI |
| UI-01 | UI | FR-01, AC-01, AC-02 | Login labels, validation, busy, safe failure, success routing | client/tests/lab-03/Login.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-02 | UI | FR-04, AC-03 | Change Password validation, busy, failure, continuation | client/tests/lab-03/ChangePassword.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-03 | UI | FR-06, AC-04, AC-05 | Authenticated shell, role navigation, logout, direct-route guard | client/tests/lab-03/Login.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-04 | UI | FR-12, AC-09 | Staff Queue controls, rows/cards, pagination and feedback | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-05 | UI | FR-13, AC-10, AC-12 | Staff Detail operational fields, badges, comments, notes, failures | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-06 | UI | FR-23-FR-28, AC-15-AC-21 | User Management list/forms/safety feedback/forbidden state | client/tests/lab-03/UserManagement.test.tsx | Planned scenario; source file ran in PR #58 CI |
| UI-07 | Regression | FR-07-FR-11, AC-07, AC-08 | Requester Create/List/Detail/Attachment flows use session identity | client/tests/lab-03/RequesterRegression.test.tsx | Planned scenario; source file ran in PR #58 CI |
| STYLE-01 | UI style | AC-22, AC-23 | Zen Green tokens, badges, error association, focus and readonly treatment | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned scenario; source file ran in PR #58 CI |
| STYLE-02 | Responsive | AC-22, AC-23 | Equivalent table/card content and no horizontal overflow | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned scenario; source file ran in PR #58 CI |
| E2E-01 | E2E | AC-01-AC-04 | Login, initial password, shell, logout, direct access blocking | e2e/lab-03/authentication.spec.ts | Planned scenario; source file ran in PR #58 CI |
| E2E-02 | E2E | AC-09-AC-14 | Staff queue/detail, assignment, priority, status, comments, notes, failure | e2e/lab-03/staff-ticket-flow.spec.ts | Planned scenario; source file ran in PR #58 CI |
| E2E-03 | E2E | AC-15-AC-21 | Administrator user lifecycle and safety rules | e2e/lab-03/user-administration.spec.ts | Planned scenario; source file ran in PR #58 CI |
| E2E-04 | E2E/visual | AC-22, AC-23 | Desktop/tablet/mobile screenshots and keyboard/accessibility checks | e2e/lab-03/responsive-visual.spec.ts | Planned scenario; source file ran in PR #58 CI |
| E2E-05 | E2E/regression | AC-06-AC-08 | Requester creates/lists/opens Tickets, uses Attachments/comments, and cannot use staff-only operations | e2e/lab-03/requester-regression.spec.ts | Planned scenario; source file ran in PR #58 CI |

## 5. Acceptance-criterion traceability

| AC | Planned tests and evidence |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-01, E2E-01 |
| AC-03 | API-04, UI-02, E2E-01 |
| AC-04 | API-03, UI-03, E2E-01 |
| AC-05 | API-06, API-08, API-23, API-26, API-32, UI-03, E2E-01, E2E-02, E2E-03 |
| AC-06 | API-06, API-08, API-31, E2E-05 |
| AC-07 | API-07, UI-07, E2E-05 |
| AC-08 | API-16, UI-07, E2E-05 |
| AC-09 | API-09, UI-04, E2E-02 |
| AC-10 | API-10, API-31, UI-05, E2E-02 |
| AC-11 | API-11, UI-05, E2E-02 |
| AC-12 | API-12, API-13, UI-05, E2E-02 |
| AC-13 | API-14, API-15, API-30, UI-05, E2E-02 |
| AC-14 | API-20, API-33, UI-01, UI-04, UI-05, UI-06, E2E-02, E2E-03 |
| AC-15 | API-17, UI-06, E2E-03 |
| AC-16 | API-18, UI-06, E2E-03 |
| AC-17 | API-19, API-29, UI-06, E2E-03 |
| AC-18 | API-20, UI-06, E2E-03 |
| AC-19 | API-21, UI-02, E2E-03 |
| AC-20 | API-22, UI-06, E2E-03 |
| AC-21 | API-23, UI-06, E2E-03 |
| AC-22 | STYLE-01, STYLE-02, E2E-04 |
| AC-23 | UI-01, UI-02, STYLE-01, STYLE-02, E2E-04 |
| AC-24 | API-24, API-25, API-28 and migration/seed output |

## 6. Planned commands

Server:

    npm ci
    npm run lab3:upgrade
    npm run prisma:seed
    npm run prisma:seed
    npm run test
    npm run build

Client:

    npm ci
    npm run test
    npm run build

E2E:

    npx playwright test e2e/lab-03

Focused commands may be used during TDD, but final evidence must include
complete output from the final main branch. Sections 8–9 record the historical
release. Any new remediation changes require a new final-main rerun.

## 7. Final verification checklist

- [x] Historical PR #58 and final-main CI jobs passed at file/job level.
- [x] New remediation server tests pass locally in an isolated PostgreSQL schema.
- [x] New remediation client tests and production build pass locally.
- [x] New E2E paths run against a real seeded API/database and capture fresh responsive images.
- [x] Direct unauthorized API calls and Requester ownership are covered in API tests.
- [ ] New remediation branch has a reviewed PR and green CI.
- [ ] The new remediation commit is merged and rerun on final `main`.
- [ ] Automated keyboard/focus/contrast audit proves every AC-23 detail; current coverage is partial and visual/manual inspection is still required.

## 8. PR #58 staging evidence

- Pull request: https://github.com/Davidice23/toktickit/pull/58
- CI run: https://github.com/Davidice23/toktickit/actions/runs/35310955716
- Server build and tests: passed
- Client build and tests: passed
- Lab 3 browser workflows: passed, 7 tests across 5 files
- CI database: isolated PostgreSQL with committed Lab 3 upgrade and seed

The evidence is on lab3-staging; final-main evidence is recorded below after PR #59.

## 9. Final-main release evidence

- Release pull request: https://github.com/Davidice23/toktickit/pull/59
- Release merge commit: `00b71e36e979e02dcf72847c9035e00cde934159`
- Final-main CI run: https://github.com/Davidice23/toktickit/actions/runs/35321640402
- Trigger: push to `main` on 2026-09-18
- Server build and tests: passed (PostgreSQL container, Lab 3 upgrade/seed, full server suite)
- Client build and tests: passed (production build and full client suite)
- Lab 3 browser workflows: passed (Chromium, real API/database, 7 tests across 5 files)

## 10. Post-release remediation: local verified evidence

On 2026-09-24, the new `fix/lab3-final-readiness` branch was checked against
**isolated localhost PostgreSQL schemas**, not the user's normal schema:

| Check | Command / test | Observed result |
| --- | --- | --- |
| Upgrade | `npm run lab3:upgrade` in `server/` | Passed against `lab3_codex_final` after the Windows CLI invocation fix. |
| Server API/unit/integration | `npm run test:lab3` | 10 files, 30 tests passed; includes repeat-safe seed and legacy Lab 2 ID/FK preservation. |
| Server production build | `npm run build` | Passed. |
| Client component/regression | `npm test -- --run` | 12 files, 24 tests passed; one React `act(...)` warning in an older Lab 1 test remains non-failing. |
| Client production build | `npm run build` | Passed. |
| Browser suite after cross-role extension | `npm run test:lab3` in `e2e/`, local Chrome | 14 tests passed; includes fresh screenshots at 1440, 820, and 390 px. |
| Cross-role operational journey | `npx playwright test lab-03/staff-ticket-flow.spec.ts` | 2 tests passed; one creates a unique Requester Ticket and verifies Staff claim, IT Priority, status, public/private messages, and Requester visibility. |

The complete E2E suite passed locally after the code changes, but must run again in CI.
The real legacy-data migration test preserves existing `User`, `Ticket`, and
`Attachment` IDs and foreign keys; the idempotent seed test runs twice and
checks all fictional role/status/message fixtures. These tests are stronger
than the previous TODO/limited migration checks, but they are **not** evidence
of an already reviewed or merged PR.
