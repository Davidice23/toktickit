# TokTickIT

TokTickIT is an IT service desk application developed for CPE334 Software
Engineering in the Age of AI Agents. Lab 1 delivers a small full-stack vertical
slice that connects a React user interface to an Express REST API and a
PostgreSQL database through Prisma.

## Lab 2 development identity warning

Lab 2 uses a Development Requester selector and `X-Requester-Id` header only to
simulate requester-specific behavior. This mechanism is deliberately spoofable:
a client can change the header and impersonate another seeded Requester. It is
not login, authentication, authorization, or a security boundary. Lab 3 must
replace it with a server-verified authenticated identity.

## Lab 1 goal

The completed Lab 1 application lets a user select **Check System** and see:

- whether the TokTickIT API is online;
- the supported IT request categories stored in PostgreSQL;
- a loading state while requests are running; and
- a useful error message when the API or database is unavailable.

## Technology stack

- Client: React, TypeScript, Vite, and Bootstrap
- Server: Node.js, Express, and TypeScript
- Database: PostgreSQL with Prisma ORM
- Testing: Vitest, Testing Library, and Supertest
- Workflow: GitHub Issues, GitHub Projects, feature branches, peer-reviewed
  Pull Requests, `lab1-staging`, and `main`

## Repository structure

```text
toktickit/
|-- client/                 React frontend
|   |-- src/
|   `-- tests/lab-01/
|-- server/                 Express backend
|   |-- prisma/
|   |-- src/
|   `-- tests/lab-01/
|-- docs/lab-01/            Lab evidence and records
|-- .gitignore
`-- README.md
```

## Prerequisites

Install these tools before running the project:

- Git
- Node.js and npm
- PostgreSQL

Confirm that PostgreSQL is accepting connections on the configured host and
port before running database migrations or seeds.

## Install dependencies

From the repository root, install the client packages:

```powershell
cd client
npm install
```

Then install the server packages:

```powershell
cd ../server
npm install
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

## Environment variables

Copy the example files and keep the real `.env` files only on your local
machine:

```powershell
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

Client variable:

```env
VITE_API_URL="http://localhost:3000"
```

Server variables:

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/toktickit?schema=public"
PORT=3000
```

Replace `USERNAME` and `PASSWORD` with local PostgreSQL credentials. Never
commit either `.env` file.

## Database preparation

The Category model, migration, and idempotent seed are included. Run these
commands from `server/`:

```powershell
npm run prisma:migrate -- --name init
npm run prisma:seed
```

## Run the application

Start the server from `server/`:

```powershell
npm run dev
```

The API listens on `http://localhost:3000` by default.

In a second terminal, start the client from `client/`:

```powershell
npm run dev
```

Open `http://localhost:5173` in a browser.

## Build and test

Run the server checks from `server/`:

```powershell
npm run build
npm test
```

Run the client checks from `client/`:

```powershell
npm run build
npm test
```

The final Lab 1 release contains seven passing automated tests: three server
tests and four client tests. The commands above also verify both production
builds.

## Lab 1 API contracts

The final Lab 1 release provides these endpoints:

- `GET /api/health` - implemented in Issue 2
- `GET /api/categories` - implemented in Issue 4 after the Issue 3 database work

## Git workflow

`main` is the stable release branch and `lab1-staging` is the Lab 1 integration
branch. Do not develop directly on either branch.

```text
feature branch -> Pull Request -> lab1-staging -> release Pull Request -> main
```

Required feature branches:

- `feature/1-project-foundation`
- `feature/2-health-check`
- `feature/3-category-seed`
- `feature/4-category-list`

Every feature Pull Request requires passing checks and peer review before it is
merged into `lab1-staging`.

## Security rules

Never commit:

- `.env` files;
- passwords, API keys, or database credentials;
- `node_modules/`;
- generated build output; or
- large temporary files.

## Author

Wachirawit Photchamnian - 67070505206 - GitHub: `Davidice23`
