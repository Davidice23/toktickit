# Lab 1 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex (GPT-5) through the Codex desktop application.

I used Codex as a pair-programming assistant for requirements analysis, Git workflow guidance, implementation, testing, troubleshooting, and final verification. I remained responsible for approving actions, checking the output, arranging peer review, and deciding when work was ready to merge.

## Selected key prompts

| # | Prompt name | Prompt summary | How I used or corrected the result |
|---|---|---|---|
| 1 | Understand Lab 1 | Read the Labsheet and explain what must be done, why it is required, and the complete workflow for a beginner. | I used the explanation to understand the four dependent Issues and the required evidence before coding. |
| 2 | Start Issue 1 | Open VS Code and guide me through creating the project foundation. | I followed the feature-branch workflow and checked that the React, Express, Prisma, and test scaffolds matched the required structure. |
| 3 | Fix Issue 1 | Continue fixing Issue 1 and show where the work currently sits in the full flow. | The server TypeScript output path was corrected so the build output matched the start script before opening the PR. |
| 4 | Use stacked branches | Begin the next Issues with a stacked-branch workflow and preserve the correct PR order. | I learned why parent PRs must merge first and allowed the branches to be resynchronized with `lab1-staging` after each merge. |
| 5 | Troubleshoot PostgreSQL | Test PostgreSQL first because I was unsure of the password and it contained a special character. | The first credential approach failed. I did not share the password; instead, the tests were moved to an isolated PostgreSQL environment with a clean database. |
| 6 | Implement Issue 3 | Continue the Category model, migration, and idempotent seed after the earlier PRs were merged. | I required the migration and seed to run twice and checked that there were exactly four distinct category names. |
| 7 | Implement Issue 4 | Continue after peer review and build the category API, React list, loading state, error handling, and tests. | I checked that React rendered data returned by the API rather than hard-coded values and added safe database-error coverage. |
| 8 | Final verification | After the final feature PR was approved and merged, verify everything again from a clean checkout. | The clean test exposed that Prisma Client had to be generated before seeding. I corrected the verification sequence, then reran builds, tests, and HTTP checks successfully. |

## Reflection

My prompts improved when I named the current Issue, branch dependency, expected evidence, and the exact point where I wanted Codex to stop for review. The most useful corrections came from testing clean environments: database credential assumptions and Prisma generation both looked acceptable in the existing workspace but needed a more explicit, reproducible setup. This showed me that AI-generated work still needs independent tests, peer review, and careful Git history checks.
