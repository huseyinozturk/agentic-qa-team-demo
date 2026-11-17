# Cases: API and unit (no framework selected yet, so the Automation engineer will not touch these)

## api-001: A repeated webhook is applied once
type: api | suite: critical | tickets: TE-112 | status: ready

1. Send the same payment confirmation twice. Source: API §3.1
2. Expect: the wallet is credited once. Source: PRD §2.4, TE-112 AC1

## api-002: Code validity boundary
type: api | suite: regression | tickets: TE-102 | status: ready

1. Verify a code 9 minutes and 11 minutes after delivery. Source: Clarification C1
2. Expect: accepted at 9 minutes, rejected at 11. Source: PRD §1.2

## api-003: Daily limit boundary
type: api | suite: regression | tickets: TE-160 | status: ready

1. Top up 5000 USD, then 1 USD. Source: Clarification C2
2. Expect: HTTP refusal and an unchanged balance. Source: TE-160 AC2, TE-160 AC3

## api-004: A webhook with a wrong signature is rejected
type: api | suite: regression | tickets: TE-113 | status: ready

1. Send a payment confirmation with a wrong signature. Source: TE-113 AC1
2. Expect: HTTP 401 and no credit. Source: TE-113 AC1

## unit-001: Rounding is half up
type: unit | suite: regression | tickets: TE-114 | status: ready

1. Round 0.125 and 0.124 to two decimals. Source: PRD §3.5
2. Expect: 0.13 and 0.12. Source: TE-114 AC1
