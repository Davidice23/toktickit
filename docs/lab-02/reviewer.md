# Lab 2 Peer Review Record

## Identities

| Role | Name | Student ID | GitHub |
| --- | --- | --- | --- |
| Author | Wachirawit Photchamnian | 67070505206 | `Davidice23` |
| Peer reviewer | นายศารินทร์ ไชยารัตน์ | 67070505207 | `Sxr1n` |

## Review log

| PR | Scope | Branch flow | Review and response | Status |
| --- | --- | --- | --- | --- |
| [#24](https://github.com/Davidice23/toktickit/pull/24) | Contract | feature/15-lab2-contract -> lab2-staging | Reviewer identified five contract ambiguities; author acknowledged them and created follow-up work. | Merged |
| [#25](https://github.com/Davidice23/toktickit/pull/25) | Contract follow-up | fix/15-contract-review-feedback -> lab2-staging | Resolved concurrency, header limitation, idempotency, search semantics, and AC traceability findings. | Approved and merged |
| [#26](https://github.com/Davidice23/toktickit/pull/26) | Data model and seed | feature/16-lab2-data -> lab2-staging | Schema, migration, repeat-safe seed, and integration tests reviewed. | Approved and merged |
| [#27](https://github.com/Davidice23/toktickit/pull/27) | Zen Green shell | feature/17-zen-green-foundation -> lab2-staging | Responsive shell and accessibility state reviewed. | Approved and merged |
| [#28](https://github.com/Davidice23/toktickit/pull/28) | Requester context | feature/18-requester-context -> lab2-staging | Active Requester loading, persistence, switching, and safe errors reviewed. | Approved and merged |
| [#29](https://github.com/Davidice23/toktickit/pull/29) | Create Ticket | feature/19-create-ticket -> lab2-staging | Backend validation, idempotency, UI validation, and error associations reviewed. | Approved and merged |
| [#30](https://github.com/Davidice23/toktickit/pull/30) | My Tickets | feature/20-my-tickets -> lab2-staging | Owner-scoped list, search, pagination, and loading/empty/error states reviewed. | Approved and merged |
| [#31](https://github.com/Davidice23/toktickit/pull/31) | Ticket Detail | feature/21-ticket-detail -> lab2-staging | Owned detail and safe cross-owner 404 behavior reviewed. | Approved and merged |
| [#32](https://github.com/Davidice23/toktickit/pull/32) | Attachments | feature/22-attachments -> lab2-staging | Type, size, signature, ownership, download, and soft removal behavior reviewed. | Approved and merged |
| [#33](https://github.com/Davidice23/toktickit/pull/33) | Quality evidence | feature/23-lab2-quality -> lab2-staging | Reviewer found the browser custom-header download issue; follow-up fix was created. | Approved and merged |
| [#34](https://github.com/Davidice23/toktickit/pull/34) | Download fix | fix/attachment-download -> lab2-staging | Fetch -> Blob -> programmatic download was reviewed and confirmed. | Approved and merged |
| [#35](https://github.com/Davidice23/toktickit/pull/35) | Release | lab2-staging -> main | Full staging promotion reviewed; all feature PRs were already peer-reviewed. | Approved and merged |

## Review practice

- `Sxr1n` was requested on every feature and release PR.
- Substantive findings were resolved in follow-up commits or documented as Lab 3 limitations.
- No PR was treated as complete until approval and merge were visible in GitHub.
