---
id: 2025-03-10-cases-core
from: qa-lead
to: analyst
status: done
created: 2025-03-10T10:00
cases: [auth-001, wallet-001, invest-001]
tickets: [TE-101, TE-110, TE-130, TE-160]
---
## Ask
Write cases for every ticket tagged `e2e-fe`, `api` or `unit` in the strategy. Use the source hierarchy. Where sources disagree, draft a clarification. Propose the smoke, critical and regression suites.

## Result
- `docs/cases/auth.md`, `docs/cases/wallet.md`, `docs/cases/property-invest-portfolio.md`, `docs/cases/api-unit.md`
- `docs/cases/suites.json` (proposed smoke and critical members)
- `docs/cases/clarifications.md` (three questions)

## Evidence
- cases: 13 end-to-end cases (12 ready, 1 blocked), 4 API cases, 1 unit case; every step and expectation names a source
- conflicts found: C1 (code validity: product says 10 min, API spec says 15), C2 (daily limit: 5000 vs 10000)
- open question: C3 (declined payments and the daily total), blocks `wallet-006`
- sources opened: `PRD §1.2` and `API §1.2` (disagree); `PRD §2.2` and `API §2.2` (disagree)

## Open questions
C3 for Product. The API specification owner must fix the two numbers.
