---
source-ticket: TE-160
status: draft
---

# Draft cases: daily wallet top-up limit (TE-160)

Recorded sample output. Every step names its source (ticket key and acceptance criterion).

## wallet-004: Top-up up to the daily limit succeeds (ready)

1. Sign in with a valid e-mail and code. Source: TE-101 AC1
2. Top up 5000 USD in one top-up. Source: TE-160 AC1
3. The wallet balance shows USD 5000.00 and a success message. Source: TE-160 AC1

## wallet-005: Top-up beyond the daily limit is refused (ready)

1. Sign in with a valid e-mail and code. Source: TE-101 AC1
2. Top up 5000 USD (succeeds). Source: TE-160 AC1
3. Top up 1 USD more; the message "Daily limit reached" is shown. Source: TE-160 AC2
4. The wallet balance is still USD 5000.00. Source: TE-160 AC3

## wallet-006: A declined payment and the daily total (blocked)

1. Sign in with a valid e-mail and code. Source: TE-101 AC1
2. Make a top-up that the provider declines. Source: TE-111 AC1
3. Top up 5000 USD; expected result depends on gap G1. Source: TE-160 AC1

## Gaps

- **G1** (blocks wallet-006): does a declined payment count towards the 5000 USD daily total? TE-160 comment c-3 asks this and the description and AC1-AC3 do not answer it. Ask the ticket owner; do not guess.
- **G2** (testID, for the automation engineer): the app has no testID for a "daily limit" message; `topup-error-text` exists and can carry it. Confirm with the app developer before automating wallet-005.
