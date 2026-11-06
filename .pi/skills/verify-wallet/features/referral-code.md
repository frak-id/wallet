# Referral code

From Profile → Referrals a user can create their own 4-letter referral code (or have one generated) and redeem a friend's or creator's code; each form keeps its submit button disabled until the input is acceptable.

## Sub-features

- `referral-hub` shows `/profile/referral` with "Generate my code" and "Enter a referral code".
- `referral-create-gate` keeps "Generate my code" disabled until 4 letters are typed in "Customize your code".
- `referral-create-auto` offers "Generate automatically" as an alternative.
- `referral-redeem-gate` keeps "Apply the code" disabled until a code is typed in "Referral code".
- `referral-terms` links to FRAK's terms on both forms.

## How to get to it (user POV)

- Choose `Profile` in the tab bar, then `Referrals`.
- Choose the third welcome-carousel slide on `/wallet` ("Invite your friends to Frak").
- Choose `Back` on `/profile/referral/create` or `/profile/referral/redeem`.

## Driving it with verify-wallet.sh

Preconditions:

- `H doctor` is all `ok`.
- Default seeded session; the light mock answers `/user/wallet/referral/status` with no owned code.

- **Whole recipe.** Run `H flow spa .pi/skills/verify-wallet/flows/referral-code.mjs`. Verdict `PASS`, steps `01-referrals`, `02-create-filled`, `03-redeem-filled`.
- **Hub.** On `/profile`, `getByRole("link", { name: "Referrals" }).click()`. URL ends `/profile/referral`; `heading "Referrals" [level=1]`.
- **Create gate.** `getByRole("link", { name: "Generate my code" }).click()`. `heading "My referral code"`; `button "Generate my code"` is disabled; after `getByRole("textbox", { name: "Customize your code" }).fill("LOLA")` it is enabled.
- **Back.** `getByRole("button", { name: "Back" }).click()`. URL ends `/profile/referral`.
- **Redeem gate.** `getByRole("link", { name: "Enter a referral code" }).click()`. `heading "Got a referral code?"`; `button "Apply the code"` is disabled; after `getByRole("textbox", { name: "Referral code" }).fill("LOLA10")` it is enabled.
- **Proof.** The step screenshots show the filled input next to the enabled button.

## Gotchas

- Submitting either form calls the backend, which the light mocks do not answer, so the request is blocked and the UI shows its error path. To prove creation or redemption, mock the endpoint inside the flow, assert the request body, and say the backend was mocked.
- The create form and the hub both use the accessible name "Generate my code" (a link on the hub, a button on the form). Use the role to disambiguate.
- With a seeded owned code (`ownedCode` non-null in `/user/wallet/referral/status`) the hub renders differently; the light mock always returns `null`.
