<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

NEVER read or modify `./.env` file unless the user explicitly asks it.

## E2E Playwright implementation rules

When adding or changing Playwright e2e tests, preserve the deterministic approach introduced in US-023:

- keep `fullyParallel: true`; do not fix flakiness by forcing `workers: 1`, serializing the whole suite, or increasing retries;
- tests that mutate data must use `tests/e2e/support/fixtures.ts` and factory-created collaborators, clients, offers, activity rows, months, or reserved km ranges instead of mutating seed entities such as Giulia Conti, TechSolutions, DataFlow, or seed scaglioni;
- select customers/offers by label or value derived from the factory, never with `selectOption({ index: ... })`;
- use reserved month helpers from `tests/e2e/support/date.ts` for report/monthly aggregations and reserved km helpers from `tests/e2e/support/reserved-resources.ts` for global `ScaglioneKm` data;
- avoid hard waits, Tailwind class selectors, and ambiguous partial navigation matches; prefer roles, labels, exact names, web-first `expect`, and minimal `data-testid` where needed;
- run `npm run lint` after e2e changes, because it includes the e2e anti-flakiness guardrail.

See `tests/e2e/README.md` for the full e2e testing contract.

## Archetipo Review rules

When running `/archetipo-review`, the review must include a **static CI impact assessment**. Do NOT contact GitHub, fetch workflow runs, or execute the pipeline — the goal is to predict, by reading, whether CI would break if the changes were approved:

- read `.github/workflows/ci.yml` and walk through its steps (install, prisma migrate/seed, lint, unit tests, build, e2e) against the diff under review;
- for each step, reason about whether the changes could make it fail — e.g. new dependencies not added to `package.json`, schema changes without a migration, seed data assumptions broken, lint rules violated (including the e2e anti-flakiness guardrail), type errors that would fail the build, or e2e tests relying on mutated seed entities;
- if any step is judged likely to fail, block approval and report which step and why in the rework feedback;
- document the assessment in the review notes: verdict (would pass / would fail / uncertain) plus a one-line rationale per step considered at risk.
