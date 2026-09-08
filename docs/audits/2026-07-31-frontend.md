# Frontend Audit — Frak Wallet

**Date:** 2026-07-31
**Scope:** 4 apps + 7 shared packages + 4 published SDK packages (~250k LOC frontend)
**Method:** read-only static analysis (read + grep). Registry claims verified live against npm. No files modified.

---

## Verdict

This is a **well above-average codebase**. Build engineering is genuinely excellent — the Rolldown chunking, the listener's three-ring architecture with a 32KB hard-fail gzip budget, the Tauri no-op stub aliasing, `assertComponentRegistrations` — that's work most teams never get to. Zero production `any` in the wallet app, two non-null assertions repo-wide (both in tests), an acyclic package graph, zero deep imports past barrels.

The problems are **concentrated at the two boundaries where in-repo conventions stop applying**: the npm publish boundary and the postMessage trust boundary. Both are unguarded by CI.

---

## P0 — Ship-blocking

### 1. `@frak-labs/components@1.0.13` is uninstallable from npm

`sdk/components/package.json:107` declares `@frak-labs/design-system: workspace:*` under **dependencies**. Changesets rewrites it to `0.0.0`; design-system is `private: true`. Verified live:

```
npm error 404 The requested resource '@frak-labs/design-system@0.0.0' could not be found
```

Every public install of the web-components package fails. `sdk/components/tsdown.config.ts` already inlines design-system via `alwaysBundle: [/design-system/]`, so the manifest entry is **pure dead weight** — moving it to `devDependencies` is a one-line fix with zero behavioral change.

**Also add a CI gate** asserting every dependency of a public package resolves on the registry. Nothing catches this class today.

> Related but cosmetic: `sdk/react/package.json:81` dev-depends on the private `@frak-labs/wallet-shared` (an inverted edge through two layers). It leaks into the published manifest (`react-sdk@1.2.1` carries `"@frak-labs/wallet-shared": "0.0.15"`) but npm skips devDeps, so installs succeed. The only reason for the edge is `sdk/react/tests/vitest-fixtures.ts` — those fixtures belong in `packages/test-foundation`, which already exists for this purpose.

### 2. Listener lifecycle channel bypasses all origin validation

`packages/rpc/src/listener.ts:394-398` routes lifecycle messages **before** the middleware chain and returns early. Combined with `apps/listener/app/bootstrap.ts:170` (`allowedOrigins: "*"`), `isOriginAllowed` short-circuits at `listener.ts:196-198`, and `isLifecycleMessage` (`:213-218`) is a 2-key structural check on attacker-controlled data.

Net effect: **any origin can post lifecycle messages to the listener.** Reachable handlers in `apps/listener/app/module/handlers/lifecycleHandler.ts`:

- `resolved-config` (`:236-297`) — sets `merchantId` / `origin` / `trustLevel`. This is the **trust root**, and it's self-asserted: `allowedDomains` arrives in the same message it authorizes (`:263-266`).
- `sso-redirect-complete` (`:379-396`) — decompresses and writes an arbitrary `Session` with zero validation.
- `restore-backup` (`:66-68`).
- `modal-css` — `applyBackendCss` (`:369-378`) injects raw CSS with no validation, while the sibling `isSafeCssLink` (`:112-121`) is exemplary (https + `.css` only, rejects `javascript:`/`data:`/`http:`). Same inconsistency at `apps/listener/app/ui/ListenerUiProvider.tsx:200-212`.

The comment at `bootstrap.ts:157-160` claims validation happens in `walletContextMiddleware` — **that claim does not hold for this path.**

**Fix:** route lifecycle messages through origin validation in `packages/rpc/src/listener.ts`, and replace `allowedOrigins: "*"` with the resolved merchant origin.

### 3. `walletContextMiddleware` fails open

`apps/listener/app/module/middleware/walletContext.ts:80-90` logs `"Origin mismatch, rejecting RPC request"` then **falls through and processes the request** when `isRunningLocally`. That flag is `process.env.STAGE`-based (`packages/app-essentials/src/utils/env.ts:8`) — a *runtime* value, not `import.meta.env.DEV`, so it isn't statically eliminated and a misconfigured `STAGE` disables origin enforcement in a deployed build.

Two more holes in the same file:
- Unconditional bypass when `origin === window.origin` (`:58-70`) — any XSS on the wallet origin escalates to full RPC.
- It validates against `resolvingContext.origin`, a value set by the *unauthenticated* lifecycle message from #2.

Only two surfaces are gated on `trustLevel` at all (`useSendInteractionListener.ts:30-38`). `frak_displayModal`, `frak_displayEmbeddedWallet`, `frak_displaySharingPage`, `frak_getMerchantInformation`, `frak_listenToWalletStatus`, `frak_getMergeToken` and the SSO handlers are not.

### 4. Lifecycle replies broadcast JWTs to `targetOrigin: "*"`

`packages/wallet-shared/src/common/utils/lifecycleEvents.ts:19,22` — every iframe→parent message uses `"*"`, including `do-backup` payloads containing live session + SDK JWTs. `includeUserActivation: true` additionally delegates transient user activation to an unverified origin.

The backup hash is unkeyed (`apps/listener/app/module/utils/backup.ts:59-63`) and `hashJson` ships in the bundle — it prevents forgery, not reading or recomputation. `pushBackupData` also `console.log`s the entire backup object including live JWTs (`:127-129`); `removeConsole` only runs when `isProd`.

---

## P1 — Architecture

### 5. No runtime schema validation anywhere in the frontend

Zero zod / valibot / typebox / `@hookform/resolvers` across all four apps. Consequences:

**business** — ~60 inline `rules={{}}` blocks across 25 files.
- `src/module/campaigns/component/Creation/RewardCampaign/utils.ts:592-628` **re-implements the backend's `validateRuleDefinition`** (tier overlap `:545-558`, negated-scope/matched-basis coupling `:83-92`) across 628 lines. Backend source: `services/backend/src/domain/campaign/services/CampaignManagementService.ts:522`.
- `src/stores/campaignStore.ts:255` hand-copies the backend's `PRODUCT_SCOPE_FIELDS` allowlist, with a comment naming the source line.

**wallet** — `app/routes/sharing.tsx:138-166` hand-validates 15 search params. This is a **native-SDK-facing contract that shipped binaries can never be updated to match**. `sso.tsx:56` and `monerium.callback.tsx:25-27` use bare `as string` casts before checking.

**rpc** — `packages/rpc/src/rpc-schema.ts` types are compile-time fiction at a trust boundary; `handleRpcMessage` does `params ?? data` with no runtime check.

The backend already ships **TypeBox schemas**, and the frontend already imports *types* from them (`apps/business/src/types/Campaign.ts` pulls from `@frak-labs/backend-elysia/domain/campaign`). The runtime validator is sitting in the dependency graph, unused.

**This is the single highest-leverage change available.** Adopt the existing TypeBox schemas as runtime validators; add valibot (smallest) for search params and RPC payloads.

### 6. Zero route loaders in the wallet app

`grep 'loader:|loaderDeps' apps/wallet/app/routes/**` → **no matches**. `beforeLoad` is used 10× for guards only. Meanwhile `app/main.tsx:78` sets `defaultPreload: "render"` — so the router prefetches *code* but has no *data* to prefetch. Every navigation is: navigate → mount → spinner → fetch → paint.

Worst case: `app/routes/explorer_.$merchantId.tsx:36-57` runs the entire route purpose inside a `useEffect` (wait for query settle → `navigate()` → `.then()` → open modal), and its query `app/module/explorer/hook/useGetExplorerMerchantById.ts:29-51` is an **unbounded serial paginated scan** — walking `/explore` 100 records at a time to find one merchant, up to 10 sequential round-trips, on the cold-start push-notification path. It also can't resolve a merchant that isn't explorer-listed, so some notifications never open their target. (There's an accurate `TODO` at `:16-23` naming the needed backend endpoint.)

Same pattern at `app/routes/install.tsx:158-190`.

The plumbing already exists: `useMerchantResolvedConfig.ts:20-34` and `install.tsx:206-227` already use `queryOptions(...)`, which is exactly what `loader: ({ context }) => context.queryClient.ensureQueryData(...)` consumes. Small change, large payoff.

**Steps:** pass `queryClient` into router context (`main.tsx:74`) → add loaders to `explorer_.$merchantId`, `history`, `wallet.index`, `profile.index`, `notifications` → keep the component hooks (they become instant cache reads).

### 7. `services/backend` is the de-facto shared schema package

wallet-shared, client, business, shopify, wallet and listener all depend on it. It exposes 18 subpath exports (`services/backend/package.json:75-93`) including `./infrastructure/persistence/postgres` and six `./domain/*/db/schema` paths. A **service sits at layer 2 of the package graph**, and the boundary is held only by convention.

Five files in wallet-shared alone couple to the backend's internal domain layer: `pairing/types/errors.ts:1,10`, `pairing/clients/origin.ts:1`, `pairing/types/ws.ts:9`, `types/Balance.ts:1`, `types/RewardHistoryItem.ts:1,7`.

Defensible for Eden Treaty, but should be an explicit `packages/api-contracts` extraction. That's also the natural home for the shared TypeBox validators from #5.

### 8. Chunking strategy duplicated three times and already drifted

`apps/{wallet,business,listener}/vite.config.ts` each carry their own copy. `apps/business/vite.config.ts:31-34` says "mirroring apps/wallet/vite.config.ts" — and has already drifted: `blockchain-vendor` is `/node_modules[\/](viem|@noble|@scure)/` vs wallet's `/node_modules[\/](viem|wagmi|@wagmi|permissionless|@noble|@scure|ox)[\/]/`. Different trailing anchoring means business's also matches `viem-something`.

`packages/dev-tooling` — which contains 422 LOC of genuinely excellent plugins — has **zero chunking logic**. That's where these belong.

Related: `apps/wallet/vite.config.ts:175` hardcodes wallet-shared's internal directory names into a chunk regex. When the bundler config has to name a package's internals, that package's barrel isn't doing its job.

### 9. Single error boundary in the wallet app

`errorComponent` appears once, at `apps/wallet/app/routes/__root.tsx:24`. A throw anywhere blanks the entire app — including in `walletMerge/component/MergeFlow/index.tsx` (314 LOC, irreversible financial operation) and `monerium/component/MoneriumBankFlow/index.tsx` (7-screen state machine).

`app/module/common/component/ModalOutlet/index.tsx:89-91` wraps lazy modals in `<Suspense>` with **no** error boundary, so a stale-deploy chunk 404 blanks the whole app because a modal failed to load.

**Fix:** `errorComponent` on the three layout routes (`_wallet/_protected.tsx`, `_protected-fullscreen.tsx`, `_auth.tsx`) covers nearly everything. Wrap `ModalOutlet`'s `Suspense` in a boundary that closes the modal and toasts rather than escalating.

---

## P2 — Libraries & Framework

**The stack choices are sound.** React 19 + TanStack Router/Query + Zustand + Viem/Wagmi + vanilla-extract + Vite 8/Rolldown is a modern, coherent, well-matched set. Versions are current, centralized in a root catalog, and recently pinned (`57331cc74`). **No framework replacement is recommended.**

What to add or remove:

| Action | Target | Why |
|---|---|---|
| **Add** | `valibot` (+ `@hookform/resolvers`) | Closes #5. Smallest bundle of the schema libs; TanStack Router supports it natively in `validateSearch`. |
| **Evaluate** | `babel-plugin-react-compiler` | 84 files use manual memoization in the wallet app; ~15 are provable no-ops (`sso.tsx:127-130` memoizes a property read; `SsoRegister.tsx:31-39` memoizes a boolean predicate). The compiler deletes this category instead of auditing it one by one. |
| **Remove** | `nprogress` + `@types/nprogress` (business) | ~5KB + CSS in the eager root chunk (`routes/__root.tsx:11`) for what's ~15 lines of CSS. `PendingLoader/index.tsx:16` also runs at module scope. |
| **Reduce** | `lucide-react` in business | Shadows identical design-system icons — `Pagination/index.tsx:133` (Chevrons), `AlertDialog/index.tsx:11` uses lucide `X` where DS has `CloseIcon`. Pick one icon source. |
| **Consolidate** | 5 raw `@radix-ui/*` packages in business | `common/component/Separator/index.tsx:1` uses `@radix-ui/react-separator` — a package *not even in design-system's deps*. `forms/Form/index.tsx:4` uses raw `@radix-ui/react-label` while DS ships `FieldLabel`. The DS-first strategy is ~70% executed. |
| **Add to DS** | `@radix-ui/react-dropdown-menu` | The one missing overlay primitive; business rolls its own via `cmdk`. |
| **Merge** | `packages/client` (87 LOC) → wallet-shared | One real consumer; its Eden client is a far weaker duplicate of `wallet-shared/src/common/api/backendClient.ts`, down to a copy-pasted `BACKEND_URL` default. |
| **Split** | `design-system/charts/` (7,323 LOC) | 30% of the package, vendored from bklit/visx, running a **second styling dialect** (`charts-utilities.css.ts:3-7` is "a scoped reimplementation of the Tailwind utility classes"), entirely untested, and reachable from sdk/components' inlined bundle. |

### Preact in the listener

Aliasing is currently **correct** — verified no uncovered specifiers (no `react-dom/server`, `react/compiler-runtime`, `scheduler`; `use()` unused). But it's structurally fragile: absolute-path aliases are hand-maintained (`apps/listener/vite.config.ts:216-242`) because wallet-shared and design-system declare *real* react as runtime deps.

This class of bug **already shipped once** for zustand — dual bundled copies from `@wagmi/core`'s pin, which is why five zustand subpath aliases exist at `vite.config.ts:243-267`.

Two further notes:
- `StrictMode` is a silent no-op under preact/compat (maps to Fragment) — `app/ui/runtime.tsx:18,60`. Double-invoke effect detection never runs.
- design-system's React-19 ref-as-prop pattern (`Button/index.tsx:25,31`, `Input/index.tsx:39`) is the sharpest remaining compat risk, and nothing in the build verifies ref forwarding across renderers.
- design-system lands **wholesale** in the listener's `lazy-shared` chunk (`vite.config.ts:410`) while hard-depending on `motion`, `@visx/*`, `d3-*`, `vaul`, `liquid-glass-react`. Protected only by tree-shaking; no lint or budget assertion covers lazy chunks.

---

## P2 — Notable code-quality items

- **`apps/business/src/module/campaigns/component/Creation/RewardCampaign/index.tsx` is 1545 LOC / 56KB** with ~15 inlined sub-components, and subscribes to the entire draft (`:1314`) so any write re-renders the whole step. Sibling `NewCampaign/` already shows the right extraction pattern.
- **~31KB of mock JSON statically imported into production query modules** — `campaigns/queries/queryOptions.ts:9`, `merchant/queries/queryOptions.ts:8`, `campaigns/api/mock.ts:3-4`, `members/api/mock.ts:1` — with no dev guard. The `/demo` route guard (`routes/demo.tsx:9-11`) blocks the route, not the bundle. Demo mode itself is reachable in prod by writing `demo-token` into localStorage (`config/auth.ts:28-29`). `mock/products.json` has zero importers — dead.
- **`gcTime: Infinity` + persister `maxAge: Infinity`** in *both* wallet (`RootProvider.tsx:27,44`) and business (`queryClient.ts:10-16`, `RootProvider.tsx:36`). The localStorage query cache grows monotonically for the browser-profile lifetime; only a deploy (`buster`) evicts. localStorage is synchronous and ~5MB — `QuotaExceededError` is unhandled. Recommend finite defaults (7d `maxAge`, 24h `gcTime`) with per-query overrides.
- **Derived state via self-referencing effect on the money path:** `apps/wallet/app/routes/_wallet/_protected/tokens.send.tsx:216-227` reads *and* writes `selectedToken` in an effect that depends on `selectedToken`. It terminates only because `getUpdatedToken` happens to return falsy on convergence — if it ever returns a fresh object, that's an infinite render loop on the token-transfer screen. Derive during render instead. Same file `:207-211`: a `setValue` effect that should be `useForm({ defaultValues })`.
- **Dead service-worker branch:** `apps/wallet/app/service-worker.ts:90` compares `client.url === "/"`, but `WindowClient.url` is always absolute. The condition is *always false*, so notification clicks always open a duplicate window instead of focusing the open app. The SW build also skips `removeConsole` (the `isSW` branch returns a config with no plugins), shipping `console.log` of a `WindowClient` per click (`:16,:89`).
- **OAuth refresh token in plaintext localStorage:** `apps/wallet/app/module/monerium/store/moneriumStore.ts:24-61` — no `partialize`, no `version`, no `migrate`. PKCE `pendingCodeVerifier`/`pendingState` persist indefinitely too. Currently prod-gated (`monerium.callback.tsx:19-21`) — **fix before lifting the gate.** Compare `biometricsStore.ts:56-65` and `pendingActionsStore.ts:118-136`, which get this right.
- **Business's bundle budget is warn-only** (`vite.config.ts:29,154-157`, `enforce: false`) while the listener's is a hard fail. Inverted relative to risk.
- **Duplication worth deleting:**
  - Two divergent `shortenAddress` impls producing *different strings for the same address* — `authentication/utils/shortenAddress.ts:7-11` (`0x123456...12345678`) vs `walletMerge/utils/shortenAddress.ts:13-16` (`0x1234…abcd`). The merge flow is the exact flow that asks users to compare addresses.
  - `apps/business/src/polyfill/bigint-serialization.ts` duplicates `packages/wallet-shared/src/polyfills/bigint-serialization.ts`, imported as a bare side-effect (`__root.tsx:9`) so it's untree-shakeable and invisible to knip.
  - `apps/business/src/module/common/hook/useCopyToClipboardWithState.ts` duplicates the wallet-shared version line-for-line — except business's carries a non-secure-context try/catch fix that never propagated upstream.
  - Two `extractDomain` impls inside the listener alone, with different anchoring: `useWalletStatusListener.ts:15-21` (unanchored `.replace("www.","")`) vs `lifecycleHandler.ts:148-154` (anchored regex).
  - Three pagination layers in business (`common/component/Pagination`, `TablePagination`, `members/component/TableMembers/Pagination.tsx`) while DS `DataTable` has its own `PaginationState`.
  - Two confirm dialogs: `common/component/AlertDialog` (16-prop god-component) vs `common/component/ConfirmDialog`.
- **Query key collision:** `apps/listener/app/module/queryKeys/merchant.ts` and `packages/wallet-shared/src/common/queryKeys/merchant.ts` both emit `["merchant","estimatedRewards",id]` — two modules writing the same cache entry with different shapes. 2 of the listener's 3 keys are dead.
- **Explorer query keys defined in three separate private objects** (`useGetExplorerMerchants.ts:8-12`, `useGetExplorerMerchantById.ts:5-8`, `useAffiliateShareLink.ts:4-7`) all writing the `["explorer", …]` namespace by string agreement. Every other feature centralizes in `<feature>/queryKeys/`.
- **Three incompatible error strategies in one business file:** `campaigns/api/campaignApi.ts` — swallow-to-empty-list (`:39-52`, a 500 renders as "no campaigns"), swallow-to-null (`:71-77`), and throw with `error?.toString()` yielding `[object Object]` (`:104,:129,:163,:180`). Plus 8 `as Campaign` casts erasing Eden Treaty's types.
- **Minor:** one legacy `forwardRef` (`ButtonLink/index.tsx:20`); `gcTime` < `staleTime` at `usePreviousAuthenticators.ts:13`; hardcoded English `aria-label` at `Password/index.tsx:47` in an i18n app; unstyled non-i18n 404 at `__root.tsx:83-88`; redundant `darkMode` sprinkles condition emitting 2× dead color classes (`design-system/src/sprinkles.css.ts:98-104`); unreachable guard in `business/src/module/forms/Form/index.tsx:61-63` (deref before null-check); six disagreeing size-variant vocabularies across DS recipes (`s|m` vs `sm|md|lg` vs `small|medium|large` vs `default|wide`).

---

## Docs are stale — worth correcting

Three claims in `CLAUDE.md` / `packages/wallet-shared/AGENTS.md:20` are **wrong**, and one actively misdirects contributors:

- *"AlertDialog exists in both wallet-shared and design-system"* — grep for `AlertDialog|Dialog` in `packages/wallet-shared/src` returns **zero** matches. `AGENTS.md:20` tells contributors to "pick based on app context" between two components, one of which doesn't exist. The **real** duplication is `apps/listener/app/module/modal/component/Modal/index.tsx:21,247-260`, which hand-builds raw radix, bypassing design-system entirely.
- *"Backend type coupling via **dev** dependency"* — it's a full `dependencies` entry (`packages/wallet-shared/package.json:63`).
- *"Barrel from package root only — internal paths discouraged"* — contradicted by 5 wildcard subpath exports in the manifest (`./pairing/*`, `./authentication/*`, `./wallet/*`, `./tokens/*`, `./providers/*`) and ~60 subpath import sites in wallet + listener.

Also stale: `apps/listener/AGENTS.md` references `app/entry.client.tsx` (actually `.ts`), `app/views/listener.tsx` (doesn't exist — now `app/bootstrap.ts` + `app/ui/runtime.tsx`), and `app/module/providers/` (doesn't exist — it's `app/ui/`). CLAUDE.md's design-system count ("~28 components" vs 59 dirs) and sdk/core figures are also off.

---

## Dependency graph (verified)

```
Layer 0 (zero workspace deps):
  frame-connector (packages/rpc)   published, 8 files / 1.7k LOC
  test-foundation, dev-tooling
  design-system                    [private] 334 files / 24.2k LOC
  app-essentials                   28 files / 2.4k LOC, only runtime dep is viem

Layer 1:
  core-sdk    -> frame-connector
  client      -> backend-elysia (dev)

Layer 2:
  backend-elysia -> app-essentials, core-sdk
  ui-preview     -> core-sdk, design-system
  components     -> core-sdk, design-system, frame-connector   [P0: design-system is private]
  react-sdk      -> core-sdk, frame-connector, [dev] wallet-shared   <== INVERTED

Layer 3:
  wallet-shared  -> app-essentials, backend-elysia, core-sdk, design-system
                    263 files / 31k LOC

Layer 4 (apps — no app->app edges, verified):
  nexus-wallet, nexus-listener, nexus-business, shopify-app
```

**Cycles:** none at package granularity. One intra-package cycle: `sdk/core/src/actions/referral/referralInteraction.ts:3` imports `{ watchWalletStatus }` from `../index` — the barrel that re-exports it. Harmless under ESM live bindings, defeats per-module tree-shaking on that path.

**Inverted edges:** react-sdk → wallet-shared (backwards two layers, leaks to published manifest); backend-elysia used as a shared type library by 6 workspaces, placing a service at layer 2.

**Deep imports past barrels:** zero repo-wide.

---

## What's genuinely good — don't regress

- **`apps/wallet/vite.config.ts`** — 12 priority-ordered Rolldown chunk groups; the `tanstack-vendor` > `blockchain-vendor` ordering fix for bun's content-addressed node_modules; the `tags: ["$initial"]` app-shell filter preventing shared modules from leaking into feature chunks; `PURE_OUTLET_PARENT_ROUTES` skipping ~210B chunks for layout shells, with the verification command written down.
- **The Tauri no-op stub alias** — aliases `@tauri-apps/*` to a stub on web builds so Rolldown drops the runtime entirely, rather than trusting DCE.
- **`apps/listener`'s three-ring architecture** — Ring 0 framework-free pure TS, Ring 1 dynamic-imported on first UI RPC, Ring 2 per-boundary chunks with wagmi/viem quarantined behind `lazy()`. Enforced by a 32KB gzip **hard-fail** budget plus two custom Rolldown plugins, each paired with an anti-no-op assertion so the stripper can't silently stop working.
- **`assertComponentRegistrations`** (sdk/components) — a `writeBundle` guard that fails the build if a `customElements.define` gets shaken out. Exactly the right response to a bug class unit tests structurally cannot catch.
- **Prod-build guard** — `getDefineProps()` throws when `FRAK_VARIANT=prod` but `BACKEND_URL` resolves to a dev host. Catches a silent shipped-to-users failure.
- **`apps/business/src/api/backendClient.ts`** — `stepUpAwareFetch` (`:81-98`) transparently retries after 2FA step-up with a documented reason why `onResponse` can't; `parse401` (`:47-66`) clones before reading the body.
- **`apps/listener/app/queryClient.ts:17`** — imports `QueryClient` from `@tanstack/query-core` rather than react-query, keeping React bindings out of Ring 0. Worth propagating.
- **`pendingActionsStore` migrate contract** (`:118-126`) — correctly identifies that unversioned persisted state is treated as v0 so `migrate` always runs, and must never throw.
- **`favoritesStore.ts:50-55`** — documents the `useSyncExternalStore` infinite-loop footgun from returning a fresh `Object.keys` array.
- **`sharing.test.ts`** — tests `validateSearch` through the router's real `parseSearchWith(JSON.parse)`, catching number-vs-string coercion that hand-built test objects would miss.
- **`app-essentials`** — the model shared package: `sideEffects: false`, one runtime dep, 7 explicit subpath exports, 6 consumers, zero internal deps.
- **design-system's vanilla-extract discipline** — one sprinkles call site (Box), recipe-as-default consistently applied across 26 files, three-tier tested tokens, radix behind every overlay primitive, zero raw hex in components. `ResponsiveModal/index.tsx:65-72` blurs `activeElement` to dodge the radix `aria-hidden`/FocusScope race — real a11y care.
- **Accessibility is tested** — `Back.test.tsx:88-101` asserts non-empty `aria-label`; `GlassCloseButton.test.tsx:46-57` asserts the i18n default and override.
- **Build configs are unusually well-commented**, explaining bundler-specific gotchas at the point of decision rather than in a wiki nobody reads.

---

## Suggested sequencing

**Now (hours)**
- #1 — move design-system to `devDependencies` + add the CI publishability gate
- #3 — swap `isRunningLocally` for `import.meta.env.DEV` in `walletContext.ts:85`
- `shortenAddress` dedupe
- SW `client.url` fix + add `removeConsole` to the `isSW` build
- delete `mock/products.json`
- doc corrections (stale AlertDialog claim, backend dep type, listener AGENTS.md paths)

**Next (days)**
- #2 + #4 — the postMessage trust boundary, as one piece of work
- #9 — route-level error boundaries + ModalOutlet boundary
- finite `gcTime` / `maxAge` in both apps
- `tokens.send.tsx` derived-state fix
- `crypto.randomUUID()` for channel ids (`packages/rpc/src/client.ts`)

**Then (weeks)**
- #5 — shared TypeBox validators (biggest single win)
- #6 — route loaders + the backend `GET /user/merchant/explore/:id` endpoint
- #7 — extract `packages/api-contracts`
- #8 — hoist chunk groups into dev-tooling
- split `RewardCampaign/index.tsx`
- move listener `Modal` onto the DS `AlertDialog`
- move sdk/react fixtures to test-foundation, drop the wallet-shared devDep

**Opportunistic**
- React Compiler evaluation
- DS consolidation in business (drop raw radix, one icon source)
- charts package split
- `packages/client` merge into wallet-shared
- add `check-exports` to sdk/components
- drop `/src` from published `files` (sdk/core:38, sdk/react:37)
- replace wildcard barrels (`sdk/core/src/bundle.ts`, `dev-tooling/src/index.ts`, `client/src/index.ts`)

---

## Bottom line

Don't change frameworks — change the boundaries. The library choices are good and current. What's missing is runtime validation (the schemas are already owned, just not run), CI enforcement at the publish boundary, and origin enforcement on the lifecycle channel.

The build engineering already demonstrates the team knows how to enforce invariants mechanically — `assertComponentRegistrations` and the 32KB budget are exactly the right reflex. Apply it to the two boundaries that currently have nothing.
