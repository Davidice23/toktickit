# Lab 2 AI Use Record

## Tool Used

OpenAI Codex (GPT-5 family) is used as a specification and coding assistant. The student remains responsible for approving requirements, understanding code, checking commands and dependencies, testing failure cases, responding to peer review, and deciding whether the Definition of Done is satisfied.

## Selected Key Prompts

The wording below is a concise paraphrase of the working prompts; final submission evidence may include screenshots or links to the original conversation where appropriate.

| No. | Prompt / request | Purpose | Result retained by the student |
| --- | --- | --- | --- |
| 1 | Study the Lab 2 sheet in detail and explain the required work and order. | Requirement discovery | Identified scope, exclusions, deliverables, workflow, evidence, and submission structure. |
| 2 | Design the complete Lab 2 workflow. | Sprint planning | Produced the contract-first, Issue/branch/PR, integration, E2E, and release flow. |
| 3 | Start the work and create the GitHub Issues. | Work decomposition | Created Issues #15-#23 with dependencies, branch names, acceptance criteria, and evidence. |
| 4 | Prepare the Engineering Contract and wait for my approval. | Spec DD/Test DD | Drafted `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md`; the student reviewed and approved them. |
| 5 | Explain whether a Collaborator is required and how peer review should work. | Process clarification | Distinguished repository access from per-PR review and confirmed the Lab requires review evidence, not a fixed Collaborator count. |
| 6 | Check the peer review and determine what must happen next. | Review validation | Detected four technical ambiguities, verified AC-28/AC-29, and chose a follow-up PR instead of ignoring review feedback. |

## Important Human Decisions

- The student explicitly approved the Engineering Contract before implementation.
- The student chose `Sxr1n` as the peer reviewer and is responsible for repository access.
- The student accepted a follow-up PR to resolve review feedback before Issue #16 begins.
- Secrets and PostgreSQL credentials remain local and are not included in AI prompts or repository files.

## Verification and Corrections

- AI output was checked against the Lab sheet and repository state.
- Acceptance criteria were checked for complete test traceability.
- GitHub state was verified rather than inferred from screenshots alone.
- Peer feedback exposed concurrency, security-wording, idempotency, and query-semantics details that were added to the contract before implementation.

## My Reflection

> **Student review required before final submission:** Replace or revise this draft in your own words.

Using Codex helped me break a large and incomplete stakeholder request into smaller Issues and testable documents before coding. I still needed to inspect the Lab requirements, approve design decisions, verify GitHub state, and respond to peer feedback. The peer review was useful because it found technical ambiguity that looked acceptable at first but could have produced inconsistent code and tests. I learned that AI output should be treated as a draft engineering artifact that requires human review and evidence, not as proof that the work is complete.
