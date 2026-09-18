# Lab 3 browser verification

These Playwright specs are executable release-verification workflows, not skipped placeholders.
They cover the seeded authentication/password-change path, Requester Ticket creation,
IT Staff queue/filter access, Administrator user search/create safety, and responsive
horizontal-overflow checks at 1440px, 820px, and 390px.

The CI job provisions an isolated PostgreSQL database, applies the committed Lab 3
upgrade and seed, starts the API, and then lets Playwright start the Vite client through
`playwright.config.ts`. Seeded accounts use the CI-only `LAB3_SEED_INITIAL_PASSWORD`;
the tests rotate each account to `LAB3_E2E_PASSWORD` on first use and never print it.

Run locally after configuring a dedicated test database:

```text
npm ci --prefix server
npm run lab3:upgrade --prefix server
npm run build --prefix server
npm ci --prefix client
npm ci --prefix e2e
npm run test:lab3 --prefix e2e
```
