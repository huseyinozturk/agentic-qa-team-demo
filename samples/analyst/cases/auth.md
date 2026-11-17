# Cases: sign-in

## auth-001: Sign in with e-mail and code
type: e2e-fe | suite: smoke | tickets: TE-101 | status: ready

1. Enter a valid e-mail and request a code. Source: PRD §1.1
2. Enter the delivered code. Source: PRD §1.1
3. Expect: the user is signed in and sees the wallet. Source: PRD §1.1, TE-101 AC1

## auth-002: A wrong code is rejected
type: e2e-fe | suite: regression | tickets: TE-101 | status: ready

1. Request a code and enter a wrong one. Source: PRD §1.3
2. Expect: an error is shown and the user stays on the sign-in screen. Source: PRD §1.3, TE-101 AC2

## auth-003: Sign in when the code arrives late
type: e2e-fe | suite: regression | tickets: TE-102 | status: ready

1. Request a code while delivery is slow. Source: TE-102 AC1
2. Expect: a "Code delivered" banner appears when the code arrives. [ui: otp-delivered-banner] Source: Design §3.1, TE-102 AC1
3. Enter the code. Expect: it is accepted, because it is valid for 10 minutes after delivery. Source: Clarification C1
