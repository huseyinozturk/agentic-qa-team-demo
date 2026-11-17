---
id: 2025-03-14-flow-sign-out
from: qa-lead
to: automation-engineer
status: done
created: 2025-03-14T09:30
cases: [auth-004]
tickets: [TE-150]
---
## Ask
Automate sign-out (TE-150 AC1 and AC2): after signing in, open the profile, check the e-mail, sign out and expect the sign-in screen. Regression tag only.

## Result
- `e2e/flows/auth/auth-004-sign-out.yaml` (new; reuses `subflows/sign-in.yaml`; tag `regression`)

## Evidence
- lint: `node runner/src/cli.ts lint` -> `lint: 11 flows, 30 app testIDs checked, 0 errors`
- run: runId `20250314T100500Z_auth-004_ios` ok on ios (recorded mode)
- diff: `e2e/flows/auth/auth-004-sign-out.yaml`

## Open questions
TE-150 AC3 (the old session cannot see wallet data after sign-out) needs an API-level check; not automated here.
