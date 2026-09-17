# Lab 3 Test Plan and Traceability

> Contract status: Pending peer review. Implementation must not start until this contract is approved.

Test execution status: Planned / Not run. This document is a pre-implementation plan; it contains no implementation or passing-test claim.

## 1. Test strategy

Lab 3 uses Spec DD, Test DD, and TDD. For each feature, write or finalize the mapped test first, capture the initial red reason in the PR, implement the smallest conforming behavior, then refactor while retaining the contract.

Coverage layers:

- Unit tests for password rules, normalization, session expiry, CSRF, role checks, status transitions, queue query parsing, comment/note validation, and Administrator safety predicates.
- API/integration tests with Supertest and PostgreSQL for migrations, seed repeatability, authentication, authorization, ownership, queue/detail workflows, comments/notes, Attachments, and User Management.
- React component tests with Testing Library for controls, role navigation, feedback states, validation, focus, badges, and safe failures.
- Regression tests for every retained Lab 2 Requester and Attachment capability after removal of the Development Requester selector.
- End-to-end tests with the real client, server, test database, seeded roles, session cookie, and representative workflows.
- Manual/automated responsive and accessibility inspection at 1440px, 820px, and 390px.

Final status for every item below is Planned / Not run until the corresponding implementation and final-main verification actually occur.

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

## 4. Planned test inventory

| Test ID | Type | Requirement | Planned check | File | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-02, BR-05 | Email normalization and password boundaries | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| UNIT-02 | Unit | BR-06, BR-08 | Session expiry, revoke, token and CSRF validation | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| UNIT-03 | Unit | BR-18 | Status transition matrix accepts/rejects exact edges | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| UNIT-04 | Unit | BR-23, BR-24 | Comment/note trim, blank and length limits | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| UNIT-05 | Unit | BR-26, BR-27 | Self-deactivation and last-admin safety predicates | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-01 | API | FR-01, AC-01 | Valid active login establishes session and safe User response | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-02 | API | BR-03, AC-02 | Invalid and inactive credentials share safe 401 response | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-03 | API | FR-03, AC-04 | Current user, logout, revoked session, and expired session | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-04 | API | FR-04, AC-03 | Initial password blocks normal routes until valid change | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-05 | API | BR-08 | Missing/invalid CSRF token blocks mutations | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-06 | API | FR-07, BR-10, AC-06 | Requester creation derives owner from session despite spoofed header/body | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-07 | API | FR-08, FR-09, AC-07 | Authenticated Requester list/detail/Attachment regression | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-08 | API | BR-11, BR-12 | Cross-owner Ticket and Attachment resources use safe ownership response | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-09 | API | FR-12, AC-09 | Staff Queue search, filters, sorting, pagination, metadata | server/tests/lab-03/staff-queue.api.test.ts | Planned / Not run |
| API-10 | API | FR-13, AC-10 | Staff Ticket Detail includes permitted operational data | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-11 | API | FR-14, BR-13, BR-14, AC-11 | Atomic claim and separate reassign/unassign validate active allowed owner and conflicts | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-12 | API | FR-15, BR-15, BR-16, AC-12 | IT Priority differs from Requested Priority and is restricted to IT Staff/Administrator | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-13 | API | FR-16, BR-17, BR-18, AC-12 | Valid status transition and invalid transition rejection | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-14 | API | FR-18, FR-19, BR-21, BR-22, AC-13 | Public/Internal visibility and role authorization | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-15 | API | FR-20, BR-23, BR-24 | Append-only comments/notes reject blank/oversized content | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-16 | API | FR-10, FR-21, AC-08 | Requester resolution indication cannot set formal status | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-17 | API | FR-23, AC-15 | Administrator list/search/optional role filter | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-18 | API | FR-24, AC-16 | Administrator creates one-role user with initial password | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-19 | API | FR-25, AC-17 | Administrator edits name/email/role/active state | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-20 | API | FR-27, AC-18 | Duplicate email, invalid role, and invalid input are safe conflicts/validation | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-21 | API | FR-26, BR-29, AC-19 | Initial password reset forces next-login change and revokes sessions | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-22 | API | FR-27, BR-26, BR-27, AC-20 | Self-deactivation and last-admin removal are prevented transactionally | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-23 | API | FR-06, AC-21 | Non-Administrators cannot access User Management | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-24 | Integration | BR-31, BR-32, AC-24 | Migration preserves IDs/data | server/tests/lab-03/migration.integration.test.ts | Planned / Not run |
| API-25 | Integration | BR-32, AC-24 | Seed runs twice without duplicate users, Tickets, comments, notes, or references | server/tests/lab-03/seed.integration.test.ts | Planned / Not run |
| API-26 | Authorization | FR-12-FR-17, AC-09-AC-13 | Administrator can use the operational queue, assignment, priority, status, comments, and notes allowed by the matrix | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-27 | Security | BR-04, AC-02 | Login throttles after five failures per email/IP window and returns 429 with Retry-After | server/tests/lab-03/auth.api.test.ts | Planned / Not run |
| API-28 | Migration | BR-16, BR-31, AC-24 | Existing Tickets receive IT Priority copied from Requested Priority without changing IDs or ownership | server/tests/lab-03/migration.integration.test.ts | Planned / Not run |
| API-29 | Security | BR-28, AC-17 | Administrator deactivation revokes existing sessions and blocks subsequent access | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-30 | API | BR-23, AC-13 | Public Comments and Internal Notes have no edit/delete endpoint and remain append-only | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-31 | Authorization | FR-22, AC-10 | Requester upload/remove versus Staff/Administrator metadata/download Attachment policy | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-32 | Authorization | FR-06, AC-05 | Exhaustive role matrix checks: unauthenticated, Requester-to-Staff, Staff-to-Admin, Admin staff operations, and Requester ownership | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| API-33 | Error handling | BR-30, AC-14 | Unexpected server failure returns safe 500 envelope with correlationId and no stack/detail leak | server/tests/lab-03/authorization.api.test.ts | Planned / Not run |
| UI-01 | UI | FR-01, AC-01, AC-02 | Login labels, validation, busy, safe failure, success routing | client/tests/lab-03/Login.test.tsx | Planned / Not run |
| UI-02 | UI | FR-04, AC-03 | Change Password validation, busy, failure, continuation | client/tests/lab-03/ChangePassword.test.tsx | Planned / Not run |
| UI-03 | UI | FR-06, AC-04, AC-05 | Authenticated shell, role navigation, logout, direct-route guard | client/tests/lab-03/Login.test.tsx | Planned / Not run |
| UI-04 | UI | FR-12, AC-09 | Staff Queue controls, rows/cards, pagination and feedback | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned / Not run |
| UI-05 | UI | FR-13, AC-10, AC-12 | Staff Detail operational fields, badges, comments, notes, failures | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned / Not run |
| UI-06 | UI | FR-23-FR-28, AC-15-AC-21 | User Management list/forms/safety feedback/forbidden state | client/tests/lab-03/UserManagement.test.tsx | Planned / Not run |
| UI-07 | Regression | FR-07-FR-11, AC-07, AC-08 | Requester Create/List/Detail/Attachment flows use session identity | client/tests/lab-03/RequesterRegression.test.tsx | Planned / Not run |
| STYLE-01 | UI style | AC-22, AC-23 | Zen Green tokens, badges, error association, focus and readonly treatment | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned / Not run |
| STYLE-02 | Responsive | AC-22, AC-23 | Equivalent table/card content and no horizontal overflow | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned / Not run |
| E2E-01 | E2E | AC-01-AC-04 | Login, initial password, shell, logout, direct access blocking | e2e/lab-03/authentication.spec.ts | Planned / Not run |
| E2E-02 | E2E | AC-09-AC-14 | Staff queue/detail, assignment, priority, status, comments, notes, failure | e2e/lab-03/staff-ticket-flow.spec.ts | Planned / Not run |
| E2E-03 | E2E | AC-15-AC-21 | Administrator user lifecycle and safety rules | e2e/lab-03/user-administration.spec.ts | Planned / Not run |
| E2E-04 | E2E/visual | AC-22, AC-23 | Desktop/tablet/mobile screenshots and keyboard/accessibility checks | e2e/lab-03/responsive-visual.spec.ts | Planned / Not run |
| E2E-05 | E2E/regression | AC-06-AC-08 | Requester creates/lists/opens Tickets, uses Attachments/comments, and cannot use staff-only operations | e2e/lab-03/requester-regression.spec.ts | Planned / Not run |

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

Focused commands may be used during TDD, but final evidence must include complete output from the final main branch. No command in this plan has been executed for Lab 3 yet.

## 7. Final verification checklist

- [ ] All planned server tests pass on final main.
- [ ] All planned client tests pass on final main.
- [ ] All three mandated E2E files and the planned Requester regression/responsive E2E files pass on final main.
- [ ] Migration applies to an empty test database and preserves a Lab 2 fixture database.
- [ ] Seed runs twice without duplicate users, Tickets, comments, notes, or reference rows.
- [ ] Direct unauthorized API calls are covered, not only hidden UI controls.
- [ ] Requester ownership and Attachment regression are covered.
- [ ] Responsive and accessibility checks are complete at all three target widths.
- [ ] Status is changed from Planned / Not run only after actual evidence is captured.
