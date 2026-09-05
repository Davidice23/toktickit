# Lab 2 Peer Review Record

This file records peer-review evidence for Lab 2. It is updated after every feature and release Pull Request.

## Identities

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Author | Wachirawit Photchamnian | 67070505206 | `Davidice23` |
| Peer reviewer | นายศารินทร์ ไชยารัตน์ | 67070505207 | `Sxr1n` |

## Review Log

| PR | Issue | Branch flow | Review received | Author response | Approval | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [#24](https://github.com/Davidice23/toktickit/pull/24) | #15 | `feature/15-lab2-contract` -> `lab2-staging` | Identified Attachment-count concurrency, visible Requester-header security warning, idempotency retention/scope, query-level case matching, and requested an AC-28/AC-29 traceability check. | Initial acknowledgement was too brief. A follow-up branch resolves the four specification ambiguities; inspection confirmed AC-28 and AC-29 were already present. | Approved by `Sxr1n` on 2026-09-05 | Merged; follow-up review pending |
| [#25](https://github.com/Davidice23/toktickit/pull/25) | #15 | `fix/15-contract-review-feedback` -> `lab2-staging` | Follow-up review requested after resolving every substantive finding from PR #24. | Resolution details are recorded below and in the PR description. | Pending | Open; awaiting peer review |

## PR #24 Review Resolution

1. **Attachment count race:** specified an owned-Ticket row lock, active count, and metadata insert in one transaction; added a concurrent-upload integration test.
2. **Requester header spoofability:** added prominent warnings to README and both specification/API contracts; retained the Lab 3 migration decision.
3. **Idempotency lifetime:** scoped keys by Requester, stored an immutable canonical payload hash, and retained it for the Ticket lifetime; expanded replay/conflict tests.
4. **Case-insensitive search:** specified Prisma insensitive mode/PostgreSQL `ILIKE`; expanded mixed-case tests.
5. **Traceability:** verified AC-28 and AC-29 exist in `tests.md` and map to style, accessibility, responsive, and E2E evidence.

## Follow-up PR

[PR #25](https://github.com/Davidice23/toktickit/pull/25) contains the contract corrections and the initial reviewer/AI-use evidence required by Issue #15. Implementation remains paused until the follow-up is reviewed and approved. The final review result, any additional author responses, and merge evidence will be recorded here after review.

## Review Practice for Remaining Issues

- Request `Sxr1n` on each feature PR before merge.
- Record at least the substantive findings, response, resulting commit/decision, and approval.
- If no defect is found, record what files, acceptance criteria, and tests were checked rather than using only `LGTM`.
- Do not mark an Issue Done until review feedback is resolved and the approved PR is merged.
