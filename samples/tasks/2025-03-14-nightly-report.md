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
Run the plan, then send the morning report: results per test, suggested failure classes with evidence, and how the host behaved (CPU, memory, swap, disk, duration).

## Result
- `docs/qa-team/runs/2025-03-14-nightly.md`

## Evidence
- report: `docs/qa-team/runs/2025-03-14-nightly.md`
- counts: ios Pass: 5 / Fail: 5
- batch: `20250313T220000Z_regression_ios`
- host: swap 6.2 GB, minimum free memory 610 MB, peak CPU 96 percent (see the System section)

## Open questions
`invest-001` is suggested as `selector` but may be an app bug (button hidden by the keyboard). A person should confirm.
