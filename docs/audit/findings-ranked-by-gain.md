# Audit Findings — Ranked by Engineering Gain

**Date:** 2026-08-05
**Inputs:** `docs/audit/frontend-audit.md`, `docs/audit/frontend-ui-audit.md`, `docs/plans/2026-07-31-001-test-frontend-test-quality-audit-plan.md` (commit `e73842a43`)
**Method:** every quantified claim in those three docs was re-measured against the tree (`wc`, `stat`, `gzip -9`, `grep`, plus two synthetic rolldown-vite tree-shake probes). This document re-sorts the findings by *what we gain*, not by severity.

> **Read this first:** ten headline numbers in the source audits did not survive measurement — four overstated, two understated, four mis-diagnosed (including one filed as **P0** that is unreachable code). See [§0 Corrections](#0-corrections-to-the-source-audits). The rankings below use the measured numbers.

> **Scope:** this document tracks what is still **open**. Items are removed as they land and recorded, with their residual caveats, in `docs/audit/findings-resolved.md`.

**Two sorts are provided.** §1–§5 rank by *engineering dimension* (performance, bundle, code efficiency, complexity). §6–§8 re-rank by **exposure scope** (P1 listener/SDK → P2 wallet/Tauri → P3 business/shopify), which is the sort to act on — it moves a business-app bundle saving off the top spot and puts the postMessage trust boundary there instead.

---

## 0. Corrections to the source audits

| Claim | Source | Measured | Impact on priority |
|---|---|---|---|
| Devtools = "~75–90 KB gzipped, a third of the 275 KB budget" | ui-audit #8 | **18.6 KB gz eager** + 71.6 KB gz lazy chunk that is emitted but never fetched. Router/react-devtools tree-shake to **0.03 KB** — only `ReactQueryDevtools` fails to shake | Still the #1 bundle win, but it is **6.8%** of the budget, not 33%. Cause is narrower than described: a namespace re-export in `react-query-devtools` + no `sideEffects` field |
| "10 columns × 50 rows = ~500 flexRender calls" | ui-audit #11 | **Worse.** The campaigns table registers no `getPaginationRowModel()` and passes no `pagination` prop — it renders **all N campaigns**. Cost is `10 × N`, unbounded | Promoted. This has no ceiling |
| Mock JSON "~31 KB in the bundle" | frontend-audit P2 | 31,004 B raw → **5,590 B gz**. Real issue is demo data reachable in prod, not weight | Demoted as a bundle win, kept as a correctness/exposure item |
| Inter-tight "131 KB shipped" | ui-audit #19 | 134,672 B on disk confirmed, **0 consumers** confirmed. But no element requests the family, so browsers never download it — the web hot path cost is ~940 B of inlined `@font-face` | Demoted for web, **kept for Tauri** (real binary weight) |
| nprogress "~5 KB in the eager root chunk" | frontend-audit P2 | 4.1 KB gz total, and it **is genuinely used** (`PendingLoader/index.tsx:20-22`) | **Drop this finding.** Removing it is a net loss |
| "Three pagination layers" (duplication) | frontend-audit P2 | Not duplication — a 3-tier stack (primitives → composed → store adapter). Real finding: **354 LOC serving exactly one table** | Reframed: over-abstraction, not dedupe. Low value either way |
| `RewardCampaign/utils.ts` "re-implements the backend's validateRuleDefinition across 628 LOC" | frontend-audit #5 | **Zero copied code.** 627 LOC is mostly CPA split math + form⇄rule mapping with no backend equivalent. Genuine rule overlap ≈ 25 LOC. Both sides document the coupling deliberately | Reframed. The real defect is **drift**: the client never checks `percent ≤ 100`, which the backend enforces |
| Business budget `enforce: false` is "inverted relative to risk" | frontend-audit P2 | The config documents *why* (`vite.config.ts:22-28`): enforcing once blocked a deploy and was "fixed" by raising the number | Keep the finding, but the fix is a ratchet, not flipping a boolean |
| Charts are "reachable from sdk/components' inlined bundle" | frontend-audit P2 | **No sdk file imports `design-system/components/charts`.** `alwaysBundle: [/.*/]` is an allowlist, not a reachability rule — tree-reachability keeps charts out. Only 4 `apps/business` files import them | **Charts are P3, not P1.** Do not escalate the split on CDN grounds |
| Dark theme "ships light-ramp values that fail WCAG" — filed **P0** | ui-audit #5 | Contrast maths confirmed. But `theme.css.ts:59` gates the whole theme on `[data-theme='dark']`, and **nothing anywhere sets that attribute** — no `prefers-color-scheme` fallback either. The only residue is a `frak_theme` localStorage key `useLogout.ts:11` clears and nothing reads | **Not a P0 — it is unreachable.** Reframed: dead CSS shipped to every visitor (P1-6). Decide *delete or wire up*; if wiring up, fix contrast first, since `tokens.test.ts` currently asserts the broken values |

Two claims came back **stronger** than written: zero route loaders across **47 route files**, and the explorer scan has **no max-page cap** at all (it will 429 past page 30 against the backend's own 30-req/min limit).

One finding is **entirely new** and outranks most of the audits' bundle section: the CDN entry point is a shim that dynamically imports the real loader, so **every merchant page pays two sequential CDN round trips** before the iframe is even created (P1-4).

---

## 1. Runtime performance — user-perceived latency

Ranked by measured cost × how hot the path is.

| # | Finding | Location | Measured cost | Gain | Effort |
|---|---|---|---|---|---|
| P2 | **Campaigns table rebuilds all cells per checkbox** | `TableCampaigns/columns.tsx:293-300` | `selectedIds` in `useMemo` deps + store allocates a new `Set` per mutation → 10 column defs rebuilt and `10 × N` `flexRender` calls per click. **1 of 10 columns actually reads `selectedIds`**. No pagination → N unbounded | Selection cost drops from `O(10N)` to `O(1)` per click. Removes the only unbounded interaction cost in the app | **S** |
| P3 | **Explorer merchant lookup: uncapped serial scan** | `useGetExplorerMerchantById.ts:30-49` | `while(true)` over 100-record pages, **no page cap**, awaited serially. Backend limit is 30 req/min (`explorer.ts:8`) → a merchant past page 30 throws 429 mid-scan | One request instead of up to `ceil(total/100)`. Removes a hard failure mode, not just latency. Backend needs `GET /user/merchant/explore/:id` (the file's own TODO says so) | **M** (needs backend) |
| P4 | **Listener context re-renders 17 consumer sites** | `ListenerUiProvider.tsx:347-355` | Inline object literal as `value`; the other three members are *already* stabilized — the literal is the sole cause. **16 files / 17 call sites** | One `useMemo` stops the entire listener modal tree re-rendering on every provider state change. Listener is an iframe on merchant sites = hottest path in the product | **XS** |
| P6 | **Unbounded, unvirtualized history** | `history.tsx:19-70`, `useHistory.ts:15-46` | No slice/limit anywhere in the chain; `useGetRewardHistory` sends no query params so the server returns everything. Rendered in a Tauri WebView | Bounded first paint. Fixing the `${day}-${index}` keys also stops `MerchantLogo` re-fetch churn on every insert (list is timestamp-desc, so a new entry shifts every key) | **M** |
| P7 | **Infinite query cache** | wallet `RootProvider.tsx:27,44`; business `queryClient.ts:13` + `RootProvider.tsx:33` | Nothing is ever evicted; localStorage grows for the browser-profile lifetime. **Business has no `buster`** — wallet does (`APP_VERSION`) | Bounded memory + no unhandled `QuotaExceededError`. Business is the real risk: a payload schema change rehydrates stale shapes forever | **S** |
| P8 | **24 `Intl.NumberFormat` per sheet open** | `CampaignDetailsSheet/parts.tsx:20-52` | 6 formatters × **4 independent call sites** (each with its own memo — no sharing) | ~1–3 ms + GC churn per open. `intlCache.ts` already has `getDateTimeFormat`; add the twin | **XS** |

**Net gain:** P1+P2+P4 alone are ~30 LOC and remove the three worst interaction/entry-point costs in the product. P1 and P3 compound — if the explorer deep link ever ships in a push notification, it lands on a cold start *and* runs the uncapped scan.

---

## 2. Load performance — bytes on the critical path

The business eager budget is **gzipped** (`EAGER_JS_BUDGET_GZIP = 275 * 1024`), so these are directly comparable.

| # | Finding | Measured | Share of 275 KB budget | Effort |
|---|---|---|---|---|
| B1 | `ReactQueryDevtools` rendered unguarded (`RootProvider.tsx:92`) | **18.6 KB gz eager** (+71.6 KB gz dead lazy chunk) | **6.8%** | **XS** — one `import.meta.env.DEV &&`, matching what `__root.tsx:50-64` already does |
| B2 | Mock JSON in production query modules (7 files) | 5.6 KB gz | 2.0% | **S** |
| B3 | Shopify blocks FCP on a cross-origin font stylesheet (`root.tsx:69-71`) | **150–450 ms** FCP/LCP, per `dev-tooling/src/vite.ts:136-140`'s own docblock | n/a — latency, not bytes | **S** — `inlineFontFaces` already exists; shopify is the one app that never registered it |
| B4 | Inter-tight fonts, 0 consumers | 131.5 KiB **deploy artifact / Tauri binary**; ~940 B on the web path | ~0% web | **XS** |
| B5 | `welcome_logos_detail.webp` 183 KB, idle-prefetched on every boot within 2s | 183 KB for a modal most users never open | n/a | **XS** — re-encode → 40–55 KB expected |
| B6 | Shopify PNGs with `assetsInlineLimit: 0` | 45.8 KB across 2 files, full round-trip each | n/a | **XS** |
| ~~B7~~ | ~~nprogress~~ | ~~4.1 KB gz~~ — **it is used.** Dropped | — | — |

**Net gain:** B1+B2 = **24.2 KB gz off the eager path (8.8% of budget)** for roughly an hour of work. B3 is the single largest user-facing latency win in this section and the app already owns the tool that fixes it.

---

## 3. Code efficiency — LOC actually deletable

Measured with `wc -l`. "Deletable" means removable without a behaviour change unless noted.

| # | Item | LOC deletable | Verdict |
|---|---|---|---|
| C1 | `RewardCampaign/index.tsx` split | 1,544 LOC / 57.7 KB → extract ~15 inlined sub-components | **Real.** Largest file in the frontend by a wide margin. Also subscribes to the whole draft (`:1314`) so any write re-renders the step. Sibling `NewCampaign/` shows the pattern |
| C2 | `design-system/charts/` split | 7,323 LOC / 50 files = **30.13% of the package** (confirmed exactly) | **Real.** Second styling dialect, untested, vendored, reachable from sdk/components' inlined bundle |
| C3 | Business `AlertDialog` → `ConfirmDialog` | 234 LOC (125 + 40 css + 69 test), 4 call sites | **Rewrite, not a de-dupe.** 16 props (21 counting nested), incl. a dead `onSuccess` prop declared at `:27` and never used |
| C4 | Pagination chain | 354 LOC serving **one** table (`TableMembers`) | **Not duplication.** Over-abstraction. Deletable only if the chain is collapsed |
| C5 | `packages/client` | 88 LOC, **2 production import sites**, split across two unrelated concerns. `package.json` declares a `./types/*` export pointing at a directory that doesn't exist | Low value. Merge only if touching it anyway |
| C6 | `extractDomain` ×2 in listener | 6 LOC | **Do it** — and it fixes a latent bug: `"www."` (unanchored) vs `/^www\./`, plus different fallbacks (`url` vs `""`) for the same malformed input |
| C7 | `useCopyToClipboardWithState` ×2 | 26 LOC | **Blocked** by the `wallet-shared`-forbidden-in-business rule. Needs a neutral package. Business's copy is the better one (awaits + try/catch for non-secure contexts) |
| C8 | bigint polyfill ×2 | 13 impl + 46 test | **Blocked** by the same rule. Business's version is better (typed global vs two `as any` that violate the repo's own lint rules) |
| C9 | `shortenAddress` ×**3** (audit said 2) | ~18 LOC | Third undeclared copy at `RecoveryFlow/ValidateStep.tsx:202-204`. Consolidating **changes the rendered format** on the SSO screen — needs a product call, or keep two named helpers |
| ~~C10~~ | ~~`RewardCampaign/utils.ts` re-implements backend validation~~ | ~0 | **Mis-diagnosis.** No copied code; ~25 LOC of deliberate, commented client-side pre-validation. See §5 for the real defect |

**Net gain:** ~9,000 LOC of *structural* debt (C1+C2) versus ~110 LOC of genuine duplication. **The dedupe findings are not where the value is** — two of the four are architecturally blocked for a combined 39 LOC. C1 and C2 are the only entries here worth scheduling on their own.

---

## 4. Complexity & maintenance surface

Ranked by blast radius — how many places must change together today.

| # | Finding | Measured surface | What we gain | Effort |
|---|---|---|---|---|
| X1 | **No runtime validation, anywhere** | 0 schema libs in any `apps/*/package.json`. **44 inline `rules={{` blocks across 20 files** in business. Backend ships **345 `t.Object(...)` TypeBox schemas** + 3 dedicated `*/schemas` exports. Frontend already imports from `@frak-labs/backend-elysia` at **69 sites** — but **51 are `import type`** | One source of truth for constraints. The seam already exists and is already wired; **only the erased type layer crosses it today**. Every backend validation change is currently a silent client drift | **L** |
| X2 | **Chunk config triplicated** | wallet 153 + business 100 + listener 162 + 13 = **428 LOC**. `blockchain-vendor` regex differs in **all three**. `dev-tooling` (474 LOC src) is already imported by all three but exports **no chunking helper** | One definition. Also fixes measured drift: business's regex is unanchored (`node_modules/viem-anything` matches), and `radash` lands in a different chunk in each app. `react-vendor` is byte-identical between wallet and business incl. its comment — the obvious first extraction | **M** |
| X3 | **Raw z-index literals** | **51 literals across 36 files**; only **14 files** import the token. The design system itself bypasses its own token in 5 files. 4 live layering collisions confirmed (embedded wallet at 1001 vs `modal` 1000; gate ties `toast` 9999; listener modal at 210/220 *below* `zIndex.modal`) | Stacking order becomes greppable and reviewable. Removes a class of bug that only reproduces at specific viewport/flow combinations | **M** |
| X4 | **Breakpoints exported as bare numbers** | `breakpoints.ts` is 5 SLOC of numbers only. **24 hand-written media queries across 7 files**, all in business. 9 use `767px`, 12 use `768px` → confirmed 1px-wide broken state at exactly 768px where nav is visible *and* mobile header layout is active | Adding `up`/`below` helpers removes the collision **structurally**, not site by site. Highest structure-per-line-changed ratio in this table | **S** |
| X5 | **Wallet has one error boundary** | wallet: `errorComponent` ×**1**, `ErrorBoundary` ×**0**, across 13 route modules. business: 21 + 4 | Any throw in the merge flow (314 LOC, irreversible) or a stale-deploy modal chunk 404 currently blanks the entire app. 3 layout routes cover nearly everything | **S** |
| X6 | **`services/backend` is a layer-2 shared library** | **18 subpath exports**, 3 leaking persistence internals (`infrastructure/persistence/postgres`, 2× `db/schema`). All map to **raw `./src/*.ts`** — no build boundary. **6 workspaces** depend on it | An explicit `packages/api-contracts` gives the boundary a name and a review gate. Also the natural home for X1's shared validators | **L** |
| X7 | **Hardcoded colors** | **66 non-token hex literals across 21 files**. `apps/shopify` 21 + `apps/listener` 18 are the outliers; business (4) and wallet (2) are near-clean | Shopify imports **zero** DS tokens, so `[data-theme='dark']` is a complete no-op there. One architectural decision (Polaris vs Frak) resolves ~32% of all drift | **M** |
| X8 | **Business error boundaries are copy-paste** | 8 consecutive draft routes each declare `errorComponent: CampaignError`; 4 more declare `MerchantNotFoundError` | A layout-route boundary collapses 12 declarations to 2 | **XS** |

---

## 5. Correctness bugs filed under other headings

These are not perf or complexity findings, but they are cheap and they are wrong *today*.

| Finding | Location | Consequence |
|---|---|---|
| `key={index}` over a removable + appendable field array | `ProductsCampaign/index.tsx:259-260` | Deleting "A" from `["A","B","C"]` leaves the value visibly behind. RHF registration, focus and validation state bind to the wrong row. `useFieldArray` + `field.id` is the fix |
| Client never validates `percent ≤ 100` | `RewardCampaign/utils.ts` vs `CampaignManagementService.ts:578-584` | **The real defect behind the "re-implementation" finding.** Backend rejects at publish; the wizard lets you get there |
| Two `shortenAddress` formats in the merge flow | `authentication/` vs `walletMerge/` | The merge flow is the exact flow that asks users to compare addresses, and it shows a different truncation than SSO does |
| Business persister has no `buster` | `apps/business/.../RootProvider.tsx:33` | Combined with `maxAge: Infinity`, a payload schema change hydrates stale shapes indefinitely. Wallet gets this right |

---

## 6. Scope-weighted priority

Exposure tiers, per product reality:

| Tier | Scope | Audience | Frequency | Consequence of a defect |
|---|---|---|---|---|
| **P1** | `apps/listener`, `sdk/*`, `packages/rpc` | **Every visitor of every merchant site** | Every page view | Hits people who never chose Frak. Reputational + security blast radius is the whole customer base at once |
| **P2** | `apps/wallet` (web + Tauri) | Converted B2C users | Regular, mobile-heavy | Must feel smooth. Money paths live here |
| **P3** | `apps/business`, `apps/shopify` | Merchants | ~weekly, desktop, behind a login | Annoyance, not incident. Absorbs cost the others cannot |

### 6.0 What is actually on the P1 path (measured — this corrects my earlier framing)

The listener's three-ring architecture means "P1" is **not** uniform. Traced from `sdk/components/src/bootstrap/loader.ts` through `bootstrap.ts`:

**Runs on every merchant page view, zero user interaction:**
- `cdn/components.js` (3-line shim) → **dynamically imports** `cdn/loader.js` → **two sequential CDN round trips before anything starts**
- `loader.js` → `initFrakSdk` → `setupClient()` → `createIframe()` **unconditionally** (`setupClient.ts:30`)
- The `/listener` iframe document + its Ring 0 chunks (`index`, `common`, `vendor`, `rolldown-runtime`)
- `initClientId()` (a crypto op on first-ever visit), 2 preconnects, a `metrics.frak.id` ping
- `setupReferral` → `referralInteraction` → **at least one RPC round trip on boot**
- **All of `packages/rpc`** — `vite.config.ts:626` puts it in the `$initial`-tagged `common` chunk, and it is separately inlined into `loader.js` and `cdn/bundle.js`
- The design-system **reset + theme CSS**, injected at module top level (`loader.ts:9`)

**Ring 1 / Ring 2 — only once the SDK opens UI:** `ListenerUiProvider`, the modal, the embedded wallet, `blockchain-vendor` (~285 KB), all of design-system.

> **Correction to my own Tier 1 list:** I previously called `ListenerUiProvider` "the hottest path in the product." It is **Ring 1** — the only eager reference is a type-only import at `uiBus.ts:11`, which is erased. It costs nothing until a modal opens. Still P1 and still a one-line fix, but it is an *interaction*-path win, not a page-view one.

### 6.1 P1 — Listener / SDK (every visitor, every page)

| # | Finding | Path | Gain | Effort |
|---|---|---|---|---|
| **1** | **Lifecycle channel bypasses all origin validation** | Eager | `listener.ts:394-398` routes lifecycle messages *before* the middleware chain; with `allowedOrigins: "*"` (`bootstrap.ts:170`) **any origin can set `merchantId`/`origin`/`trustLevel`** — the trust root, self-asserted in the same message that authorizes it. Reachable: arbitrary `Session` writes, unvalidated CSS injection | **M** |
| **2** | **`walletContextMiddleware` fails open** | Eager | `walletContext.ts:80-90` logs "rejecting" then **processes the request anyway** when `isRunningLocally` — which is `STAGE`-based (a *runtime* value), so it is not statically eliminated and a misconfigured `STAGE` disables origin enforcement in a deployed build. Swap for `import.meta.env.DEV` | **XS** |
| **3** | **Lifecycle replies broadcast JWTs to `targetOrigin: "*"`** | Eager | `lifecycleEvents.ts:19,22` — every iframe→parent message, including `do-backup` payloads with live session + SDK JWTs. `includeUserActivation: true` also hands transient activation to an unverified origin. `pushBackupData` additionally `console.log`s the whole backup (`removeConsole` only runs when `isProd`) | **S** |
| **4** | **Two sequential CDN round trips before the iframe starts** | Eager | `components.js` is a 3-line shim that dynamically imports `loader.js` from jsdelivr, re-resolving `@${CDN_TAG}` at runtime. WordPress pins `latest` with no `?ver=`. This is pure serial latency on **every merchant page** — *not in the original audits* | **S** |
| **5** | **`@frak-labs/components@1.0.13` is uninstallable** | n/a | Verified live 404 — `design-system: workspace:*` is a **runtime** dep but the package is `private: true`. `tsdown.config.ts` already inlines it via `alwaysBundle`, so the manifest entry is dead weight. Every public install fails | **XS** |
| **6** | **`semanticDark` ships to every visitor and is 100% dead** | **Eager** | `theme.css.ts:59` emits a full second 42-token block into the base CSS injected by `loader.ts:9`. **Nothing in the repo sets `data-theme`** — verified across apps/sdk/packages/plugins/services; there is no `prefers-color-scheme` fallback either. The only residue is a `frak_theme` localStorage key that `useLogout.ts:11` clears and nothing reads | **XS** |
| **7** | **`packages/rpc` has zero tests, on both eager paths** | Eager | The whole package is `$initial` in the listener *and* inlined into both CDN bundles. Every downstream test `vi.mock`s it, so `listener.ts`/`client.ts` never execute under test. Planning research already saw a disabled origin guard leave **925 tests green** | **M** |
| **8** | **Embedded wallet paints over every modal** | Ring 2 | `zIndex: 1001` sits exactly 1 above `zIndex.modal` → renders over every DS Dialog/Drawer, trapping focus behind an un-dismissable panel. Listener's own modal is at 210/220, *below* `zIndex.modal` | **S** |
| **9** | **Embedded wallet CTAs have no accessible name** | Ring 2 | `ButtonWallet/index.tsx:25-33` renders `children` as a **sibling outside** the button; only `icon` is inside. The embedded wallet's primary Copy and Share actions announce as unnamed buttons | **XS** |
| **10** | 18 hardcoded hex colors, 0 DS tokens adopted | Ring 2 | `ButtonWallet` alone has 7. Listener is effectively un-themable | **M** |

**P1 verdict:** the top 3 are all the **same defect class** — the postMessage trust boundary is unguarded, and it is reachable by every visitor of every merchant site. That is the single most consequential cluster in the entire audit, and it ranks far above anything I put in my previous Tier 1. Items 4 and 6 are the only pure *page-view* performance wins available at P1; everything else on the eager path is already tightly budgeted (32 KB hard-fail).

### 6.2 P2 — Wallet / Tauri (B2C users, mobile, money paths)

| # | Finding | Gain | Effort |
|---|---|---|---|
| **1** | **OAuth refresh token in plaintext localStorage** | `moneriumStore.ts:24-61` — no `partialize`, no `version`, no `migrate`; PKCE verifier/state persist indefinitely. Currently prod-gated — **fix before lifting the gate**. Sibling stores get this right | **S** |
| **2** | **Explorer lookup: uncapped serial scan** | No page cap, 100/page, serial, against a 30-req/min backend limit → 429s past page 30. Compounds with #1: the moment a push points at `/explorer/{id}`, it lands on a cold start *and* runs this | **M** |
| **3** | **One error boundary for the whole app** | `errorComponent` ×1, `ErrorBoundary` ×0 across 13 route modules. A throw in the merge flow (314 LOC, irreversible) or a stale-deploy modal chunk 404 blanks the entire app. 3 layout routes cover nearly everything | **S** |
| **4** | **`GlassButton` erases focus repo-wide** | `outline: none` at base, `:focus` *and* `:focus-visible`, no substitute. This is the wallet's universal close/share/sort/back affordance — keyboard users have zero focus indication anywhere | **XS** |
| **5** | **Unbounded, unvirtualized history** | No slice/limit anywhere in the chain; server returns everything; rendered in a Tauri WebView. Index-derived keys over a timestamp-desc list mis-associate every row on insert, churning `MerchantLogo` fetches | **M** |
| **6** | **Missing safe-area insets** | `tokens.css.ts:388-392` documents that raw `env()` **returns 0 on Android Tauri** — and 4 sites use raw `env()` anyway, including `Drawer`, which is what every mobile `ResponsiveModal` renders | **S** |
| **7** | `welcome_logos_detail.webp` 183 KB, idle-prefetched every boot | For a modal most users never open. Re-encode → 40–55 KB | **XS** |
| **8** | 16px close button (13% of the 44px minimum) | `padding: 0`, no width/height, pinned 8px into the corner. 5 more sub-44px targets | **XS** |

> **Do not discount P2 on "it's lazy":** `preloadModalChunks.ts:18-55` fires **every** modal chunk on the first idle tick. Wallet modal weight is downloaded by all users regardless of whether they open one.

### 6.3 P3 — Business / Shopify (merchants, weekly, desktop)

Everything here is real but absorbs cost the other two tiers cannot. **Two exceptions escalate on cost-of-fix, not on exposure** — they are one-liners, so tier is irrelevant.

| # | Finding | Gain | Effort |
|---|---|---|---|
| **1** | Shopify blocks FCP on a cross-origin font stylesheet | **150–450 ms** per `dev-tooling`'s own docblock. `inlineFontFaces` already exists; shopify is the one app that never registered it — *escalate purely on effort* | **S** |
| **2** | Campaigns table rebuilds all cells per checkbox | `10 × N`, unbounded (no pagination model registered). Only 1 of 10 columns reads `selectedIds` | **S** |
| **3** | `key={index}` over a removable field array | **Correctness.** Deleting "A" from `["A","B","C"]` leaves the value visibly behind; RHF state binds to the wrong row | **S** |
| **4** | Campaign wizard territory field is keyboard-unreachable | `PopoverTrigger asChild` onto a plain `<div>`. A **required** field — the flow cannot be completed by keyboard at all | **S** |
| **5** | Business persister has no `buster` + `maxAge: Infinity` | A payload schema change rehydrates stale shapes forever. Wallet gets this right | **S** |
| **6** | `FieldError` is silent + 11 dangling `aria-describedby` | Validation errors are never announced. Business-only (wallet has its own `Field`) | **S** |
| **7** | Sidebar collides with content at exactly 768px | 9 sites use `767px`, 12 use `768px`. Confirmed 1px-wide broken state | **S** |
| **8** | Mock JSON in production query modules | 5.6 KB gz, but the real issue is demo data reachable in prod via a localStorage token | **S** |
| **9** | Client never validates `percent ≤ 100` | Backend rejects at publish; the wizard lets you get there | **XS** |
| **10** | `RewardCampaign/index.tsx` 1,544 LOC | Subscribes to the whole draft, so any write re-renders the step | **L** |
| **11** | Shopify imports **zero** DS tokens | 21 hex literals; `[data-theme='dark']` is a no-op there — though see P1-6: it is a no-op *everywhere* | **M** |
| **12** | 24 `Intl.NumberFormat` per sheet open | 6 × 4 independent call sites | **XS** |
| **13** | `design-system/charts/` — 7,323 LOC / 30% of the package | **P3, not P1** — see §0. Untested, second styling dialect | **L** |

### 6.4 Cross-cutting — inherit the tier of the highest consumer

| Finding | Consumers | Effective tier | Note |
|---|---|---|---|
| **Shared TypeBox validators** | all 4 apps + wallet-shared | **P1** (rpc payloads) → P3 (forms) | `rpc-schema.ts` types are compile-time fiction *at the trust boundary* — that slice is P1 and belongs with the §6.1 cluster. The 44 business form `rules` blocks are P3 |
| **`packages/api-contracts` extraction** | 6 workspaces | P1 boundary, P3 urgency | 18 subpath exports, 3 leaking persistence internals, all raw `./src/*.ts` |
| **Chunk config triplicated (428 LOC)** | wallet, business, listener | P2/P3 | Listener's is the one with a hard-fail budget, so drift there is caught. `react-vendor` is byte-identical wallet↔business — start there |
| **`zIndex` token bypassed (51 literals / 36 files)** | all | P1 (embedded wallet) → P2 | The 4 live collisions span tiers; the token itself is correct |
| **`prefers-reduced-motion` unguarded** | DS keyframes + 11 files | P1 (sdk Banner keyframes, listener Spinner) | Two **infinite** animations (Skeleton pulse, Spinner spin). `MotionConfig`/`useReducedMotion` = 0 matches repo-wide |
| **DS `Slider` is fully unreferenced** | none | dead code | Verified zero consumers outside its own directory; drags `@radix-ui/react-slider` into the graph |
| **CI runs no quality job** | all | **P1** | 7 workflows, only the listener bundle budget. The 4-command gate at `AGENTS.md:16` is human-enforced and has measurably leaked |

---

## 7. Revised sequencing (scope-weighted)

### Now — P1 trust boundary, as one piece of work

The three findings are one defect and should not be split: **route lifecycle messages through origin validation** (`packages/rpc/src/listener.ts`), **replace `allowedOrigins: "*"` with the resolved merchant origin**, **swap `isRunningLocally` for `import.meta.env.DEV`**, and **stop broadcasting to `targetOrigin: "*"`**. Then add runtime validation on the RPC payload slice only — not the whole X1 programme.

Reachable by every visitor of every merchant site, and `packages/rpc` has **no tests that execute it**, so nothing will tell you if this regresses. Pair the fix with the first real tests in that package.

### This week — one-liners, any tier

| # | Change | Tier | Gain |
|---|---|---|---|
| 1 | `sdk/components`: design-system → `devDependencies` | P1 | The package becomes installable at all |
| 2 | Delete `semanticDark` (or wire up a theme switch) | P1 | Dead CSS off every visitor's critical path |
| 3 | `GlassButton` focus-visible ring | P2 | Restores keyboard focus wallet-wide |
| 4 | Delete `mock/products.json` and DS `Slider` | P3 | Two dead modules |
| 5 | `ButtonWallet` accessible name | P1 | Primary embedded-wallet actions stop announcing as unnamed |

### Next — P2 smoothness + the P1 latency item (days)

6. Add `modulepreload` for `cdn/loader.js` in the merchant plugins (P1 — see the note below; the shim itself must stay)
7. `moneriumStore` hardening, before the prod gate lifts
8. `errorComponent` on wallet's 3 layout routes + a boundary around `ModalOutlet`'s `Suspense`
9. Retire the bespoke `DetailOverlay` portal in favour of the DS `Dialog` (it now has dialog semantics, but still no focus trap — see the resolved-log caveat)
10. Safe-area insets (Tauri Android renders raw `env()` as 0)
11. Shopify `inlineFontFaces` + business persister `buster` (P3, both cheap)

### Then — structural (weeks)

12. Backend `GET /user/merchant/explore/:id`, then point the explorer hook at it (P2, removes the 429 failure mode)
13. Shared TypeBox validators, **P1 slice first** (RPC payloads), forms later
14. `up`/`below` in `breakpoints.ts`; hoist chunk groups into `dev-tooling`
15. Split `RewardCampaign/index.tsx` and `design-system/charts/` (both P3 — schedule last)

> **P1-4 (two CDN round trips) — analysed, do NOT merge the shim.** Live `curl` probes against
> jsDelivr showed the `?v=` cache-buster is inert (the edge ignores query strings; both files carry
> the same 7d/12h TTL). But the shim is *load-bearing for a different reason*: `cdn/loader.js` emits
> **relative** dynamic chunk imports, and the unversioned merchant URL has no directory segment, so
> the shim's re-anchoring to `.../components@latest/cdn/` is what makes every lazy component chunk
> resolve. Inlining the loader 404s all of them for every unversioned merchant — silently, because
> `register()` swallows the error and the `:not(:defined)` rule keeps the elements invisible. The
> real fix is a `modulepreload` hint in the plugins (sequenced at #6), which requires dropping the
> inert `?v=` first (different cache keys) and a plugin release to reach merchants.

### Add the enforcement the repo already knows how to write

Every P1 finding above survived because **no gate covers that boundary**. The repo demonstrably knows the reflex — `assertComponentRegistrations`, the 32 KB hard-fail budget, the prod-build `BACKEND_URL` guard. Missing: a publishability check (catches P1-5), an origin-enforcement test that actually executes `packages/rpc` (catches P1-1/2/3), and *any* CI job running the four-command gate.

---

## 8. What we actually gain, per tier

**P1 — Listener / SDK.** The bytes are already well-controlled: a 32 KB gzip **hard-fail** budget, a genuinely framework-free Ring 0, and three interlocking strippers with anti-no-op assertions. There is very little performance left to win here, and the audits' bundle findings mostly do not land on this tier. What we gain at P1 is **not speed — it is trust**: closing a postMessage boundary that any origin can currently drive, on a surface loaded by every visitor of every merchant site, currently defended by zero executing tests. Plus two clean deletions (dead dark theme, one CDN hop).

**P2 — Wallet / Tauri.** This is where the *experience* gains are, and they are concentrated in cheap fixes: one notification cold start, one always-false comparison, one missing focus ring across the app's universal button, 131.5 KiB out of the mobile binary. The structural item (route loaders across 47 files) converts every navigation from navigate→spinner→fetch→paint into fetch-in-parallel. Two money-path defects (`tokens.send` render loop, plaintext refresh token) are latent rather than live — fix before they are not.

**P3 — Business / Shopify.** Correctly deprioritized. The headline bundle win I originally ranked #1 lives here, and at merchant-weekly frequency behind a login on desktop, 18.6 KB gz is close to irrelevant — it stays on the list only because it is one line. The genuine P3 items are **correctness, not performance**: a field array that silently corrupts form state, a required wizard field unreachable by keyboard, a validation gap that lets merchants build a campaign the backend will reject. The 9,000 LOC of structural debt (`RewardCampaign`, `charts`) is real and should be scheduled **last**.

**The reframe this exercise produced.** Sorting by dimension put a business-app bundle saving at #1. Sorting by scope puts the postMessage trust boundary there, and it was P0 in the source audit all along — I under-weighted it because it is not a performance finding. The corrected picture:

- **P1 is a security and correctness tier, not a performance tier.** Its perf is already the best-engineered part of the repo.
- **P2 is the performance tier**, and its wins are unusually cheap.
- **P3 is a correctness tier** whose performance findings can wait.

The recurring shape across all three is unchanged and still the most useful thing in this document: *every finding sits at a boundary where an existing abstraction carries only half its load* — `dev-tooling` exports no chunking helper, `backend-elysia` crosses 69 import sites but only as types, `breakpoints.ts` exports numbers but no queries, the `zIndex` token is bypassed by 72% of its would-be callers, and `packages/rpc` is on two eager paths with no tests. **None of this needs new architecture. It needs the existing abstractions to export one more thing, and the existing enforcement reflex pointed at four boundaries that currently have nothing.**
---

## Appendix — measurement provenance

All figures re-derived on 2026-08-05 against the working tree at `e73842a43`:
- Byte sizes: `stat -c%s`, `gzip -9 -c | wc -c`.
- Tree-shake behaviour: two synthetic prod builds in `/tmp` using the repo's own `rolldown-vite` v8.1.5 against `apps/business/node_modules`. No repo file was modified, and no app build was run (`apps/business/dist` does not exist).
- LOC: `wc -l` (physical lines, incl. comments/blanks) — comment-dense files therefore overstate logic removed.
- Counts (`zIndex:`, hex, `rules={{`) are **lower bounds**: indirection through a local const, `rgba()`/`hsl()` colors, and multi-key rule blocks are not captured.
- Not measured: wall-clock profiling. All runtime costs are derived statically from render/construction/round-trip counts, not benchmarked.
- **No CDN/dist artifact exists on disk** (`find` for `dist`/`cdn`/`build` outside `node_modules` returns nothing), so **no P1 bundle size was measured**. The only figures available are changelog-attested: `sdk/core/cdn/bundle.js` 39.0 KB / 13.2 KB gz and `sdk/components/cdn/loader.js` 45.5 KB / 14.9 KB gz (CHANGELOG #183). The listener's "~28 KB gz eager" is a **code comment only** (`vite.config.ts:75`).
- To get authoritative P1 numbers: `bun run build:sdk` then gzip the `cdn/` outputs, and `bun run --cwd apps/listener build`, which prints `[eager-budget] boot JS: X KB gz across N chunks (limit 32 KB)`. **Worth doing before acting on any P1 sizing claim, including mine.**
- Ring classification (§6.0) is from static import-graph tracing plus the chunk-group regexes, not from a built manifest. The regexes are hand-maintained over file paths, so a file move silently reclassifies a module's ring — only the 32 KB budget assertion catches it.
