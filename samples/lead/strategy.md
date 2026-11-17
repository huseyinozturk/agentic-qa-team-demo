# Test strategy

Recorded sample of the QA Lead's output, written after reading all project documents and tickets.

## What was collected

- 3 documents, ranked: product requirements, API specification, design notes (`docs/qa-team/source-hierarchy.md`).
- 14 tickets in 7 areas: auth, wallet, property, invest, portfolio, profile, infra.

## Which test type for what

| Type | What it covers | Tickets |
|---|---|---|
| e2e-fe | User journeys through the app | 11 |
| api | Backend rules (code validity, webhooks, limits, sessions) | 5 |
| unit | Pure logic (rounding) | 1 |
| none | Infrastructure only | 1 |

Rule used: if a user can see or rely on it, it gets an end-to-end case; if the rule lives in the backend, it also gets an API case; if it is one pure function, it is a unit test.

## Suites and plan

- Suites are built from case tags: **smoke** (few, fast, the app is alive), **critical** (money and data integrity), **regression** (everything else).
- The Analyst proposes the members; **the owner approves** smoke and critical.
- Plan: smoke on every new build, regression every night, critical before a release; all on staging (`e2e/test-plan.json`).

## What happens next

Analyst writes cases per tag, Automation engineer automates the `e2e-fe` cases (the only framework selected so far is Maestro), Runner executes the plan.
