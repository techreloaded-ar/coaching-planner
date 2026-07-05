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
