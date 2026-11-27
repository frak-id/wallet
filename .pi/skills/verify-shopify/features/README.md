# Shopify app verification map

The maintained source for verifying the screens of the Frak Shopify app (`apps/shopify`). Read this index, then use the matching feature file as the recipe. `H` below is `.pi/skills/verify-shopify/scripts/verify-shopify.sh`, `F` is `.pi/skills/verify-shopify/flows`.

## Baseline preconditions

- `H doctor` is all `ok`, and `H mocks` passes: otherwise screens render from data the loaders can no longer return.
- Every recipe runs inside `H flow`, which starts and stops its own server. Never drive a server you did not start.
- Network access to `cdn.shopify.com` (Polaris). Everything else off-origin is blocked.

## Driving conventions

- Reach a screen with `open(path, scenario)`; the scenario params are in the SKILL.md table. There is no admin navigation menu, so `open` is the entry point even where a merchant would click the admin sidebar.
- Prefer ARIA roles and names. Polaris tables are `grid`; buttons, tabs and fields sit in shadow DOM, which `getByRole` pierces.
- Names below are English (`--locale en`, the default). A flow run with `--locale fr` needs the French names from `apps/shopify/app/i18n/locales/fr/translation.json`.
- Buttons that call a loader action (pause, publish, fund, connect) render but do nothing: there is no server.

## Proof and skip reporting

- A screen proof is the screenshot and ARIA snapshot of `step()`, with the scenario, width and locale named.
- The harness proves rendering from mock data. Report an action, a redirect or an admin-only behaviour as not verified, with the reason "no server in the harness".
- Report a scenario the harness cannot express (for example a loader state `main.tsx` does not model) as unverified, and add the scenario rather than reporting a neighbouring one.

## Feature entry contract

Each feature file starts with an H1 and one paragraph, then four H2s in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-shopify.sh`, `Gotchas`.

## Features

- [Setup guide and settings](./setup-guide.md): the 7-step onboarding guide on the home page, the legacy-theme manual install, and the settings page.
- [Campaigns](./campaigns.md): the campaign table on the home page and on Campaigns, and its bank distribution warnings.
- [Funding](./funding.md): the reward budget, bank states, purchase form and purchase list.
- [Appearance and ambassador page](./appearance-ambassador.md): customer-facing text, share button and banner, and the ambassador page states.
- [Pages outside the admin](./outside-admin.md): the post-payment purchase page and the login page.
