# Lab 4 Visual and Accessibility Review Checklist

This checklist records a human review of the exact PR head. Automated test output and screenshots are supporting evidence, not a substitute for inspecting the rendered screens and trying the keyboard paths.

## Review record

- PR URL / code head: [PR #84](https://github.com/Davidice23/toktickit/pull/84) / `3f7623d57b347c2d9b0ed4f950331f47638eee86`
- Reviewer and review date: **Pending**
- Browser and version / OS / zoom: **Pending**
- CI run and `lab4-browser-evidence` artifact: [run 41342097987](https://github.com/Davidice23/toktickit/actions/runs/41342097987) / [artifact 13098171329](https://github.com/Davidice23/toktickit/actions/runs/41342097987/artifacts/13098171329)
- Outcome: **AUTOMATED ARTIFACT READY — human screenshot/keyboard review pending; do not mark this checklist complete yet**

## Screenshots to inspect

Open the exact-head `lab4-browser-evidence` artifact. For each screen below, inspect the 1440px, 820px, and 390px captures where present. Check alignment, clipping/overlap, readable content, visible state, responsive navigation, and that controls remain usable. Record a screenshot path/name or a short reason when a viewport does not apply.

| Screen/state | Expected artifact / automated source | Human inspection result / defect reference |
| --- | --- | --- |
| Requester dashboard | `lab4-requester-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Pending |
| IT Staff dashboard | `lab4-staff-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Pending |
| Administrator dashboard | `lab4-administrator-dashboard-{1440,820,390}.png` from `e2e/lab-04/dashboards.spec.ts` | Pending |
| Staff Ticket detail with Actions workflow | `lab4-actions-staff-{1440,820,390}.png` from `e2e/lab-04/actions-taken-workflow.spec.ts` | Pending |
| Requester Ticket detail, Actions read-only | `lab4-actions-requester-{1440,820,390}.png` from `e2e/lab-04/actions-taken-workflow.spec.ts` | Pending |
| Requester resolution indication | `lab4-resolution-requester-advisory-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Codex artifact-only visual preflight passed; human inspection pending |
| Stale update safely refreshed and retried | `lab4-resolution-stale-update-recovered-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13098171329 |
| Resolution blocked without completed Action | `lab4-resolution-blocked-resolution-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13098171329 |
| Resolution succeeds with completed Action evidence | `lab4-resolution-resolved-with-evidence-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13098171329 |
| Staff queue, Requester ticket list, and Administrator user management | `evidence-capture.spec.ts` artifacts in the same full browser run | Pending |

## Manual keyboard and accessibility checks

- [ ] Use keyboard only to reach the page navigation and all primary actions; focus remains visible and follows a sensible order.
- [ ] At 390px, open and close the navigation with the keyboard; navigation activation closes the menu and does not strand focus.
- [ ] Confirm headings, landmarks, tables, buttons, form labels, and status messages make sense when navigated by role/name.
- [ ] Trigger representative invalid forms; verify each field error is associated with its field and not communicated by color alone.
- [ ] Open and dismiss Action dialogs using keyboard controls; confirm focus is trapped while open, Escape closes when safe, and focus returns to the trigger or a logical fallback.
- [ ] Confirm contrast and focus indicators are clear on white, pale-green, and green-header surfaces. Automated dashboard thresholds are recorded separately in `tests.md`.
- [ ] Check 200% zoom or equivalent text scaling on the Ticket/Action workflow and confirm content and controls remain available.
- [ ] Confirm Requester screens do not reveal Staff-only mutation controls or Internal Notes.

## Findings and follow-up

Record each issue with the screen, viewport, reproduction steps, severity, and linked follow-up Issue/PR. If no defect is found, state that explicitly and link the inspected artifact/run.

| Finding | Severity | Screen / viewport | Follow-up | Resolution / recheck evidence |
| --- | --- | --- | --- | --- |
| Pending review | — | — | — | — |

Do not mark the Lab 4 Hardening gate complete while the review record, screenshot inspection, or any required follow-up remains pending.

## Codex artifact-only visual preflight (not a human review)

- Inspected artifact: [run 41342097987](https://github.com/Davidice23/toktickit/actions/runs/41342097987) / [artifact 13098171329](https://github.com/Davidice23/toktickit/actions/runs/41342097987/artifacts/13098171329); archive SHA-256 verified as `4d80b9b7169b3da1aeda5dd482bb98088448cb1d466393da15a435a2341c5357`.
- Artifact inventory: 27 screenshots total — 9 dashboard, 6 Actions detail, and 12 Ticket-resolution screenshots, generated at 1440px, 820px, and 390px where applicable.
- Focused recheck: inspected `lab4-actions-requester-{1440,820,390}.png` and `lab4-resolution-requester-advisory-{1440,820,390}.png`. The prior 1440px/820px crowding finding is resolved in the exact-head artifact: each form label, textarea, and action buttons occupy separate vertical rows; no visible overlap or clipping was found. The 390px layout remains stacked and readable.
- Result: **Codex artifact-only preflight passed for the six updated Requester captures.** It does not satisfy the human screenshot, keyboard, accessibility, or zoom checklist above. Human reviewer, browser/OS, keyboard test, and manual checklist remain pending; do not mark the hardening gate complete.
