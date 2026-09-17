# Lab 3 AI Use and Reflection

> Contract status: Pending peer review. Implementation must not start until this contract is approved.

This record describes the planned use of two LLM roles. It does not claim that implementation, testing, review, or release work has been completed.

## LLM roles

- Sol: planning and specification agent. Sol interprets the handout, audits the baseline, proposes the dependency graph, and drafts the engineering contract and test traceability.
- Luna: coding and execution agent. Luna will implement only after the contract is approved, work issue by issue, run tests, preserve evidence, and report actual results.
- Human owner: reviews requirements, approves decisions, checks commands and evidence, responds to peer review, and decides whether the Definition of Done is satisfied.

## Selected planning prompts

The following are summaries of eight selected planning prompts used to prepare this contract. Exact conversational wording and later coding prompts should be retained by the student when the implementation phase begins.

| No. | Prompt summary | Intended use |
| --- | --- | --- |
| 1 | Read the Lab 3 handout completely and explain all nine rubric parts, mandatory scope, exclusions, and required evidence. | Requirement discovery |
| 2 | Inspect the Lab 2 repository without changing it and report the branch, dirty files, current identity model, test harness, and safest starting commit. | Baseline and risk audit |
| 3 | Design an authorization matrix for Requester, IT Staff, and Administrator, including ownership and forbidden direct API calls. | Security contract |
| 4 | Propose a PostgreSQL/Prisma migration that preserves existing Requester IDs, Tickets, Attachments, and seed repeatability. | Data evolution |
| 5 | Compare session approaches for the existing Express/Vite stack and specify opaque cookies, expiration, logout invalidation, CSRF, CORS, and safe errors. | Authentication design |
| 6 | Define the exact REST endpoints and response/error envelopes for login, Requester regression, Staff Queue/Detail, comments/notes, and Admin users. | API contract |
| 7 | Extend the Lab 2 Zen Green UI into Login, Change Password, Staff Queue, Staff Detail, and User Management with responsive/accessibility states. | UI contract |
| 8 | Build a pre-implementation test plan mapping every acceptance criterion to server, client, authorization, migration, responsive, and E2E tests. | Test DD and traceability |

## My Reflection

Placeholder for the human reflection after the contract review and implementation cycle. Implementation has not started. The student will describe which planning suggestions were accepted, which were corrected after peer review, how the coding agent's output was independently checked, and what was learned from red/green tests and final evidence.

## Evidence to retain later

- The approved contract PR and review comments.
- The final prompts used with Sol and Luna.
- Red/green test evidence for each implementation Issue.
- Human decisions that changed the proposed authorization, migration, API, UI, or test design.
- Final-main commands and screenshots used in Answer Parts 1 through 9.
