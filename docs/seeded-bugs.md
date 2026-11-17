# Seeded bugs

The demo product has two deliberate bugs so the team has real findings. Both are marked `SEEDED BUG` in the source.

| # | Where | Symptom | Caught by | Ticket (fake) |
|---|---|---|---|---|
| 1 | `mock-backend/server.mjs`, `handleWebhook` | A duplicate payment webhook credits the wallet twice (top-up 100, balance 200). The backend skips event de-duplication. | `wallet-003` (backend mode `duplicate-webhook`) | TE-112 |
| 2 | `app/src/screens.tsx`, `PortfolioScreen` | The portfolio is cached on first load and never refreshed after a purchase, so it shows stale numbers until the app restarts. | `portfolio-001` | TE-140 |

Bug 1 can be switched off with `FIX_SEEDED_BUGS=1` for the backend (a unit test covers both behaviours). Bug 2 is fixed by calling the real `invalidatePortfolio` after a purchase.

The recorded nights also contain three failures that are **not** seeded bugs, to show the other failure classes: `auth-003` (env: slow OTP provider), `property-001` (driver: the simulator did not respond) and `invest-001` (suggested `selector`, doubtful: a person must decide whether the button is really missing or hidden).
