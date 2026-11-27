# Campaigns

The merchant's campaigns in a Polaris table, on the Campaigns page and on the home dashboard: name, status, date, budget, rewards and per-status actions. Campaigns are created and edited in the Frak business dashboard, which the buttons open in a new tab.

## Sub-features

- `table` one row per campaign with status badge, date, budget (with its reset date for a recurring budget), rewards per recipient, and actions.
- `row-actions` `Pause` + `Archive` for an active campaign, `Resume` + `Archive` for a paused one, `Delete` for a draft, `View details` for all.
- `distribution-badge` a second status badge when the bank cannot pay rewards (for example "No funds" when `distribution=depleted`).
- `header-actions` `View all campaigns` and `Create new campaign`, both opening the business dashboard.

## How to get to it (user POV)

- Admin app menu → Campaigns.
- The home page once setup is done (`Campaigns` section under the newsletter link).

## Driving it with verify-shopify.sh

Preconditions:

- `H doctor` and `H mocks` pass.

- **Table.** `open("/app/campaigns")`. `heading "Campaigns" [level=1]`; `getByRole("grid")` holds 3 rows: "Parrainage printemps" (Active), "Offre fidélité" (Paused, weekly budget with a reset date), "Brouillon soldes d'été" (Draft).
- **Actions.** In the same grid: `button "Pause"`, `button "Resume"`, `button "Delete"`, three `button "View details"`.
- **Depleted bank.** `open("/app/campaigns", { distribution: "depleted" })`. The active row shows a second badge ("No funds").
- **Layout.** `VERIFY_ONLY=campaigns H flow F/overflow.mjs --locale fr`. `PASS`; a failure names `s-table > s-internal-scroll-box > div.scroll` with the content and box widths.

## Gotchas

- Polaris table cells never wrap: a long budget or reward text widens the whole table, which then scrolls inside its card with no visible scrollbar and cuts the Actions column. That is the regression the layout audit was built on (`campaigns-budget-depleted`, French, 1040px).
- Action buttons submit to the route action; in the harness nothing happens and no row changes.
- Dates use the browser's locale (`toLocaleDateString`), not i18next's. The driver sets both from `--locale`, so they match in the harness.
