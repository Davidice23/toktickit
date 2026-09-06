# Lab 2 quality and release readiness

This document records the final evidence for the Lab 2 completion branch before
its promotion PR to `lab2-staging` and then `main`.

## Automated verification run

Executed on `feature/lab2-completion` on 2026-09-06:

| Suite | Result |
| --- | --- |
| Server Vitest/PostgreSQL | 15 tests passed (8 files) |
| Server TypeScript build | Passed |
| Client Vitest/Testing Library | 14 tests passed (6 files) |
| Client TypeScript/Vite build | Passed |
| Git whitespace check | Passed |

The attachment API covers valid PDF upload, owner-scoped download, soft
removal, blocked removed download, unsupported type rejection, and signature
validation. The Ticket Detail UI covers loading, unavailable, read-only data,
attachment metadata, upload errors, header-authenticated browser downloads,
and removed metadata.

## Manual/release checklist

- [x] Run the full requester flow against real client/server/PostgreSQL,
  including the browser download path that sends `X-Requester-Id`.
- [x] Capture 1440 px, 820 px, and 390 px screenshots for selection, Create
  Ticket, My Tickets, and Ticket Detail under `artifacts/lab-02/screenshots/`.
- [x] Confirm no document horizontal overflow, clipped filenames, or hidden
  actions at each viewport.
- [x] Run the repeat-safe seed verification twice.
- [x] Update `docs/lab-02/tests.md` with final completion-branch results.
- [ ] Promote the completion branch through a peer-reviewed PR, then rerun the
  same commands on final `main` before submission.
