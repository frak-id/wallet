---
name: verify-listener
description: Drive the Frak listener (apps/listener) the way a merchant site does and capture proof — the SDK→iframe RPC boot, the modal login step (mocked passkey, stubbed backend) and the sharing page — in headless Chromium against a listener build the harness serves and tears down itself. Use to prove a listener change works end to end, to catch chunk-splitting or bundle regressions by comparing per-flow JS request lists and gz bytes between two builds, or to reproduce a modal or sharing UI bug and collect screenshots and console evidence; no SST stack, backend or account needed.
---

# Verify the Frak listener

```bash
bun .pi/skills/verify-listener/scripts/run.ts --build --flow all
bun .pi/skills/verify-listener/scripts/run.ts --dist <listener dist> --flow sharing --runs 3
```

Run from any checkout or worktree: the script targets the checkout it lives in.

- `--build` runs `bun run build` in `apps/listener`, then serves `apps/listener/dist`. `--dist <path>` serves an existing `vite build` output instead (built with `base: "/listener"`). Pass exactly one.
- `--flow boot|modal-login|sharing|all` (default `all`), `--runs N` (default 1), `--label NAME`, `--evidence DIR`, `--repo PATH` (another checkout; default is this one).
- The SDK side is that checkout's `sdk/components/cdn`; run `bun run build:sdk` once if it is missing. Playwright and Chromium come from `apps/wallet` (`(cd apps/wallet && bunx playwright install chromium)` if missing).
- Exit 0 only when every run passed, 1 on a failed run, 2 on bad arguments or a missing build.

## Covers / does not cover

Each run is a fresh browser:
- `boot`: the merchant page loads the SDK, the `#frak-wallet` iframe loads, `FrakSetup.client` exists and the RPC connection and setup handshake resolved. No UI.
- `modal-login`: `displayModal` with a `login` step (`allowSso: false`), then a click on the primary button. Passes when the SDK promise resolves with the stubbed wallet and the listener frame called the passkey mock.
- `sharing`: `displaySharingPage`. Passes when `[data-testid="sharing-copy"]` is visible in the iframe.

A run also fails on any failed `/listener/**` or `/sdk/**` request (4xx or `requestfailed`).

Not covered: a real passkey or backend (no gcp-dev), SSO, wallet pairing, the install page, transactions, WebKit and Firefox, and the post-login side effects (pairing websocket, identity merge, chain RPC), which fail or 404 and show up as console errors.

## How it is wired

- One Bun server on one port serves two origins, so the SDK→listener postMessage is really cross-origin: merchant `http://127.0.0.1:<port>` (host page and SDK) and wallet `http://localhost:<port>` (the dist at `/listener` plus backend stubs). Both are secure contexts, so WebAuthn and `crypto.subtle` work over http.
- The listener calls the backend origin baked in at build time (`https://localhost:3030` without SST), so the browser routes every off-origin call to the stub server by path. `/track` gets `200 {}`. A path with no stub gets 404 and is listed in `unstubbedCalls`.
- Passkey mock: `navigator.credentials.get` returns a real P-256 assertion signed by a per-page WebCrypto key, installed in every frame. The stub backend never checks it.
- Before each screenshot the driver waits until no finite animation or transition is running, in the merchant page and in the listener frame, so two runs of one build give identical pixels.

## Evidence

Default `<repo>/.pi/verify-evidence/<utc>-listener-<label>/` (gitignored, shared with `verify-wallet`). An existing directory is refused.

```
summary.txt        one line per run: PASS/FAIL, js count, gz KiB, failed, console errors
summary.json       per run: pass, error, js[] {path, rawBytes, gzBytes}, totals,
                   failedRequests, unstubbedCalls, consoleErrors
<flow>/run-<k>/
  NN-<step>.png    01-boot | 01-modal-login-step, 02-modal-login-done | 01-sharing-cta; FAIL.png
  js.txt           gz<TAB>raw<TAB>path for listener JS from page load to UI shown, plus TOTAL
  requests.jsonl   every request the server answered (afterUiShown marks the tail)
  console.log      browser console and page errors, all frames
```

The gz figures are gzip -6 of the served bytes, not a CDN's encoding. To compare two builds, run each with `--dist`, a distinct `--label`, and the same `--flow`, then diff `<flow>/run-*/js.txt`. Compare screenshots across runs with `magick compare -metric AE a.png b.png`.

## Known traps

- **Trust refusal (-32002)**: the listener silently refuses interactions from an origin its merchant does not allow. The resolve stub lists `127.0.0.1:<port>` in `allowedDomains` because the listener compares `host:port`. Prove a flow by visible DOM and resolved results, never by the absence of an error.
- **Two origins are required**: on one origin the listener skips its context check and the flow proves nothing about the cross-origin path.
- **Backend URL is baked in at build time**: the listener calls whatever origin the build embedded, and the driver reroutes every off-origin call to the stubs by path. An unstubbed call therefore shows up as a 404 in the console, not as a network error; add a stub in `scripts/server.ts` if a flow needs one.
- **One `displayModal`, no re-fire**: the e2e suite re-fires a dropped open (`SdkHelper.fireUntilModalOpen`); this driver does not, because a merchant gets one call. "modal never opened" on a build whose chunks all loaded is a real listener or SDK bug.
- `FrakSetup.client` appears only after the iframe handshake, with a 30 s deadline. A boot timeout means the iframe never connected: check `requests.jsonl` for the `/listener` document and its chunks.
- Serving `/listener` needs an explicit `text/html` type for the document, or Chromium treats the iframe as a download (`net::ERR_ABORTED`).
- Import `@playwright/test` only through `apps/wallet` (the driver uses `createRequire`). A bare import lets Bun auto-install a second Playwright, which then throws "Requiring @playwright/test second time".
