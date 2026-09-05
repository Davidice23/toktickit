# Lab 2 Sprint Engineering Specification

| Item | Value |
| --- | --- |
| Product | TokTickIT Requester Ticketing MVP |
| Sprint | Lab 2 |
| Contract version | 0.2 |
| Contract status | Student-approved revision; follow-up peer review pending |
| Approved by | Wachirawit Photchamnian (67070505206) |
| Approval date | 2026-09-03 |
| Specification issue | #15 |
| Integration branch | `lab2-staging` |

> **Lab 2 security limitation:** `X-Requester-Id` and the Development Requester selector are deliberately spoofable test mechanisms. They demonstrate owner-scoped application behavior but do not establish an authenticated identity or a security boundary. Lab 3 must replace them with server-verified authentication before this behavior can be considered secure.

## 1. Sprint Goal

Deliver a professional, responsive Requester-facing ticketing increment. A person selected through the temporary Development Requester screen can create an IT support ticket, see only their own tickets, search and organize that list, open a read-only detail view, and safely upload, download, and soft-remove permitted attachments. The increment establishes a reusable Zen Green UI foundation and a traceable engineering contract for later labs.

## 2. Stakeholder Request Interpretation

Lab 2 is a multi-user ownership simulation, not an authentication sprint. Active seeded Requesters provide the current test identity. The backend remains the authority for generated values, validation, ownership filtering, and file rules. The frontend must communicate all meaningful states and remain usable at desktop, tablet, and mobile widths. Completion is proven by automated tests, peer review, project history, and visual evidence rather than by implementation alone.

## 3. Scope

### Included

- Development Requester selection, persistence, display, switching, and failure/empty states.
- Active Category and Related System reference data from PostgreSQL.
- Ticket creation with backend-generated Ticket Number, Ticket Date, owner, and initial status.
- Requester-owned My Tickets with search, filters, sorting, and pagination.
- Requester-owned read-only Ticket Detail.
- Attachment upload, metadata, download, and owner-authorized soft removal.
- Zen Green application shell, reusable components, responsive layouts, accessibility rules, and state feedback.
- Prisma schema/migrations, repeat-safe seed data, REST APIs, automated tests, E2E flow, and evidence.

### Explicitly excluded

- Real login/logout, passwords, password hashing, sessions, tokens, authenticated identity, and secure role authorization.
- IT Staff dashboard/queue, assignment, reassignment, or changing IT Priority.
- Public Comments, Internal Notes, Actions Taken, or other collaboration/work tracking.
- Ticket lifecycle changes after the initial `NEW` status, including resolve, close, reopen, or cancel.
- Administrator management of users, roles, Requesters, or reference data.

## 4. Functional Requirements

- **FR-01** The system shall list active Development Requesters in predictable name order.
- **FR-02** The application shall require a Development Requester before requester-specific screens can open.
- **FR-03** The application shall persist and display the selected Development Requester and provide Change Requester.
- **FR-04** Changing Requester shall reload or clear all requester-specific data before showing the new context.
- **FR-05** The system shall list active Categories and active Related Systems from PostgreSQL.
- **FR-06** A Requester shall create a Ticket with Category, Related System, Summary, Requested Priority, and Description.
- **FR-07** The backend shall assign the official Ticket Number, Ticket Date, owner, and initial Current Status.
- **FR-08** The creation flow shall prevent accidental duplicate submission and preserve input after a recoverable failure.
- **FR-09** A Requester shall list only Tickets they own.
- **FR-10** My Tickets shall support documented search, filtering, sorting, and pagination.
- **FR-11** My Tickets shall distinguish loading, empty-list, no-results, and safe failure states.
- **FR-12** A Requester shall open a read-only detail view only for a Ticket they own.
- **FR-13** A Requester shall upload permitted Attachments to a Ticket they own.
- **FR-14** A Requester shall inspect active and removed Attachment metadata for a Ticket they own.
- **FR-15** A Requester shall download only an active Attachment belonging to their own Ticket.
- **FR-16** A Requester shall soft-remove their own active Attachment after confirmation and a valid reason.
- **FR-17** All required screens shall provide responsive desktop, tablet, and mobile layouts.
- **FR-18** All API failures shall use safe, consistent responses that do not expose stack traces, filesystem paths, credentials, or cross-owner resource existence.

## 5. Business Rules

### Requester context

- **BR-01** Lab 2 uses a Development Requester selector for testing only; it is not authentication or authorization.
- **BR-02** Only active Requesters appear in the selector; results are ordered by name then ID.
- **BR-03** The selected Requester ID is stored under `toktickit.devRequesterId` in browser local storage.
- **BR-04** A stored Requester ID must be revalidated against the active Requester API on application start. Missing, invalid, or inactive values are cleared.
- **BR-05** Requester-specific API calls carry `X-Requester-Id`. This header is deliberately spoofable in Lab 2 and must be replaced by authenticated server identity in Lab 3.
- **BR-06** Change Requester clears requester-specific form/list/detail caches, returns to selection, and reloads data after the next selection.

### Ticket defaults, ownership, and validation

- **BR-07** The backend generates the official unique Ticket Number; the client cannot supply or edit it.
- **BR-08** The official format is `TKT-` followed by the zero-padded database Ticket ID to six digits, for example `TKT-000123`.
- **BR-09** Ticket creation and Ticket Number assignment occur in one database transaction; an incomplete numbered Ticket is never committed.
- **BR-10** Ticket Date is the backend `createdAt` timestamp in UTC and is displayed in the user's locale.
- **BR-11** A new Ticket begins with Current Status `NEW`.
- **BR-12** The selected Requester becomes the saved `requesterId`; client-supplied ownership is not trusted.
- **BR-13** Summary is required, trimmed, and must contain 5-120 characters after trimming.
- **BR-14** Description is required, trimmed, and must contain 10-5,000 characters after trimming.
- **BR-15** Requested Priority is required and one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- **BR-16** Category and Related System must exist and be active at creation time.
- **BR-17** Frontend validation improves feedback, but the backend repeats all authoritative validation.
- **BR-18** The UI generates one UUID idempotency key per logical submission. The submit button is disabled while pending.
- **BR-19** Idempotency is scoped by the composite `(requesterId, submissionKey)`. The backend stores a SHA-256 hash of the canonical normalized creation payload with the Ticket and retains both key and hash for the Ticket's lifetime. A replay with the same stored hash returns the original Ticket without creating another; the same key with a different hash returns a conflict. Later changes to mutable Ticket fields do not change the stored creation hash.
- **BR-20** A recoverable creation failure preserves editable form values and selected valid files so the Requester can correct or retry.

### Ticket list and detail

- **BR-21** Every Ticket list/detail query is constrained by the selected `requesterId` in the database query, not filtered only in the browser.
- **BR-22** A missing Ticket and a Ticket owned by another Requester both return the same `404` safe response.
- **BR-23** Search is trimmed and case-insensitive across Ticket Number, Summary, and Description. Case-insensitivity is enforced in the PostgreSQL query with Prisma `mode: "insensitive"` (`ILIKE` semantics), not inherited from database or operating-system collation.
- **BR-24** Supported filters are Category, Related System, Requested Priority, and Current Status. Empty filter values mean no filter.
- **BR-25** Supported sort fields are `updatedAt`, `ticketDate`, `ticketNumber`, and `summary`; directions are `asc` and `desc`.
- **BR-26** Default order is `updatedAt desc`, with `id desc` as the deterministic secondary order. Every other sort also uses `id desc` as a tie-breaker.
- **BR-27** Pagination is one-based. Allowed page sizes are 10, 20, and 50; defaults are page 1 and page size 10.
- **BR-28** Unknown, malformed, or unsupported query values return `400` rather than being silently ignored.
- **BR-29** An owner with zero Tickets sees the empty-list state. A nonempty owner list reduced to zero by search/filters sees the no-results state.

### Attachments

- **BR-30** Allowed types are JPG/JPEG (`image/jpeg`), PNG (`image/png`), WEBP (`image/webp`), and PDF (`application/pdf`). Both MIME type and file signature are validated.
- **BR-31** Maximum size is 5 MiB (5,242,880 bytes) per file; an empty file is invalid.
- **BR-32** A Ticket may have at most five active Attachments. Removed Attachments do not consume an active slot. Upload admission is concurrency-safe: one database transaction locks the owned Ticket row with `SELECT ... FOR UPDATE`, counts active Attachments, and inserts metadata before releasing the lock. Concurrent uploads for the same Ticket are serialized, so the active count cannot exceed five.
- **BR-33** The original filename is normalized for display, limited to 150 characters, stripped of path components/control characters, and never used as the physical stored filename.
- **BR-34** A stored filename is an application-generated UUID plus a validated extension under `server/uploads/lab-02`; upload directories and file contents are excluded from Git.
- **BR-35** Attachment metadata contains ID, Ticket ID, original name, stored name, MIME type, byte size, uploaded timestamp, removal timestamp, and removal reason.
- **BR-36** Attachment ownership is inherited from its Ticket and checked on metadata, upload, download, and removal.
- **BR-37** Ticket creation completes before optional files upload. If one upload fails, the Ticket and successful prior uploads remain; the UI identifies each failed file and offers retry. The Ticket is not silently deleted.
- **BR-38** File persistence uses compensation: write a temporary file, validate, create metadata in a database transaction, atomically rename to its final path, and delete the temporary/final file if the database step fails.
- **BR-39** Soft removal requires explicit confirmation and a trimmed reason of 5-200 characters. It sets `removedAt` and `removedReason`; it does not delete metadata.
- **BR-40** Removed metadata remains visible with a Removed badge, timestamp, and reason, but preview/download controls are absent and the download API returns `404`.
- **BR-41** Re-removing an already removed Attachment is idempotent only when the caller owns the Ticket; it returns the existing removed metadata without changing the original removal record.
- **BR-42** Attachment operations against a missing, removed, or cross-owner resource use safe errors and never reveal storage paths.

### Failure and future evolution

- **BR-43** Reference/requester/list loading failures display a safe message and Retry action; stale data is not represented as freshly loaded.
- **BR-44** API error bodies follow the shared envelope in `api-spec.md`; unexpected errors return a correlation ID and log detail only on the server.
- **BR-45** Lab 3 will replace `X-Requester-Id` and local-storage identity with authenticated server identity while retaining the `RequesterUser`-to-`Ticket` ownership relationship.

## 6. UI Specification Summary

The application uses the reusable Zen Green tokens and component states defined in [`ui-spec.md`](./ui-spec.md). The shell shows TokTickIT identity, My Tickets, Create Ticket, current Requester, active navigation, Change Requester, and a mobile navigation pattern. Required screens are Development Requester Selection, Create Ticket, My Tickets, and Requester Ticket Detail. Desktop uses centered multi-column/table layouts, tablet uses two columns where practical, and mobile stacks fields and uses ticket cards without horizontal page scrolling. All screens explicitly handle initial, loading/busy, empty/no-results, validation, success, and safe failure states.

## 7. Data Changes

### Proposed Prisma models

| Model | Important fields and constraints |
| --- | --- |
| `RequesterUser` | `id`, `name`, unique `email`, `isActive`, `createdAt`, `updatedAt`; index on `(isActive, name)` |
| `Category` | existing `id`, unique `name`, plus `isActive`, `createdAt`, `updatedAt`; index on `(isActive, name)` |
| `RelatedSystem` | `id`, unique `name`, `isActive`, `createdAt`, `updatedAt`; index on `(isActive, name)` |
| `Ticket` | `id`, nullable-while-transactional unique `ticketNumber`, `submissionKey`, `submissionHash`, `requesterId`, `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, `currentStatus`, nullable `itPriority`, `createdAt`, `updatedAt`; composite unique `(requesterId, submissionKey)` |
| `Attachment` | `id`, `ticketId`, `originalName`, unique `storedName`, `mimeType`, `sizeBytes`, `uploadedAt`, nullable `removedAt`, nullable `removedReason` |

### Enums

- `RequestedPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- `TicketStatus`: `NEW` for Lab 2; later migrations may add lifecycle values.
- `ITPriority`: reuse priority values as a nullable read-only field for future labs; Lab 2 never assigns or edits it.

### Relationships

- One Requester owns many Tickets; every Ticket belongs to one Requester.
- One Category classifies many Tickets; every Ticket has one Category.
- One Related System is referenced by many Tickets; every Ticket has one Related System.
- One Ticket has many Attachments; every Attachment belongs to one Ticket.
- Foreign keys use restrictive deletion during Lab 2 so ownership/evidence cannot be accidentally cascaded away.

### Index decisions

- `Ticket.ticketNumber`, requester email, Category name, Related System name, and stored filename are unique. Idempotency uses a composite unique constraint on `(requesterId, submissionKey)` and stores the immutable canonical `submissionHash`.
- Composite Ticket indexes support common owner-scoped operations: `(requesterId, updatedAt)`, `(requesterId, currentStatus)`, `(requesterId, categoryId)`, `(requesterId, relatedSystemId)`, and `(requesterId, requestedPriority)`.
- `Attachment(ticketId, removedAt)` supports active-count and metadata queries.
- Design justification: owner ID is the leading Ticket index column because every Lab 2 ticket query is owner-scoped. This both improves the common access path and makes ownership enforcement natural in the database query.

### Migration and seed decisions

- Add one named Prisma migration for the Lab 2 increment; never edit the Lab 1 migration.
- Preserve Lab 1 Category data while adding defaults for new columns.
- Seed with `upsert` by stable unique names/emails so repeated runs do not create duplicates.
- Required seed: four Categories (Account and Access, Hardware, Software, Network), at least six realistic Related Systems, at least four active Requesters, and at least one inactive Requester.

## 8. API Contract

The authoritative endpoint, request, response, validation, status, pagination, ownership, and error definitions are in [`api-spec.md`](./api-spec.md). All requester-owned routes use `X-Requester-Id` as the temporary Lab 2 context and enforce owner predicates server-side. No API response exposes a stored filename or filesystem path.

## 9. Acceptance Criteria

- **AC-01** Given the selector opens, when active Requesters load, then only active database records appear in predictable order with an explanation that this is not login.
- **AC-02** Given no valid Requester is selected, when a requester-specific route opens, then the selector is shown instead.
- **AC-03** Given a Requester is selected, when the application opens, then the shell shows that Requester and Change Requester is available.
- **AC-04** Given Requester A data is visible, when switching to Requester B, then A's cached/list/detail data disappears and B's data is reloaded.
- **AC-05** Given the Requester API is loading, empty, or fails, then the selector shows the corresponding accessible state and Retry where meaningful.
- **AC-06** Given Create Ticket opens, when reference data loads, then active Categories and Related Systems come from PostgreSQL and generated/read-only fields are visually distinct.
- **AC-07** Given valid Ticket data, when submitting once, then one owned `NEW` Ticket is committed and the backend Ticket Number and Ticket Date are displayed.
- **AC-08** Given invalid required, length, enum, or reference values, when submitted, then no Ticket is created and field-level safe validation is shown.
- **AC-09** Given a pending or replayed logical submission, when submit is triggered again, then duplicate Tickets are not created.
- **AC-10** Given a recoverable Ticket API failure, when submission fails, then a safe error appears and editable values remain.
- **AC-11** Given a selected Requester, when My Tickets loads, then only Tickets owned by that Requester are returned and can be opened.
- **AC-12** Given a search term, when My Tickets loads, then trimmed case-insensitive matches across the documented fields are returned.
- **AC-13** Given one or more valid filters, when applied, then only matching owned Tickets appear; Clear Filters restores the unfiltered list.
- **AC-14** Given a valid sort selection, when applied, then results follow the documented field/direction and deterministic tie-breaker.
- **AC-15** Given multiple pages, when navigating, then allowed page sizes and correct pagination metadata/results are used.
- **AC-16** Given an invalid list query parameter, when requested, then the API returns a safe `400` response.
- **AC-17** Given no owned Tickets versus no filter matches, when the list renders, then distinct empty-list and no-results states appear.
- **AC-18** Given a list-loading failure, when My Tickets renders, then it shows a safe failure and Retry without exposing another Requester's data.
- **AC-19** Given an owned Ticket, when its detail opens, then current Ticket data is displayed read-only with active/removed Attachment metadata.
- **AC-20** Given a missing or cross-owner Ticket, when detail is requested, then no Ticket data is returned and the same safe not-found experience appears.
- **AC-21** Given a valid permitted file within limits and an owned Ticket, when uploaded, then active metadata is saved and displayed.
- **AC-22** Given an empty, unsupported, spoofed-signature, oversized, or sixth active file, when uploaded, then it is rejected safely without corrupt metadata/orphaned files.
- **AC-23** Given an active owned Attachment, when downloaded, then the original safe filename and correct content are returned.
- **AC-24** Given a cross-owner, missing, or removed Attachment, when downloaded, then content is not returned and resource existence/storage is not disclosed.
- **AC-25** Given an active owned Attachment, when removal is confirmed with a valid reason, then removal metadata is retained and download/preview becomes unavailable.
- **AC-26** Given removal is cancelled or its reason is invalid, when the action ends, then the Attachment remains active.
- **AC-27** Given a Ticket is created and an optional upload fails, when the workflow completes, then the Ticket and successful uploads remain and failed files are identified for retry.
- **AC-28** Given desktop, tablet, and mobile viewports, when each required screen renders, then it follows the documented layout with no clipping, overlap, hidden actions, unreadable filenames, or horizontal page scrolling.
- **AC-29** Given keyboard-only use, when navigating screens and dialogs, then controls have visible focus, meaningful labels, correct disabled/busy behavior, and non-color state indicators.
- **AC-30** Given an unexpected API error, when any workflow fails, then the user receives a safe actionable message while the server retains diagnostic detail and a correlation ID.

## 10. Definition of Done

### Product completion

- [ ] All approved scope and AC-01 through AC-30 are implemented.
- [ ] Every AC maps to at least one planned automated test in `tests.md`.
- [ ] Required unit, API/integration, UI component, UI style, responsive, and E2E tests pass from documented commands on final `main`.
- [ ] No required test is skipped, disabled, commented out, flaky, or unrelated to its mapped criterion.
- [ ] Migrations apply cleanly and seed can run twice without duplicates.
- [ ] Ownership is enforced in backend queries and cross-Requester Ticket/Attachment cases pass.
- [ ] API, data, validation, error, UI, accessibility, and responsive behavior conform to the approved contract.
- [ ] Desktop, tablet, and mobile visual checks/screenshots pass for Create Ticket, My Tickets, and Ticket Detail.
- [ ] README setup/run/test instructions and `.gitignore` are current.

### Course delivery

- [ ] Issues #15-#23 include dependencies, branch names, acceptance criteria, and evidence.
- [ ] Each Issue uses its own feature branch and peer-reviewed PR into `lab2-staging`.
- [ ] Review comments are answered and approvals are recorded in `reviewer.md`.
- [ ] Integration is verified on `lab2-staging`, followed by one release PR to `main`.
- [ ] Final GitHub Project shows all Lab 2 Issues Done.
- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`, and `ai-use.md` are complete.
- [ ] Required evidence and readable screenshots are stored under `artifacts/lab-02/screenshots` and included in one concise PDF with Answer Part 1 through Answer Part 9 in order.

## 11. Assumptions and Decisions

1. `X-Requester-Id` is chosen for consistent temporary context across APIs; changing the header trivially impersonates another seeded Requester. It provides no security and will be replaced in Lab 3.
2. Ticket Numbers use committed database IDs so uniqueness is guaranteed without a race-prone daily counter.
3. Search includes Ticket Number, Summary, and Description; reference values remain explicit filters to keep results understandable.
4. Files are stored locally for this lab while metadata is stored in PostgreSQL. The storage service boundary must permit later replacement with object storage.
5. Ticket creation and optional file upload are separate operations. A Ticket remains valid when an optional upload fails, and partial upload success is reported precisely.
6. Cross-owner resources intentionally use the same `404` response as missing resources to avoid existence disclosure even though Lab 2 is not secure authentication.
7. IT Priority is future-facing, nullable, and read-only; Lab 2 contains no control or workflow for assigning it.

## 12. Revision History

| Version | Date | Reason |
| --- | --- | --- |
| 0.1 | 2026-09-03 | Initial student-approved engineering contract in PR #24 |
| 0.2 | 2026-09-05 | Clarified Attachment concurrency, Requester-header security limitation, idempotency retention/scope, query-level case-insensitive search, and traceability after peer review |

## 13. Issue Decomposition and Order

| Issue | Branch | Purpose | Depends on |
| --- | --- | --- | --- |
| #15 | `feature/15-lab2-contract` | Contract and test plan | Lab 1 complete |
| #16 | `feature/16-lab2-data` | Schema, migration, idempotent seed | #15 |
| #17 | `feature/17-zen-green-foundation` | UI tokens, shell, reusable states | #15 |
| #18 | `feature/18-requester-context` | Temporary Requester context | #15, #16, #17 |
| #19 | `feature/19-create-ticket` | Ticket creation | #15-#18 |
| #20 | `feature/20-my-tickets` | Owned list/query behavior | #18, #19 |
| #21 | `feature/21-ticket-detail` | Owned read-only detail | #18-#20 |
| #22 | `feature/22-attachments` | Attachment lifecycle | #15, #16, #18, #19, #21 |
| #23 | `feature/23-lab2-quality` | Integration, E2E, evidence | #15-#22 |

This order keeps the contract and data foundation ahead of dependent behavior, allows UI foundation work after the contract, and reserves cross-feature integration/evidence for the final Issue.
