---
name: verify-shopify
description: Render the Frak Shopify app's real screens (apps/shopify — setup guide, home, campaigns, funding, appearance, ambassador page, settings, and the purchase and login pages outside the admin) in headless Chromium without a store, the Shopify CLI or the admin, and capture proof. The route components are the real ones; server modules are stubbed and loader data is typed mock data, checked against the real loaders. Includes a check that every screen renders and a layout check that fails when a table is wider than its card. Use to prove a Shopify UI or copy change, reproduce a layout bug, or compare two checkouts screen by screen.
---

# Verify the Frak Shopify app

One harness, `.pi/skills/verify-shopify/scripts/verify-shopify.sh`, run from anywhere in the repo. Every drive is one invocation that starts its own vite server, proves the server is the one it started, drives it, writes evidence, and kills exactly what it started.

Read [`features/README.md`](features/README.md) before driving: it maps each screen to its scenarios, recipe and proof.

## What this harness is (and is not)

- **Surface.** The route modules of `apps/shopify` (`app/routes/*.tsx`), mounted client-side in a React Router memory router by `harness/main.tsx`, served by vite with `apps/shopify` as root. The page components, hooks, i18n and Vanilla Extract styles are the app's own. Polaris web components load from `POLARIS_URL` (`app/utils/polaris.ts`), Shopify's CDN.
- **Server code never runs.** Every `*.server*` module and `@shopify/shopify-app-react-router/server` is replaced by a stub (`harness/vite.config.mjs`). The one exception is `auth.login/error.server.tsx`, a pure function that the harness runs for real.
- **Loader data is mock data, selected by URL query.** `harness/main.tsx` returns fixed data per route, typed with `satisfies` against each real loader's return type. `useMerchantBank` (an RPC multicall) is swapped for `harness/useMerchantBank.mock.ts`. The query parameters are listed in [Scenarios](#scenarios).
- **Hermetic except for Polaris.** The driver blocks every request outside the app origin and `cdn.shopify.com`, and lists each in `network.log`. The Frak SDK's merchant-config fetch and wallet iframe are among them, so the "Failed to fetch merchant config" warnings in `console.log` are expected. The run needs network access to `cdn.shopify.com`.
- **Not covered:** the admin frame (title bar, App Bridge navigation, `ui-save-bar`), loaders and actions (pausing a campaign, publishing the ambassador page, funding), real bank balances (fixed per scenario), a connected Frak wallet (always disconnected), theme blocks and app embeds (`extensions/theme-components`), the checkout post-purchase extension, the storefront ambassador page (`proxy/ambassador.liquid`). Also not this skill: `apps/business` (use `verify-business`), `apps/wallet` (`verify-wallet`), `apps/listener` (`verify-listener`).

## Doctor

Run first, and whenever anything looks off. Read-only.

```bash
.pi/skills/verify-shopify/scripts/verify-shopify.sh doctor [--tree DIR]
```

No line may be `FAIL` (exit 0). It checks bun, `vite` in `apps/shopify`, the built SDK (`bun run build:sdk`: the Shopify app imports `@frak-labs/core-sdk`), `@playwright/test` and its Chromium (borrowed from `apps/wallet`), and that every app module `harness/main.tsx` imports still exists. A missing browser is fixed with `(cd apps/wallet && bunx playwright install chromium)`.

### Mock drift

```bash
.pi/skills/verify-shopify/scripts/verify-shopify.sh mocks [--tree DIR]
```

Type-checks `harness/main.tsx` and `harness/useMerchantBank.mock.ts` against the real route loaders (about 5 s). Exit 1 means a loader changed shape: update the mock data in `harness/main.tsx` until it passes, or a screen renders from data the app can no longer produce. Run it after touching a loader, a `services.server` return type, or a backend schema the Shopify app reads.

Each `flow` run also does an instance doctor: the listening port's process group must be the server it launched, and the page `<title>` must be `verify-shopify harness`. Otherwise it refuses and exits 2. `instance.txt` records the URL, server pid, tree, commit and dirty file count.

## Launch + drive

```bash
.pi/skills/verify-shopify/scripts/verify-shopify.sh flow <flow.mjs> [--tree DIR] [--locale en|fr] [--width N] [--evidence DIR]
```

- Launch: `apps/shopify/node_modules/.bin/vite --config <staged harness>/vite.config.mjs --host 127.0.0.1 --port <free> --strictPort`, from a per-run copy of `harness/` in `$TMPDIR` whose `node_modules` links to the tree's `apps/shopify/node_modules`. Ready = `GET /` answers. Blocks until the flow ends.
- `--width` is the app iframe's width, not the window's: the admin's own sidebar takes about 240px, so the default 1040 matches a 1280px laptop window. `--locale fr` renders French (`?lng=fr`); the default is English.
- `--tree DIR` renders another checkout's `apps/shopify` with this skill's harness. That checkout needs `bun install` and `bun run build:sdk`. Use it for before/after: a worktree at the old commit, then the same flow on both.
- A flow is an ES module exporting one async function. It gets `{ page, context, url, locale, open, step, expect, pageErrors }`:
  - `open(path, scenario)` loads a route with scenario params (`open("/app/campaigns", { distribution: "depleted" })`), then waits for the router, the fonts and Polaris to settle. Each call is a full page load: the scenario is fixed per load.
  - `step(name)` writes `NN-name.png` (full page) + `NN-name.aria.yml` + a `steps.log` line.
  - `pageErrors` collects uncaught page errors; any left at the end fails the run.
  - Throwing anything = FAIL.

```js
export default async ({ open, page, step, expect }) => {
    await open("/app/campaigns", { distribution: "depleted" });
    await expect(page.getByRole("grid")).toBeVisible();
    await step("campaigns");
};
```

Polaris renders tables as `role=grid`, and its controls live in shadow DOM, which `getByRole` pierces. Ready-made flows live in `flows/`; put throwaway flows in `/tmp`. `VERIFY_ONLY=campaigns,funding` restricts the two scenario flows below to scenarios whose name contains one of those words; the verdict names the filter, so a partial run is never mistaken for a full one.

### Every screen

```bash
.pi/skills/verify-shopify/scripts/verify-shopify.sh flow .pi/skills/verify-shopify/flows/screens.mjs --locale fr
```

Renders every scenario in `flows/scenarios.mjs` (about 40 s) with one screenshot each, and fails if any shows the error page (other than `app-error`, which must) or throws a page error. It is the smoke test after any change in `apps/shopify`, and the set of screenshots for a before/after review.

### Layout audit

```bash
.pi/skills/verify-shopify/scripts/verify-shopify.sh flow .pi/skills/verify-shopify/flows/overflow.mjs --locale fr
```

Visits every scenario and fails when content is wider than a box that clips it, or than a table's scroll box: a Polaris table that needs sideways scrolling shows its last column cut, with no visible scrollbar. Code snippets that scroll on purpose and 1px screen-reader-only text are not counted. `overflow.json` lists each hit with scenario, the Polaris component chain, and both widths; a screenshot is taken only for scenarios with a hit. Run it at the widths and locales a change touches; French is longest. It catches the 2026-11 campaign table regression (`campaigns-budget-depleted: s-table > s-internal-scroll-box > div.scroll 962px in 934px`, French, 1040px).

## Scenarios

Query parameters read by `harness/main.tsx`. Unset means the first value.

| Param | Values | Effect |
|---|---|---|
| `onboarding` | `done`, `1`…`7` | `N` = steps before N are done (setup guide on `/app`, settings) |
| `theme` | (unset), `legacy` | `legacy` = a theme without app blocks |
| `distribution` | `distributing`, `depleted`, `not_deployed`, `paused`, `warning` | campaigns' bank distribution status |
| `bank` | `open`, `paused`, `lowlimit`, `empty`, `walletless`, `undeployed`, `none` | bank status and balances |
| `purchases` | (any), `none` | funding page purchase list |
| `button`, `banner` | `1` | theme already has the share button / banner |
| `status` | `live`, `draft`, `hidden`, `oldPage`, `none` | ambassador page |
| `state` | `confirmed`, `pending`, `processing`, `declined`, `missing` | `/purchase` page |
| `error` | `invalid`, `missing` | `/auth/login` error |
| `lng` | `en`, `fr` | set by `--locale` |

A new scenario is a new parameter value read in `harness/main.tsx` plus a row in `flows/scenarios.mjs`.

## Evidence

Default location: `.pi/verify-evidence/<UTC timestamp>-shopify-<flow name>/` at the repo root (self-gitignored, shared with the other verify skills). `--evidence DIR` picks another path; an existing directory is always refused, so an old PASS can never survive a failed rerun. The path is printed as `evidence: …` on exit.

| File | Content |
|---|---|
| `verdict.txt` | `PASS`/`FAIL` + flow, URL, width, locale; on FAIL the URL and stack. Written last. |
| `NN-<step>.png`, `NN-<step>.aria.yml`, `steps.log` | each `step()` |
| `FAIL.png`, `FAIL.aria.yml` | state at the failure |
| `network.log` | every blocked off-origin request |
| `console.log` | browser console + page errors |
| `server.log`, `instance.txt` | vite output, instance doctor |
| `overflow.json` | layout audit only: every hit with scenario, element chain and widths |

Proof standards:
- The harness proves how a screen renders from given data, not that a merchant can reach it inside the admin or that its action works. Say which: "renders", not "works".
- Name the scenario, width and locale of every claim. One width proves one width.
- Assert with `expect` before `step()`, so the screenshot shows the asserted state.
- Never edit `harness/main.tsx` to make a flow pass. Mock data follows the loaders (`mocks` must pass), not the screenshot you want.
- A before/after compares the same flow, scenario, width and locale on two trees (`--tree`).

## Cleanup

Automatic: on exit (pass, fail, Ctrl-C) the harness sends TERM then KILL to the server's own process group, which it created with `set -m`, and deletes its staged harness copy in `$TMPDIR`. Nothing else is touched and nothing is killed by name. Evidence is never deleted. The only file a run writes inside a tree is vite's cache in `apps/shopify/node_modules/.vite-verify-shopify`; `mocks` also refreshes `apps/shopify/.react-router/types` (`react-router typegen`, gitignored).

If a run was killed with SIGKILL and left a server behind, `instance.txt` names its pid; kill that pid's process group (`kill -TERM -- -<pid>`) and nothing else.

Isolation: concurrent runs are fine (free ports, separate browsers, separate staged copies and evidence). They share the tree's vite cache, so stagger starts by a second or two.

## Helpers

- `scripts/verify-shopify.sh` — the harness above. `verify-shopify.sh --help` prints usage.
- `scripts/drive.mjs` — Playwright driver started by `flow`; do not call it directly.
- `harness/` — what vite serves: `index.html`, `main.tsx` (routes + mock data), `useMerchantBank.mock.ts`, `vite.config.mjs` (server stubs). Copied per run; edit it here.
- `flows/scenarios.mjs` — the scenario list; `flows/screens.mjs`, `flows/overflow.mjs` — the two ready-made flows.
