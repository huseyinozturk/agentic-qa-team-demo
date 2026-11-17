---
id: 2025-03-14-nightly-report
from: qa-lead
to: runner
status: done
created: 2025-03-14T07:30
cases: []
tickets: []
---
## Ask
Morning report of the nightly regression: pass and fail, suggested failure classes with evidence, known findings, what changed since last night.

## Result
- `docs/qa-team/runs/2025-03-14-nightly.md`

## Evidence
- report: `docs/qa-team/runs/2025-03-14-nightly.md`
- counts: ios Pass: 5 / Fail: 5
- batch: `20250313T220000Z_regression_ios`

## Open questions
`invest-001` is suggested as `selector` ("Element not found: buy-confirm-button") but may be an app bug (the button may be hidden by the keyboard). A person should confirm.
