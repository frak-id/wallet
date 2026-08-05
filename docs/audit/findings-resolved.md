# Audit Findings — Resolved

Companion to `docs/audit/findings-ranked-by-gain.md`, which tracks only what is still **open**.
Items are removed from that document as they land and recorded here, so the open list stays lean and
this one keeps the history (including the caveats each fix left behind).

Tiers: **P1** listener/SDK (every visitor of every merchant site) · **P2** wallet/Tauri (B2C users)
· **P3** business/shopify (merchants, ~weekly).

---

## 2026-08-05 — first remediation pass

Two commits. Source findings were re-measured before fixing; three turned out to be different
problems than the audits described, and are noted as such below.

### P1 — Listener / SDK

| Was | Fix | Caveat |
|---|---|---|
| **P1.8** `ListenerUiProvider` passed an inline object literal as its context value, re-rendering all 17 consumer sites on every provider render | `useMemo` on the value. The other three members were already stabilised, so the literal was the sole cause | The win is smaller than "17 sites on every render" implies: `translation`'s own deps include `currentRequest`, so the memo mainly absorbs provider re-renders driven by the resolving-context store and the reward query |
| **P1.11** two diverged `extractDomain` helpers; one stripped `www.` **unanchored** (`foo.www.example.com` → `foo.example.com`) and they disagreed on the parse-failure fallback (`""` vs raw input) | One `extractDomain` returning `string \| null`, anchored `/^www\./`. Security callers fail closed on `null`; best-effort callers opt into a fallback explicitly. First test for the helper added | The old `""` was **matchable**: an `allowedDomains` entry of `""` or `"www."` would have granted `trustLevel: "verified"` to any embedder whose origin failed to parse. `null` closes that |
| **P1.4** "two sequential CDN round trips" | **Not fixed — deliberately.** See the boxed note in `findings-ranked-by-gain.md` §7 | Merging the shim would have been an outage: it re-anchors relative chunk URLs. The audit's framing (cache-busting) was wrong; the `?v=` is provably inert |

### P2 — Wallet / Tauri

| Was | Fix | Caveat |
|---|---|---|
| **P2.1** every notification click cold-started a new tab (`client.url === "/"` is never true, so the focus loop never returned) | Origin comparison + reuse of the warm, authenticated tab. A bare `/` target only focuses; a real deep link navigates. Focus failures and malformed payloads both fall back to `openWindow` rather than silently doing nothing | `WindowClient.navigate()` is a real navigation, not an SPA route change, so a deep link still re-executes the bundle. Only the duplicate tab and the generic-target teardown are avoided |
| **P2.2** self-referencing effect on the token-send screen read *and* wrote `selectedToken`; it terminated only because `getUpdatedToken` happened to return falsy on convergence | State now holds the token **address**; the item is derived during render via `resolveSelectedToken`. `getUpdatedToken` (+12 tests) deleted, 6 targeted tests added | The derived fallback to `balances[0]` can *substitute* a token if the selected one drops out of the balance list (the backend filters zero balances, and maps a multicall error to zero). Guarded by adopting the substitute into state and resetting the amount field — the requested address (state) and the shown token (derived) are compared directly, so no previous value is tracked and a transient empty balance cannot clear the guard. The substitution itself is still silent to the user |
| **P2.7** `DetailOverlay` was a bare portal: no `role`, no `aria-modal`, no name, no Escape, across six wallet modals | `role="dialog"` + `aria-modal` + i18n'd `aria-label` (7 new keys, en/fr), focus-in on mount, focus restore on unmount, Escape to close, re-entrancy guard on the close animation | **Still no focus trap and no `inert` background**, so `aria-modal="true"` currently asserts something not strictly true. Escape correctly defers to nested Radix layers via `defaultPrevented`. Retiring the portal for the DS `Dialog` remains the right end state (open item #9) |
| **P2.8** zero route loaders across 47 route files | `queryClient` in the router context (extracted to its own module); `queryOptions` factories shared by loader and hook; loaders on home / explorer / settings | `useWalletSecurityStatus` is **not** prefetched (needs React-side wagmi wiring). `defaultPreloadStaleTime: 0` was required — without it the router's own preload window stops re-invoking loaders. With `defaultPreload: "render"`, the three tab links now warm their data at first paint: a deliberate trade (instant tab switches vs. 3 concurrent requests on cold boot), deduped by Query's 60s `staleTime` |
| **P2.11** 131.5 KiB of Inter Tight with zero consumers | Verified across apps/packages/sdk/plugins/services — the only references were the token definition, the font files, and the build wiring. All removed | Web clients never downloaded these (nothing requested the family); the real saving is **Tauri binary / deploy artefact** weight |
| **P2.14** `html { height: 100vh }` | → `100dvh` | Was the last `vh` in the wallet path; it fought `AppShell`'s `--viewport-height` keyboard mirror |
| **P2.15** two `shortenAddress` formats | Consolidated on the repo's dominant idiom (viem `slice`, `0x123456...12345678`) in `module/common/utils`. A **third**, undeclared copy in `RecoveryFlow/ValidateStep.tsx` was found and removed | Merge and recovery screens now show 19 chars instead of 13 — more checksum characters on the two screens that ask users to *verify* an address. A short-input guard was carried over from the deleted copy. Four `formatHash` helpers still exist for tx hashes; out of scope |

### P3 — Business

| Was | Fix | Caveat |
|---|---|---|
| **P3.1** `ReactQueryDevtools` statically imported and rendered unguarded — a namespace re-export defeats its own `NODE_ENV` guard, so ~18.6 KB gz shipped eagerly | Lazy + `import.meta.env.DEV`, inside its own `Suspense` so it cannot gate first paint on the router's app-wide boundary. Same `Suspense` gap fixed in `apps/wallet` | Not regression-proof: the business eager budget is `enforce: false`, so a static import creeping back is a log line, not a build failure. Ratcheting that budget is still open |

---

## Corrections this pass produced

Worth keeping, because each one inverts something an audit asserted:

1. **`?v=` CDN cache-busting is inert.** jsDelivr ignores query strings (verified: three novel query
   values all returned `x-cache: HIT`, identical `etag`, identical `age`). The shim's real job is
   **URL re-anchoring** for relative chunk imports.
2. **The dark theme is unreachable.** `theme.css.ts` gates `semanticDark` on `[data-theme='dark']`
   and nothing anywhere sets that attribute; there is no `prefers-color-scheme` fallback. The
   ui-audit's P0 contrast failures are real arithmetic on dead code.
3. **`design-system/charts` is P3, not P1.** No `sdk/` file imports it; `alwaysBundle: [/.*/]` is an
   allowlist, not a reachability rule.

## Verification notes for this pass

- `bun run format` and `bun run lint` clean.
- **Full suite green: 567 files / 5267 tests passing** with both commits applied
  (`apps/listener` included: 21 files / 217 tests).
- `bun run typecheck` for `apps/wallet`: **0 errors in the app.** The only 3 remaining are
  pre-existing `TS5097` (`.ts` extension imports) in `packages/design-system/src/global.ts`, last
  touched by `32e719c07`.

### Two environment traps that cost a lot of time — document them

Both produced convincing false signals during this pass. Neither is a repo defect.

1. **`NODE_ENV=production` in the shell silently breaks the entire component test suite.**
   `react/index.js` switches on `process.env.NODE_ENV` and `react.production.js` does **not**
   export `act` (only `react.development.js` does). `@testing-library/react` then falls back to
   `react-dom/test-utils`, which in React 19 is a stub, and every render-based test dies with
   `TypeError: React.act is not a function` — ~1400 failures, plus all 21 `apps/listener` files
   failing at import. Re-running with `NODE_ENV=test` turns the suite fully green with no code
   change. If you see mass `React.act` failures, check the ambient env before believing them.
2. **`bun run typecheck` needs two prerequisites, or it reports a flood of phantom errors.**
   - `bun run build:sdk` first, otherwise every `@frak-labs/core-sdk` import is `TS2307`.
   - `apps/wallet/app/routeTree.gen.ts` must exist (it is gitignored and generated by the Vite
     plugin). Without it, `main.tsx` cannot resolve `./routeTree.gen` and **every**
     `createFileRoute("/path")` in the app reports
     `Argument of type '"/x"' is not assignable to parameter of type 'undefined'` — dozens of
     errors that all vanish once the file is generated.
   - On a 4 GB box `tsc` is OOM-killed at the default heap; `node --max-old-space-size=3400` runs
     it to completion.
