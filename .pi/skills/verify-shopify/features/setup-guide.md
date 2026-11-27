# Setup guide and settings

The home page (`/app`) shows a 7-step setup guide until the shop is fully connected, then the dashboard. Settings (`/app/settings`) shows the shop's Frak connection, the same steps, the app pixel and the webhooks.

## Sub-features

- `guide-steps` the 7 steps in order: connect the shop, app pixel, Shopify webhook, Frak webhook, theme app embed, share button, banner; done steps are disabled, the next one is expanded.
- `guide-progress` "N of 7 tasks completed" with a progress bar.
- `legacy-install` on a theme without app blocks, a "Manual installation" section with snippets to copy.
- `settings-status` "Your Shop on Frak", the setup steps still to do, "Application pixel" and "Active Webhooks".

## How to get to it (user POV)

- Open the Frak app in the Shopify admin: the home page.
- Admin app menu → Settings.

## Driving it with verify-shopify.sh

Preconditions:

- `H doctor` and `H mocks` pass.

- **Every step.** `VERIFY_ONLY=home-onboarding H flow F/screens.mjs`. Steps `01-home-onboarding-step1` to `07-home-onboarding-step7`.
- **First step.** `open("/app", { onboarding: "1" })`. `heading "Frak configuration" [level=1]`, `heading "Setup guide" [level=2]`, text "0 of 7 tasks completed", `button "Register your shop in the Frak ecosystem"`.
- **Middle step.** `open("/app", { onboarding: "4" })`. `button "Register your shop in the Frak ecosystem" [disabled]` (done) and `button "Connect Frak purchase tracker"` (next).
- **Legacy theme.** `open("/app", { theme: "legacy" })`. `heading "Manual installation" [level=2]`, `button "Copy snippet"`, `button "Edit theme.liquid"`.
- **Settings.** `open("/app/settings", { onboarding: "2" })`. `heading "Settings" [level=1]`, `heading "Your Shop on Frak" [level=3]`, `heading "Setup guide" [level=3]`.

## Gotchas

- `onboarding=N` means steps 1 to N-1 are done. Steps 6 and 7 only decide which theme blocks are present, so `onboarding=7` already shows the dashboard with a reminder for the banner, not the guide.
- The "Register" and "Connect" buttons call loader actions; clicking them changes nothing in the harness.
- The legacy-theme snippet is a `pre` that scrolls sideways on purpose; the layout audit ignores it.
