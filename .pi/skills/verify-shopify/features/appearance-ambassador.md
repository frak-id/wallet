# Appearance and ambassador page

Appearance (`/app/appearance`) sets the text customers see and links to the theme editor for the share button and banner. The Ambassador page screen (`/app/ambassador`) publishes, shows or hides the storefront page where customers sign up as ambassadors.

## Sub-features

- `appearance-tabs` `On your site` and `In the Frak app` (toggle buttons, `pressed` on the active one).
- `appearance-text` "Text shown to customers" with `Save Customizations` and `Discard`, plus the brand logo.
- `appearance-theme` "Share Button" and "Banner" sections, each with a button to the theme editor; their copy changes once the block is installed.
- `ambassador-live` the page address with `See my page` and `Copy address`, "Text and photo", and `Hide my page`.
- `ambassador-draft` "Turn your customers into ambassadors" with `Publish my page`.

## How to get to it (user POV)

- Admin app menu → Appearance.
- Admin app menu → Ambassador page.

## Driving it with verify-shopify.sh

Preconditions:

- `H doctor` and `H mocks` pass.

- **Appearance.** `open("/app/appearance")`. `heading "Appearance" [level=1]`, `button "On your site" [pressed]`, `heading "Share Button" [level=2]`, `button "Configure button in your product page"`.
- **Blocks installed.** `open("/app/appearance", { button: "1", banner: "1" })`. The Share Button and Banner sections show their installed state.
- **Frak app tab.** After `open("/app/appearance")`, `getByRole("button", { name: "In the Frak app" }).click()`, then `step()`. The tab becomes `[pressed]`.
- **Ambassador live / draft.** `open("/app/ambassador", { status: "live" })`: `button "See my page"`, `button "Hide my page"`. `{ status: "draft" }`: `button "Publish my page"`.

## Gotchas

- The real page saves with Shopify's `ui-save-bar`, an App Bridge element that only exists inside the admin; the harness does not show it.
- `hidden` and `oldPage` ambassador states exist in the scenario table but have no ready-made step; add them to `flows/scenarios.mjs` when a change touches them.
- The storefront page itself (`proxy/ambassador.liquid`) is not rendered: it is Liquid, served by Shopify's app proxy.
