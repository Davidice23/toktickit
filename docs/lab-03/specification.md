# Lab 3 Engineering Contract

> Contract status: Pending peer review. Implementation must not start until this contract is approved.

## 1. Sprint goal

Replace the Lab 2 Development Requester selector with server-verified authentication and role-based authorization. Deliver a usable TokTickIT increment with three roles: Requester, IT Staff, and Administrator. Requesters retain their Lab 2 ticket and attachment workflows; IT Staff receive an operational queue and ticket workflow; Administrators receive minimalist user management.

## 2. Stakeholder interpretation

The stakeholder needs real users instead of a temporary identity selector. A user signs in with an email and password, changes an initial password before entering the normal application, and sees only the navigation and actions permitted by the assigned role. Requesters manage their own requests. IT Staff and Administrators triage and work Tickets through the explicitly listed operational matrix; Administrators also manage accounts but do not gain operations outside that matrix. Every protected operation is enforced by the backend; hidden UI controls are only usability feedback.

## 3. Scope

### 3.1 Included

- Email/password login, logout, current-user retrieval, session expiration, and mandatory first-login password change.
- One role per user: Requester, IT Staff, or Administrator.
- Server-side role authorization and ownership checks.
- Migration of the Lab 2 Development Requester identity to an authenticated User model.
- Requester ticket creation, owned ticket list/detail, attachments, Public Comments, and a problem-appears-resolved indication.
- IT Staff Ticket Queue with search, filters, sorting, pagination, ownership, IT Priority, permitted status transitions, Public Comments, and Internal Notes.
- Minimalist Administrator User Management: list/search, create, basic edit, one-role assignment, activate/deactivate, and set a new initial password.
- Zen Green responsive UI and reusable components.
- Unit, API/integration, UI, authorization, migration/regression, accessibility, responsive, and end-to-end test plans.

### 3.2 Explicit exclusions

- Email invitations, password-reset email, MFA, social login, SSO, and self-registration.
- Actions Taken by IT Staff, SLA calculation, escalation, notifications, dashboards, and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, extended profiles, profile photos, and production infrastructure changes.
- Multiple roles per user, user deletion, bulk operations, import/export, role history, account history, account unlocking, approval workflows, and advanced identity management.
- Mandatory user-list pagination, multi-column sorting, and multiple simultaneous user filters.

## 4. Roles and authorization principles

Each user has exactly one role. An inactive user cannot authenticate. A role check is performed on every protected API operation. A requester identity is derived from the authenticated session, never from a client-supplied requesterId or X-Requester-Id value. Cross-owner resources use a safe not-found response where revealing existence would be harmful.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Login, current user, logout | Own session | Own session | Own session |
| Change an initial password | Yes | Yes | Yes |
| Create and manage own Tickets | Own only | No | No |
| Read Staff Queue and operational detail | No | Yes | Yes |
| Attachment metadata/download on operational detail | No | Yes | Yes |
| Upload/remove Attachments | Own Tickets | No | No |
| Assign/reassign Ticket | No | Yes | Yes |
| Set IT Priority | No | Yes | Yes |
| Change Ticket status | No | Yes | Yes |
| Public Comments | Own Tickets | Visible Tickets | Visible Tickets |
| Internal Notes | No | Read/create | Read/create |
| Requester problem-resolved indication | Own Tickets | No | No |
| User Management | No | No | Yes |

Administrator has the operational staff capability required by the Lab contract: it can inspect and operate Tickets as well as manage users. The landing experience remains User Management, while backend authorization and the UI matrix explicitly permit the listed staff operations. Peer review may revise this matrix before implementation.

## 5. Functional requirements

### Authentication and identity

- FR-01: The system shall authenticate an active user with a normalized email and valid password.
- FR-02: The system shall establish an opaque server-side session and return the authenticated user identity and role without exposing password material.
- FR-03: The system shall provide current-user retrieval and logout that invalidates the session.
- FR-04: A user with mustChangePassword set shall be restricted to the password-change flow until a valid new password is saved.
- FR-05: The system shall validate password boundaries, confirmation, session expiration, revoked sessions, and safe failure responses.
- FR-06: The client shall show role-specific navigation and protect direct route access with an authenticated current-user check.

### Requester regression

- FR-07: An authenticated Requester shall create Tickets using the session user as owner.
- FR-08: An authenticated Requester shall list and open only owned Tickets and permitted Attachments.
- FR-09: Existing Lab 2 Ticket validation, idempotency, Attachment continuity, and safe ownership behavior shall continue after migration.
- FR-10: A Requester shall append Public Comments to an owned Ticket and indicate that the problem appears resolved.
- FR-11: The Development Requester selector, Change Requester action, local-storage identity, and X-Requester-Id security dependency shall be removed from the normal UI and authorization path.

### IT Staff workflow

- FR-12: IT Staff or Administrator shall access a Ticket Queue with documented search, filters, sorting, pagination, metadata, empty states, and failure states.
- FR-13: IT Staff or Administrator shall open Ticket Detail containing Ticket information, ownership, priorities, status, comments, notes, and existing Attachments.
- FR-14: IT Staff or Administrator shall claim, assign, or reassign a Ticket to an allowed active staff owner.
- FR-15: IT Staff or Administrator shall set IT Priority independently from the Requester-submitted Requested Priority.
- FR-16: IT Staff or Administrator shall change status only through the approved transition matrix.
- FR-17: IT Staff or Administrator shall append Public Comments and Internal Notes. Both entries shall record backend author and creation time.

### Comments, notes, and workflow

- FR-18: Public Comments shall be visible to the Requester who owns the Ticket, IT Staff, and Administrator.
- FR-19: Internal Notes shall be visible only to IT Staff and Administrator, with creation restricted to the approved authorization matrix.
- FR-20: Public Comments and Internal Notes shall be append-only in Lab 3, reject blank content, and render as text rather than executable HTML.
- FR-21: Requester resolution indication shall not directly set Resolved or Closed status.
- FR-22: The API shall preserve Attachment metadata and enforce role/ownership rules for Attachment operations.

### Administrator User Management

- FR-23: An Administrator shall list users with name, email, role, status, and edit action, with name/email search and an optional role filter.
- FR-24: An Administrator shall create a user with name, email, one permitted role, active state, and an initial password.
- FR-25: An Administrator shall update name, email, role, and activation state.
- FR-26: An Administrator shall set a new initial password and mark the target account for password change at next login.
- FR-27: The API shall reject duplicate email, invalid role, invalid input, self-deactivation, and removal of the last active Administrator.
- FR-28: User deactivation shall be used instead of deletion and shall invalidate active sessions for the deactivated user.

## 6. Business rules

- BR-01: Only an active user with valid credentials may authenticate.
- BR-02: Email is trimmed and normalized consistently before lookup and uniqueness validation.
- BR-03: Invalid credentials and inactive-account credentials return the same safe public failure message.
- BR-04: Repeated login failures are limited to five attempts per normalized-email + IP pair in 15 minutes, then return 429 with Retry-After: 900; raw credentials are never logged.
- BR-05: Passwords are stored only as strong one-way hashes and never returned by an API.
- BR-06: A valid session is opaque, server-side, expires, and is revoked by logout, password reset, deactivation, or explicit invalidation.
- BR-07: A user marked mustChangePassword cannot access normal application APIs until changing the password.
- BR-08: Mutating cookie-authenticated requests require the approved CSRF protection.
- BR-09: Duplicate normalized email addresses are rejected with a conflict response.
- BR-10: A client-supplied requesterId or X-Requester-Id never overrides the authenticated identity.
- BR-11: Requester Ticket, list, detail, Attachment, comment, and resolution operations require ownership.
- BR-12: Cross-owner and missing protected Tickets and Attachments use an equivalent safe not-found response where appropriate.
- BR-13: A Ticket may have zero or one primary owner; the owner must be active and have an allowed operational role.
- BR-14: Assignment and reassignment are server-validated and cannot assign an inactive or Requester user.
- BR-15: Requested Priority is submitted by the Requester and remains distinct from IT Priority.
- BR-16: IT Priority initially copies Requested Priority when the Ticket is created and can then be changed only by IT Staff or Administrator.
- BR-17: The required statuses are New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.
- BR-18: Status changes must follow the approved transition matrix; invalid transitions return 409 INVALID_TRANSITION and do not mutate the Ticket.
- BR-18a: Status transitions to Cancelled require confirmation and a non-blank reason; transitions to Resolved or Closed require confirmation; transitions to Reopened require a non-blank reason.
- BR-18b: A Ticket must have an active IT Staff or Administrator owner before entering In Progress or Resolved. Claim succeeds only when the Ticket is unassigned; a concurrent or already-owned claim returns 409 CLAIM_CONFLICT. Unassignment is allowed only from New or Open.
- BR-19: A Requester may indicate that the problem appears resolved but cannot formally set Resolved or Closed.
- BR-20: IT Staff and Administrator remain responsible for formal resolution and closure.
- BR-21: Public Comments are visible to the owning Requester, IT Staff, and Administrator.
- BR-22: Internal Notes are visible only to IT Staff and Administrator and never appear in a Requester response.
- BR-23: Comments and notes are append-only, author-attributed, timestamped by the backend, and reject empty or whitespace-only content.
- BR-24: Comment and note lengths have documented limits and safe text rendering.
- BR-25: An Administrator can assign only one permitted role per user; multiple roles are not supported.
- BR-26: An Administrator cannot deactivate their own account.
- BR-27: The system must always retain at least one active Administrator.
- BR-28: Deactivation is used instead of deletion and immediately prevents new authentication.
- BR-29: Setting an initial password sets mustChangePassword and revokes the target user's existing sessions.
- BR-30: Unexpected failures return a safe public message and correlation ID while server logs retain diagnostic detail only.
- BR-31: Lab 2 Categories, Related Systems, Tickets, Attachments, Ticket IDs, and ownership data remain valid after migration.
- BR-32: Seed operations are idempotent, contain only local test credentials, and do not expose sensitive personal data.

### Status transition matrix

| Current | Allowed next status | Role | Conditions |
| --- | --- | --- | --- |
| New | Open, Cancelled | IT Staff / Administrator | Cancelled requires confirmation and reason |
| Open | In Progress, Waiting for Requester, Cancelled | IT Staff / Administrator | In Progress requires active owner; Cancelled requires confirmation and reason |
| In Progress | Waiting for Requester, Resolved, Cancelled | IT Staff / Administrator | Resolved requires active owner and confirmation; Cancelled requires confirmation and reason |
| Waiting for Requester | In Progress, Resolved, Cancelled | IT Staff / Administrator | In Progress/Resolved require active owner; Resolved requires confirmation; Cancelled requires confirmation and reason |
| Resolved | Closed, Reopened | IT Staff / Administrator | Closed requires confirmation; Reopened requires reason |
| Closed | Reopened | IT Staff / Administrator | Reopened requires reason |
| Reopened | In Progress, Cancelled | IT Staff / Administrator | In Progress requires active owner; Cancelled requires confirmation and reason |
| Cancelled | Reopened | IT Staff / Administrator | Reopened requires reason |

## 7. Data model and migration decision

The migration shall preserve all existing IDs, Tickets, Attachments, Categories, and Related Systems. The proposed migration renames the existing RequesterUser table to User rather than copying rows into a new identity table. Existing Ticket.requesterId values remain unchanged and are re-pointed to User.id.

### Proposed models

| Model | Required fields and relationships |
| --- | --- |
| User | id, name, unique normalized email, passwordHash, role, isActive, mustChangePassword, createdAt, updatedAt; owns requester Tickets, operational Tickets, Comments, Notes, Sessions |
| Session | id, tokenHash, userId, expiresAt, revokedAt, csrfTokenHash, createdAt, lastSeenAt |
| Ticket | Existing fields preserved; add nullable ownerId, requester resolution fields, expanded status enum, and indexes for queue queries |
| PublicComment | id, ticketId, authorId, body, createdAt |
| InternalNote | id, ticketId, authorId, body, createdAt |
| Attachment | Existing metadata and storage lifecycle preserved |

Foreign keys shall use restrictive deletion. User deletion is not supported. Role/active-owner constraints that cannot be expressed in a foreign key shall be enforced in transactions and covered by API tests.

### Migration sequence

The executable upgrade path is `npm run lab3:upgrade`; it is not a single `prisma migrate deploy` followed by an unrelated seed. The command runs these ordered steps and exits non-zero on any failure:

1. `npx prisma migrate deploy` applies the structural migration: rename `RequesterUser` to `User` with an explicit transactional SQL rename, preserve primary keys/FKs, add role/session/workflow/comment/note fields and indexes, expand the status enum, and temporarily leave credential and `itPriority` columns nullable for backfill. No copy-and-drop alternative is in scope.
2. `tsx scripts/lab3/backfill-credentials.ts` runs a Prisma transaction using `LAB3_SEED_INITIAL_PASSWORD`, creates Argon2id hashes, sets `mustChangePassword=true`, copies every existing `Ticket.requestedPriority` into `itPriority`, and aborts/rolls back if any existing User lacks a credential or any preserved ID/count assertion fails.
3. `tsx scripts/lab3/verify-migration.ts` checks User/Ticket/Attachment/Category/Related System counts and IDs, ownership, Attachment metadata, non-null priority, and credential completeness. Application startup remains blocked if this command fails.
4. `tsx scripts/lab3/finalize-constraints.ts` applies the final non-null/check constraints in a transaction only after verification succeeds.
5. `npm run prisma:seed` adds repeat-safe IT Staff, Administrator, realistic Tickets, comments, and notes without overwriting changed credentials. Seed runs only after the upgrade command succeeds.

Rerunning the command is safe: completed structural/backfill steps are detected by migration/version and idempotent upserts; a failed backfill rolls back its transaction and leaves startup blocked until the command succeeds. The clean test database and Lab 2 fixture database must both run this same path.

## 8. Seed requirements

The repeat-safe seed shall contain at least four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, and one active Administrator. Tickets shall cover all required statuses where feasible, Requested and IT Priorities, assigned and unassigned ownership, and multiple Requesters. Seeded Public Comments and Internal Notes shall contain fictional non-sensitive content. Credentials are local development fixtures only and shall be documented without using real passwords or secrets.

## 9. API and UI decisions

The API uses JSON success and error envelopes defined in api-spec.md. Authentication uses an opaque server-side cookie session with explicit CORS and CSRF rules. The client uses a shared authenticated API helper, current-user bootstrap, protected routes, and reusable Zen Green state/badge/dialog components. The UI is responsive at 1440px desktop, 820px tablet, and 390px mobile.

## 10. Acceptance criteria

| ID | Acceptance criterion | Planned evidence |
| --- | --- | --- |
| AC-01 | An active user with valid credentials receives an authenticated session and identity/role. | Auth API, Login UI, E2E |
| AC-02 | Invalid and inactive credentials fail safely without unnecessary account disclosure. | Auth API/UI |
| AC-03 | A user with an initial password cannot enter normal screens before changing it. | Auth API, Change Password UI, E2E |
| AC-04 | Logout revokes access and direct protected routes are blocked afterward. | Auth API/UI, E2E |
| AC-05 | Navigation and direct API access enforce the role matrix. | Authorization API/UI |
| AC-06 | Requester Ticket and Attachment APIs use authenticated ownership, even when a spoofed requesterId/header is supplied. | Authorization API, regression |
| AC-07 | Existing Lab 2 requester creation, list, detail, and Attachment behavior continues for authenticated Requesters. | Regression API/UI/E2E |
| AC-08 | Requesters can append Public Comments and indicate problem resolution but cannot formally resolve or close a Ticket. | API/UI |
| AC-09 | IT Staff and Administrators can use the Staff Queue with documented search, filters, sorting, pagination, ownership, badges, and safe states. | Queue API/UI/E2E |
| AC-10 | IT Staff and Administrators can open Ticket Detail and see permitted Ticket, Attachment, comment, note, ownership, priority, and status information. | Detail API/UI |
| AC-11 | IT Staff and Administrators can claim/reassign only to an allowed active operational user. | Detail API |
| AC-12 | IT Staff and Administrators can update IT Priority and only valid status transitions. | Detail API/UI |
| AC-13 | Public Comments are shared and Internal Notes are restricted and visually distinct. | Comments API/UI |
| AC-14 | Empty, validation, forbidden, not-found, conflict, and unexpected failure states are safe and actionable. | API/UI/E2E |
| AC-15 | Administrator can list/search users and optionally filter by role. | Admin API/UI |
| AC-16 | Administrator can create a user with one role and an initial password. | Admin API/UI |
| AC-17 | Administrator can edit name, email, role, and activation state. | Admin API/UI |
| AC-18 | Duplicate email and invalid role/input are rejected without partial mutation. | Admin API |
| AC-19 | Setting an initial password forces a password change at the next login. | Admin API/Auth E2E |
| AC-20 | Self-deactivation and removal of the last active Administrator are prevented. | Admin API/UI |
| AC-21 | Non-Administrators cannot access User Management APIs or screens. | Authorization API/UI |
| AC-22 | All major Lab 3 screens reuse Zen Green tokens and are usable at desktop, tablet, and mobile widths. | UI tests/screenshots |
| AC-23 | Labels, focus, status semantics, error associations, and keyboard paths satisfy the accessibility contract. | UI/style/E2E |
| AC-24 | Migration preserves existing IDs, Tickets, Attachments, and seed repeatability. | Migration/seed tests |

## 11. Assumptions and decision register

| Decision | Proposed choice | Status |
| --- | --- | --- |
| Session mechanism | Opaque server-side session cookie, hashed token in Session table, maximum lifetime 8 hours | Pending peer approval |
| Cookie/CSRF | HttpOnly SameSite cookie, explicit origin CORS, CSRF header for mutations | Pending peer approval |
| Password hashing | Argon2id, memory 65536 KiB, iterations 3, parallelism 1; password length 12-128 characters | Pending peer approval |
| Administrator ticket access | Full operational Ticket/queue/comment/note capability plus User Management | Pending peer approval |
| Staff assignment | Only active IT Staff or Administrator can be an owner; Requesters cannot own operational assignment | Pending peer approval |
| Login throttling | Five failures per normalized-email + IP in 15 minutes, then 429 with Retry-After: 900; no credential logging | Pending peer approval |
| Queue pagination | Page sizes 10, 20, 50; default 20; default sort updatedAt desc, id desc | Pending peer approval |
| Comment/note limits | Public Comment 1-2,000 characters; Internal Note 1-4,000 characters after trim | Pending peer approval |
| Attachment access | Requester owns upload/remove/download; IT Staff and Administrator may read metadata/download on operational detail; no staff upload/remove | Pending peer approval |
| API error envelope | Shared code/message/fields/correlationId structure | Pending peer approval |

No implementation issue may begin while a decision above materially affects the authorization or migration contract and remains unresolved.

## 12. Product Definition of Done

- [ ] This contract and the API/UI/test contracts are peer-reviewed and approved before implementation.
- [ ] All approved FRs, BRs, and AC-01 through AC-24 are implemented.
- [ ] Backend authentication, session, CSRF, role, ownership, and safe-error rules are enforced independently of UI controls.
- [ ] Migration applies without losing IDs, Tickets, Attachments, Categories, or Related Systems.
- [ ] Seed is repeat-safe and meets all role/status/assignment fixture requirements.
- [ ] Lab 2 Requester behavior continues through authenticated identity.
- [ ] Staff Queue and Staff Detail satisfy queue, ownership, priority, status, comments, notes, and Attachment continuity requirements.
- [ ] Administrator User Management satisfies duplicate, validation, activation, initial-password, self-deactivation, and last-admin safety rules.
- [ ] Planned unit, API/integration, client, authorization, regression, migration, responsive/accessibility, and E2E tests pass on final main.
- [ ] Desktop, tablet, and mobile screenshots plus the completed Zen Green checklist are captured.
- [ ] reviewer.md contains actual reviewer identity, PR links, comments, responses, and approvals.
- [ ] ai-use.md contains the selected prompts and a truthful reflection.
- [ ] The final submission PDF contains Answer Part 1 through Answer Part 9 in the required order.
