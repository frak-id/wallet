---
name: verify-business
description: Drive the Frak merchant dashboard (apps/business) the way a merchant does and capture proof — merchants, campaign list and detail sheet, the campaign creation wizard, settings — in headless Chromium or WebKit against an instance the harness starts and tears down itself, logged in through the app's built-in demo mode with every off-origin request blocked. Includes a layout audit that fails when a word breaks mid-word. Use to prove a business UI change works at desktop or phone width, reproduce a UI bug, or collect screenshots/ARIA evidence; no SST stack, backend or account needed.
---

# Verify the Frak business dashboard

One harness, `.pi/skills/verify-business/scripts/verify-business.sh`, run from anywhere in the repo. Every drive is a single invocation that starts its own `vite dev`, proves the server is the one it started, drives it, writes evidence, and kills exactly what it started. You never start or stop a server by hand.

Read [`features/README.md`](features/README.md) before driving: it maps each user-facing feature to its entry points, recipe and proof.

## What this harness is (and is not)

- **Surface.** The TanStack Router SPA in `apps/business`, served by `vite dev` over http on a free port. No SST: without it the build falls back to stage `dev`, and nothing it would call is reachable anyway (see below).
- **Auth is demo mode.** Before the flow runs, the driver opens `/demo` (`src/routes/demo.tsx`), which seeds `token: "demo-token"` in the `business-auth` store and redirects to `/m/11111111-1111-1111-1111-111111111111/dashboard`. Data then comes from `apps/business/src/mock/*.json` (4 merchants, campaigns `camp_001…008`, members). `--logged-out` skips `/demo` and starts on `/login`.
- **Hermetic.** Demo mode still calls a few things it does not mock: `/user/merchant/resolve`, `/business/auth/{account,sessions,2fa/methods}` and billing on `localhost:3030`, the wallet listener iframe on `localhost:3000`, and Arbitrum Sepolia RPC. The driver blocks every request that leaves the app origin and lists each one in `network.log`. The pages still render; parts fed by those calls stay empty or loading (Settings' active sessions, Billing documents).
- **Mutations are demo-only.** Saving a campaign in demo mode never calls the backend: `useSaveCampaign`'s demo branch fakes it after 300 ms. A flow proves the UI and the client-side draft, not the API.
- **Not covered:** a real merchant account against the gcp-dev backend (not built: it needs a test merchant and its credentials), login itself (wallet SIWE, email, Shopify), funding and bank transfers, push sending. Also not this skill: `apps/wallet` (use `verify-wallet`), `apps/listener`, `apps/shopify`.

## Doctor

Run first, and whenever anything looks off. Read-only.

```bash
.pi/skills/verify-business/scripts/verify-business.sh doctor
```

No line may be `FAIL` (exit 0). It checks bun, `vite` in `apps/business`, `@playwright/test` and its Chromium (borrowed from `apps/wallet`: business has no Playwright of its own), and that the demo route and demo data still exist. A missing browser is fixed with `(cd apps/wallet && bunx playwright install chromium)`. A missing WebKit is only a `warn`, since only `--webkit` needs it: `(cd apps/wallet && bunx playwright install webkit)`.

Each `flow` run also does an instance doctor before driving: the listening port's process group must be the server it just launched, and the served `<title>` must be `Frak Business Hub | Manage Your Web3 Products`. Otherwise it refuses and exits 2. The result is in `instance.txt` (URL, server pid, commit, dirty file count).

## Launch + drive

```bash
.pi/skills/verify-business/scripts/verify-business.sh flow <flow.mjs> [--logged-out] [--locale en-US|fr-FR] [--width N] [--welcome] [--webkit] [--evidence DIR]
```

- Launch: `bun x vite dev --host 127.0.0.1 --port <free> --strictPort` in `apps/business`; ready = `GET /` answers (first boot ~10 s). Blocks until the flow ends; there is no long-lived instance to attach to.
- Browser: Desktop Chrome, 1280×900, `en-US`. `--width 390` (or any width) checks a phone or tablet layout; the sidebar collapses to icons below 768px. `--locale fr-FR` renders the app in French. `--webkit` runs Playwright's WebKit with the Desktop Safari profile, whose screenshots are 2× (2560px wide at 1280): the engine inside Safari at its current version, not real Safari and not the Safari 15.4 floor. Headless unless `VERIFY_HEADED=1`.
- The "new dashboard" announcement is dismissed before load (`business_welcomePopup_v1` in localStorage) because it covers every page; `--welcome` keeps it.
- A flow is an ES module exporting one async function. It gets `{ page, context, url, merchantId, step, expect }`: a Playwright page already on the demo dashboard (or `/login`), the instance URL, the demo merchant id, `step(name)` which writes `NN-name.png` (full page, scrolled to the top first) + `NN-name.aria.yml` + a `steps.log` line, and Playwright's `expect`. Throwing anything = FAIL.

```js
import { openFromSidebar } from "./nav.mjs";

export default async ({ page, step, expect }) => {
    await openFromSidebar(page, "/campaigns/list");
    await expect(page.getByRole("heading", { name: "List", level: 1 })).toBeVisible();
    await step("list");
};
```

Ready-made flows live in `flows/`; copy one as a starting point and put throwaway flows in `/tmp`. `flows/nav.mjs` exports `openFromSidebar(page, pathSuffix)`, which works at every width. Use `getByRole` with the names in the feature files and in the `*.aria.yml` a run writes. The ready-made flows use `en-US` names; a flow run with `--locale fr-FR` needs French names (`flows/split-words.mjs` uses none, so it runs in either).

### Layout audit

```bash
.pi/skills/verify-business/scripts/verify-business.sh flow .pi/skills/verify-business/flows/split-words.mjs --width 390 --locale fr-FR
```

Visits the dashboard, campaign overview and list, every wizard step of the draft `camp_003`, members, push, merchant pages and settings, injects `scripts/split-words.js`, and fails if the layout breaks an ordinary word mid-word (breaks after `-`, `/`, `.` and inside CJK text are normal and skipped). Run it at the widths a change touches; French has the longest words. `split-words.json` in the evidence lists every split, including emails and numbers, which do not fail the run. It is known to catch the 2026-11 regression: with `overflow-wrap: anywhere` back in the design-system reset it fails on "Registratio|n" in the campaigns table.

## Evidence

Default location: `.pi/verify-evidence/<UTC timestamp>-business-<flow name>/` at the repo root (self-gitignored, shared with `verify-wallet`). `--evidence DIR` picks another path; an existing directory is always refused, so an old PASS can never survive a failed rerun. The path is printed as `evidence: …` on exit.

| File | Content |
|---|---|
| `verdict.txt` | `PASS`/`FAIL` + flow, URL, width, locale, auth; on FAIL the URL and stack. Written last. |
| `NN-<step>.png`, `NN-<step>.aria.yml`, `steps.log` | each `step()` |
| `FAIL.png`, `FAIL.aria.yml` | state at the failure |
| `network.log` | every blocked off-origin request (`FAILED(net::ERR_BLOCKED_BY_CLIENT…)`) |
| `console.log` | browser console + page errors |
| `server.log`, `instance.txt` | vite output, instance doctor |
| `split-words.json` | layout audit only: every split token with page, element path and width |

Proof standards:
- Drive the real user path: reach a page by clicking what a merchant clicks, from the entry points in the feature file. A `page.goto` to a deep route proves the route renders, not that users can reach it. The layout audit is the exception: it checks rendering, not reachability.
- Capture the action **and** the resulting state: a `step()` after each meaningful transition. Assert with `expect` before `step()`, so the screenshot shows the asserted state.
- A layout claim names the widths and locale it was checked at. One width proves one width.
- Never stub app modules or set store state from a flow beyond what `/demo` seeds.
- Report a feature you could not reach with the command you ran and the unmet precondition; never report it verified through a different entry point.

## Cleanup

Automatic: on exit (pass, fail, Ctrl-C) the harness sends TERM then KILL to the server's own process group, which it created with `set -m`; nothing else is touched, and nothing is ever killed by name. Evidence is never deleted. The only shared files a run writes are `apps/business`'s own generated outputs (`src/routeTree.gen.ts`, vite's cache), gitignored and identical to what `bun run dev` produces.

If a run was killed with SIGKILL and left a server behind, `instance.txt` names its pid; kill that pid's process group (`kill -TERM -- -<pid>`) and nothing else.

Isolation: concurrent runs are fine (free ports, separate browsers, separate evidence). They share `apps/business`'s vite cache, so stagger starts by a second or two.

## Helpers

- `scripts/verify-business.sh` — the harness above. `verify-business.sh --help` prints usage.
- `scripts/drive.mjs` — Playwright driver started by `flow`; do not call it directly (it needs the env the harness sets).
- `scripts/split-words.js` — the mid-word break detector, injected by `flows/split-words.mjs`; any flow can inject it with `page.addScriptTag` and call `window.__splitWords()`.
- `flows/*.mjs` — tested flows, run with `verify-business.sh flow .pi/skills/verify-business/flows/<name>.mjs`.
