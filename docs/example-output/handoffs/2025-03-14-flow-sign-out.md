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
The Watcher saw TE-150 move to Ready for Test with the `e2e` label. The Analyst wrote the case (`docs/cases/profile.md`). Automate `auth-004` and add it to the regression suite.

## Result
- `e2e/flows/auth/auth-004-sign-out.yaml` (new; reuses `subflows/sign-in.yaml`; tag `regression`)

## Evidence
- lint: `node runner/src/cli.ts lint` -> `lint: 11 flows, 30 app testIDs checked, 0 errors`
- run: runId `20250314T100500Z_auth-004_ios` ok on ios (recorded mode)
- diff: `e2e/flows/auth/auth-004-sign-out.yaml`

## Open questions
`api-005` (the old session cannot read wallet data) needs an API test framework; not automated here.
