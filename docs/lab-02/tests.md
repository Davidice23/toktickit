# Lab 2 Test Plan and Results

| Item | Value |
| --- | --- |
| Contract version | 0.1 |
| Contract status | Student-approved revision; follow-up peer review pending |
| Test execution status | Planned before implementation |
| Acceptance source | `docs/lab-02/specification.md` AC-01 through AC-30 |
| Final authority | Passing tests from final `main`, plus required visual inspection |

## 1. Test Strategy

Lab 2 uses Spec DD, Test DD, and TDD. For each feature Issue, write the mapped tests first, capture the expected failing reason (red), implement the smallest conforming behavior (green), then refactor without breaking the suite. Tests cover pure rules, PostgreSQL-backed APIs, React components, reusable UI styles, responsive behavior, and one complete multi-Requester E2E workflow.

### Test isolation

- API tests use a dedicated test database, apply migrations, and seed deterministic fixtures.
- Every API test resets mutable Ticket/Attachment data without deleting reference/requester fixtures.
- Files use a temporary test upload directory removed after the suite.
- UI tests mock only the HTTP boundary and assert requests plus rendered states.
- E2E uses the real client, server, PostgreSQL, and a dedicated upload directory.
- No production/local personal data or secret appears in fixtures, snapshots, screenshots, or logs.

### Evidence rule

`Planned` means not yet implemented/executed. During each Issue, record the initial failing reason in the PR, then change the status here only after the exact test passes. Final results are recorded again after running the complete suite on `main`.

## 2. Planned Tests

### 2.1 Unit tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | BR-08, BR-09, AC-07 | Ticket Number formatting from committed ID | `42` becomes `TKT-000042`; boundaries remain unique | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| UNIT-02 | BR-13-BR-20, AC-08-AC-10 | Normalization and Ticket input validation | Trimmed valid data accepted; missing/boundary/enum values rejected by field | `server/tests/lab-02/ticket-validation.unit.test.ts` | Planned |
| UNIT-03 | BR-23-BR-28, AC-12-AC-16 | Ticket-list query parsing | Valid defaults/combinations parsed; unknown/malformed values rejected; search explicitly selects insensitive mode | `server/tests/lab-02/ticket-query.unit.test.ts` | Planned |
| UNIT-04 | BR-30-BR-34, AC-21, AC-22 | File type/signature/size/name rules | Valid JPG/PNG/WEBP/PDF pass; spoofed, empty, large, unsafe fail | `server/tests/lab-02/attachment-validation.unit.test.ts` | Planned |
| UNIT-05 | BR-39-BR-41, AC-25, AC-26 | Removal reason and idempotent removal rules | 5-200 trimmed reason accepted; invalid rejected; replay unchanged | `server/tests/lab-02/attachment-removal.unit.test.ts` | Planned |

### 2.2 API and PostgreSQL integration tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Status |
| --- | --- | --- | --- | --- | --- |
| API-REQ-01 | FR-01, BR-02, AC-01 | Active Development Requesters | Only active rows returned in name/ID order | `server/tests/lab-02/requesters.api.test.ts` | Planned |
| API-REQ-02 | BR-02, AC-05 | Empty and database-failure Requester responses | Empty array is `200`; failure is safe `500` | `server/tests/lab-02/requesters.api.test.ts` | Planned |
| API-REF-01 | FR-05, BR-16, AC-06 | Active Categories/Related Systems | Active database rows returned in order; inactive excluded | `server/tests/lab-02/reference-data.api.test.ts` | Planned |
| API-CRT-01 | FR-06, FR-07, BR-07-BR-16, AC-07 | Valid Ticket creation | `201`; one owned `NEW` Ticket; backend number/date returned | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-02 | BR-13-BR-17, AC-08 | Required and exact length boundaries | Valid min/max accepted; below/above/missing rejected by field | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-03 | BR-15-BR-17, AC-08 | Enum and active reference validation | Invalid priority or missing/inactive reference returns `400`; no row | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-04 | BR-12, AC-07 | Owner derives from Requester context | Saved `requesterId` equals valid header context | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-05 | BR-18, BR-19, AC-09 | Requester-scoped exact idempotent replay | First request `201`, early/late replay `200`; one Ticket; another Requester cannot receive it | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-06 | BR-19, AC-09 | Stored-hash idempotency conflict | Same Requester/key with different canonical body returns `409`; immutable creation hash remains unchanged | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-CRT-07 | BR-09, BR-44, AC-10, AC-30 | Transaction rollback and safe unexpected error | `500` safe envelope/correlation ID; no partial Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-LST-01 | FR-09, BR-21, AC-11 | Owner-scoped list | Requester A never receives B Tickets | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-02 | BR-23, AC-12 | Trimmed query-level case-insensitive search | Mixed-case terms match number/summary/description through PostgreSQL `ILIKE`, only within owner | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-03 | BR-24, AC-13 | Individual and combined filters | Category/system/priority/status AND combinations are correct | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-04 | BR-25, BR-26, AC-14 | Sort fields, direction, tie-breaker | Stable documented ordering for every allowed sort | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-05 | BR-27, AC-15 | Pagination boundaries and metadata | Defaults, 10/20/50, last/beyond-last pages are accurate | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-06 | BR-28, AC-16 | Invalid/unknown query | Safe `400`; unsupported parameters not ignored | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-07 | BR-29, AC-17 | Zero owner rows and zero matches | Both return correct empty data/metadata for UI distinction | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-LST-08 | BR-44, AC-18, AC-30 | List database failure | Safe `500` with correlation ID and no leaked detail | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-DTL-01 | FR-12, BR-21, AC-19 | Owned Ticket Detail | `200` full read-only data and ordered attachment metadata | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-DTL-02 | BR-22, AC-20 | Missing versus cross-owner detail | Both return identical safe `404` envelope | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-ATT-01 | BR-30-BR-38, AC-21 | Valid upload formats | JPG/PNG/WEBP/PDF produce `201`, metadata, and stored file | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-02 | BR-30-BR-34, AC-22 | Empty/type/signature/size/name rejection | Correct `400`/`413`/`415`; no metadata/orphan file | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-03 | BR-32, AC-22 | Five-active boundary, removed slot, and concurrent admission | First five active accepted, sixth `409`, removed frees slot; with four active and two concurrent uploads exactly one succeeds and final active count is five | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-04 | BR-36, AC-20, AC-24 | Cross-owner metadata/upload/download/remove | Same safe `404`; no mutation/content/existence leak | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-05 | BR-35, BR-40, AC-19 | Active and removed metadata list | Ordered list retains removed metadata without storage data | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-06 | BR-36, AC-23 | Active owned download | `200`, correct bytes/type/safe original disposition | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-07 | BR-40, BR-42, AC-24 | Removed/missing/unavailable download | Identical safe `404`; no bytes/path returned | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-08 | BR-39-BR-41, AC-25, AC-26 | Valid, invalid, cancelled, replayed removal | Metadata retained; valid removal blocks download; invalid no change | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-ATT-09 | BR-37, BR-38, AC-27, AC-30 | Upload failure and compensation | Ticket/prior uploads remain; failing upload leaves no orphan | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-SEED-01 | Data contract | Repeat-safe seed | Running seed twice yields required exact unique fixtures | `server/tests/lab-02/seed.integration.test.ts` | Planned |

### 2.3 React UI component and style tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Status |
| --- | --- | --- | --- | --- | --- |
| UI-REQ-01 | FR-01-FR-04, AC-01-AC-04 | Selection, guard, persistence, display, switch | Correct routing/context; switch clears old data | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-REQ-02 | BR-43, AC-05 | Selector loading/empty/failure/retry | Distinct accessible states and correct disabled controls | `client/tests/lab-02/RequesterSelection.test.tsx` | Planned |
| UI-CRT-01 | FR-05-FR-08, AC-06, AC-07 | Initial form/reference/read-only/success | Database options, header context, official success values | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-CRT-02 | BR-13-BR-17, AC-08 | Client field validation | Nearby messages; invalid fields linked; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-CRT-03 | BR-18-BR-20, AC-09, AC-10 | Busy/duplicate/failure retention | One API call, disabled busy button, values preserved | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-CRT-04 | BR-30-BR-37, AC-22, AC-27 | File selection and partial upload outcome | Per-file validity; success/failure groups; retry action | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-LST-01 | FR-09-FR-11, AC-11-AC-15 | Query controls and open action | Correct headers/query/reset/page interactions | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-LST-02 | BR-29, BR-43, AC-17, AC-18 | Loading/empty/no-results/failure | Four distinct states with proper actions | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-DTL-01 | FR-12, AC-19, AC-20 | Owned detail and safe not-found/failure | Read-only groups; back/retry; no forbidden controls | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-ATT-01 | FR-13-FR-16, AC-21-AC-26 | Attachment state/action UI | Active/uploading/invalid/removed/unavailable and dialog behavior | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-A11Y-01 | AC-29 | Labels, focus, ARIA, non-color state | Form/menu/dialog/table/component accessibility contract | `client/tests/lab-02/Accessibility.test.tsx` | Planned |
| STYLE-01 | AC-06, AC-28, AC-29 | Zen Green tokens/component classes | Required tokens, read-only/editable/error/focus/buttons/badges | `client/tests/lab-02/ZenGreenStyles.test.tsx` | Planned |
| STYLE-02 | AC-28 | Desktop table/mobile card markup | Equivalent ticket fields/actions in responsive representations | `client/tests/lab-02/ResponsiveLayouts.test.tsx` | Planned |

### 2.4 Responsive and end-to-end tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Status |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-01-AC-04, AC-06-AC-27 | Complete Requester flow | Select A, create, find, detail, upload/download/remove, blocked download; B cannot access | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | AC-04, AC-11, AC-20, AC-24 | Multi-Requester ownership | Switching A to B removes A data; direct Ticket/Attachment URLs rejected | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | AC-28, AC-29 | Desktop/tablet/mobile required screens | Screenshots; no page overflow/clipping/overlap/hidden action | `e2e/lab-02/responsive-visual.spec.ts` | Planned |
| E2E-04 | AC-05, AC-10, AC-18, AC-30 | Safe failure paths | Simulated API failures show actionable states and preserve appropriate input | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Planned evidence |
| --- | --- |
| AC-01 | API-REQ-01, UI-REQ-01, E2E-01 |
| AC-02 | UI-REQ-01, E2E-01 |
| AC-03 | UI-REQ-01, E2E-01 |
| AC-04 | UI-REQ-01, E2E-02 |
| AC-05 | API-REQ-02, UI-REQ-02, E2E-04 |
| AC-06 | API-REF-01, UI-CRT-01, STYLE-01, E2E-01 |
| AC-07 | UNIT-01, API-CRT-01, API-CRT-04, UI-CRT-01, E2E-01 |
| AC-08 | UNIT-02, API-CRT-02, API-CRT-03, UI-CRT-02 |
| AC-09 | API-CRT-05, API-CRT-06, UI-CRT-03 |
| AC-10 | API-CRT-07, UI-CRT-03, E2E-04 |
| AC-11 | API-LST-01, UI-LST-01, E2E-01, E2E-02 |
| AC-12 | UNIT-03, API-LST-02, UI-LST-01 |
| AC-13 | API-LST-03, UI-LST-01 |
| AC-14 | API-LST-04, UI-LST-01 |
| AC-15 | API-LST-05, UI-LST-01 |
| AC-16 | UNIT-03, API-LST-06 |
| AC-17 | API-LST-07, UI-LST-02 |
| AC-18 | API-LST-08, UI-LST-02, E2E-04 |
| AC-19 | API-DTL-01, API-ATT-05, UI-DTL-01 |
| AC-20 | API-DTL-02, API-ATT-04, UI-DTL-01, E2E-02 |
| AC-21 | UNIT-04, API-ATT-01, UI-ATT-01, E2E-01 |
| AC-22 | UNIT-04, API-ATT-02, API-ATT-03, UI-CRT-04 |
| AC-23 | API-ATT-06, UI-ATT-01, E2E-01 |
| AC-24 | API-ATT-04, API-ATT-07, UI-ATT-01, E2E-02 |
| AC-25 | UNIT-05, API-ATT-08, UI-ATT-01, E2E-01 |
| AC-26 | UNIT-05, API-ATT-08, UI-ATT-01 |
| AC-27 | API-ATT-09, UI-CRT-04, E2E-01 |
| AC-28 | STYLE-02, E2E-03, completed visual checklist |
| AC-29 | UI-A11Y-01, STYLE-01, E2E-03 |
| AC-30 | API-CRT-07, API-LST-08, API-ATT-09, E2E-04 |

All 30 Acceptance Criteria have planned evidence. Every automated test above names its intended repository path.

## 4. Responsive and Visual Checklist

Execute at 1440 px desktop, 820 px tablet, and 390 px mobile for Development Requester Selection, Create Ticket, My Tickets, and Ticket Detail.

- [ ] Colors/tokens match `ui-spec.md`.
- [ ] Editable versus read-only fields are visually distinct.
- [ ] Labels, required markers, and messages align with their controls.
- [ ] Primary/secondary/tertiary/destructive/disabled/busy actions are consistent.
- [ ] Loading, empty, no-results, validation, success, warning, error, and removed states are clear without color alone.
- [ ] Desktop table and mobile cards provide equivalent identifying information.
- [ ] Priority, status, and attachment badges are consistent.
- [ ] No clipped label, overlapping message, hidden action, or unreadable Attachment filename.
- [ ] No document-level horizontal scrolling.
- [ ] Keyboard focus is visible; mobile menu and removal dialog manage focus correctly.
- [ ] Screenshot paths and state names follow `ui-spec.md`.

## 5. Test Commands

Commands may be refined when Playwright and Lab 2 scripts are added; any change must update this file and README.

```powershell
cd server
npm run test
npm run build
npx prisma migrate deploy
npm run prisma:seed
npm run prisma:seed

cd ../client
npm run test
npm run build

cd ..
npx playwright test e2e/lab-02
```

Focused TDD commands:

```powershell
cd server
npx vitest run tests/lab-02/<current-test-file>.test.ts

cd ../client
npx vitest run tests/lab-02/<current-test-file>.test.tsx
```

The final run must use documented scripts from the final `main`, not only focused commands.

## 6. Final Results

| Suite | Required final evidence | Current result |
| --- | --- | --- |
| Server unit | Complete output from final `main` | Not run - implementation not started |
| API/PostgreSQL integration | Complete output from final `main` | Not run - implementation not started |
| Client component/style | Complete output from final `main` | Not run - implementation not started |
| Client/server builds | Complete output from final `main` | Not run for Lab 2 increment |
| Playwright E2E/responsive | Report, screenshots, and complete output | Not run - implementation not started |
| Migration/seed repeatability | Clean migration plus seed run twice | Not run - implementation not started |
| Visual checklist | Completed checklist at three widths | Not inspected - implementation not started |

## 7. Known Limitations or Deferred Tests

- No Lab 2 test is approved for deferral at contract creation.
- **Security limitation:** `X-Requester-Id` is trivially spoofable. Its tests prove owner-scoped application behavior for cooperative Lab 2 testing, not authentication or security against a malicious client. Server-verified authentication must replace it in Lab 3.
- Real authentication/authorization, IT Staff workflow, ticket lifecycle transitions, comments, notes, and Actions Taken are intentionally excluded rather than deferred Lab 2 tests.
