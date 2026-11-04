# Install page

The standalone `/install` page (also served at `/i`, the short ambassador QR path) runs after a shopper taps "install" from a merchant: it mints an install code from the forwarded credential, copies it, and hands the shopper to the app store or back to the host app, telling them how much they stand to keep.

## Sub-features

- `install-code` shows the minted code (e.g. `LOLA10`) and copies it before the store handoff.
- `install-store` offers "Download the app" with a store URL carrying `merchantId` and `anonymousId` as the referrer (Play Store on Android, App Store on iOS).
- `install-refused` falls back to the store link alone when the code request is refused.
- `install-native` reports the outcome to a native host through `returnScheme` (`action=code`).
- `install-i18n` renders in `en` and `fr` (`lng` param), with or without an advertisable reward.
- `install-short` accepts compact `m`/`a` on `/i` and derives a missing `a` from the proof.

## How to get to it (user POV)

- Tap install in a merchant site or app embedding the Frak SDK (`/install?m=…&a=…[&embed=native&returnScheme=…&sid=…]`).
- Scan an ambassador QR (`/i?m=…[&a=…]`).
- Scan a short referral QR `/r/<CODE>`: nginx 302s to `/install?ref=` in production; `serve-standalone.ts` does not reproduce `/r/`, so that redirect is not drivable here.

## Driving it with verify-wallet.sh

Preconditions:

- `H doctor` is all `ok`.
- Surface `standalone`, `--logged-out` (a seeded session routes a web visit to the processing screen instead).

- **Full behavior set.** Run `H check -- --project=standalone install.check`. Verdict `PASS`, 22 specs (code, refused credential, native handoff, en/fr, no-reward) listed in `playwright.log`.
- **Refused-code fallback, as a flow.** Write `/tmp/install.mjs` that does `page.goto(url + "/install?m=550e8400-e29b-41d4-a716-446655440000&a=x&lng=en", { waitUntil: "commit" })`, then run `H flow standalone /tmp/install.mjs --logged-out`. With the code endpoint blocked: `heading "Don't lose your 12 €!" [level=1]` and `link "Download the app"` whose `href` starts with `https://play.google.com/store/apps/details?id=id.frak.wallet.dev&referrer=merchantId%3D550e…`.
- **Code path, as a flow.** Use `a=550e8400-e29b-41d4-a716-446655440001` (the mock client id) and, before the `goto`, `page.route("**/*/user/identity/install-code/generate", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: "LOLA10", expiresAt: new Date(Date.now() + 72 * 3600e3).toISOString() }) }))`; `page.waitForRequest` on that URL resolves and the code `LOLA10` becomes visible.
- **Proof.** `step()` after the code or fallback renders; for the code path assert the `install-code/generate` request with `page.waitForRequest`.

## Gotchas

- The device decides the store: the default Pixel 7 yields a Play Store link; `--desktop` or an iPhone viewport changes the CTA. State which device the proof used.
- A 403 from `install-code/generate` is terminal (store link only); a 5xx retries. A blocked request behaves like a network failure, not a refusal — mock 403 explicitly to prove `install-refused`.
- `/install` copies the code to the clipboard before the handoff; the harness grants clipboard permission, a real denial is not exercised.
- `/i` is served by `serve-standalone.ts` as `install.html`, same as nginx; `/r/` is not.
