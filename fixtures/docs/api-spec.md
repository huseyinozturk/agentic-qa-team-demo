# TokenEstate: API specification (fake, for the demo)

Owner: Backend team (Sam Rivera). Second in the source hierarchy: it must follow the product requirements.

### §1 One-time codes

§1.1 `POST /otp/request` sends a code. `POST /otp/verify` checks it and returns a session token.
§1.2 A code is valid for 15 minutes after delivery.

### §2 Wallet

§2.1 `POST /wallet/topup` credits the wallet after the payment provider confirms.
§2.2 The daily top-up limit is 10000 USD per user.
§2.3 A declined payment returns HTTP 402 and does not change the balance.

### §3 Payment webhooks

§3.1 The provider may deliver a webhook more than once. The handler de-duplicates by event id.

### §4 Orders

§4.1 `POST /orders` buys tokens. It returns HTTP 409 when the balance is too low.
§4.2 The total is `tokens x price`, rounded to two decimals, half up.
