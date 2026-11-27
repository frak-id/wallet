# Funding

The Funding page shows the shop's reward budget (the Frak bank): whether rewards are distributed, each token's balance with Frak fees and VAT, the form to buy more budget through Shopify billing, and the purchases already made.

## Sub-features

- `budget` "Reward Budget" with the distribution state, a "Login with Frak" banner (the wallet is never connected in the harness), and one card per token with its balance split.
- `bank-states` paused rewards, a spending limit below the balance, an empty bank, a bank not deployed yet.
- `purchase-form` "Purchase" with the amount field and `Fund bank`.
- `purchase-list` "Active Purchases" table: amount, status, transaction hash, date, and `Confirm` for a purchase awaiting the merchant's approval.

## How to get to it (user POV)

- Admin app menu → Funding.
- The `funding page` link on the purchase page after a payment.

## Driving it with verify-shopify.sh

Preconditions:

- `H doctor` and `H mocks` pass.

- **Every state.** `VERIFY_ONLY=funding H flow F/screens.mjs`. Steps `funding`, `funding-rewards-paused`, `funding-limit-too-low`, `funding-empty-no-purchase`, `funding-bank-not-deployed`.
- **Open bank.** `open("/app/funding")`. `heading "Funding" [level=1]`, `heading "Reward Budget" [level=2]`, `button "Login with Frak"`, the EUR card "1 875 €", `heading "Active Purchases" [level=2]` with 3 rows and `button "Confirm"`.
- **Not deployed.** `open("/app/funding", { bank: "undeployed", purchases: "none" })`. "Reward Budget" and "Purchase" headings, no token cards.

## Gotchas

- Balances come from `harness/useMerchantBank.mock.ts`, not the chain: 1 250 in the first stablecoin, 0 in the others, a 5 000 limit (1 000 with `bank=lowlimit`).
- The confirmed purchase's 66-character transaction hash makes the purchase table the widest one in the app: it is the first to overflow when a column label grows.
- `Fund bank`, `Confirm` and `Login with Frak` need a server or a wallet; they render but do nothing.
