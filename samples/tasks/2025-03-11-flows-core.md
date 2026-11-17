---
id: 2025-03-11-flows-core
from: qa-lead
to: automation-engineer
status: done
created: 2025-03-11T09:00
cases: [auth-001, auth-002, auth-003, wallet-001, wallet-002, wallet-003, property-001, invest-001, invest-002, portfolio-001]
tickets: [TE-101, TE-102, TE-110, TE-111, TE-112, TE-120, TE-130, TE-131, TE-140]
---
## Ask
Automate the ready end-to-end cases with Maestro, tag them from `docs/cases/suites.json`, run each once, and list testIDs the app is missing.

## Result
- 10 flows under `e2e/flows/` (auth, wallet, property, invest, portfolio)
- `docs/qa-team/testid-requests.md`

## Evidence
- lint: `node runner/src/cli.ts lint` -> `lint: 10 flows, 30 app testIDs checked, 0 errors`
- run: runId `20250311T150000Z_auth-001_ios` ok on ios (recorded mode)
- run: runId `20250311T150000Z_wallet-003_ios` failed (app: balance 200.00 instead of 100.00)
- run: runId `20250311T150000Z_portfolio-001_ios` failed (app: portfolio not refreshed)
- not automated yet: wallet-004 and wallet-005 need a new testID (`topup-limit-message-text`); wallet-006 is blocked by C3

## Open questions
Two flows fail on their first run for app reasons. They are real findings, not flow problems, and are left failing (no skips).
