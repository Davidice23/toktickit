# Lab 4 Engineering Contract: Actions Taken, Dashboards, and Final Regression

> **Status: Approved implementation baseline (PR #75).** The learner authorized this Contract for review and Sxr1n approved its four documents in PR #75 at head `24d3add`. Any substantive behavior change must update the Contract and receive learner and peer review before dependent implementation proceeds.

## 1. Sprint goal

Complete TokTickIT's core service-desk workflow without breaking Labs 1-3. IT Staff and Administrators will record, assign, update, complete, and cancel Actions Taken under Tickets; all roles will receive concise role-appropriate dashboards; and the system will enforce final workflow, ownership, concurrency, security, accessibility, and regression rules with traceable evidence.

## 2. Stakeholder interpretation

The Ticket Owner remains accountable for coordinating a Ticket, but more than one operational user may do recorded work. An Action Taken is a child work record, not an Internal Note and not a replacement for Ticket ownership. Requesters may read every Action Taken on their own Tickets but cannot create or change one. A Requester's “problem appears resolved” indication remains advisory; a permitted staff member must still make the formal status change after the server verifies the resolution gate. Dashboards summarize authoritative server data and link to existing detailed views rather than duplicating full ticket lists.

## 3. Scope

### 3.1 Included

- A Ticket-to-many-Actions-Taken model, safe migration, recovery procedure, and idempotent synthetic seed data.
- Action list, create, assignment, edit, lifecycle transition, completion, cancellation, audit history, validation, and role restrictions.
- The eight Ticket statuses and a complete server-enforced transition matrix with a resolution gate and stale-update protection.
- Concise Requester, IT Staff, and Administrator dashboard APIs and Zen Green dashboard UI with drill-downs.
- Lab 4 API, UI, data, migration, authorization, regression, E2E, responsive, accessibility, visual, and performance-smoke tests.
- Final hardening of the existing authenticated roles, Tickets, Attachments, Public Comments, Internal Notes, user management, documentation, evidence, and release workflow.

### 3.2 Explicit exclusions

- SLA clocks, escalation engines, on-call schedules, breach alerts, and external email/SMS/LINE/push notifications.
- Inventory, spare parts, purchasing, cost accounting, time-sheet billing, payroll, or labour-cost calculation.
- Multi-level approvals, electronic signatures, advanced BI/report builders, export warehouses, multi-tenant organisations, or production cloud operations.
- A new attachment-storage product. `attachmentNotes` is text that identifies an existing file or image; it does not create a second upload lifecycle.
- Unapproved features or a new client-side identity/security mechanism.

## 4. Roles and authorization principles

All authorization is enforced by the backend using the authenticated session. Hiding a control is usability feedback only. `ADMINISTRATOR` retains all operational capabilities required for support and testing plus user management. A user who is inactive, whose session is revoked/expired, or who must change an initial password cannot use normal operational endpoints.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Read Actions Taken | All Actions of owned Ticket only | Accessible staff Ticket | Accessible staff Ticket |
| Create/assign/edit/transition/complete/cancel an Action | No | Yes, subject to Contract rules | Yes, subject to Contract rules |
| Formal Ticket assignment, priority, status | No | Yes | Yes |
| Requester “appears resolved” advisory | Own Ticket only | No | No |
| Requester dashboard | Own data only | No | No |
| Operational dashboard | No | Own/operational data | Operational data plus concise user-account counts |
| Internal Notes | No | Read/create | Read/create |
| User management | No | No | Yes |

For an owned Ticket that does not exist, the requester API returns the same safe not-found shape as a nonexistent Ticket. It must not reveal another Requester's Ticket, Action, Attachment, or Internal Note.

## 5. Functional requirements

### 5.1 Actions Taken

- **FR-01:** A Ticket shall have zero or more Actions Taken; every Action Taken belongs to exactly one Ticket.
- **FR-02:** A permitted operational user shall create an Action with an active operational assignee, description, follow-up choice, attachment notes when useful, and a client retry key.
- **FR-03:** The system shall assign an Action only to an active `IT_STAFF` or `ADMINISTRATOR`; Ticket Owner and Action assignee may differ.
- **FR-04:** The system shall show a Ticket's Actions in deterministic chronological order, including planned, in-progress, completed, and cancelled records.
- **FR-05:** A permitted operational user shall edit only Contract-approved mutable Action fields while the Action is not terminal.
- **FR-06:** A permitted operational user shall move an Action only through the approved Action lifecycle and may complete or cancel it only with the required data.
- **FR-07:** The backend shall derive Action actors from the session and shall reject client-supplied actor identity or immutable audit fields.
- **FR-08:** A Requester shall read all safe Action fields for an owned Ticket but shall have no Action mutation endpoint or UI control.
- **FR-09:** The API shall return field-level validation, safe not-found/forbidden behavior, idempotent retry behavior, and stale-update conflicts without overwriting newer data.
- **FR-10:** Every Action lifecycle or material edit shall create an append-only audit event visible according to the role policy.

### 5.2 Ticket workflow and resolution

- **FR-11:** The system shall retain Ticket statuses `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **FR-12:** The backend shall reject a Ticket status change that is not permitted by the transition matrix, even if a client bypasses the normal UI.
- **FR-13:** The backend shall enforce the approved resolution gate atomically with the Ticket status mutation.
- **FR-14:** A Requester resolution indication shall not formally set a Ticket to `RESOLVED` or `CLOSED`.
- **FR-15:** Concurrent Action and Ticket mutations shall not cause lost updates or permit a Resolution that bypasses a newly created or changed Action prerequisite.
- **FR-16:** Successful operations shall refresh the detailed Ticket summary, its Action list, and affected dashboard data.

### 5.3 Dashboards

- **FR-17:** A Requester dashboard shall return only the authenticated Requester's metrics and compact drill-down rows.
- **FR-18:** An IT Staff dashboard shall return operational metrics, the current user's assigned/recorded Actions Taken, and recent or urgent Tickets from backend-calculated data.
- **FR-19:** An Administrator dashboard shall reuse operational data and may additionally show concise active-user counts; it shall not expose credentials or private Internal Notes.
- **FR-20:** Every metric card shall have a documented calculation, empty behavior, time boundary where relevant, and drill-down destination.
- **FR-21:** Dashboard endpoints shall return concise summaries and bounded rows, not whole Ticket collections for client-side counting.

### 5.4 Product hardening

- **FR-22:** Existing authentication, session, CSRF, role, ownership, Tickets, Attachments, Public Comments, Internal Notes, IT Staff, and Administrator behavior shall continue to work for permitted users.
- **FR-23:** The UI shall cover loading, validation, success, empty/no-result, forbidden, not-found, conflict, and safe API-failure states; recoverable failures preserve entered form values.
- **FR-24:** Forms shall prevent accidental duplicate submissions in the UI and the backend shall safely handle retry through idempotency/concurrency controls.
- **FR-25:** Lab 4 screens shall retain the Zen Green design language, semantic structure, visible focus, keyboard operation, error associations, non-colour cues, and responsive layouts without page-level horizontal overflow.
- **FR-26:** README, test instructions, evidence, reviewer record, and AI-use record shall be current before release.

## 6. Business rules

### 6.1 Actions Taken rules

| ID | Rule |
| --- | --- |
| BR-01 | Every Action Taken belongs to exactly one existing Ticket. |
| BR-02 | A Ticket has at most one primary Ticket Owner, but multiple different operational users may be Action assignees or performers. |
| BR-03 | An Action assignee must be an active IT Staff member or Administrator at the time of assignment; inactive users are rejected with a field error. |
| BR-04 | `performedBy` is automatic. It is set from the authenticated actor when an Action first becomes `COMPLETED`; it is never accepted from client input. While an Action is not complete, the UI displays “Pending completion” rather than inventing a performer. |
| BR-05 | `actionAt` is the server-recorded UTC date/time at which an Action becomes `COMPLETED`; `createdAt` remains the record creation time. Both are rendered in the configured presentation time zone. |
| BR-06 | An Action starts as `PLANNED`. Its allowed lifecycle is `PLANNED -> IN_PROGRESS|COMPLETED|CANCELLED` and `IN_PROGRESS -> COMPLETED|CANCELLED`. `COMPLETED` and `CANCELLED` are terminal in Lab 4. |
| BR-07 | Completion requires a non-blank Result, an active authenticated performer, and all conditional follow-up validation. Cancellation requires a non-blank cancellation reason. |
| BR-08 | If `followUpRequired` is true, `followUpNote` is required and trimmed. Turning follow-up off clears the note only after the user confirms that action in the UI; the audit event records the change. |
| BR-09 | `attachmentNotes` is optional text naming or describing relevant existing evidence. It shall not expose a removed attachment's storage path, session token, or an unauthorized file. |
| BR-10 | A cancelled Action remains visible in the Ticket Action history and is never hard-deleted by this Lab. |
| BR-11 | Each Action create uses an `Idempotency-Key` scoped to its Ticket and authenticated actor. Repeating the same key with the same normalized payload returns the original safe result; a different payload returns a deterministic conflict. |
| BR-12 | Public Action fields are visible to the Requester of the owned Ticket. Internal Notes, private error details, and operational-only audit detail are not leaked. |

### 6.2 Ticket workflow rules

| From | Permitted next status | Additional server rule |
| --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | Cancellation requires confirmation and reason. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `CANCELLED` | Staff/Admin only. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | Resolution gate applies to `RESOLVED`. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | Resolution gate applies to `RESOLVED`. |
| `RESOLVED` | `CLOSED`, `REOPENED` | Closing requires explicit operational confirmation. |
| `CLOSED` | `REOPENED` | Reopen requires a reason. |
| `REOPENED` | `IN_PROGRESS`, `CANCELLED` | Reopen history remains append-only. |
| `CANCELLED` | `REOPENED` | Reopen requires a reason. |

- **BR-13:** Only IT Staff or Administrator performs formal Ticket status changes.
- **BR-14 (proposed #71 amendment):** Entering `IN_PROGRESS`, `RESOLVED`, or `CLOSED` requires an active operational Ticket Owner. Only a Ticket currently in `IN_PROGRESS` blocks that owner's deactivation or demotion; `RESOLVED` and `CLOSED` retain the owner as historical attribution and do not permanently block account changes. If that owner is later inactive or non-operational, reassign the Ticket to an active operational owner before a transition into `IN_PROGRESS`, `RESOLVED`, or `CLOSED`.
- **BR-15:** The resolution gate for `RESOLVED` requires: (a) an active operational Ticket Owner; (b) at least one completed Action with a non-blank Result; and (c) no Action on the Ticket in `PLANNED` or `IN_PROGRESS`. The Requester's advisory confirmation is not a prerequisite.
- **BR-16:** Ticket cancellation and reopening require a non-blank reason; closure requires explicit confirmation. The reason and prior/new status enter the append-only Ticket workflow history.
- **BR-17:** Ticket list and Action history ordering is deterministic. Ticket recency uses `updatedAt DESC, id DESC`; Action workflow history uses `createdAt ASC, id ASC`; completed-work display uses `actionAt DESC, id DESC` when appropriate.
- **BR-18:** Every workflow mutation shall validate current state, Action prerequisites, role, and expected version within the same database transaction.

### 6.3 Dashboard rules

| ID | Rule |
| --- | --- |
| BR-19 | “Open Ticket” means status in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; it excludes `RESOLVED`, `CLOSED`, and `CANCELLED`. |
| BR-20 | Requester “needs attention” means an owned Ticket in `WAITING_FOR_REQUESTER`. |
| BR-21 | Requester “recently updated” lists owned Tickets updated during the preceding 14 calendar days, bounded by `[start,end)` and ordered by `updatedAt DESC, id DESC`. |
| BR-22 | Requester “recently resolved” lists owned Tickets whose server-maintained `resolvedAt` is in the preceding 14 calendar days and whose current status is `RESOLVED` or `CLOSED`. Reopened Tickets do not count until resolved again. |
| BR-23 | IT Staff “unassigned open” means an open Ticket with no owner. “My owned open” means an open Ticket whose `ownerId` is the authenticated operational user. |
| BR-24 | IT Staff “my active Actions” means Actions assigned to the authenticated operational user with status `PLANNED` or `IN_PROGRESS`. “My recently completed Actions” means Actions with `performedById` equal to that user and `actionAt` in the preceding 14 days. These are separate metrics. |
| BR-25 | “Urgent” means an open Ticket whose `itPriority` is `URGENT`, or whose `itPriority` is null and whose Requester priority is `URGENT`. |
| BR-26 | Dashboard time calculation stores UTC and presents Asia/Bangkok time. Each response uses one `asOf` timestamp for all metrics. |
| BR-27 | A metric with no match returns `0`; its compact list returns `[]` and the UI supplies an actionable empty-state message. |
| BR-28 | Each dashboard list has a documented maximum row count, deterministic tie-breaker, and server-recognized drill-down query. |

### 6.4 Safety and migration rules

- **BR-29:** All Action/Ticket writes require the normal authenticated session, CSRF protection, and server-side role/ownership authorization.
- **BR-30:** API error envelopes are safe and stable: `{ "error": { "code", "message", "fields?", "correlationId?" } }`. They never contain secrets, SQL, stack traces, tokens, or another Requester's record.
- **BR-31:** An Action/Ticket mutation carries an expected Ticket workflow version. An Action edit/transition also carries an expected Action version. A stale request returns `409 STALE_VERSION` and leaves data unchanged.
- **BR-32:** Mutations that can affect Resolution acquire the same parent Ticket coordination boundary before reading Actions and writing Ticket/Action/history. This prevents cross-record write skew.
- **BR-33:** Lab 4 migration is additive and preserves existing Users, Tickets, Attachments, Public Comments, Internal Notes, identifiers, and ownership. Legacy Tickets without Actions remain valid and are not automatically resolved.
- **BR-34:** Seed data is synthetic and repeat-safe. It includes all major statuses/priorities, assigned and unassigned Tickets, zero/one/multiple Actions, a follow-up case, an inactive operational user, and both zero/non-zero dashboard examples without resetting unrelated user credentials.

## 7. Data changes and design decisions

### 7.1 Proposed model

| Record | Required concepts |
| --- | --- |
| `Ticket` extension | `workflowVersion Int @default(1)`, `resolvedAt DateTime?`, relation to Actions and Ticket workflow events. Existing `updatedAt` remains an audit timestamp, not a client concurrency token. |
| `ActionTaken` | Ticket relation; `assigneeId`; nullable `performedById`; `status`; `description`; nullable `result`; `followUpRequired`; nullable `followUpNote`; nullable `attachmentNotes`; nullable `actionAt`; nullable `cancelledAt`; nullable `cancellationReason`; `version`; `createdAt`; `updatedAt`. |
| `ActionTakenEvent` | Append-only Action id, event kind/status, actor id, createdAt, safe old/new values or reason. |
| `TicketWorkflowEvent` | Append-only Ticket id, previous/current status, actor id, reason/confirmation metadata, createdAt. |

Foreign keys use `Restrict` for audit-preserving records. Candidate indexes include `(ticketId, status, id)`, `(assigneeId, status, updatedAt)`, `(performedById, actionAt)`, `(ticketId, createdAt, id)`, `(currentStatus, ownerId, updatedAt)`, and `(resolvedAt, requesterId)` after query-plan evidence confirms their value.

### 7.2 Rationale

1. A separate Action assignee and automatic performer preserves the distinction between planned responsibility and the person who completed work; it supports the stakeholder's multi-staff scenario without impersonation.
2. `workflowVersion` on the parent Ticket coordinates Action and Ticket gate changes that cannot safely be protected by each child Action's version alone.
3. Append-only events preserve the rubric's auditability/ordering requirement while allowing explicitly approved edits to the current Action snapshot.
4. `resolvedAt` records the semantic event needed for a stable “recently resolved” metric; `updatedAt` changes for unrelated edits and is therefore not sufficient.

### 7.3 Migration, recovery, and seed

- Generate one new reviewed Prisma migration from a disposable development database; do not edit applied migrations, use `prisma db push`, or use `migrate reset` against a shared/user database.
- Test fresh Lab 4 bootstrap and Lab 3-to-Lab 4 upgrade using disposable databases. Before/after checks include row IDs, foreign keys, ownership, attachment metadata and bytes, plus legacy Tickets with no Actions.
- The recovery plan is restore of a verified pre-migration snapshot into a disposable database followed by validation. A forward-fix migration is used only after review; rollback by data deletion is prohibited.
- The Lab 4 seed uses stable synthetic keys/upserts, is run twice, and does not reset a non-fixture user's password, role, or active state.

## 8. API and UI contract references

Exact endpoints, shapes, status codes, idempotency, version fields, and error examples are in [api-spec.md](api-spec.md). Screen, navigation, feedback, accessibility, responsive, and visual behavior are in [ui-spec.md](ui-spec.md). Planned tests and AC traceability are in [tests.md](tests.md).

## 9. Acceptance criteria

| ID | Observable criterion |
| --- | --- |
| AC-01 | A permitted operational user creates a valid Action under the intended Ticket and the server records the authenticated actor/audit data rather than a client-supplied identity. |
| AC-02 | An Action cannot be assigned to an inactive or non-operational user. |
| AC-03 | A Ticket Owner and Action assignee may be different active operational users. |
| AC-04 | A permitted user can edit mutable Action data and sees a deterministic conflict rather than overwriting a newer Action/Ticket change. |
| AC-05 | Action completion requires Result; cancellation requires reason; follow-up note is required when follow-up is selected. |
| AC-06 | Requesters see every safe Action on their own Ticket but cannot read/mutate another Ticket's Action or any operational-only detail. |
| AC-07 | Repeating an Action create retry key with the same payload is safe; a changed payload produces a deterministic conflict. |
| AC-08 | Action and Ticket histories are append-only, ordered deterministically, and role-filtered. |
| AC-09 | Every allowed Ticket transition succeeds only for Staff/Admin; every prohibited transition is rejected by the backend. |
| AC-10 | Resolution is rejected when its owner/Action prerequisites fail and succeeds only when the documented gate is true. |
| AC-11 | Concurrent Action/Ticket mutations preserve the gate and return a safe conflict where necessary. |
| AC-12 | Requester dashboard data is restricted to the authenticated Requester and has correct open, attention, recent-update, and recent-resolution values. |
| AC-13 | Staff dashboard data has correct unassigned, owned-open, current-user Action, urgent/recent values and does not overcount joins. |
| AC-14 | Every dashboard card has a bounded drill-down whose result matches the card predicate. |
| AC-15 | Each role reaches only its role-appropriate dashboard/navigation and changing sessions clears prior-user data. |
| AC-16 | Dashboard and Action UI covers loading, empty, validation, success, forbidden, not-found, conflict, and recoverable safe-failure states. |
| AC-17 | Requester, Staff, and Administrator representative Lab 1-3 workflows continue to work after Lab 4 migration. |
| AC-18 | Fresh migration, Lab 3 upgrade, recovery, and two seed runs preserve required data and fixtures. |
| AC-19 | Lab 4 screens meet the documented Zen Green, responsive, keyboard, focus, label, error, non-colour, clipping, overlap, and overflow checks. |
| AC-20 | The final main branch has complete, traceable passing test and review evidence with no required suite skipped or represented falsely. |

## 10. Product Definition of Done

Product completion is true only when all approved scope is implemented; every AC maps to passing evidence; migration/seed/recovery tests pass; all planned required suites run from documented commands; no required test is skipped/disabled; API/UI/data match this Contract; role/ownership/CSRF/concurrency/safe-error checks pass; responsive/accessibility/manual visual checks are recorded; README and repository docs are current; peer findings are addressed; and exact final-main CI is green.

Course delivery is separately complete only when all Lab 4 Issues are represented honestly in the Project workflow, feature PRs and reviews are traceable, the release follows `lab4-staging -> main`, `reviewer.md` and `ai-use.md` contain actual information, and one readable PDF uses `Answer Part 1` through `Answer Part 9` in order with working links.

## 11. Assumptions and decision register

| Decision | Status before review | Choice / rationale |
| --- | --- | --- |
| D-01 | Approved in PR #75 | Action lifecycle is planned/in-progress/completed/cancelled; terminal records are retained rather than hard-deleted. |
| D-02 | Approved in PR #75 | Action assignee and performer are distinct; performer is automatically set at completion. |
| D-03 | Approved in PR #75 | Ticket resolution requires active owner, one completed Action with Result, and no active Action. Requester advisory is not required. |
| D-04 | Approved in PR #75 | Parent Ticket workflow version coordinates Action/Ticket writes; Action has its own version for edit conflict feedback. |
| D-05 | Approved in PR #75 | UTC storage, Asia/Bangkok presentation, 14-day recent windows, and `[start,end)` boundaries are used for dashboards. |
| D-06 | Approved in PR #75 | Dashboard rows are bounded, ordered server-side, and drill into filtered existing detailed views. |
| D-07 | Approved in PR #75 | Admin sees the Staff dashboard plus optional active account totals, not a separate broad analytics product. |
| D-08 | Approved in PR #75 | Historical review/Contract screenshots may cite their original commit; final-product screenshots/tests/CI must cite final main. |

The learner and peer approved these baseline decisions in PR #75. A later behavior change updates this Contract, traceability, and tests and requires review on the changed commit.
