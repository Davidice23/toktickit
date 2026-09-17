# Lab 3 Peer Review Record

> Core authentication decisions were approved by peer review on 2026-09-17. The authentication foundation
> is implemented; the remaining Staff/UI/resource-policy decisions are still pending and gate their
> dependent implementation slices.

This record tracks the Contract approval, the test/CI scaffolding review, and the authentication-foundation
follow-up. It must be updated when the remaining decision rows receive peer approval.

## Review status

| Field | Final value |
| --- | --- |
| Contract branch | docs/lab3-engineering-contract |
| Base branch | lab3-staging |
| Contract PR | [PR #36](https://github.com/Davidice23/toktickit/pull/36) |
| Author | Wachirawit Photchamnian - 67070505206 |
| Reviewer placeholder | Sxr1n |
| Review state | Approved |
| Implementation started | Authentication foundation in PR #42; CSRF/decision reconciliation in PR #44; dependent Staff/UI/resource-policy slices remain gated |
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

## Required completion fields

Before implementation begins, fill in:

- Contract PR number and URL.
- Reviewer identity and review timestamp.
- Each substantive review comment.
- The author's response and resulting document change.
- Approval state and approving reviewer.
- Evidence that all open contract decisions are resolved or explicitly accepted.

## Review checklist

- [ ] Scope and explicit exclusions match the Lab 3 handout.
- [ ] Functional requirements cover authentication, first-login password change, logout, Requester regression, Staff workflow, comments/notes, and Admin management.
- [ ] Business rules include ownership, status transitions, password/session safety, and Administrator safeguards.
- [ ] Authorization matrix is internally consistent and backend-enforceable.
- [ ] Migration preserves User/Ticket/Attachment IDs and existing data.
- [ ] API contract defines session, CSRF/CORS, validation, safe errors, and status codes.
- [ ] UI contract covers modes, feedback, Zen Green reuse, responsive behavior, and accessibility.
- [ ] Test plan exists before implementation and maps every acceptance criterion.
- [x] No dependent Staff/UI/resource-policy implementation started while its decision rows remain pending.
