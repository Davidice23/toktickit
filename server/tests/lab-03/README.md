# Lab 3 server test harness

These files are the test entry points required by `docs/lab-03/tests.md`.
The Contract PR is approved, but the Lab 3 application features are not yet
implemented. Each placeholder test is intentionally marked `todo` so the
baseline CI remains honest and does not claim unrun behavior passes.

Integration tests must use `LAB3_TEST_DATABASE_URL` (or the test-only
`DATABASE_URL`) and must never connect to a personal or production database.
The migration/seed suites will call the same `npm run lab3:upgrade` path used
by the final evidence once the migration issue implements it.
