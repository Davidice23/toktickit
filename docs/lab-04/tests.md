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
| MIG-02 | Upgrade / AC-18 | Lab 1-3 User, Ticket, Attachment, Public Comment, Internal Note IDs/FKs/ownership survive Lab 3-to-4 upgrade; a legacy resolved Ticket with requester advisory time is not backfilled | Before/after oracle matches; legacy Ticket retains `resolvedAt = NULL` and no workflow events | `server/tests/lab-04/migration.integration.test.ts` |   PASS — [CI run 41233180575 (attempt 2)](https://github.com/Davidice23/toktickit/actions/runs/41233180575), code head `20a8976`, disposable PostgreSQL |
| MIG-03 | Recovery / AC-18 | A verified pre-migration disposable snapshot can be restored and passes integrity checks, including legacy resolution/advisory fields | Restore/recheck succeeds without destructive reset or fabricated history | `server/tests/lab-04/migration.integration.test.ts` |   PASS — [CI run 41233180575 (attempt 2)](https://github.com/Davidice23/toktickit/actions/runs/41233180575), code head `20a8976`, disposable PostgreSQL |
| SEED-01 | Integration / AC-18 | Lab 4 seed is repeat-safe; only stable synthetic fixtures receive baseline events/example `resolvedAt` and a second seed changes neither | No duplicate fixtures/events; ordinary/migrated records remain untouched | `server/tests/lab-04/seed.integration.test.ts` |   PASS — [CI run 41233180575 (attempt 2)](https://github.com/Davidice23/toktickit/actions/runs/41233180575), code head `20a8976`, disposable PostgreSQL |
| SEED-02 | Integration / AC-02,13,18 | Seed includes zero/one/multiple Actions, all key statuses/priorities, assigned/unassigned, active/inactive staff, zero/non-zero dashboard cases | Fixture oracle is explicit and stable | `server/tests/lab-04/seed.integration.test.ts` | PASS — PR #77 CI, head `503e3af`, disposable PostgreSQL |

### 3.2 Actions Taken API and authorization

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| API-01 | API / AC-01 | Staff creates valid Action under correct Ticket | `201`; correct Ticket; created actor/session-derived audit; planned state | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-02 | API / AC-02 | Inactive/non-staff assignee is rejected | Field error; no Action/event/version mutation | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-03 | API / AC-03 | Ticket Owner and Action assignee may differ | Valid creation/update succeeds with both links correct | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-04 | API / AC-05 | Blank/too-long description, required follow-up note, missing Result, and missing cancel reason | Deterministic validation fields; persisted state unchanged | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-05 | API / AC-06 | Requester A reads safe Actions for own Ticket, including beyond page 100; Requester B cannot read/mutate; requester actor data excludes role/activity | Safe list/404/403 according to Contract; no mutation | `server/tests/lab-04/actions-taken.api.test.ts` | Prior behavior passed PR #78 CI at `b863ac0`; new requester projection awaits CI |
| API-06 | API / AC-07 | Same key/payload after an edit returns original receipt; changed payload or unavailable legacy receipt conflicts | Original JSON response, one record; deterministic `409` for mismatch/missing receipt | `server/tests/lab-04/actions-taken.api.test.ts` | Passed PR #78 CI at `b863ac0`; changes to normalization require new-head CI |
| API-07 | API / AC-04,06 | Nested action ID from another Ticket, spoofed actor/version/timestamp fields, terminal edit, and unknown enum | Safe 404/400/409; no cross-ticket mutation | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-08 | API / AC-08 | Lifecycle edits/transitions append Action events in deterministic order | Current snapshot and immutable history match expected actor/status | `server/tests/lab-04/actions-taken.api.test.ts` | IMPLEMENTED — build/type-check pass; waiting PR CI |
| API-09 | API / AC-04,11 | Concurrent Action creates and stale Action/Ticket versions | One accepted create; the stale request returns `409`; one Action/event persists | `server/tests/lab-04/actions-taken.api.test.ts` | PARTIAL — `Promise.all` does not establish controlled transaction overlap; database execution remains pending |
| API-10 | API / AC-08 | Staff history combines Action and Ticket events with deterministic ordering, consistent response shape, and beyond-page-100 access | Staff/Admin can read; Requester receives `403`; no Internal Note content | `server/tests/lab-04/actions-taken.api.test.ts` | Prior history passed PR #78 CI at `b863ac0`; new SQL and mixed-source tests await CI |
| API-11 | Unit / AC-05–07 | Non-object/incorrect note types, pagination bounds, replay and missing receipt | Safe errors and replay logic without database access | `server/tests/lab-04/actions-validation.unit.test.ts` | PASS locally — 21 mocked-auth/database-isolated tests; new-head PR CI pending |
| API-12 | API / AC-05,08 | Follow-up false prevents nonempty note in create/edit/completion; blank attachment normalizes consistently | `400` for incompatible notes; no stale version/event writes; blank attachment is `null` | `server/tests/lab-04/actions-taken.api.test.ts` | New integration test awaiting disposable-DB CI; negative cases passed in mocked unit tests |
| API-13 | API / AC-02,16 | Only Staff/Admin can search and page through active operational users; no email, password, or inactive/non-operational account is returned | Anonymous `401`, Requester `403`, Staff/Admin same safe rows, invalid query `400` | `server/tests/lab-04/actions-taken.api.test.ts`; `server/tests/lab-04/actions-validation.unit.test.ts` | IMPLEMENTED — server type-check passes; local API-test execution is blocked by sandbox TCP loopback `EACCES`; new-head disposable-PostgreSQL CI remains required |

### 3.3 Ticket workflow and concurrency

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| WF-01 | API table-driven / AC-09 | Every permitted Ticket status edge succeeds for Staff/Admin and every other edge fails | Exact status/error matrix | `server/tests/lab-04/ticket-workflow.api.test.ts` | IMPLEMENTED — pure rule matrix passed locally; real API matrix NOT RUN, CI required |
| WF-02 | API / AC-10 | Resolution gate checks active owner, completed Action with Result, and no active Action | Each missing prerequisite returns `422`; satisfying all succeeds | `server/tests/lab-04/ticket-workflow.api.test.ts` | IMPLEMENTED — mocked boundary/rules passed locally; database execution NOT RUN |
| WF-03 | API / AC-10 | Requester advisory does not alter formal status and is not a required Resolution prerequisite | Status stays unchanged after advisory; Staff may resolve only with actual gate | `server/tests/lab-04/ticket-workflow.api.test.ts` | IMPLEMENTED — database execution NOT RUN |
| WF-04 | API / AC-11 | Resolve races against create/start/edit/complete/cancel Action | Database invariant holds; no unsafe resolve/write skew; deterministic conflict where needed | `server/tests/lab-04/ticket-workflow.api.test.ts` | IMPLEMENTED — controlled PostgreSQL lock-overlap tests NOT RUN |
| WF-05 | API / AC-08,11 | Reassign/priority/status/role deactivation races use one coordination policy; only `IN_PROGRESS` blocks account changes, while resolved/closed history is retained and later active-owner transitions require reassignment | No stale overwrite; deterministic allowed/block outcomes; history/version/error is correct | `server/tests/lab-04/ticket-workflow.api.test.ts` | PASS on exact code head `eb13ec9` in CI run [41226258281](https://github.com/Davidice23/toktickit/actions/runs/41226258281); Sxr1n re-review pending |
| WF-06 | API / AC-08 | Ticket workflow history is append-only, sorted, role-filtered, and contains reason where required | No prior event rewrite/deletion | `server/tests/lab-04/ticket-workflow.api.test.ts` | IMPLEMENTED — database execution NOT RUN; role filtering builds on #66 tests |

### 3.4 Dashboard API and calculation oracle

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| DASH-R-01 | API / AC-12 | Requester A receives own open/attention/recent metrics and bounded rows | Counts equal independent fixture/database oracle; no B records | `server/tests/lab-04/dashboard.api.test.ts` | PASS — CI run 41248716827 |
| DASH-R-02 | API / AC-12,14 | Requester zero state, 14-day half-open window, reopened/resolved semantics, bounded ordering, and drill-down filter | Correct zero/rows/predicate at one server `asOf` | `server/tests/lab-04/dashboard.api.test.ts` | PASS — CI run 41248716827 |
| DASH-S-01 | API / AC-13 | Staff values for unassigned, owned-open, current-user active Actions, recently completed Actions, urgent Tickets | Values equal independent database oracle; owner != action assignee case covered | `server/tests/lab-04/dashboard.api.test.ts` | PASS — CI run 41248716827 |
| DASH-S-02 | API / AC-13,14 | No duplicate Ticket rows from multiple Actions, bounded arrays, deterministic ordering, correct staff/admin access | Exact counts and bounded rows; requester forbidden | `server/tests/lab-04/dashboard.api.test.ts` | PASS — CI run 41248716827 |
| DASH-S-03 | API / AC-14 | Each card drill-down query resolves to the same eligible Ticket/Action set | IDs/predicate match card semantics | `server/tests/lab-04/dashboard.api.test.ts` | PASS — CI run 41248716827 |
| PERF-01 | Performance-smoke / AC-13,14 | Bounded dashboard query behavior on documented synthetic volume | Recorded plan/row count/runtime/query evidence meets approved non-production threshold | `server/tests/lab-04/dashboard-performance.smoke.test.ts` | PLANNED |

### 3.5 Client component, style, and accessibility

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| UI-A-01 | Component / AC-04-06,16 | Action list/create/edit/assign/start/complete/cancel fields, safe Requester view, field errors and dialog focus | Correct controls/data/error associations; Requester is read-only | `client/tests/lab-04/ActionsTaken.test.tsx` | PASS locally — 9/9 component tests; keyboard dialog focus/return and lifecycle controls covered |
| UI-A-02 | Component / AC-16 | Loading, empty, forbidden/not-found, conflict reload, and recoverable safe-failure preserve form draft | Correct labelled feedback/retry/reconciliation | `client/tests/lab-04/ActionsTaken.test.tsx`; `client/tests/lab-04/TicketWorkflow.test.tsx` | PASS locally — forbidden retry, Ticket not-found retry, validation draft retention, and stale-version reconciliation covered |
| UI-W-01 | Component / AC-09-11,16 | Only permitted Ticket transitions are offered; gate error shows safe actionable prerequisites and preserves selected status | Correct form choices/confirmation/reason/conflict feedback | `client/tests/lab-04/TicketWorkflow.test.tsx` | PASS locally — 3/3 component tests, including transition validation, actionable resolution gate, and not-found retry |
| UI-R-01 | Component / AC-12,14-16 | Requester dashboard cards/lists/empty/drill-down and current-session scope | Correct labels/links/role fallback | `client/tests/lab-04/RequesterDashboard.test.tsx` | PASS locally — 2/2 tests cover API values, scoped/asOf links, bounded rows, zero cards, empty/failure/retry states |
| UI-S-01 | Component / AC-13-16 | Staff dashboard cards including current-user Actions, urgent/recent, failure/drill-down | Correct data mapping/labels/role fallback | `client/tests/lab-04/StaffDashboard.test.tsx` | PASS locally — 2/2 tests cover API metrics, Action-specific Ticket links, urgent/recent rows, zero/empty and Admin aggregate-only summary |
| UI-N-01 | Component / AC-15 | Landing/navigation/session switch clears prior role/user workspace data | Correct default/active page/no stale cache | `client/tests/lab-03/RoleNavigation.test.tsx` | PASS locally — Requester, Staff, Admin default routes, active navigation, queue/User Management navigation, unauthorized Requester deep-link fallback, and Requester A-to-B logout/login isolation covered |
| A11Y-01 | Component/manual / AC-19 | Labels, invalid fields, descriptions, keyboard/focus/dialog/escape/return/non-colour cues | Automated assertions plus recorded manual checklist | `client/tests/lab-04/accessibility.test.tsx` | PLANNED |
| VIS-01 | Style/manual / AC-19 | Zen Green consistency and no clipping/overlap/overflow at 1440/820/390 | Screenshot/checklist evidence for each major screen | `e2e/lab-04/dashboards.spec.ts`, `client/tests/lab-04/responsive-visual.test.tsx` and evidence paths | PARTIAL — dashboard E2E now checks page overflow and captures all three widths; manual visual review and remaining screens are reserved for #73 |

### 3.6 Browser end-to-end and regression

| Test ID | Type / AC | What it proves | Expected result | Planned path | Final |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E / AC-01-08,16 | Requester, IT Staff, and Administrator see permitted role views; Staff creates/starts/completes an Action and Requester reads safe records | Full browser-to-API flow; no requester mutation controls; responsive checks and screenshots at 1440/820/390 | `e2e/lab-04/actions-taken-workflow.spec.ts` | IMPLEMENTED — local browser execution requires the isolated database-backed CI environment |
| E2E-02 | E2E / AC-09-11,16 | Ticket lifecycle, resolution gate, advisory behavior, stale/recoverable state | Valid flow works; invalid/bypass state is safely handled | `e2e/lab-04/ticket-resolution.spec.ts` | PLANNED |
| E2E-03 | E2E / AC-12-16,19 | Requester/Staff/Admin dashboard navigation, metrics/drill-down, 3 viewport evidence | Role-scoped dashboard and responsive behavior works | `e2e/lab-04/dashboards.spec.ts` | IMPLEMENTED — discovered by Playwright; exact-head browser execution/evidence awaits disposable PostgreSQL CI |
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

Ticket workflow component coverage and dashboard UI coverage are implemented locally. Database-backed E2E for Ticket resolution and dashboards, the full accessibility checklist, and whole-application manual visual review remain pending their exact-head CI/hardening gates. The initial Action API suite ran on disposable PostgreSQL in PR #78 CI at head `b863ac0`; reviewer-feedback changes need a new run. Migration/seed/recovery checks also passed on PR #77 head `503e3af`. No skipped/todo/placeholder assertion is a Lab 4 pass claim.

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

At the time of that pre-commit check, four mocked tests were added and the same command reported **11 passed**. `prisma generate`, `prisma validate` with a non-connected placeholder URL, server build, and strict TypeScript checks passed locally; no local database was started, migrated, or modified. The initial history endpoint had a 100-page cap at that point; reviewer-feedback changes subsequently remove it, pending new-head database CI. Controlled-overlap concurrency proof remains outstanding.

#### PR #78 initial CI failure (2026-10-31)

Run [41188287774](https://github.com/Davidice23/toktickit/actions/runs/41188287774) on head `b08c5bd` used disposable PostgreSQL: migration deploy, seed, build, migration/recovery test, and 11 mocked validation tests passed; full server regression reported **66 passed / 1 failed**. The Action edit/reassignment test expected `ASSIGNED` before `EDITED`, while both changes belong to one atomic operation and the Contract requires ordering by `createdAt` then `id`, not a field-type priority. The test was revised to assert each audit field, old/new value and actor, plus ordered history IDs. This revision requires a new exact-head CI run; the initial failure is not reported as a pass. Client and browser jobs passed on `b08c5bd`. The separately invoked server Lab 4 suite was skipped after the regression failure.

The subsequent PR #78 run [41188839850](https://github.com/Davidice23/toktickit/actions/runs/41188839850) passed all three jobs at head `b863ac0`: server regression **67/67** and focused Lab 4 server suite **24/24**, plus client and browser jobs. These counts apply to that head, not to later reviewer-feedback changes. For the pre-commit feedback revision, **21 mocked unit tests** and local build/type-check passed. Five new validation cases failed before the change and passed afterwards; legacy-note protection and SQL-shape tests were added afterwards. The new real PostgreSQL history query, isolation behavior, and integration cases require new-head CI.

PR #78's reviewer-feedback head `2a373f2` passed all three jobs in [run 41189748345](https://github.com/Davidice23/toktickit/actions/runs/41189748345): server regression **79/79**, focused Lab 4 server suite **36/36**, plus client and browser jobs. Sxr1n approved after reviewing this head; PR #78 merged as `24477c9`. This does not resolve the separate #77 data-foundation follow-ups.

#### Issue #71 pre-PR local verification (2026-10-31)

Branch `feature/71-ticket-workflow-concurrency` started from staging merge `24477c9`. Server and client builds passed. The workflow rules and mocked HTTP boundary suite passed **11/11** locally; the rules suite checks all 64 state pairs, and the HTTP boundary suite mocks authentication/database access. The full client regression suite passed **25/25**, with an existing non-failing React `act(...)` warning in the Lab 1 App test. Standalone strict TypeScript checks of the new workflow and updated Lab 3 test files passed. No PostgreSQL database was started, migrated, or accessed locally.

The new `ticket-workflow.api.test.ts` includes a real backend 64-edge matrix for both roles, authorization/CSRF, resolution/owner gates, advisory behavior, append-only status events, stale versions, and controlled PostgreSQL lock-overlap tests. PR #79 CI run [41219414423](https://github.com/Davidice23/toktickit/actions/runs/41219414423) passed the earlier exact head `6bee0a1` before peer feedback; the updated owner policy and new account-lifecycle cases are verified below on their exact code head. These disposable-database CI results are not local-database evidence.

The #71 integration suite requires explicit `LAB4_DISPOSABLE_DB=1` as well as `NODE_ENV=test` and a local database named `toktickit_test`; it refuses to run without these guards. Set the opt-in only after verifying that the target is disposable. The Lab 3 and Lab 4 server CI jobs set it for their temporary PostgreSQL services. Teardown targets only the synthetic records created by this suite; these checks do not make other existing database tests safe for a shared database.

#### PR #79 first-head CI failure and test-fixture repair (2026-10-31)

Run [41217577108](https://github.com/Davidice23/toktickit/actions/runs/41217577108) on head `e3d58bc75c2dce62beedc1e4e81eb214ae282834` completed with Client and Browser jobs passing, but Server regression **101 passed / 4 failed of 105**; the explicit Lab 4 server step was skipped after that failure. Two tests created synthetic operational Users without the database-required password hash. Two assertions assumed an omitted `itPriority` defaulted to `null`, while the existing Lab 3 migration sets it to `LOW`. The log also emitted caught FK-delete failures for synthetic Tickets still referenced by PublicComment and Attachment. A focused follow-up added password hashes to those synthetic users, compares stale/losing writes against the captured initial priority, and removes only the test's own Attachment/PublicComment/InternalNote children before its parent Ticket. The verification outcome is recorded below.

The repair was committed as `6cd24e5277521642987c0fce54478569f23dd472`. New exact-head run [41219133877](https://github.com/Davidice23/toktickit/actions/runs/41219133877) passed all three jobs on disposable CI PostgreSQL: Server regression **105/105**, focused Lab 4 server **62/62**, Client regression **25/25**, focused Lab 4 client **1/1**, browser regression **16/16**, and focused Lab 4 browser **2/2**. The rerun verified the repaired fixture creation and scoped teardown paths. These results apply to this exact head; they must be repeated if the PR head changes.

#### PR #79 reviewer policy update and exact-head recheck (2026-11-01)

Following Sxr1n's feedback, the proposed policy was narrowed: only currently `IN_PROGRESS` Tickets block deactivation/demotion; `RESOLVED`/`CLOSED` preserve the historical owner and do not permanently block account changes. A later transition into `IN_PROGRESS`, `RESOLVED`, or `CLOSED` still requires an active operational owner, so reassignment is required before continuing/closing when the old owner is inactive or non-operational. The API test also verifies that a resolved Ticket cannot be closed until reassigned, and that a closed Ticket retains its former owner after deactivation.

The first run after this change, [41226035047](https://github.com/Davidice23/toktickit/actions/runs/41226035047), caught a test expectation mismatch only: the API's existing invalid-owner validation returns `400`, not `422`. The assertion was corrected without changing the API status behavior. Exact code head `eb13ec9cd4b7f263636e15a3ba93e06f1b2402ce` then passed all jobs in [run 41226258281](https://github.com/Davidice23/toktickit/actions/runs/41226258281): Server regression **106/106**, focused Lab 4 server **63/63**, Client regression **25/25**, focused Lab 4 client **1/1**, browser regression **16/16**, focused Lab 4 browser **2/2**. The CI suite used disposable PostgreSQL; no personal/local database was used. The Contract amendment still requires Sxr1n re-review before merge.

#### PR #80 reviewer feedback and exact-head CI recheck (2026-11-01)

Sxr1n confirmed the no-backfill policy and asked for a linked green CI run plus PASS status for MIG-02, MIG-03, and SEED-01. Code commit `20a8976e73c704c62cf3bedcbce17e34309db9f9` updates the seed integration test to restore only the `lab3-demo-005` fixture's original `currentStatus` and `resolvedAt`, remove its exact test-only workflow event in `afterAll`, and disconnect Prisma in `finally`, so the regression test does not contaminate a later smoke run.

The first attempt of [CI run 41233180575](https://github.com/Davidice23/toktickit/actions/runs/41233180575) passed Server and Client but exposed a timing failure in the existing Lab 3 authentication browser test: `getByRole("status")` matched both the success and loading callouts. After rerunning the failed browser job, attempt 2 completed successfully: all three required jobs passed. The focused Lab 4 server suite passed **63/63 tests across 8 files**; `migration.integration.test.ts` passed **1/1** (fresh bootstrap, Lab 3 upgrade, disposable-schema restore), and `seed.integration.test.ts` passed **1/1**. CI used disposable PostgreSQL; no personal/local database was used.

#### PR #81 dashboard CI failure and fixture repair (2026-11-01)

The first exact-head CI run [41244093300](https://github.com/Davidice23/toktickit/actions/runs/41244093300) passed the Client and Browser jobs but failed the Server job in three dashboard integration cases. The test helper explicitly inserted `itPriority = null`, while the Lab 3 upgrade backfills this column and enforces `NOT NULL`. Local server build, a strict TypeScript check of `dashboard.api.test.ts`, and `git diff --check` passed. Follow-up commit `3e904d6` changed the fixture default to `LOW` and used an explicit `URGENT` value in the urgent-ticket fixture.

The next run [41247031349](https://github.com/Davidice23/toktickit/actions/runs/41247031349) verified that database setup and the corrected fixture now pass, but the server regression still reported **109 passed / 2 failed of 111**; the focused Lab 4 server step was skipped. Both remaining failures were test expectations: one expected the oldest fixture Ticket to appear in a five-row bounded list despite deterministic `updatedAt/id` ordering, and one compared the Admin role-count array in locale order rather than comparing role/count values independent of ordering. The Client job passed; the Browser job was still running when inspected.

The following run [41247193092](https://github.com/Davidice23/toktickit/actions/runs/41247193092) confirmed that the corrected bounded requester-list and Admin role-count assertions pass; Server regression then exposed one additional assertion that expected a particular urgent Ticket to appear in the dashboard's independently bounded five-row `recentOrUrgentTickets` list. The same Ticket is asserted through the `urgent-open` drill-down and exact metric oracle. That unsupported membership assumption was removed in follow-up commit `7468ca8`.

The final exact-head run [41247339419](https://github.com/Davidice23/toktickit/actions/runs/41247339419) passed all three required CI jobs on head `7468ca86bff64fa91d911e83cbfe611c5c19e4fc`. Server regression passed **111/111 tests across 26 files**, including the Lab 4 server smoke suite at **68/68 across 9 files**. Client regression passed **25/25 across 13 files**, including the focused Lab 4 client test at **1/1**. Browser regression passed **16/16**, including the focused Lab 4 browser smoke tests at **2/2**. CI used disposable PostgreSQL; no personal/local database was used. This records successful automated verification only; Sxr1n's review/approval remains a separate human review step.

After the documentation-only commit `41de7c2`, CI run [41247615076](https://github.com/Davidice23/toktickit/actions/runs/41247615076) passed Client and Browser but failed one Server assertion (110/111). During concurrent server test-file execution, the global unassigned queue count changed between the API request and its independent database oracle (4 versus 2); the dashboard test itself was unchanged from the earlier passing run. Because the server integration files share the disposable database, `server/vitest.config.ts` now disables cross-file parallelism to prevent other suites' fixtures from racing dashboard count assertions.

The serialized exact-head run [41248716827](https://github.com/Davidice23/toktickit/actions/runs/41248716827) passed all required jobs on head `ea0f1b8cdd056037c7e5124612024e591e56916a`. Server regression passed **111/111 tests across 26 files**, with focused Lab 4 Server **68/68 across 9 files**. Client regression passed **25/25 across 13 files**, with focused Lab 4 Client **1/1**. Browser regression passed **16/16**, with focused Lab 4 Browser **2/2**. CI used disposable PostgreSQL; no personal/local database was used.



#### Issue #67 local and browser verification (2026-11-01, pre-PR)

The focused client run `npm --prefix client run test:lab4 -- --reporter=dot` passed **13/13 tests across 3 files**. The full client regression `npm --prefix client test -- --reporter=dot` passed **37/37 tests across 15 files**; one pre-existing React `act(...)` warning remains in the Lab 1 `App.test.tsx`. Client production build and server TypeScript build both passed, as did `git diff --check`. The end-to-end test inventory command `npm --prefix e2e test -- --list` discovered **17 tests across 8 files**, including the new Issue #67 flow; browser execution was not run locally because it requires the disposable PostgreSQL-backed CI service.

The new operational-assignee API contract and tests are implemented. Its server build passes, but local API-test execution could not proceed because Supertest's TCP loopback bind returned sandbox `EACCES`; no personal database was used. The initial focus-return assertion caught a stale-node test expectation after a successful refresh; the UI now targets the refreshed Action card, and the test verifies the currently rendered element. PR #82 was subsequently opened at `32568b1f23d6486d0aa0b36fecb3b9f7a262377c` for Sxr1n review.

#### PR #82 first-head CI failure and requester-safe payload correction (2026-11-01)

Exact-head run [41298666014](https://github.com/Davidice23/toktickit/actions/runs/41298666014) passed Client and Server. Browser regression passed **16/17** and failed `e2e/lab-04/actions-taken-workflow.spec.ts` when the Requester opened the Ticket but the Action Description was not rendered. Inspection found the Requester API intentionally omits account roles from assignee/performed-by records, while the shared UI unconditionally formatted `assignee.role`; this caused a runtime rendering failure on the safe Requester payload. The correction makes the role optional in the shared response type, renders it only in Staff/Admin views, and changes the component regression fixture to match the role-redacted Requester response. Local full Client regression now passes **37/37 across 15 files** and the Client production build passes. A new exact-head CI run is still required; no merge is authorized or performed.

#### Issue #68 local verification (2026-11-01, pre-PR)

The local worktree is on `feature/68-role-dashboards-ui`, based on the #82 feature head `06560fc6c8fea5de99a0d841ef079d806c54b7c9`; GitHub confirms PR #82 is merged into `lab4-staging` as merge commit `9d186fb26b44380c4f9b38056c650ad4e91adc3e`. A Git fetch was unavailable in this environment, so the branch was not rebased from a freshly fetched staging ref. No personal/local database was started or accessed.

The tested implementation is recorded at commit `82a315b36483ed84be87a216d7a9fc7122712fd2` (the commands below ran against the identical worktree immediately before that local commit).

`npm --prefix client test -- --reporter=dot` passed **42/42 tests across 17 files**. `npm --prefix client run test:lab4 -- --reporter=dot` passed **18/18 tests across 5 files**. `npm --prefix client run build` and `npm --prefix server run build` passed. `npm --prefix e2e run test:lab4 -- --list` discovered **4 tests across 3 files**, including the new role-dashboard flow. `git diff --check` passed. The E2E browser tests were discovered but not executed locally because they require the isolated disposable-PostgreSQL CI environment; manual visual/accessibility review and exact-PR-head CI remain pending.

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
