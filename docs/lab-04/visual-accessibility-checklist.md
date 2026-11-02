# Lab 4 Visual and Accessibility Review Checklist

This checklist records a human review of the exact PR head. Automated test output and screenshots are supporting evidence, not a substitute for inspecting the rendered screens and trying the keyboard paths.

## Review record

- PR URLs / code heads: [PR #84](https://github.com/Davidice23/toktickit/pull/84) / `3f7623d57b347c2d9b0ed4f950331f47638eee86`; [PR #85](https://github.com/Davidice23/toktickit/pull/85) / `1cb379ad8d7912c9a1552e6afd39b6d102cd556e` (both merged to `lab4-staging`)
- Reviewer and review date for the **full manual checklist**: Wachirawit Photchamnian (learner/author; self-reported review), **2026-11-03**. Sxr1n's code approval on PR #85 is separate from this learner review.
- Browser and version / OS / zoom: Microsoft Edge **156.0.4314.58**; Windows 10 Home Single Language **26H2 (build 26300)**; browser zoom **100%**. The reviewer reports also checking the required 200% zoom/reflow case.
- CI run and `lab4-browser-evidence` artifact: [run 41445516577](https://github.com/Davidice23/toktickit/actions/runs/41445516577) / [artifact 13142202669](https://github.com/Davidice23/toktickit/actions/runs/41445516577/artifacts/13142202669); the downloaded 27-screenshot artifact used for Codex preflight is [run 41342097987](https://github.com/Davidice23/toktickit/actions/runs/41342097987) / [artifact 13098171329](https://github.com/Davidice23/toktickit/actions/runs/41342097987/artifacts/13098171329)
- Outcome: **The learner confirmed that all listed screen/state, keyboard, and accessibility checks were completed and reported no additional defect requiring follow-up. This is a self-reported human review; Codex did not independently operate every authenticated workflow.**

## Screenshots to inspect

Open the exact-head `lab4-browser-evidence` artifact. For each screen below, inspect the 1440px, 820px, and 390px captures where present. Check alignment, clipping/overlap, readable content, visible state, responsive navigation, and that controls remain usable. Record a screenshot path/name or a short reason when a viewport does not apply.

| Screen/state | Expected artifact / automated source | Human inspection result / defect reference |
| --- | --- | --- |
| Requester dashboard | `lab4-requester-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| IT Staff dashboard | `lab4-staff-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Administrator dashboard | `lab4-administrator-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Staff Ticket detail with Actions workflow | `lab4-actions-staff-{1440,820,390}.png` from `e2e/lab-04/actions-taken-workflow.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Requester Ticket detail, Actions read-only | `lab4-actions-requester-{1440,820,390}.png` from `e2e/lab-04/actions-taken-workflow.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Requester resolution indication | `lab4-resolution-requester-advisory-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Signed-out login form | Learner-inspected local preview after PR #85 spacing change; no CI screenshot is attached for this view | Learner self-review reported complete (2026-11-03); accepted the revised label/input spacing; no issue reported |
| Stale update safely refreshed and retried | `lab4-resolution-stale-update-recovered-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Resolution blocked without completed Action | `lab4-resolution-blocked-resolution-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Resolution succeeds with completed Action evidence | `lab4-resolution-resolved-with-evidence-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Learner self-review reported complete (2026-11-03); no issue reported; screenshots in artifact 13098171329 |
| Staff queue, Requester ticket list, and Administrator user management | `e2e/lab-03/evidence-capture.spec.ts`; screenshot paths are under `artifacts/lab-03/screenshots/` | Learner self-review reported complete (2026-11-03); no issue reported. These supporting screenshots were not included in the prior Lab 4 CI artifact; the workflow is updated in this follow-up to upload them on the next run. |

## Manual keyboard and accessibility checks

- [x] Use keyboard only to reach the page navigation and all primary actions; focus remains visible and follows a sensible order. (Learner self-review, 2026-11-03.)
- [x] At 390px, open and close the navigation with the keyboard; navigation activation closes the menu and does not strand focus. (Learner self-review, 2026-11-03.)
- [x] Confirm headings, landmarks, tables, buttons, form labels, and status messages make sense when navigated by role/name. (Learner self-review, 2026-11-03.)
- [x] Trigger representative invalid forms; verify each field error is associated with its field and not communicated by color alone. (Learner self-review, 2026-11-03.)
- [x] Open and dismiss Action dialogs using keyboard controls; confirm focus is trapped while open, Escape closes when safe, and focus returns to the trigger or a logical fallback. (Learner self-review, 2026-11-03.)
- [x] Confirm contrast and focus indicators are clear on white, pale-green, and green-header surfaces. Automated dashboard thresholds are recorded separately in `tests.md`. (Learner self-review, 2026-11-03.)
- [x] Check 200% zoom or equivalent text scaling on the Ticket/Action workflow and confirm content and controls remain available. (Learner reports this check completed; browser baseline zoom was 100%.)
- [x] Confirm Requester screens do not reveal Staff-only mutation controls or Internal Notes. (Learner self-review, 2026-11-03.)

## Findings and follow-up

Record each issue with the screen, viewport, reproduction steps, severity, and linked follow-up Issue/PR. If no defect is found, state that explicitly and link the inspected artifact/run.

| Finding | Severity | Screen / viewport | Follow-up | Resolution / recheck evidence |
| --- | --- | --- | --- | --- |
| No additional defect reported by learner in the completed self-review (2026-11-03) | — | All listed screen/state groups and keyboard/accessibility checks | None reported | Recheck after the exact-head CI run linked below |

The learner review is recorded as a self-report, not as a Codex human review. Keep the Lab 4 Hardening gate open until this follow-up's exact-head CI passes, the uploaded artifact is verified, and the requested peer review is complete.

## Codex artifact-only visual preflight (not a human review)

- Inspected artifact: [run 41342097987](https://github.com/Davidice23/toktickit/actions/runs/41342097987) / [artifact 13098171329](https://github.com/Davidice23/toktickit/actions/runs/41342097987/artifacts/13098171329); archive SHA-256 verified as `4d80b9b7169b3da1aeda5dd482bb98088448cb1d466393da15a435a2341c5357`.
- Artifact inventory: 27 screenshots total — 9 dashboard, 6 Actions detail, and 12 Ticket-resolution screenshots, generated at 1440px, 820px, and 390px where applicable.
- Focused recheck: inspected `lab4-actions-requester-{1440,820,390}.png` and `lab4-resolution-requester-advisory-{1440,820,390}.png`. The prior 1440px/820px crowding finding is resolved in the exact-head artifact: each form label, textarea, and action buttons occupy separate vertical rows; no visible overlap or clipping was found. The 390px layout remains stacked and readable.
- Additional inspection on 2026-11-02: Codex reviewed the 1440px and 390px dashboard captures for Requester, Staff, and Administrator; 1440px and 390px Staff and Requester Ticket/Actions detail; the 820px Requester detail; all four 390px Ticket-resolution states (advisory, stale-update recovery, blocked, and resolved); and the 1440px resolved-with-evidence state. No obvious overlap, clipping, or horizontal overflow was visible in those screenshots. The 390px views use stacked cards; the Requester view shows Actions as read-only and does not expose Staff operational controls or Internal Notes; the blocked/stale states include explanatory text and the resolved state displays workflow history. This assessment is static-image-only and does not test keyboard behavior, screen-reader semantics, focus order, color contrast, or 200% zoom.
- Result: **Codex artifact-only visual preflight passed for the inspected screenshots.** It is separate from the learner's self-reported full manual review recorded above and is not represented as a human review. The learner reports all manual items completed on 2026-11-03; exact-head evidence and peer review remain the final gate.
