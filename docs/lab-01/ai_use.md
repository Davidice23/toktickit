# Lab 1 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex (GPT-5) through the Codex desktop application.

I used Codex as a pair-programming assistant for requirements analysis, Git workflow guidance, implementation, testing, troubleshooting, and final verification. I remained responsible for approving actions, checking the output, arranging peer review, and deciding when work was ready to merge.

## Selected key prompts

The prompt text below is copied from my actual conversation with Codex. The
original Thai wording is preserved rather than replaced with a summary.

| # | Prompt name | Actual prompt text | How I used or corrected the result |
|---|---|---|---|
| 1 | Understand Lab 1 | “เรียนรู้ lab นี้แล้วอธิบายให้ผมเข้าใจว่าต้องทำอะไรบ้าง ยังไง ขั้นตอนไหนบ้าง อย่างละเอียด” | I used the explanation to understand the four dependent Issues, the reason for each step, and the required evidence before coding. |
| 2 | Start Issue 1 | “เปิด Vscode แล้ว เริ่ม Issue 1” | I followed the feature-branch workflow and checked that the React, Express, Prisma, and test scaffolds matched the required structure. |
| 3 | Continue Issue 1 | “แก้ Issue 1 ต่อ” | I reviewed the generated changes and corrected the server TypeScript output path so the build output matched the start script before opening the PR. |
| 4 | Use stacked branches | “งั้นเริ่มทำแบบ Stacked Branch ได้เลย” | I learned why parent PRs must merge first and resynchronized dependent branches with `lab1-staging` after each merge. |
| 5 | Check PostgreSQL | “ผมสามารถลองเข้าPostgreSQLก่อนได้มั้ย ผมไม่แน่ใจรหัส” | The first local credential assumption failed. I kept the password out of Git and moved repeatable verification to an isolated PostgreSQL database. |
| 6 | Start Issue 3 | “เริ่ม Issue 3 แบบ Stacked Branch” | I required the Category migration and idempotent seed to run twice, then checked that exactly four distinct category names remained. |
| 7 | Prepare evidence PR | “ทำให้ PR 9 พร้อมรีวิว” | I checked that `ai_use.md`, `reviewer.md`, and `tests.md` were complete before requesting independent peer review. |
| 8 | Final verification | “เริ่มตรวจงานบน main” | The clean verification exposed the Prisma Client generation step. I corrected the sequence and reran builds, all seven tests, seed idempotency, and direct HTTP checks. |

## Reflection

My prompts improved when I named the current Issue, branch dependency, expected evidence, and the exact point where I wanted Codex to stop for review. The most useful corrections came from testing clean environments: database credential assumptions and Prisma generation both looked acceptable in the existing workspace but needed a more explicit, reproducible setup. This showed me that AI-generated work still needs independent tests, peer review, and careful Git history checks.
