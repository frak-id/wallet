# Sharing page

The standalone `/sharing` page lets a shopper share a merchant link and see what they earn per referred purchase. Plain web visits get a centred card; the native iOS/Android SDK sheets load it chromeless with `embed=native` and receive results through a custom-scheme `returnScheme`.

## Sub-features

- `sharing-web` renders the card for a plain web visit: merchant reward, "Share with your friends", three how-it-works items, FAQ, footer "Copy link".
- `sharing-faq` expands an FAQ answer in place.
- `sharing-native` renders full-bleed (no card) when `embed=native`, at every sheet viewport.
- `sharing-warm` loads empty (`state=warm`) and fills in when the host sets the fragment (`#sid=…&state=live&link=…&products=…`), replacing rather than merging a previous activation.
- `sharing-no-reward` renders without an amount when the merchant has no campaign.

## How to get to it (user POV)

- Tap share in a merchant site that uses the web SDK (opens `/sharing?merchantId=…&link=…`).
- Tap share in an app embedding the native SDK (sheet loads `/sharing?…&embed=native&clientId=…&returnScheme=…&sid=…`).
- Inside the Tauri app or after a client-side navigation, the SPA route renders the same `SharingView` — not drivable here (different build).

## Driving it with verify-wallet.sh

Preconditions:

- `H doctor` is all `ok`.
- Surface `standalone`, `--logged-out`. URL params use the mock merchant `550e8400-e29b-41d4-a716-446655440000`.

- **Web visit.** Run `H flow standalone .pi/skills/verify-wallet/flows/sharing-web.mjs --logged-out`. Verdict `PASS`, steps `01-sharing`, `02-faq-open`.
- **Render.** `page.goto(url + "/sharing?merchantId=550e…0000&link=https%3A%2F%2Facme.example.com", { waitUntil: "commit" })`. Inside `getByRole("dialog")`: `heading "Share with your friends"` and text `Earn 12 €, on every purchase!`.
- **FAQ.** `dialog.getByRole("button", { name: "How much can I earn?" }).click()`. The button gets `aria-expanded="true"`.
- **Native sheet, warm/activate, no-reward, viewports.** Run `H check -- --project=standalone sharing.check`. 30 specs pass (2026-10-12); `playwright.log` lists each by name.
- **Proof.** For the flow: the two step screenshots + ARIA. For the check: `verdict.txt` + `playwright.log`; failure artifacts land in `test-results/`.

## Gotchas

- `/sharing` exists in two builds. Always use surface `standalone` (or the check's `standalone` project); the SPA route is a different bundle.
- With `returnScheme` set, the page pings `<scheme>://result?action=ready` and Chromium never fires `load`. Navigate with `waitUntil: "commit"`. Custom-scheme results are not visible to `page.route`; use `recordHostResults` from `tests-light/mocks/nativeHost.ts` (as `sharing.check.ts` does) to assert them.
- Logged out, the footer `Copy link` button renders disabled.
- The reward amount appears only after the merchant and reward queries settle; wait on the amount text, not on a fixed delay or `networkidle`.
- Merchant ids must be lower-case UUIDs or the link silently resolves to null and the CTA branches go unexercised (asserted in `tests-light/mocks/api.ts`).
