# Lab 4 Visual and Accessibility Review Checklist

This checklist records a human review of the exact PR head. Automated test output and screenshots are supporting evidence, not a substitute for inspecting the rendered screens and trying the keyboard paths.

## Review record

- PR URL / code head: [PR #84](https://github.com/Davidice23/toktickit/pull/84) / `3e5bfa9fd825f0187cef85b6137baba177c0731c`
- Reviewer and review date: **Pending**
- Browser and version / OS / zoom: **Pending**
- CI run and `lab4-browser-evidence` artifact: [run 41333174628](https://github.com/Davidice23/toktickit/actions/runs/41333174628) / [artifact 13094460468](https://github.com/Davidice23/toktickit/actions/runs/41333174628/artifacts/13094460468)
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
| Requester resolution indication | `lab4-resolution-requester-advisory-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13094460468 |
| Stale update safely refreshed and retried | `lab4-resolution-stale-update-recovered-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13094460468 |
| Resolution blocked without completed Action | `lab4-resolution-blocked-resolution-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13094460468 |
| Resolution succeeds with completed Action evidence | `lab4-resolution-resolved-with-evidence-{1440,820,390}.png` from `e2e/lab-04/ticket-resolution.spec.ts` | Pending human inspection of artifact 13094460468 |
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

- Inspected artifact: [run 41333174628](https://github.com/Davidice23/toktickit/actions/runs/41333174628) / [artifact 13094460468](https://github.com/Davidice23/toktickit/actions/runs/41333174628/artifacts/13094460468); archive SHA-256 verified as `40ff04201157322be7daf62da67fba02e11ebb306e19802de2371ffc79201225`.
- Scope: all 9 dashboard screenshots, 6 Actions detail screenshots, and 12 Ticket-resolution screenshots at 1440px, 820px, and 390px.
- Dashboard, Staff detail, and resolution states: no obvious card overlap, horizontal clipping, or inaccessible off-screen primary control was visible in the captured viewports. At 820px, some headings/navigation labels wrap but remain readable.
- Finding: Requester detail screenshots `lab4-actions-requester-{1440,820}.png` and `lab4-resolution-requester-advisory-{1440,820}.png` show the public-comment label, native-sized textarea, and submit button crowded on one line. At 390px the same form stacks. A responsive grid and full-width styled textarea were added to `client/src/styles.css`; this finding is **not yet verified fixed** until a new exact-head CI screenshot artifact is inspected.
- Result: **Codex preflight in progress; exact-head re-capture pending.** This automated image inspection does not satisfy the human screenshot, keyboard, accessibility, or zoom checklist above. Human reviewer, browser/OS, keyboard test, and manual checklist remain pending.
