# Cases: profile (added after the Watcher saw TE-150 move to Ready for Test)

## auth-004: Sign out returns to the sign-in screen
type: e2e-fe | suite: regression | tickets: TE-150 | status: ready

1. Sign in and open the profile. Expect: the signed-in e-mail is shown. [ui: profile-email-text] Source: TE-150 AC1
2. Tap sign out. Expect: the sign-in screen is shown. [ui: sign-out-button, sign-in-title] Source: PRD §5.1, TE-150 AC2

## api-005: A signed-out session cannot read wallet data
type: api | suite: regression | tickets: TE-150 | status: ready

1. Sign out, then call the wallet endpoint with the old session. Source: PRD §5.1
2. Expect: HTTP 401. Source: TE-150 AC3
