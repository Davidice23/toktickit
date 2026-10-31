# Lab 4 AI-use record

This log records model use by work period. It does not replace the learner's
own review, decisions, or reflection for the final report.

| Period / work | Model actually used | Scope and evidence | Learner checkpoint |
| --- | --- | --- | --- |
| #70 data foundation, through PR #77 merge on 2026-10-30 | Terra ExHigh (user-selected; exact model identifier should be confirmed from the earlier session before final reporting) | Implemented on `feature/70-actions-data-foundation`; PR #77 head `503e3af`; merged as `be1b800`; disposable-DB CI run [40923264624](https://github.com/Davidice23/toktickit/actions/runs/40923264624) passed. | Learner reported PR #77 was already merged and asked to inspect the current state and continue. |
| #66 Actions REST API, started 2026-10-30 | `gpt-6-luna` xhigh (user-selected continuation model) | Started from `origin/lab4-staging` merge `be1b800` on `feature/66-actions-rest-api`. Server build and standalone test TypeScript check passed locally; database integration tests have not run yet. | Learner asked to continue after surveying current work. Review and accept the eventual implementation/PR before merge. |
| #66 validation follow-up, 2026-10-30 | `gpt-6.1-terra` | Added isolated negative validation tests and fixed non-object body/type handling. The seven cases failed before the fix and passed afterwards; no real database was used. Peer review is pending. | Learner requested continuation after a read-only audit; Contract pagination and replay decisions still need review. |
| #66 pagination and replay proposal, 2026-10-30 | `gpt-6.1-terra` | Added proposed Action-page and original-response receipt implementation, additive migration, and mocked/integration test cases. Local mocked tests and schema/build checks passed; database-backed cases have not run. | Learner approved the proposed direction; Sxr1n review and CI on the actual PR head remain pending. |
| #66 PR #78 CI follow-up, 2026-10-31 | `gpt-6.1-terra` | Investigated server regression failure on `b08c5bd` and revised audit assertions to test the approved chronological/ID ordering and each changed field rather than imposing an undocumented kind priority. New-head CI and peer review pending. | Learner requested preparation for peer review; do not merge until required checks and review are complete. |

## Work protocol

- The model proposes and implements; the learner remains responsible for
  understanding and approving the Contract, reviewing the PR, and submitting
  the final report.
- CI claims must name the exact head SHA and run. Local build/type-check is not
  represented as an integration-test or database migration pass.
- Record actual prompts and learner reflection from the real session when
  preparing the final report; do not invent prompts or write the learner's
  personal reflection on their behalf.
