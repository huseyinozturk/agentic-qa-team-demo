# Cases: wallet

## wallet-001: Top up the wallet
type: e2e-fe | suite: smoke | tickets: TE-110 | status: ready

1. Sign in, open the wallet and top up 100 USD. [ui: topup-amount-input, topup-submit-button] Source: PRD §2.1
2. Expect: the new balance is USD 100.00 and a success message is shown. Source: PRD §2.1, TE-110 AC1

## wallet-002: A declined payment shows an error
type: e2e-fe | suite: regression | tickets: TE-111 | status: ready

1. Top up while the payment provider declines. Source: PRD §2.3
2. Expect: the message "Payment declined" is shown. [ui: topup-error-text] Source: Design §2.1
3. Expect: the balance is unchanged. Source: PRD §2.3, TE-111 AC1

## wallet-003: A repeated payment confirmation credits once
type: e2e-fe | suite: critical | tickets: TE-112 | status: ready

1. Top up 100 USD while the provider delivers the confirmation twice. Source: PRD §2.4, API §3.1
2. Expect: the balance is USD 100.00, not 200.00. Source: PRD §2.4, TE-112 AC1

## wallet-004: A top-up up to the daily limit succeeds
type: e2e-fe | suite: regression | tickets: TE-160 | status: ready

1. Top up exactly the daily limit of 5000 USD. Source: Clarification C2
2. Expect: the top-up succeeds. Source: TE-160 AC1

## wallet-005: A top-up beyond the daily limit is refused
type: e2e-fe | suite: regression | tickets: TE-160 | status: ready

1. Top up 5000 USD, then 1 USD more. Source: Clarification C2
2. Expect: the message "Daily limit reached" is shown. [ui: topup-limit-message-text] Source: TE-160 AC2
3. Expect: the balance is still USD 5000.00. Source: TE-160 AC3

## wallet-006: A declined payment and the daily total
type: e2e-fe | suite: regression | tickets: TE-160 | status: blocked by C3

1. Make a top-up that the provider declines, then top up the full limit. Source: PRD §2.3
2. Expect: not written yet, it depends on the open question. Source: Clarification C3
