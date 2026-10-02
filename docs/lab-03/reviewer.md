# Lab 3 Peer Review Record

> The Lab 3 Contract and all decision-register rows were approved by Sxr1n on 2026-09-17. Dependent
> Staff/UI/resource-policy implementation may proceed.

This record tracks the Contract approval, the test/CI scaffolding review, the authentication foundation, and
the final approval of all remaining decision-register rows.

## Review status

| Field | Final value |
| --- | --- |
| Contract branch | docs/lab3-engineering-contract |
| Base branch | lab3-staging |
| Contract PR | [PR #36](https://github.com/Davidice23/toktickit/pull/36) |
| Author | Wachirawit Photchamnian - 67070505206 |
| Reviewer | [Sxr1n](https://github.com/Sxr1n) (GitHub collaborator) |
| Review state | Approved |
| Implementation started | Authentication foundation in PR #42; CSRF/decision reconciliation in PR #44; dependent Staff/UI/resource-policy slices unblocked after Issue #45 approval |
| Approval | Approved by Sxr1n |

## Files submitted for review

- docs/lab-03/specification.md
- docs/lab-03/api-spec.md
- docs/lab-03/ui-spec.md
- docs/lab-03/tests.md
- docs/lab-03/reviewer.md
- docs/lab-03/ai-use.md

## Review log

| Date | PR/link | Reviewer | Comment or requested change | Author response | Approval |
| --- | --- | --- | --- | --- | --- |
| 2026-09-17 06:28 UTC | [PR #36](https://github.com/Davidice23/toktickit/pull/36) | Sxr1n | Reviewed the full Contract; confirmed the authentication/session/CSRF/RBAC design, migration direction, API/UI contracts, and AC-to-test traceability. | Author resolved the review visibility/clarity concerns in the final Contract commits. | Approved |
| 2026-09-17 06:57 UTC | [PR #38](https://github.com/Davidice23/toktickit/pull/38) | Sxr1n | Approved the test/CI scaffolding; requested a Playwright `webServer` and an explicit clarification that scaffolding does not bypass the Contract gate. | Addressed in Issue #39 / this follow-up PR. | Approved |
| 2026-09-17 08:05 UTC | [PR #44](https://github.com/Davidice23/toktickit/pull/44) | Sxr1n | Approved the stable CSRF derivation and the reconciliation of the decision-register summary; confirmed that the remaining decision rows stay pending. | Implemented the deterministic per-session CSRF derivation, regression assertion, and explicit pending-decision wording. | Approved |
| 2026-09-17 12:30 UTC | [Issue #45 approval](https://github.com/Davidice23/toktickit/issues/45#issuecomment-5714383904) | Sxr1n | Approved all six remaining decisions: staff assignment, login throttling, queue pagination, comment/note limits, attachment access, and the API error envelope. | Updated the specification, API contract status, and review record so all decision rows are approved. | Approved |
| 2026-09-30 18:43 UTC | [PR #61](https://github.com/Davidice23/toktickit/pull/61) | Sxr1n | Confirmed the first-password navigation fix and the isolated, repeat-safe legacy-upgrade test; noted that the simple SQL splitter is safe for the three pinned migrations but would need revisiting for future procedural SQL. | Kept the current pinned migration scope explicit and treated the future SQL-parser suggestion as non-blocking technical debt. | Approved |
| 2026-10-01 04:16 UTC | [PR #62](https://github.com/Davidice23/toktickit/pull/62) | Sxr1n | Confirmed that filtering the ARIA status locator removes strict-mode ambiguity without weakening the user-creation or password-nondisclosure assertions. | Merged the one-file stabilization only after all three PR CI jobs passed. | Approved |

## Verified implementation and release reviews

GitHub's review records show an `APPROVED` review by Sxr1n on each linked PR
below. This is human GitHub evidence, not an AI-generated approval. All listed
PRs are merged; the branch target is `lab3-staging` except #59, #60, #61 and
#62, which target `main`.

| Slice | Approved PRs and review evidence | Follow-up or outcome |
| --- | --- | --- |
| Contract and test foundation | [#36](https://github.com/Davidice23/toktickit/pull/36#pullrequestreview-5232013633), [#38](https://github.com/Davidice23/toktickit/pull/38#pullrequestreview-5232243098), [#40](https://github.com/Davidice23/toktickit/pull/40#pullrequestreview-5232389503) | #40 addressed the Contract/E2E scaffolding feedback. |
| Authentication and decision gate | [#42](https://github.com/Davidice23/toktickit/pull/42#pullrequestreview-5232703212), [#44](https://github.com/Davidice23/toktickit/pull/44#pullrequestreview-5232839379), [#46](https://github.com/Davidice23/toktickit/pull/46#pullrequestreview-5233551784), [#48](https://github.com/Davidice23/toktickit/pull/48#pullrequestreview-5235769420) | #44 stabilized CSRF and #48 recorded the six remaining approved decisions after the Issue #45 comment. |
| Requester, Staff and Admin implementation | [#49](https://github.com/Davidice23/toktickit/pull/49#pullrequestreview-5236639386), [#50](https://github.com/Davidice23/toktickit/pull/50#pullrequestreview-5243442680), [#52](https://github.com/Davidice23/toktickit/pull/52#pullrequestreview-5243659611), [#53](https://github.com/Davidice23/toktickit/pull/53#pullrequestreview-5243767507), [#55](https://github.com/Davidice23/toktickit/pull/55#pullrequestreview-5243848136), [#56](https://github.com/Davidice23/toktickit/pull/56#pullrequestreview-5244406000) | Reviewed in separate API and UI slices; comments and responses remain on each PR timeline. |
| Verification and release | [#58](https://github.com/Davidice23/toktickit/pull/58#pullrequestreview-5245223803), [#59](https://github.com/Davidice23/toktickit/pull/59#pullrequestreview-5245462778), [#60](https://github.com/Davidice23/toktickit/pull/60#pullrequestreview-5245589265) | #59 released to `main`; #60 documented the final-main CI run. |
| Final remediation | [#61](https://github.com/Davidice23/toktickit/pull/61), [#62](https://github.com/Davidice23/toktickit/pull/62) | Sxr1n approved the migration/UI remediation and the narrow post-merge E2E locator stabilization. Both PRs were merged to `main`; run [36826322511](https://github.com/Davidice23/toktickit/actions/runs/36826322511) passed all three jobs on `9cad71b`. |

The final post-release remediation is covered by fresh reviews on #61 and #62,
not by historical approval alone. GitHub records both approvals and merges, and
the resulting `main` commit passed Server, Client, and browser CI.

## Required completion fields

For future Contract changes, extend this record with:

- Contract PR number and URL.
- Reviewer identity and review timestamp.
- Each substantive review comment.
- The author's response and resulting document change.
- Approval state and approving reviewer.
- [x] Evidence that all open contract decisions are resolved or explicitly accepted (Issue #45 approval comment).

## Review checklist

- [x] Scope and explicit exclusions match the Lab 3 handout in the approved Contract.
- [x] Functional requirements cover authentication, first-login password change, logout, Requester regression, Staff workflow, comments/notes, and Admin management.
- [x] Business rules include ownership, status transitions, password/session safety, and Administrator safeguards.
- [x] Authorization matrix is internally consistent and backend-enforceable.
- [x] Migration contract requires preserved User/Ticket/Attachment IDs and existing data; a remediation integration test now executes this path.
- [x] API contract defines session, CSRF/CORS, validation, safe errors, and status codes.
- [x] UI contract covers modes, feedback, Zen Green reuse, responsive behavior, and accessibility.
- [x] Test plan existed before implementation and maps every acceptance criterion.
- [x] No dependent Staff/UI/resource-policy implementation started before its decision rows were approved.
