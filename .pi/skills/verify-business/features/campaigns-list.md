# Campaign list

The merchant's campaigns in one table, filtered by status tabs and a search box; clicking a campaign opens its detail sheet over the list, with funnel, ambassadors and configuration tabs and, for a draft, a link back into the wizard.

## Sub-features

- `list-table` shows one row per campaign with status, published and end dates, sharing rate, CTR, revenue and budget.
- `list-status-tabs` filters by `All`, `Active`, `Paused`, `Draft`, `Ended`, `Archived` (`tablist "Filter campaigns by status"`).
- `list-search` narrows the rows to titles matching `textbox "Search"`.
- `list-details-sheet` opens `dialog "<campaign title>"` and sets `?campaign=<id>` in the URL.
- `list-row-actions` opens a row menu from `button "Actions for <campaign title>"`.

## How to get to it (user POV)

- Sidebar `Campaigns` → `List`.
- Header `Breadcrumb` → `Campaigns` from any campaigns page.
- A link to `/m/$id/campaigns/list?campaign=<id>` opens the list with that sheet already open.

## Driving it with verify-business.sh

Preconditions:

- `H doctor` is all `ok`; demo mode (default).

- **Whole recipe.** `H flow F/campaigns-list.mjs`. Verdict `PASS`, steps `01-list`, `02-draft-tab`, `03-search`, `04-details-sheet`.
- **Open.** `openFromSidebar(page, "/campaigns/list")`. `heading "List" [level=1]`; the table's second rowgroup holds 2 rows.
- **Status tab.** `getByRole("tab", { name: "Draft" }).click()`. The tab has `aria-selected="true"`; every row contains `Draft`.
- **Search.** Back on `All`, `getByRole("textbox", { name: "Search" }).fill("Summer")`. One row, "Summer Referral Campaign".
- **Detail sheet.** `getByRole("cell", { name: "Summer Referral Campaign", exact: true }).click()`. URL gains `?campaign=camp_001`; `dialog` shows "Summer Referral Campaign", "5550 ambassadors", tabs `Funnel & ROI`, `Ambassadors`, `Configuration`, and `button "Close campaign details"`.

## Gotchas

- Each row's last cell is named `Actions for <title>`, so a non-exact `getByRole("cell", { name: "<title>" })` matches two cells.
- The sheet is a `dialog` drawn over the list; the list stays in the ARIA tree underneath.
- Demo data has only two campaigns for merchant `1111…`; status tabs other than `All`, `Draft` and `Ended` show an empty table.
