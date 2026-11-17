---
id: 2025-03-14-case-topup-limit
from: qa-lead
to: analyst
status: done
created: 2025-03-14T08:45
cases: [wallet-004, wallet-005, wallet-006]
tickets: [TE-160]
---
## Ask
Draft cases for the daily top-up limit. Every step needs a named source. Mark cases that cannot be written without an answer as blocked and name the gap.

## Result
- `docs/cases/drafts/te-160-topup-limit.md`: wallet-004 (ready), wallet-005 (ready), wallet-006 (blocked by G1)

## Evidence
- draft: `docs/cases/drafts/te-160-topup-limit.md`
- sources opened: `TE-160 AC2` = "refused with the message Daily limit reached"; `TE-160 comment c-3` = "does a declined payment count towards the daily total? Not answered in the spec."
- gaps: G1 (declined payments and the daily total), G2 (which testID carries the limit message)

## Open questions
G1 for the ticket owner. G2 for the app developer. No guesses were made.
