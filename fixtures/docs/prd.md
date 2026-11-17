# TokenEstate: Product Requirements (fake, for the demo)

Owner: Product (Jordan Lee). This is the highest-ranked source (see `docs/qa-team/source-hierarchy.md`).

### §1 Sign-in

§1.1 A user signs in with an e-mail address and a 6-digit code sent to it.
§1.2 A code is valid for 10 minutes after it is delivered. The user may request a new code at any time.
§1.3 A wrong code shows an error and keeps the user on the sign-in screen.

### §2 Wallet

§2.1 A signed-in user can top up the wallet by card. The new balance is shown after the top-up.
§2.2 A user can top up at most 5000 USD per day.
§2.3 A declined payment shows an error and leaves the balance unchanged.
§2.4 A payment confirmation that is delivered twice must credit the wallet once.

### §3 Property and investing

§3.1 A user can browse the list of properties.
§3.2 A property detail shows its name and the price per token.
§3.3 Before confirming a purchase the total price is shown.
§3.4 A purchase that costs more than the wallet balance is refused with a clear message.
§3.5 Amounts are rounded to two decimals, half up.

### §4 Portfolio

§4.1 The portfolio shows the user's holdings and their total value, and reflects a purchase right away.

### §5 Profile

§5.1 A signed-in user can sign out. After signing out, the previous session cannot read wallet data.
