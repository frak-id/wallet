# Wallet home

The wallet home (`/wallet`) shows the user's rewards in EUR with a "Transfer to my bank" action, Pending and Lifetime stat cards that explain themselves when empty, a dismissible welcome carousel, and the earnings history, which sends a new user to the explorer.

## Sub-features

- `home-render` shows the `Wallet` heading, the Rewards amount, both stat cards and the `Earnings history` section.
- `home-pending-empty` opens "You don't have any earnings yet" from the Pending card when nothing is claimable.
- `home-lifetime-empty` opens "You haven't transferred any earnings yet" from the Lifetime card when the total is 0.
- `home-transfer-empty` opens "You don't have any money to transfer yet" from "Transfer to my bank" when the balance is 0.
- `home-welcome` shows a 3-slide carousel (welcome, notifications, referral) whose first card has a `Close` button.
- `home-discover` leads from the empty earnings history to `/explorer` via "Discover offers".

## How to get to it (user POV)

- Open the app while logged in: `/` lands on `/wallet`.
- Choose `Wallet` in the bottom tab bar from any protected page.
- Choose `Back` on `/history` or `/tokens/send`.

## Driving it with verify-wallet.sh

Preconditions:

- `H doctor` is all `ok`.
- Default seeded session (do not pass `--logged-out`).

- **Whole recipe.** Run `H flow spa .pi/skills/verify-wallet/flows/wallet-home.mjs`. Verdict `PASS`, steps `01-wallet` … `05-explorer`. The flow answers `/user/wallet/balance` with a zero balance itself, because the empty-state dialogs below need one.
- **Render.** `page.goto(url + "/wallet")`, then `expect(getByRole("heading", { name: "Wallet", level: 1 })).toBeVisible()`. With the light mocks the Rewards card reads `12 ,50 EUR` and the Lifetime card is `button "€12.50 Lifetime"` (see Gotchas).
- **Pending card.** `getByRole("button", { name: "€0 Pending", exact: true }).click()`. `dialog "You don't have any earnings yet"` is visible; its `Close` button hides it.
- **Lifetime card.** `getByRole("button", { name: "€0 Lifetime", exact: true }).click()`. `dialog "You haven't transferred any earnings yet"` with a `Got it` button.
- **Transfer.** `getByRole("button", { name: "Transfer to my bank" }).click()`. `dialog "You don't have any money to transfer yet"` with a `Discover offers` button.
- **Welcome carousel.** The first slide is `button "Close Welcome in your wallet …"` with a nested `button "Close"`; slide dots are `button "Slide 1 of 3"` … `"Slide 3 of 3"`.
- **Discover offers.** `getByRole("link", { name: "Discover offers" }).click()`. URL ends `/explorer` and `heading "Explorer" [level=1]` is visible.
- **Tab entry.** From `/profile`, `getByRole("navigation", { name: "Tab navigation" }).getByRole("link", { name: "Wallet", exact: true }).click()`. URL ends `/wallet`.
- **Proof.** The `step()` screenshots + ARIA files after each dialog and after the explorer lands.

## Gotchas

- Amounts are drivable in mocked mode (FRA-336). The Rewards and Lifetime figures read `userBalance.total.eurAmount` from a query keyed on the wagmi address. The light RPC mock answers the smart account's address lookup, so wagmi connects and the query runs. The default mock is `12.5` EUR. Override `/user/wallet/balance` with `{ total: { amount, eurAmount, usdAmount, gbpAmount }, balances: [] }` for another amount. With `--real-dev` the flow's override still applies; the skill's test account has 0 € on dev anyway.
- The light suite mocks the arbitrum-sepolia RPC, so `network.log` lists a few `200 POST https://sepolia-rollup.arbitrum.io/rpc` lines instead of hundreds of blocked ones.
- `/user/merchant/explore` is not in the light mocks, so the explorer list stays empty in mocked mode. Under `--real-dev` it lists the real dev merchants (logos from `cdn.gcp.frak.id/images-staging`).
- The welcome carousel's first card is itself a `role="button"` wrapping a real `Close` button, so `getByRole("button", { name: "Close" })` is ambiguous on this page: scope it to a dialog or to the card.
- The TanStack Router / Query devtools buttons are drawn bottom-left/right in `vite dev` and overlap the tab bar in screenshots; they are not part of the product.
