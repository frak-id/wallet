---
name: verify-wallet
description: Drive the Frak user wallet (apps/wallet) the way a user does and capture proof — the TanStack SPA (/wallet, /profile, referrals, explorer…) and the standalone /sharing and /install pages — in headless Chromium against an instance the harness starts and tears down itself, either fully mocked or (--real-dev) logged in with a test passkey to the real gcp-dev backend and Arbitrum Sepolia. Use to prove a wallet UI change works, reproduce a UI bug, or collect screenshots/ARIA evidence; no SST stack needed.
---

# Verify the Frak wallet

One harness, `.pi/skills/verify-wallet/scripts/verify-wallet.sh`, run from anywhere in the repo. Every drive is a single invocation that starts its own server, proves the server is the one it started, drives it, writes evidence, and kills exactly what it started. You never start or stop a server by hand.

Read [`features/README.md`](features/README.md) before driving: it maps every user-facing feature to its entry points, recipe and proof.

## What this harness is (and is not)

- **Surfaces.** `spa` = the TanStack Router app served by `vite dev` (https, mkcert, free port). `standalone` = the preact `/sharing`, `/install`, `/i` pages, built by `build:standalone` and served by `apps/wallet/tests-light/serve-standalone.ts` (http, free port). These are two different builds: driving `/sharing` through the SPA tests the wrong bundle.
- **Auth** is a pre-seeded `frak_session_store` in localStorage (the light suite's mock session, `tests-light/mocks/sessions.ts`). `--logged-out` seeds an empty session instead. No passkey ceremony runs.
- **Backend, chain RPC, analytics** are answered by the light suite's mocks (`tests-light/mocks/api.ts`). In `flow` mode every other request that leaves the app origin is **blocked** and listed in `network.log` — the run is hermetic and never touches gcp-dev.
- **`--real-dev`** swaps all of that for the real thing, see [Real-dev mode](#real-dev-mode).
- **Not covered here:** a real platform authenticator (Touch ID / Android biometrics), pairing, the SDK→listener iframe modal, referral attribution, sending transactions. Those need the SST stack and `apps/wallet/playwright.config.ts` (`bun run --cwd apps/wallet test:e2e`, see `apps/wallet/tests/README.md`). Tauri iOS/Android builds are out of scope too. Also not this skill: `apps/business` (use `verify-business`), `apps/listener`, `apps/shopify`.

## Doctor

Run first, and whenever anything looks off. Read-only.

```bash
.pi/skills/verify-wallet/scripts/verify-wallet.sh doctor
```

Every line must be `ok` (exit 0). It checks bun, node ≥ 23.6 (the driver imports the light mocks' `.ts` files natively), `@playwright/test` in `apps/wallet`, the matching Chromium build, the light mocks, and who holds `:3000`. A missing browser is fixed with `(cd apps/wallet && bunx playwright install chromium)`.

Each `flow`/`check` run also does an instance doctor before driving: the listening port's process group must be the server it just launched, and the served `<title>` must be `Frak Wallet | …` (spa) or `Share &amp; earn | Frak` (standalone). Otherwise it refuses and exits 2. The result is in `instance.txt` (URL, server pid, commit, dirty file count).

## Launch + drive

Two modes. Both block until done; there is no long-lived instance to attach to.

### `flow` — drive one user path you wrote (hermetic)

```bash
.pi/skills/verify-wallet/scripts/verify-wallet.sh flow <spa|standalone> <flow.mjs> [--logged-out] [--desktop] [--evidence DIR]
```

- Launch: `spa` runs `bun run build:sw` then `vite dev --port <free> --strictPort` (ready = `GET /` answers; first boot ~30 s). `standalone` runs `build:standalone` and serves it (ready = `GET /sharing` answers).
- Device: Pixel 7 (the app is mobile-first); `--desktop` switches to Desktop Chrome. Locale `en-US`, clipboard granted.
- Headless by default. `VERIFY_HEADED=1` opens a visible window, so a human can click through mocked data; a flow that awaits `page.waitForEvent("close", { timeout: 0 })` keeps it open until they close it.
- A flow is an ES module exporting one async function. It gets `{ page, context, url, step, expect }`: a Playwright page already mocked and authenticated, the instance base URL, `step(name)` which writes `NN-name.png` (full page) + `NN-name.aria.yml` (ARIA snapshot of `body`) + a `steps.log` line, and Playwright's `expect` (auto-waiting assertions work outside the test runner). Throwing anything = FAIL.

```js
export default async ({ page, url, step, expect }) => {
    await page.goto(`${url}/profile`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Referrals" }).click();
    await expect(page).toHaveURL(/\/profile\/referral$/);
    await step("referrals");
};
```

Ready-made flows live in `flows/` (one per mapped feature where one exists); copy one as a starting point. Put throwaway flows in `/tmp`, not in the repo. To answer an endpoint differently from the light mocks, call `page.route(...)` inside the flow — routes registered later win.

Handles: use `getByRole` with the accessible names shown in the feature files and in any `*.aria.yml` the harness writes. Never wait on `networkidle` in the SPA: sockets and polling keep it busy. Standalone pages that carry `returnScheme` never fire `load`; navigate with `waitUntil: "commit"`.

### Real-dev mode

```bash
.pi/skills/verify-wallet/scripts/verify-wallet.sh flow spa <flow.mjs> --real-dev [--desktop] [--evidence DIR]
```

Same flows, no mocks: your **local** SPA build, a real account, the real `backend.gcp-dev.frak.id`, real reads on Arbitrum Sepolia.

- How: the gcp-dev backend only verifies passkeys whose origin is `https://wallet-dev.frak.id`. The harness serves vite on `127.0.0.1:<free port>` with that host allowed, and Chromium maps `wallet-dev.frak.id` onto it (`--host-resolver-rules`), so the page really runs at that origin and `url` is `https://wallet-dev.frak.id`. `--ignore-certificate-errors` lets the service worker register over the mkcert cert. Without SST the local build already uses stage `dev`, RP id `frak.id` and the gcp-dev backend.
- Account: before the flow runs, the harness logs in with the e2e suite's passkey mock (`apps/wallet/tests/helpers/mockedWebauthn.helper.ts`, P-256, verified by the real backend) and the suite's `AuthPage`, exactly like `tests/global.setup.ts`: login with the persisted credential, register (skipping the email step) when that fails. The credential lives outside the checkout, in `~/.pi/verify-wallet/authenticator-dev.json` (dir 700, file 600; it is a private key), so every worktree and clone on this machine logs into the same wallet. `VERIFY_WALLET_CREDENTIAL=<path>` points a run at another credential; a path that does not exist yet registers a new wallet there. Deleting the default file starts over with a new wallet. The wallet address derives from the credential, and the backend's register is idempotent for an existing credential, so a failed login that falls back to register still lands on the same address. `account.txt` in the evidence records the address and whether this run logged in or registered. The account registered on 2026-10-12 is `0xa0f8907d8db0de2ec96dbfd157645c3f90f17a14`.
- The flow starts on `/wallet` already logged in; `network.log` lists every off-origin response with its real status, and nothing is blocked.
- Proven 2026-10-12: register then login, `/user/wallet/balance` answered by gcp-dev, chain reads (smart-account `eth_call`s, a multicall carrying the address) answered 200 by `sepolia-rollup.arbitrum.io`, `wallet-home` and `referral-code` flows green.

What it costs and what it cannot do:
- **Shared state.** Every run hits the shared gcp-dev backend and database: a login session each run, a wallet row on first registration. Anything a flow submits (referral code, email, favorites) is a real write on dev. Do not run it against prod; the harness has no prod mode on purpose.
- **Amounts are real, and this account has 0 €.** Rewards come from the backend's indexing; a non-zero balance needs a real referral purchase with a payout on dev.
- **No transactions.** Sending (transfer to bank or to a crypto wallet) needs the bundler/paymaster key (`PIMLICO_API_KEY`, an SST secret, absent here) and testnet funds.
- **Spa only**, and exclusive with `--logged-out`. The page's origin is not the local one, so links the app builds from `window.location` point at `wallet-dev.frak.id` — which is still the local server inside this browser.

### `check` — run the repo's light Playwright suite

```bash
.pi/skills/verify-wallet/scripts/verify-wallet.sh check [--evidence DIR] -- <playwright args>
# e.g. -- --project=standalone install.check     (use --project=X, not --project X)
#      -- --project=spa touch-target.check
```

Runs `apps/wallet/playwright.light.config.ts` (`tests-light/specs/*.check.ts`). The standalone project's server is started by Playwright on a free port. Unless the args select `--project=standalone`, the harness also starts the SPA on **https://localhost:3000**, because the spa project's storage state is pinned to that origin; it refuses if `:3000` is taken (doctor shows by whom). `check` is not hermetic: the light suite mocks known endpoints but does not block the rest. Pixel assertions are skipped unless you export `LIGHT_SNAPSHOTS=1` and have local baselines (gitignored, machine-specific).

## Evidence

Default location: `.pi/verify-evidence/<UTC timestamp>-<flow name|check>/` at the repo root (self-gitignored). `--evidence DIR` picks another path; an existing directory is always refused, so an old PASS can never survive a failed rerun. The path is printed as `evidence: …` on exit.

| File | flow | check |
|---|---|---|
| `verdict.txt` | `PASS`/`FAIL` + flow, URL, device, auth; on FAIL the URL and stack. Written last. | `PASS`/`FAIL` + args |
| `NN-<step>.png`, `NN-<step>.aria.yml`, `steps.log` | each `step()` | — |
| `FAIL.png`, `FAIL.aria.yml` | state at the failure | — |
| `network.log` | every off-origin request: status if mocked, `FAILED(net::ERR_BLOCKED_BY_CLIENT…)` if blocked | — |
| `console.log` | browser console + page errors | — |
| `server.log`, `instance.txt` | server output, instance doctor | same (spa only) |
| `account.txt` | `--real-dev` only: wallet address, `via=login\|register`, credential path | — |
| `playwright.log`, `report/`, `test-results/` | — | list output, HTML report, failure artifacts |

Proof standards:
- Drive the real user path: navigate by clicking the links/tabs a user clicks, from the entry points listed in the feature file. A `page.goto` to a deep route proves the route renders, not that users can reach it.
- Capture the action **and** the resulting state: a `step()` after each meaningful transition, not only at the end. Assert with `expect` before `step()`, so the screenshot shows the asserted state.
- Check side effects you claim: if a step should call the backend, assert the request in the flow (`page.waitForRequest`) or read `network.log`. A request listed as blocked means that path talked to something unmocked — the UI after it is not proof.
- Mocks stand only at the production network boundary (backend, RPC, analytics). Never stub app modules or set store state from the flow beyond the seeded session.
- Report a feature you could not reach with the command you ran and the unmet precondition; never report it verified through a different entry point.

## Cleanup

Automatic: on exit (pass, fail, Ctrl-C) the harness sends TERM then KILL to the server's own process group, which it created with `set -m`; nothing else is touched, and nothing is ever killed by name. `--real-dev` also bundles the e2e auth helpers into a `mktemp -d` directory under `apps/wallet/node_modules/.cache/verify-wallet/` (there so node resolves `@playwright/test`) and removes exactly that directory on exit. Evidence is never deleted, and neither is the real-dev credential. The only shared files a run writes are the repo's own generated build outputs (`apps/wallet/public/sw.js`, `apps/wallet/dist/`, `apps/wallet/app/routeTree.gen.ts`, vite's cache), all gitignored and identical to what `bun run dev`/`build` produce.

If a run was killed with SIGKILL and left a server behind, `instance.txt` names its pid; kill that pid's process group (`kill -TERM -- -<pid>`) and nothing else.

Isolation: concurrent `flow` runs are fine (free ports, separate browsers, separate evidence). Two SPA servers share `apps/wallet`'s vite cache and route-tree generation, so avoid starting several at the same instant. `check` with the spa project is one-at-a-time per machine (`:3000`).

## Helpers

- `scripts/verify-wallet.sh` — the harness above. `verify-wallet.sh --help` prints usage.
- `scripts/drive.mjs` — Playwright driver started by `flow`; do not call it directly (it needs the env the harness sets).
- `flows/*.mjs` — tested flows, run with `verify-wallet.sh flow <surface> .pi/skills/verify-wallet/flows/<name>.mjs`.
