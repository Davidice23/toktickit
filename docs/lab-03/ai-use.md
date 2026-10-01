# Lab 3 AI Use and My Reflection

This is a selected, truthful account of how AI assisted Lab 3. Prompt entries
summarize the student's requests; they are not presented as verbatim transcripts.
The repository, peer review, tests, and final submission remain the student's
responsibility. No AI review is represented as a human peer approval.

## Roles and boundaries

- **Sol (planning/audit):** interpreted the 18-page Lab 3 sheet, decomposed
  Answer Parts 1–9, audited the Lab 2 baseline, drafted Spec DD/Test DD
  contracts, and later checked the implementation against them.
- **Luna and Terra (implementation/remediation):** implemented issue slices and
  investigated failing tests or mismatches under the approved contract.
- **Codex (current verification/reporting):** reproduced local checks,
  strengthened migration/seed and cross-role browser tests, captured new browser
  screenshots, corrected stale documentation, and assembled evidence.
- **Student:** approved the engineering contract and branch/review workflow,
  requested an actual peer review from Sxr1n, decided when reviewed PRs could
  merge, and must inspect the final PDF and submission on main.

## Selected prompts and what was checked

| No. | Student prompt summary | AI output | Human/technical verification |
| --- | --- | --- | --- |
| 1 | Read Lab 3 carefully and make a detailed plan that follows the lab. | Nine-part rubric and dependency map. | Compared against the supplied `Lab_3_sheet.pdf`. |
| 2 | Begin Phase 0 and prepare the engineering contract before coding. | Specification, API, UI, tests, review and AI-use documents. | PR #36 was peer-reviewed before dependent implementation. |
| 3 | Explain where the engineering contract lives and what it means. | Document map and decisions. | Contract files remain inspectable under `docs/lab-03/`. |
| 4 | Continue after a merge, recheck, and do the next issue. | Incremental feature/PR work. | Branch targets and merged PR history were checked; a user merge claim was not treated as proof by itself. |
| 5 | Review a friend's PR and help prepare comments. | Suggested review observations. | Only actual GitHub reviews by a real account count as peer review; AI suggestions are not substituted. |
| 6 | Audit the completed Lab 3 against the plan, lab, and contract before reporting. | Gap list for migration, seed, tests, UI, evidence and docs. | Reproduced focused server, client, and browser tests rather than accepting old checklist ticks. |
| 7 | Fix Lab 3 remediation and then make the report. | Legacy-data migration test, repeat-safe fixtures, safer API mutations, responsive fixes, new browser evidence. | Local isolated-schema tests and real-browser runs were executed; results are recorded in `tests.md`. |
| 8 | Capture fresh Git/code/web evidence and make a complete report. | New GitHub and responsive application screenshots plus this evidence-based report. | Screenshots are labeled by source and time; the final PDF is rendered and visually checked. |

## My Reflection

I used AI to make a complex, multi-role lab easier to break into reviewable
issues. The most useful planning decision was to approve the engineering
contract before implementation. That kept the role matrix, migration, API
errors, and test expectations visible when later code changed.

I also learned that a green CI badge does not prove every line of a test plan:
some earlier documentation described planned scenarios more broadly than the
actual assertions. In remediation, I required repeat-safe seed checks, a
legacy-data migration test, local API/client tests, and a browser journey that
starts as a Requester and ends with a Staff response. I checked that an
Internal Note stays hidden from the Requester. This improved the evidence and
made the remaining limits explicit instead of hiding them.

Sxr1n's GitHub review is separate from AI assistance. My responsibility is to
read review comments, answer them, verify the change, and only submit the
version whose branch, CI, and report evidence match.

## Limitations

AI-generated code and narrative can be wrong. A local passing run is not a
passing final-main CI run; screenshots from an isolated local database are
demonstrations, not proof of production security. Any rubric item not
directly demonstrated is reported as such in the test record and PDF.
