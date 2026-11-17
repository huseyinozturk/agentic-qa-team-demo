# Cases: properties, investing, portfolio

## property-001: Browse a property and open its detail
type: e2e-fe | suite: smoke | tickets: TE-120 | status: ready

1. Sign in and open the property list, then open the first property. Source: PRD §3.1
2. Expect: the name and the price per token are shown. Source: PRD §3.2, TE-120 AC2

## invest-001: Buy tokens with the wallet balance
type: e2e-fe | suite: smoke | tickets: TE-130 | status: ready

1. Top up 500 USD, open a property and enter 10 tokens. Source: PRD §3.3
2. Expect: the total (250.00) is shown before confirming. Source: PRD §3.3, TE-130 AC1
3. Confirm the purchase. Expect: a success message. [ui: buy-confirm-button] Source: Design §1.1, TE-130 AC3

## invest-002: A purchase without enough balance is refused
type: e2e-fe | suite: critical | tickets: TE-131 | status: ready

1. With an empty wallet, enter 5 tokens and confirm. Source: PRD §3.4
2. Expect: the message "Insufficient balance" is shown. Source: Design §2.2, TE-131 AC1

## portfolio-001: The portfolio reflects a purchase right away
type: e2e-fe | suite: critical | tickets: TE-140 | status: ready

1. Open the empty portfolio, buy 10 tokens, open the portfolio again. Source: PRD §4.1
2. Expect: the total shows 250.00 without restarting the app. Source: PRD §4.1, TE-140 AC1
