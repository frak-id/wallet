# Frak business verification map

This directory is the maintained source for verifying the user-facing behavior of the merchant dashboard (`apps/business`). Read this index before driving, then use the matching feature file as the recipe. The harness is `.pi/skills/verify-business/scripts/verify-business.sh`; `H` below stands for that path, `F` for `.pi/skills/verify-business/flows`.

## Baseline preconditions

- `H doctor` exits 0 with every line `ok`.
- Every run starts its own instance; never point a flow at a server you started by hand or at `bun run dev`.
- Demo mode: the flow starts on `/m/11111111-1111-1111-1111-111111111111/dashboard` ("E-Commerce Store", `shop.example.com`), Desktop Chrome 1280×900, `en-US`, all off-origin requests blocked.
- Demo campaigns for that merchant: `camp_001` "Summer Referral Campaign" (Ended, budget €5,000) and `camp_003` "Draft Campaign - Registration Focus" (Draft, weekly, budget cap 750 €). Other merchants: `22222222-…` Digital Media Platform, `55555555-…` Boutique (Empty Bank), Partner Marketplace.

## Driving conventions

- Prefer `getByRole` with the accessible names quoted in the feature files; confirm a name against the latest `*.aria.yml` before trusting it.
- Sidebar: `navigation` holding `link "My merchants"`, `button "Campaigns"` (expands `link "Data overview"` and `link "List"`), `link "Members"`, and under Preview `button "Wallet"`. Below 768px the items show icons only but keep these names, `Campaigns` becomes `link "Campaigns"` to the list, and its sub-items are hidden: `openFromSidebar(page, "<path suffix>")` from `flows/nav.mjs` works at every width.
- Header (`banner`): `navigation "Breadcrumb"`, `link "demo"` (to `/settings`), a page action (`link "Create new campaign"`, `link "Add a new merchant"`…), and the account button `button "E-Commerce Store"` (opens a `dialog` with `link "Settings"`, `button "Log out"`). A page action often exists twice (header and main): scope it with `getByRole("main")`.
- Names, URLs and flags are literal. `--locale fr-FR` changes every name.
- A failed drive writes `FAIL.png`, `FAIL.aria.yml` and the stack into `verdict.txt`, and exits 1. Exit 2 is a harness refusal (bad args, existing evidence dir, instance doctor failed).

## Proof and skip reporting

- UI proof: an ARIA snapshot plus a screenshot per meaningful step (`step()` does both), with the asserted state visible.
- Layout proof: `F/split-words.mjs` PASS at each width and locale claimed, or the screenshots of the specific screen at those widths.
- Record the feature ID, entry point, width and locale; the evidence directory name carries the flow name.
- Report an unreachable path with the command you ran and the unmet precondition. Do not report a skipped entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify-business.sh` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command or Playwright call and the observable result.
4. `Gotchas` lists traps that can waste or invalidate a run.

## Features

- [Campaign list](./campaigns-list.md) — status tabs, search, detail sheet.
- [Campaign wizard](./campaign-wizard.md) — create a campaign, resume a draft, walk the steps.
- [Settings](./settings.md) — currency, language, demo mode, from the header's demo badge.
- Layout across all of the above: the audit in [SKILL.md](../SKILL.md#layout-audit).

Not mapped yet (add a file when you first verify one): merchants dashboard and merchant edit tabs (`/m/$id/merchant`: Identity & SDK, Explorer App, Integration, Manage your team), funding (`Manage budget`), members and push notifications, campaign data overview (`/m/$id/campaigns`), billing, login (`--logged-out` reaches `/login`: `heading "Access and discover Frak Ad Manager"`, `button "Connect to Frak Ad Manager"`, `button "Email"`, `button "Shopify"`, none of which can complete offline).
