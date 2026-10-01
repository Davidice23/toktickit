# TokTickIT — CPE334 Labs 1–3

TokTickIT is a full-stack IT service desk built with React/TypeScript, Express,
Prisma, and PostgreSQL. Lab 3 replaces the Lab 2 development-only requester
selector and spoofable `X-Requester-Id` header with authenticated cookie sessions,
role-based authorization, and an operational Staff/Admin workflow.

## Lab 3 capabilities

- Requester, IT Staff, and Administrator accounts; Argon2id password hashes;
  first-login password change; HttpOnly sessions, CSRF protection, and logout.
- Session-owned Requester Ticket creation, listing, detail, public comments,
  resolution indication, and Attachment upload/download/removal.
- Staff Queue with search, status/priority/ownership filters, sorting, and
  pagination; Staff Detail with claim/reassign, IT Priority, allowed status
  transitions, requester-visible comments, private notes, and read-only
  Attachment access.
- Administrator User Management with create/edit/reset, active state, duplicate
  email protection, session revocation, and last-active-admin protection.
- Repeat-safe fictional Lab 3 fixtures: active/inactive users, Tickets across all
  statuses, varied priorities/owners, comments, notes, and an Attachment.

The [engineering contract](docs/lab-03/specification.md),
[API contract](docs/lab-03/api-spec.md), [UI contract](docs/lab-03/ui-spec.md),
[test plan](docs/lab-03/tests.md), [peer-review record](docs/lab-03/reviewer.md),
and [AI-use reflection](docs/lab-03/ai-use.md) are under `docs/lab-03/`.

## Set up locally

Install Node.js, npm, and PostgreSQL. Copy `server/.env.example` to
`server/.env` and `client/.env.example` to `client/.env`; supply a **local**
`DATABASE_URL` and point `VITE_API_URL` to the API (normally
`http://localhost:3000`). Never commit `.env` files or real credentials.

In separate terminals:

```powershell
cd server
npm ci
npm run lab3:upgrade
npm run dev
```

```powershell
cd client
npm ci
npm run dev
```

Open `http://localhost:5173`. `lab3:upgrade` applies committed migrations,
backfills Lab 2 Requesters without replacing their IDs or Tickets, and runs the
repeat-safe seed. Set `LAB3_SEED_INITIAL_PASSWORD` to a throwaway local value
(the test-only fallback is `local-only-password`), never a personal one. On first login,
seeded users must change it. See `server/.env.example` for other required
environment variables such as `CSRF_SECRET` and the allowed client origin.

The fictional seed accounts include `anan.chaiya@example.test` (Requester),
`it.staff.one@example.test` (IT Staff), and `admin@example.test`
(Administrator). An inactive account is intentionally unable to sign in.

## Verify

```powershell
cd server
npm run test:lab3
npm run build
```

```powershell
cd client
npm test
npm run build
```

```powershell
cd e2e
npm ci
npx playwright install chromium
npm run test:lab3
```

The E2E suite needs the seeded test database and running API. The Playwright
configuration starts the Vite client when needed. On a local Windows machine
with Chrome but no Playwright Chromium download, set `PLAYWRIGHT_CHANNEL=chrome`.
Do not point tests or `lab3:upgrade` at a production database. Current local
verification and any remaining gaps are recorded in `docs/lab-03/tests.md`;
passing local checks are not a substitute for a green final-`main` CI run.

## Repository and workflow

```text
client/                         React application and component tests
server/                         Express API, Prisma migrations/seed, API tests
e2e/lab-03/                     Browser journeys and responsive capture
artifacts/lab-03/screenshots/    Fresh Lab 3 browser evidence
docs/lab-03/                    Approved contract and review/test records
.github/workflows/lab3-ci.yml    Server, client, and browser CI
```

Feature branches are reviewed into `lab3-staging`; a release PR is reviewed
into `main`. Each PR should have passing applicable checks and a genuine peer
review. `main` is the submission source of truth. The Lab 2 identity header was
only a testing convenience and is **not** a security boundary.

Author: Wachirawit Photchamnian — 67070505206 — GitHub `Davidice23`.
