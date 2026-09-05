# Lab 2 quality and release readiness

Issue #23 consolidates the feature work on `lab2-staging` and records the final
verification evidence before the release pull request to `main`.

## Automated verification run

Executed on the Issue #23 branch after Issues #15–#22 were merged:

| Suite | Result |
| --- | --- |
| Server Vitest/PostgreSQL | 13 tests passed (7 files) |
| Server TypeScript build | Passed |
| Client Vitest/Testing Library | 12 tests passed (5 files) |
| Client TypeScript/Vite build | Passed |
| Git whitespace check | Passed |

The attachment API covers valid PDF upload, owner-scoped download, soft
removal, blocked removed download, unsupported type rejection, and signature
validation. The Ticket Detail UI covers loading, unavailable, read-only data,
attachment metadata, upload errors, header-authenticated browser downloads,
and removed metadata.

## Manual/release checklist

- [ ] Run the full requester E2E flow against real client/server/PostgreSQL,
  including the browser download path that sends `X-Requester-Id`.
- [ ] Capture 1440 px, 820 px, and 390 px screenshots for selection, Create
  Ticket, My Tickets, and Ticket Detail under `artifacts/lab-02/screenshots/`.
- [ ] Confirm no document horizontal overflow, clipped filenames, or hidden
  actions at each viewport.
- [ ] Run `prisma migrate deploy` on a clean database and run the seed twice.
- [ ] Update `docs/lab-02/tests.md` final results from the final `main` run.
- [ ] Have the peer reviewer approve the Issue #23 PR before merging.
- [ ] Open the release PR from `lab2-staging` to `main` only after all checks
  and evidence are complete.
