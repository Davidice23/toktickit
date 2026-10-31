# Lab 4 Test-Driven Delivery Plan and Traceability

> **Status: Approved Contract test plan (PR #75), updated with implementation evidence.** `PLANNED` means a test has not yet been created or run. This document must be updated with actual commands, paths, pass/fail/skipped totals, environment, CI URL, and commit SHA as work proceeds. A path in this plan is not evidence that the file exists today.

## 1. Test strategy and evidence rules

Lab 4 uses the smallest appropriate layer first: pure/domain test, API/integration test, client component test, browser workflow, and manual visual/accessibility inspection. A green mocked component test does not prove backend authorization, migration safety, or a working browser flow. Every acceptance criterion maps to at least one planned test, and all required automated test files identify their actual repository path.

Tests run only against a disposable/local test database or isolated schema explicitly selected for testing. Test logs redact connection strings, cookies, CSRF values, passwords, and personal content. A result is reported as one of `PLANNED`, `PASS`, `FAIL`, `SKIPPED` (with reason), or `NOT RUN`; no test is called passed merely because it is discovered, empty, mocked, skipped, or omitted from CI.

### 1.1 Baseline inventory at Contract drafting time

| Area | Verified present at baseline | Status in this Contract |
| --- | --- | --- |
| Server | `npm test`, `npm run test:lab3`; Vitest includes `tests/**/*.test.ts` | Existing regression commands; **NOT RUN** in documentation-only Phase 1 |
| Client | `npm test`, `npm run test:lab3`; Vitest includes `tests/**/*.test.tsx` | Existing regression commands; **NOT RUN** in documentation-only Phase 1 |
| E2E | `npm test`, `npm run test:lab3`; Playwright `testDir` is currently `./lab-03` | #65 must add Lab 4 discovery; **NOT RUN** in Phase 1 |
| CI | `.github/workflows/lab3-ci.yml` covers server/client/e2e, but trigger only references `main` and `lab3-staging` | #65 must extend/replace safely; no Lab 4 CI claim yet |

## 2. Test environment and isolation

1. Before any database test, validate a redacted allowlist for host/database/schema and create a uniquely scoped disposable database or schema. A developer's normal or shared course database is not a test target by default.
2. Fresh migration tests start from empty disposable PostgreSQL. Upgrade tests apply Lab 1-3 state, create representative legacy data, then apply Lab 4. Recovery tests restore a pre-migration snapshot/clone to another disposable target.
3. E2E setup creates/uses synthetic fixture accounts without logging their credentials; its teardown can delete only the namespaced records/schema it created. Browser tests do not share a mutable password or role state without serialisation/isolation.
4. Tests that need a frozen clock inject or record `asOf`; date boundary tests use UTC persistence and Asia/Bangkok presentation explicitly.
5. Concurrent tests use independent requests/connections and controlled overlap. Two sequential requests are not concurrency proof.

## 3. Planned automated tests

### 3.1 Data, migration, and seed

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| MIG-01 | Migration / AC-18 | Fresh Prisma migration creates Action, Action Event, Ticket Workflow Event, versions, relations, and required indexes | Schema validates and fresh migration deploys | `server/tests/lab-04/migration.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |
| MIG-02 | Upgrade / AC-18 | Lab 1-3 User, Ticket, Attachment, Public Comment, Internal Note IDs/FKs/ownership survive Lab 3-to-4 upgrade | Before/after oracle matches; legacy Ticket with zero Actions is readable | `server/tests/lab-04/migration.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |
| MIG-03 | Recovery / AC-18 | A verified pre-migration disposable snapshot can be restored and passes integrity checks | Restore/recheck succeeds without destructive reset | `server/tests/lab-04/migration.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |
| SEED-01 | Integration / AC-18 | Lab 4 seed is repeat-safe | Two runs create no duplicate fixtures/foreign-key breakage | `server/tests/lab-04/seed.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |
| SEED-02 | Integration / AC-02,13,18 | Seed includes zero/one/multiple Actions, all key statuses/priorities, assigned/unassigned, active/inactive staff, zero/non-zero dashboard cases | Fixture oracle is explicit and stable | `server/tests/lab-04/seed.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |

### 3.2 Actions Taken API and authorization

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| API-01 | API / AC-01 | Staff creates valid Action under correct Ticket | `201`; correct Ticket; created actor/session-derived audit; planned state | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-02 | API / AC-02 | Inactive/non-staff assignee is rejected | Field error; no Action/event/version mutation | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-03 | API / AC-03 | Ticket Owner and Action assignee may differ | Valid creation/update succeeds with both links correct | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-04 | API / AC-05 | Blank/too-long description, required follow-up note, missing Result, and missing cancel reason | Deterministic validation fields; persisted state unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-05 | API / AC-06 | Requester A reads safe Actions for own Ticket, including beyond page 100; Requester B cannot read/mutate | Safe list/404/403 according to Contract; no mutation | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — disposable-DB run pending; pagination mock test passed locally |
| API-06 | API / AC-07 | Same key/payload after an edit returns original receipt; changed payload or unavailable legacy receipt conflicts | Original JSON response, one record; deterministic `409` for mismatch/missing receipt | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — mocked replay checks passed locally; transaction and database execution pending |
| API-07 | API / AC-04,06 | Nested action ID from another Ticket, spoofed actor/version/timestamp fields, terminal edit, and unknown enum | Safe 404/400/409; no cross-ticket mutation | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-08 | API / AC-08 | Lifecycle edits/transitions append Action events in deterministic order | Current snapshot and immutable history match expected actor/status | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-09 | API / AC-04,11 | Concurrent Action creates and stale Action/Ticket versions | One accepted create; the stale request returns `409`; one Action/event persists | `server/tests/lab-04/actions-taken.api.test.ts` | PARTIAL — `Promise.all` does not establish controlled transaction overlap; database execution remains pending |
| API-10 | API / AC-08 | Staff history combines Action and Ticket events with deterministic ordering and role filtering | Staff/Admin can read; Requester receives `403`; no Internal Note content | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-11 | Unit / AC-05–07 | Non-object/incorrect note types, pagination bounds, replay and missing receipt | Safe errors and replay logic without database access | `server/tests/lab-04/actions-validation.unit.test.ts` | PASS locally — 11 mocked-auth/database-isolated tests; PR CI pending |

### 3.3 Ticket workflow and concurrency

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| WF-01 | API table-driven / AC-09 | Every permitted Ticket status edge succeeds for Staff/Admin and every other edge fails | Exact status/error matrix | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |
| WF-02 | API / AC-10 | Resolution gate checks active owner, completed Action with Result, and no active Action | Each missing prerequisite returns `422`; satisfying all succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |
| WF-03 | API / AC-10 | Requester advisory does not alter formal status and is not a required Resolution prerequisite | Status stays unchanged after advisory; Staff may resolve only with actual gate | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |
| WF-04 | API / AC-11 | Resolve races against create/start/edit/complete/cancel Action | Database invariant holds; no unsafe resolve/write skew; deterministic conflict where needed | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |
| WF-05 | API / AC-08,11 | Reassign/priority/status/role deactivation races use one coordination policy | No stale overwrite; history/version/error is correct | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |
| WF-06 | API / AC-08 | Ticket workflow history is append-only, sorted, role-filtered, and contains reason where required | No prior event rewrite/deletion | `server/tests/lab-04/ticket-workflow.api.test.ts` | PLANNED |

### 3.4 Dashboard API and calculation oracle

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| DASH-R-01 | API / AC-12 | Requester A receives own open/attention/recent metrics and bounded rows | Counts equal independent fixture/database oracle; no B records | `server/tests/lab-04/requester-dashboard.api.test.ts` | PLANNED |
| DASH-R-02 | API / AC-12,14 | Requester zero state, date boundary, reopened/resolved semantics, ordering, and drill-down filter | Correct zero/rows/predicate at fixed `asOf` | `server/tests/lab-04/requester-dashboard.api.test.ts` | PLANNED |
| DASH-S-01 | API / AC-13 | Staff values for unassigned, owned-open, current-user active Actions, recently completed Actions, urgent Tickets | Values equal independent database oracle; owner != action assignee case covered | `server/tests/lab-04/staff-dashboard.api.test.ts` | PLANNED |
| DASH-S-02 | API / AC-13,14 | No duplicate count from Action join, stable tie order, pagination/list bounds, correct staff/admin access | Exact counts and bounded rows; requester forbidden | `server/tests/lab-04/staff-dashboard.api.test.ts` | PLANNED |
| DASH-S-03 | API / AC-14 | Each card drill-down query resolves to the same eligible Ticket/Action set | IDs/predicate match card semantics | `server/tests/lab-04/staff-dashboard.api.test.ts` | PLANNED |
| PERF-01 | Performance-smoke / AC-13,14 | Bounded dashboard query behavior on documented synthetic volume | Recorded plan/row count/runtime/query evidence meets approved non-production threshold | `server/tests/lab-04/dashboard-performance.smoke.test.ts` | PLANNED |

### 3.5 Client component, style, and accessibility

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| UI-A-01 | Component / AC-04-06,16 | Action list/create/edit/assign/complete/cancel fields and validation states | Correct controls/data/error associations; requester is read-only | `client/tests/lab-04/ActionsTaken.test.tsx` | PLANNED |
| UI-A-02 | Component / AC-16 | Loading, empty, forbidden/not-found, conflict reload, and recoverable safe-failure preserve form draft | Correct labelled feedback/retry/reconciliation | `client/tests/lab-04/ActionsTaken.test.tsx` | PLANNED |
| UI-W-01 | Component / AC-09-11,16 | Only permitted Ticket transitions are offered; gate error refreshes safe Ticket state | Correct form choices/confirmation/reason/conflict feedback | `client/tests/lab-04/TicketWorkflow.test.tsx` | PLANNED |
| UI-R-01 | Component / AC-12,14-16 | Requester dashboard cards/lists/empty/drill-down and current-session scope | Correct labels/links/role fallback | `client/tests/lab-04/RequesterDashboard.test.tsx` | PLANNED |
| UI-S-01 | Component / AC-13-16 | Staff dashboard cards including current-user Actions, urgent/recent, failure/drill-down | Correct data mapping/labels/role fallback | `client/tests/lab-04/StaffDashboard.test.tsx` | PLANNED |
| UI-N-01 | Component / AC-15 | Landing/navigation/session switch clears prior role/user workspace data | Correct default/active page/no stale cache | `client/tests/lab-04/RoleNavigation.test.tsx` | PLANNED |
| A11Y-01 | Component/manual / AC-19 | Labels, invalid fields, descriptions, keyboard/focus/dialog/escape/return/non-colour cues | Automated assertions plus recorded manual checklist | `client/tests/lab-04/accessibility.test.tsx` | PLANNED |
| VIS-01 | Style/manual / AC-19 | Zen Green consistency and no clipping/overlap/overflow at 1440/820/390 | Screenshot/checklist evidence for each major screen | `client/tests/lab-04/responsive-visual.test.tsx` and evidence paths | PLANNED |

### 3.6 Browser end-to-end and regression

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E / AC-01-08,16 | Staff creates, assigns, edits, starts, completes, and cancels Actions; requester reads safe records | Full browser-to-API flow with appropriate UI state | `e2e/lab-04/actions-taken-flow.spec.ts` | PLANNED |
| E2E-02 | E2E / AC-09-11,16 | Ticket lifecycle, resolution gate, advisory behavior, stale/recoverable state | Valid flow works; invalid/bypass state is safely handled | `e2e/lab-04/ticket-resolution.spec.ts` | PLANNED |
| E2E-03 | E2E / AC-12-16,19 | Requester/Staff/Admin dashboard navigation, metrics/drill-down, 3 viewport evidence | Role-scoped dashboard and responsive behavior works | `e2e/lab-04/dashboards.spec.ts` | PLANNED |
| REG-01 | E2E/API/UI / AC-17 | Auth, password change, My Tickets, Ticket Detail, Attachments, Comments, Staff queue/detail, Internal Notes, Admin management | Representative Lab 1-3 permitted workflows remain usable | Existing `server/tests/lab-01`, `server/tests/lab-02`, `server/tests/lab-03`, `client/tests/lab-*`, `e2e/lab-03` plus documented Lab 4 additions | PLANNED |
| E2E-04 | E2E reliability / AC-18,20 | Lab 4 browser suite runs twice from automatic migration/seed setup | Two consecutive passes without manual DB repair | `e2e/lab-04/*.spec.ts` | PLANNED |

## 4. Acceptance-criterion traceability

| AC | Primary planned evidence |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | API-02, SEED-02, UI-A-01 |
| AC-03 | API-03, E2E-01 |
| AC-04 | API-07, API-09, UI-A-01, UI-A-02 |
| AC-05 | API-04, E2E-01, UI-A-01 |
| AC-06 | API-05, E2E-01, UI-A-01 |
| AC-07 | API-06, E2E-01 |
| AC-08 | API-08, API-10, WF-06, E2E-01 |
| AC-09 | WF-01, UI-W-01, E2E-02 |
| AC-10 | WF-02, WF-03, UI-W-01, E2E-02 |
| AC-11 | API-09, WF-04, WF-05 |
| AC-12 | DASH-R-01, DASH-R-02, UI-R-01, E2E-03 |
| AC-13 | DASH-S-01, DASH-S-02, PERF-01, UI-S-01, E2E-03 |
| AC-14 | DASH-R-02, DASH-S-03, UI-R-01, UI-S-01 |
| AC-15 | UI-N-01, E2E-03, REG-01 |
| AC-16 | UI-A-02, UI-W-01, UI-R-01, UI-S-01, E2E-01/02/03 |
| AC-17 | REG-01 plus full server/client/E2E command results |
| AC-18 | MIG-01/02/03, SEED-01/02, E2E-04 |
| AC-19 | A11Y-01, VIS-01, E2E-03, manual checklist/screenshots |
| AC-20 | #65 CI evidence, complete command logs, reviewer record, exact-main CI |

## 5. Command plan

### 5.1 Existing commands that may be run after the target DB/environment is verified

```powershell
# Run from repository root; each package owns its own script.
npm --prefix server run build
npm --prefix server test
npm --prefix server run test:lab3

npm --prefix client run build
npm --prefix client test
npm --prefix client run test:lab3

npm --prefix e2e test -- --list
npm --prefix e2e run test:lab3

git diff --check
```

These commands are an inventory, not a Phase 1 execution record. `npm test` on server/client already discovers their existing Lab 1-3 paths according to current config; a separate Lab 1/2 script must not be invented simply to inflate test counts.

### 5.2 Lab 4 commands provided by Issue #65

```powershell
npm --prefix server run test:lab4
npm --prefix client run test:lab4
npm --prefix e2e run test:lab4 -- --list
npm --prefix e2e run test:lab4
```

`test:lab4` is a focused selector, not a replacement for `npm test`: the latter remains the full regression command for every suite discovered by its package. The server and client include their Lab 1–4 tests; the E2E package currently owns Lab 3 regression plus Lab 4 tests. The E2E configuration discovers only `lab-03/**/*.spec.ts` and `lab-04/**/*.spec.ts`; shared helpers use no `.spec.ts` suffix and are not counted as tests.

Issue #65 supplies only executable foundation smoke coverage for behavior that exists before Lab 4 feature implementation:

- Server: health response and anonymous rejection on an existing protected Ticket route. These requests have no session cookie and do not open or mutate Prisma.
- Client: signed-out rendering after the current-session probe is denied.
- Browser: sign-in page plus protected-API rejection, then a seeded requester sign-in, navigation to My Tickets, and sign-out.

Ticket workflow, dashboards, and accessibility remain `PLANNED` until their owning implementation issues add real coverage. Action API tests are implemented but have not yet run against disposable PostgreSQL; migration/seed/recovery checks passed on PR #77 head `503e3af`. No skipped/todo/placeholder assertion is a Lab 4 pass claim.

Before any E2E run, the harness prepares an isolated CI PostgreSQL service through the current migration/seed path, starts the API with explicit test environment variables, waits for `/api/health`, runs the client via Playwright, and collects trace/screenshots/report. The dedicated Lab 4 workflow is limited to `pull_request` and `push` on `lab4-staging` and `main`, uses only `contents: read`, and does not use `pull_request_target`.

### 5.3 Issue #65 local verification record (2026-10-29, before commit)

| Command | Result | Evidence / limitation |
| --- | --- | --- |
| `npm --prefix server run build` | PASS | TypeScript build completed. |
| `npm --prefix server run test:lab4` | PASS | 1 file, 2 executable smoke tests passed after running outside the desktop sandbox because Supertest needs a temporary loopback port. |
| `npm --prefix client run build` | PASS | TypeScript and Vite production build completed. |
| `npm --prefix client run test:lab4` | PASS | 1 file, 1 executable smoke test passed. |
| `npm --prefix client test` | PASS with existing warning | 13 files / 25 tests passed; the prior Lab 1 App test emitted React's `act(...)` warning, which does not fail the suite and is not changed in #65. |
| `npm --prefix e2e run test:lab4 -- --list` | PASS | Playwright discovered 1 file / 2 executable Lab 4 browser tests. |
| Full server regression and browser execution | NOT RUN locally | No explicit disposable `DATABASE_URL` or test environment file was configured locally. The workflow creates a temporary GitHub Actions PostgreSQL service and is the required execution environment for these database-backed commands. |

This record is pre-commit local evidence, not a CI result. The PR must record the head SHA and actual workflow URL/conclusions before the foundation gate is considered complete.

### 5.4 Issue #70 disposable-database CI record

PR [#77](https://github.com/Davidice23/toktickit/pull/77) was merged at `be1b800`; run [40923264624](https://github.com/Davidice23/toktickit/actions/runs/40923264624) completed on head `503e3af` with server regression/migration/seed, client, and browser/E2E jobs successful. This proves the submitted tests on that exact head; it does not resolve the seed/history and migration-test robustness follow-ups listed in `data-foundation.md`.

### 5.5 Issue #66 local verification record (2026-10-30, before PR)

| Command | Result | Evidence / limitation |
| --- | --- | --- |
| `npm run build` (from `server`) | PASS | TypeScript production build completed after the Actions API implementation. |
| `npx tsc --noEmit --target ES2022 --module ES2022 --moduleResolution bundler --esModuleInterop --strict --skipLibCheck --types node tests/lab-04/actions-taken.api.test.ts` (from `server`) | PASS | Standalone strict TypeScript check of the database-backed Action API integration test. |
| `git diff --check` | PASS | No whitespace errors; Git emitted only a line-ending normalization warning for `docs/lab-04/data-foundation.md`. |
| `npm run test:lab4` / full server regression | NOT RUN locally | The Action API tests require a disposable `toktickit_test` PostgreSQL database. No local database was selected or touched; run them in the PR workflow's disposable PostgreSQL service and record the exact PR head/run before calling them passed. |

These local checks are not integration-test evidence. The feature PR remains pending until all PR-head CI jobs finish and any failures are resolved.

#### Follow-up local validation check (2026-10-30, pre-commit)

`npx vitest run tests/lab-04/actions-validation.unit.test.ts`: **7 passed** after the validation fix, using mocked authorization and a database stub that fails if accessed. Before the fix, the same seven cases failed: three timed out on non-object JSON bodies and four returned `500` after reaching the database stub instead of `400`. An initial sandbox run failed with loopback `EACCES`; the red/green runs used the approved external sandbox environment for Supertest's temporary loopback ports. The server build and strict TypeScript checks of both Action test files passed after the change. No real database was used. This does not replace API integration, authorization, or concurrency tests.

After the learner approved the pagination/replay direction, four mocked tests were added; the same command reported **11 passed**. `prisma generate`, `prisma validate` with a non-connected placeholder URL, server build, and strict TypeScript checks of the Action and migration test files passed locally. The new additive receipt migration, old-record preservation, page-101 fixture, real transaction/replay, recovery, and regression suites are **NOT RUN** on PostgreSQL. Docker's local engine was unavailable; no database was started, migrated, or modified. The Action history endpoint still has a separate 100-page cap and controlled-overlap concurrency proof is outstanding.

#### PR #78 initial CI failure (2026-10-31)

Run [41188287774](https://github.com/Davidice23/toktickit/actions/runs/41188287774) on head `b08c5bd` used disposable PostgreSQL: migration deploy, seed, build, migration/recovery test, and 11 mocked validation tests passed; full server regression reported **66 passed / 1 failed**. The Action edit/reassignment test expected `ASSIGNED` before `EDITED`, while both changes belong to one atomic operation and the Contract requires ordering by `createdAt` then `id`, not a field-type priority. The test was revised to assert each audit field, old/new value and actor, plus ordered history IDs. This revision requires a new exact-head CI run; the initial failure is not reported as a pass. Client and browser jobs passed on `b08c5bd`. The separately invoked server Lab 4 suite was skipped after the regression failure.

### 5.6 Exact-main release evidence

After release, record the resolved `main` SHA, CI event URL, `head_sha`, all required job conclusions, command output totals, and whether any test was skipped/not run. A green PR merge-ref or staging run is not a substitute for the exact final-main run.

## 6. Test quality gates

| Gate | Required condition |
| --- | --- |
| Contract | Every AC has at least one planned test/path; owner/reviewer accept decisions; no unresolved required rule. |
| CI foundation | Lab 4 paths are discovered with non-empty runnable smoke coverage; Lab 1-3 regression remains discoverable; no placeholder/skip-as-pass. |
| Data | Fresh, upgrade, recovery, and seed-twice tests pass on isolated targets. |
| Feature PR | Relevant tests red/green during development, targeted API/UI/E2E pass, `git diff --check`, CI on the PR head SHA, peer findings addressed. |
| Hardening | Full planned suite, two Lab 4 E2E runs, manual visual/accessibility checklist, no known required Critical/High defect. |
| Release | All feature PRs integrated, release review approved, exact-main CI green, evidence manifest complete. |

## 7. Reporting template for actual execution

```text
Test ID / path:
Commit SHA / branch:
Command exactly run:
Environment: synthetic DB/schema identifier redacted; browser/runtime/version:
Pass / fail / skipped / not-run totals:
Expected vs actual:
CI URL, event, and head SHA:
Evidence path/URL:
Known limitation or follow-up:
```

The final report presents concise readable excerpts and links to complete logs. It must not conceal failed, skipped, missing, or flaky required coverage.
