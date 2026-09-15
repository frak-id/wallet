---
title: Wallet Error Containment - Plan
type: fix
date: 2026-09-08
topic: wallet-error-boundaries
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Wallet Error Containment - Plan

## Goal Capsule

- **Objective:** A render error in the wallet app costs the user the section it happened in, not the whole app. The user always keeps a visible way to continue, and the team learns the error happened.
- **Means:** One shared error boundary inside `AppShell` on the four layouts that render it, `errorComponent` on the one that does not, and a boundary around `ModalOutlet`'s `Suspense` (KTD1, KTD2).
- **Product authority:** Closes `docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md` §6.2 #3 (also listed as X5 and as sequencing item #8). Containment only — recovery of in-flight flow state is not active scope.
- **Open blockers:** None.
- **Stop conditions:** Stop and ask if implementation requires changing `MergeFlow` or `MoneriumBankFlow` state handling, or if preserving `AppShell` chrome turns out to require restructuring `AppShell` itself.

**Product Contract preservation:** restructured and changed. Restructured, no scope change: R9 split — R9 keeps its original core intent (a failed modal closes without escalating), R10 takes the split-out surface behavior. R4 and R5 restated after research removed their premise of a second fallback variant; the protection they carried is unchanged and now sits on R5. Changed: R10 is new product behavior — a failed modal now raises a toast rather than closing silently (directed this session; see KD6). Added during review: R11 bounds containment to render-phase errors, R12 requires the caught error be announced and focused, R13 states that a fallback persists across sibling navigation. R11 and R13 name consequences the plan already entailed; R12 is a new accessibility commitment.

---

## Product Contract

### Summary

Add error containment to `apps/wallet`. A throw below the root degrades to a styled fallback scoped to the failing layout, reported through the existing `recordError`, with a hard reload as the escape. The app stops going blank; no flow state becomes recoverable that was not already.

### Problem Frame

`apps/wallet/app/routes/__root.tsx:27` is the only `errorComponent` in the app outside the standalone `sharing` entrypoint. Everything below it is uncovered, so any throw unmounts the entire tree and lands on the root fallback — a full-screen gate whose only affordance is reload.

Two failure modes make this concrete. `ModalOutlet` wraps every lazy modal in `<Suspense fallback={null}>` with no boundary (`apps/wallet/app/module/common/component/ModalOutlet/index.tsx:90`), so after a deploy a stale client requesting a since-removed chunk 404s and blanks the app — because a modal failed to load. And `MergeFlow` (irreversible, mounted under `_protected-fullscreen` via `VerifyEmail` and `AddEmail`, not a route of its own) throws into the same root boundary, so a user mid-merge loses not just the flow but every piece of app chrome that would tell them what state they are in.

The cost shape is that the blast radius is always the whole app, regardless of how local the fault was.

### Key Decisions

- KD1. **Containment, not recovery.** (session-settled: user-directed — chosen over per-flow safe-exit and full in-place retry: money flows already surface their expected errors through their own mutations, so boundaries only need to catch what those do not.) Governs R1, R7.
- KD2. **Boundary goes inside `AppShell`, not on the route, wherever `AppShell` renders.** (session-settled: user-directed — chosen over `errorComponent` on every layout: TanStack's `CatchBoundary` wraps the route's own `component`, so a layout-level `errorComponent` replaces that layout's chrome at the moment the user most needs it.) Governs R2, R3.
- KD3. **One shared boundary and fallback across all five sites.** (session-settled: user-directed — chosen over per-layout bespoke fallbacks: the sibling `apps/business` already accumulated 12 near-identical `errorComponent` declarations, which the audit lists separately as X8.) Governs R5.
- KD4. **The outermost fallback depends on nothing that may have thrown.** (session-settled: user-directed — chosen over assuming the shared fallback is safe there: `_wallet` is the only catch below root that fires when `AppShell` itself throws.) Governs R4.
- KD5. **Report through the existing `recordError`.** (session-settled: user-directed — chosen over adding a reporting path: 18 call sites across 12 `AppErrorSource` values already route to OpenPanel and Crashlytics; this adds a source value, not plumbing.) Governs R6, R10.
- KD6. **A failed modal is announced, not silently closed.** (session-settled: user-directed — chosen over closing silently: a silent close on a chunk 404 reproduces the audit's failure mode one level down, leaving the user retapping into nothing.) Governs R10.

### Requirements

**Placement**

- R1. A render error thrown below the root leaves the app usable: the user sees a fallback scoped to the failing layout rather than a blank screen or the root gate. Scoped by R11.
- R2. On every layout that renders `AppShell` — `_wallet/_auth`, `_wallet/_protected`, `_wallet/_protected-fullscreen`, `_wallet/_sso` — the boundary sits inside `AppShell`, around the outlet, so the shell's chrome survives the caught error. That chrome includes the banner stack (offline, session-expiring, pairing-in-progress, WebAuthn and ensure-conflict toasts) on all four, and additionally the bottom tab bar on `_protected`.
- R3. The offline banner in particular must remain visible through a caught error, since a connectivity fault is a plausible cause of the error the user is looking at.
- R4. `_wallet` — the one layout that renders a bare outlet with no `AppShell` — takes a route-level `errorComponent` instead, because no `AppShell`-scoped boundary can render when `AppShell` is what threw.
- R5. The fallback rendered at every site depends on nothing that may itself be implicated in the throw: no i18n, no router hooks, no React context. One component satisfies all five sites under that constraint.
- R11. Containment covers render-phase errors only. A `beforeLoad` throw runs before any component renders and still reaches the root fallback; that is the correct containment for a navigation-phase failure and is not a gap this work closes.

**Behavior**

- R6. Every caught error is reported through the existing `recordError` under a new `AppErrorSource` value distinguishing boundary catches from the root's existing `react_router` source. No second reporting path is introduced.
- R7. The fallback states that something failed and offers a way forward. It makes no claim about what did or did not happen to work in progress — a caught error carries no reliable signal about flow state, and the merge flow is irreversible.
- R8. The fallback's recovery action is a hard page reload, not an in-place boundary reset and not a history-back. A stale-deploy chunk 404 is only resolved by a fresh load fetching the current asset manifest. Its label names reloading rather than retrying, so it does not promise a client-side retry the action does not perform.
- R9. `ModalOutlet`'s lazy-modal `Suspense` is wrapped in a boundary. A modal that fails to load closes and leaves the user on the page beneath it, rather than escalating to any layout boundary.
- R10. A failed modal raises a dismissible toast in the app shell's banner stack, carrying the same hard-reload action as the fallback. The toast tells the user the modal could not open and that reloading resolves it.
- R12. A caught error is announced, not only rendered. The fallback moves focus to its recovery action so a keyboard user is not stranded where the unmounted subtree held focus, and assistive technology is told the content changed.
- R13. A layout fallback persists until reload rather than clearing on navigation, because the boundary keys on a stable value. A user who navigates to a sibling route inside the same layout still sees the fallback; leaving the layout unmounts it.

### Key Flows

- F1. Stale-deploy modal chunk 404
  - **Trigger:** A client loaded before a deploy opens a modal whose chunk no longer exists.
  - **Steps:** The dynamic import rejects; the `ModalOutlet` boundary catches it; the error is reported; the modal closes; a toast is raised in the banner stack.
  - **Outcome:** The user remains on the underlying page, is told the modal could not open, and can reload to pick up the new build.
  - **Covers R6, R8, R9, R10.**

- F2. Throw inside an irreversible flow
  - **Trigger:** A component under `_protected-fullscreen` throws mid-merge.
  - **Steps:** The boundary inside that layout's `AppShell` catches it; the error is reported; the fallback renders in the content area with the banner stack still visible; the flow unmounts.
  - **Outcome:** The user sees a scoped failure with a reload action, and no claim about whether the merge completed.
  - **Covers R2, R6, R7, R8.**

- F3. Throw in the shell itself
  - **Trigger:** `AppShell` or something it depends on throws, so no `AppShell`-scoped boundary can render.
  - **Steps:** The error propagates to `_wallet`'s route-level `errorComponent`, which renders without `AppShell`.
  - **Outcome:** A fallback with a reload action, instead of the blank screen or the root gate.
  - **Covers R1, R4, R5, R8.**

### Acceptance Examples

- AE1. **Covers R2, R3.** Given the user is on a `_protected` route and offline, when a child component throws, then the fallback renders in the content area while the offline banner and bottom tab bar remain visible.
- AE2. **Covers R9.** Given a modal chunk request 404s, when the user had opened that modal, then the modal closes, the page beneath stays interactive, and the app does not go blank.
- AE3. **Covers R7.** Given a throw occurs after the merge flow has submitted, when the fallback renders, then its copy asserts nothing about whether the merge succeeded.
- AE4. **Covers R8.** Given the fallback is showing after a chunk-load failure, when the user takes the recovery action, then the browser performs a full page load rather than a client-side reset.
- AE5. **Covers R4, R5.** Given `AppShell` itself throws, when `_wallet`'s fallback renders, then it displays correctly with no i18n, router, or context provider available above it.
- AE6. **Covers R10.** Given a modal failed to load, when the modal has closed, then a dismissible toast is visible in the banner stack offering reload; dismissing it leaves the user on the page.
- AE7. **Covers R13.** Given a throw rendered the fallback inside `_protected`, when the user navigates to a sibling route in that layout, then the fallback is still shown; leaving `_protected` unmounts the boundary and clears it.
- AE8. **Covers R12.** Given the fallback has replaced a content region that held keyboard focus, when it renders, then focus sits on its recovery action and the change is announced.
- AE9. **Covers R11.** Given a layout's `beforeLoad` throws, when the router resolves the failure, then the root fallback renders — the layout boundary never sees it.

### Scope Boundaries

- Recovery or preservation of in-flight flow state. `MergeFlow` and `MoneriumBankFlow` state machines are untouched.
- Expected, already-handled errors surfaced by mutations — `tokens.send`'s transaction errors and equivalents keep their current handling.
- Monerium, which is prod-gated.
- The root `errorComponent` and `notFoundComponent`, which stay as they are.

**Deferred to Follow-Up Work**

- The 12 duplicated `errorComponent` declarations in `apps/business` (audit X8) — a separate item in the same audit. Consolidating them onto this fallback is the natural sequel, and is what would later justify moving the component into `packages/design-system`.

### Dependencies / Assumptions

- `CatchBoundary` and `ErrorComponent` are exported from `@tanstack/react-router` (1.170.33, catalog-pinned), so no new dependency is needed. There is no `react-error-boundary` in the repo and none is being added. Note that as of 1.170.33 `ErrorComponentProps["error"]` is `unknown`, not `Error` — a fallback that reads `.message` or `.stack` must narrow with `instanceof Error` first.
- Router boundaries reset on `router.stores.loadedAt`, so a route-level caught error self-clears on navigation. R8's hard reload is a deliberate override for the stale-asset case, not a redundancy.
- `recordError` is safe to call from anywhere and no-ops when analytics are unconfigured, so adding call sites carries no bootstrap risk.
- The wallet service worker registers no `fetch` handler and caches no assets (`apps/wallet/app/service-worker.ts`) — it handles push and notification clicks only. R8 depends on this: a hard reload reaches the network for the new manifest. Adding asset caching later would break R8 silently.

### Sources / Research

- `docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md:102` (X5), `:172` (§6.2 #3), `:236` (sequencing item #8) — the finding and its three listings.
- `docs/audits/2026-07-31-frontend.md:112-118` — the original write-up and its proposed fix.
- `apps/wallet/app/routes/__root.tsx:31,74-90` — the sole existing boundary and the root fallback shape.
- `apps/wallet/app/module/common/component/AppShell/index.tsx:108-147` — chrome composition; the banner stack renders for all four layouts, the tab bar is gated on `navigation`.
- `apps/wallet/app/module/common/component/FullScreenGate/index.tsx` — the wallet's existing fallback vocabulary. Imports only `Box` and `Text`; no i18n, no router.
- `apps/wallet/app/module/pending-actions/component/EnsureConflictToast/index.tsx` — the store-driven banner-stack toast pattern R10 mirrors.
- `packages/wallet-shared/src/common/analytics/recordError.ts:53`, `events/diagnostics.ts:8` — the reporting entrypoint and the `AppErrorSource` union.
- `apps/wallet/app/utils/safeArea.test.ts:9,15,119` — the established convention for asserting a `recordError` call with a hoisted mock.
- `apps/wallet/app/routes/sharing.test.ts:6-9,32-60` — testing a route `errorComponent` by pulling it off `Route.options` and calling it directly.
- `apps/business/src/module/common/component/RouteError/index.tsx` — sibling prior art, and the duplication this plan avoids.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Use TanStack's `CatchBoundary` as the boundary primitive at every site.** It is already a dependency, takes an `errorComponent` and a `getResetKey`, and is the same class component the router uses internally. Adding `react-error-boundary` would duplicate it. There are six boundary instances — one inside `AppShell` covering four layouts, one on `_wallet`, one in `ModalOutlet` — and the shared fallback renders at the five layout sites; the modal site closes and raises a toast instead (R9, R10). Instantiates KD2 and KD3; governed by R2, R4, R5.
- KTD2. **The shared fallback extends the wallet's `FullScreenGate` vocabulary rather than porting `apps/business`'s `RouteError`.** `FullScreenGate` already renders with no i18n and no router, and `Box`/`Text`/`Button` use no React context — so a single context-free component satisfies every site including `_wallet`. Porting `RouteError` would import `useTranslation` and a router `Link`, which is exactly what R5 forbids. Instantiates KD3 and KD4; governed by R5.
- KTD3. **Fallback copy is hardcoded English, not i18n keys.** R5 forbids `useTranslation` in the fallback, and the root fallback at `__root.tsx:72-80` already sets this precedent with inline strings. The toast (R10) is the exception: it renders inside a working `AppShell`, so it uses i18n like its `EnsureConflictToast` sibling. Governed by R5, R10.
- KTD4. **The modal boundary reports and then delegates to the modal store**, calling the existing `closeModal` and raising a new toast store flag. Rendering a fallback inside the modal slot would leave a broken modal on screen; closing plus announcing is what R9 and R10 together specify. The flag lives in a new store beside `modalStore` rather than inside it: `modalStore` is a stack machine, while this is a raised/dismiss boolean matching `ensureConflictStore`. Instantiates KD6; governed by R9, R10.
- KTD5. **One new `AppErrorSource` value covers both the layout boundaries and the modal boundary.** KD5 asked for one value; the failing site is already distinguishable from the `context` field that `recordError` accepts. Governed by R6.
- KTD6. **Boundaries key on a stable value and clear on unmount, not on navigation.** `CatchBoundary` needs a `getResetKey`; the router's own boundaries key on `loadedAt`. These sit inside a layout component rather than on a route, so a constant key is correct — R8's reload is the recovery path, and a self-clearing boundary would only flash broken content back. The cost is the persistence R13 states. Governed by R8, R13.

### Assumptions

- `AppShell`'s `children ?? <Outlet />` shape (line 130) means wrapping the boundary around that expression covers both the layout-route case and any direct-children caller.

### Sequencing

U1 and U2 are independent of each other only in concept — U2 calls U1's source value, so U1 lands first. U3 depends on U1 and U2. U4 depends on U1 and U2. U5 depends on U3 and U4.

---

## Implementation Units

### U1. Add the boundary error source

- **Goal:** `recordError` can attribute an error to a React boundary catch.
- **Requirements:** R6 (KTD5, KD5).
- **Dependencies:** none.
- **Files:**
  - `packages/wallet-shared/src/common/analytics/events/diagnostics.ts` — extend the `AppErrorSource` union.
- **Approach:** Add one member to the union, named for a boundary catch rather than for a site, since KTD5 puts every site on one value. Verify the type re-exports through `packages/wallet-shared/src/common/analytics/index.ts` and `src/index.ts` unchanged.
- **Patterns to follow:** the existing union members and their naming shape in the same file.
- **Test scenarios:** none — pure type addition with no behavior. `Test expectation: none -- type-only change; U3 and U4 assert the value reaches `recordError`.`
- **Verification:** `bun run typecheck` passes and the new value is assignable at a `recordError` call site.

### U2. Build the shared boundary and fallback

- **Goal:** One context-free fallback component and one boundary wrapper exist, ready to mount at every site.
- **Requirements:** R1, R5, R7, R8, R12 (KTD1, KTD2, KTD3, KTD6, KD3, KD4).
- **Dependencies:** U1.
- **Files:**
  - `apps/wallet/app/module/common/component/ErrorBoundary/index.tsx` — create; the `CatchBoundary` wrapper plus the fallback.
  - `apps/wallet/app/module/common/component/ErrorBoundary/index.css.ts` — create; Vanilla Extract styles.
  - `apps/wallet/app/module/common/component/ErrorBoundary/ErrorBoundary.test.tsx` — create.
- **Approach:**
  1. Wrap `CatchBoundary` from `@tanstack/react-router` with a constant `getResetKey` per KTD6, an `onCatch` that calls `recordError` with U1's source, and the fallback as `errorComponent`.
  2. Build the fallback from `Box`/`Text`/`Button` only — no `useTranslation`, no router hooks, no context consumers (R5).
  3. Write the copy in the file rather than deferring it: it says something went wrong and that reloading continues, and asserts nothing about work in progress (R7). Do not carry over the root fallback's "please try again", which promises a retry the action does not perform (R8).
  4. The recovery action performs a hard reload (R8), carrying a one-line comment that the service worker caches no assets so a reload genuinely refetches the manifest — the trap a later reader would otherwise "fix" into a boundary reset.
  5. Move focus to the recovery action on mount and mark the fallback as an alert region, so a keyboard or screen-reader user is not stranded where the unmounted subtree held focus (R12).
- **Patterns to follow:** `apps/wallet/app/module/common/component/FullScreenGate/index.tsx` for composition and prop shape; its `index.css.ts` for the Vanilla Extract import style and token usage; `__root.tsx:67-83` for the reload-action shape.
- **Test scenarios:**
  - A child that throws on render causes the fallback to render instead of the child, and the child's content is absent.
  - A child that does not throw renders normally and no fallback appears.
  - A caught throw calls `recordError` once with the U1 source value (hoisted-mock convention).
  - The fallback renders with no i18n provider and no router provider mounted above it — AE5.
  - The fallback's copy contains no claim about saved, completed, or lost work — AE3.
  - Activating the recovery action triggers a full reload rather than clearing boundary state — AE4.
  - Focus lands on the recovery action when the fallback mounts, and the fallback is exposed as an alert region — AE8.
  - The recovery action's tap target meets the repo's 44px minimum.
- **Verification:** the boundary catches a thrown child in isolation, the fallback renders without providers, and reporting fires once per catch.

### U3. Mount the boundary at the five layout sites

- **Goal:** Every layout route contains a caught error rather than escalating it, with chrome preserved wherever chrome exists.
- **Requirements:** R2, R3, R4, R11, R13 (KTD1, KTD6, KD2).
- **Dependencies:** U1, U2.
- **Files:**
  - `apps/wallet/app/module/common/component/AppShell/index.tsx` — wrap the main content region's children in the boundary.
  - `apps/wallet/app/routes/_wallet.tsx` — add `errorComponent`.
  - `apps/wallet/app/routes/_wallet/_protected.tsx`, `_protected-fullscreen.tsx`, `_auth.tsx`, `_sso.tsx` — read to confirm coverage; these need no edit if the boundary lives inside `AppShell`.
- **Approach:**
  1. Place the boundary inside `AppShell` around the `children ?? <Outlet />` expression, so the banner stack and the tab bar render outside it and survive a catch (R2, R3).
  2. One placement in `AppShell` covers all four shell layouts; do not add per-layout declarations, which is the duplication KD3 rejects.
  3. Add `errorComponent` on `_wallet` only, using U2's fallback directly (R4).
- **Patterns to follow:** `AppShell/index.tsx:119-131` for the main region; `__root.tsx:26-29` for route-option shape.
- **Test scenarios:**
  - With the boundary mounted in `AppShell` and `navigation` enabled, a throwing child leaves the bottom tab bar and the offline banner rendered — AE1.
  - With `navigation` disabled, a throwing child still leaves the banner stack rendered.
  - `_wallet`'s route `errorComponent` is present and returns the fallback when invoked with an error, following the `Route.options` extraction convention.
  - A throw inside the shell content does not propagate to the root fallback.
  - A caught error in one layout leaves a sibling layout's boundary unaffected.
  - A fallback shown in `_protected` survives navigation to a sibling route and clears when the layout unmounts — AE7.
  - A `beforeLoad` throw reaches the root fallback rather than the layout boundary — AE9.
- **Verification:** a throwing child under each shell configuration renders the fallback with chrome intact, and `_wallet`'s option is wired.

### U4. Contain and announce modal load failures

- **Goal:** A modal that fails to load closes and tells the user, instead of blanking the app or vanishing silently.
- **Requirements:** R9, R10, R12 (KTD4, KD6, KD5).
- **Dependencies:** U1, U2.
- **Files:**
  - `apps/wallet/app/module/common/component/ModalOutlet/index.tsx` — wrap the `Suspense`.
  - `apps/wallet/app/module/stores/modalErrorStore.ts` — create; the raised/dismiss flag, mirroring `ensureConflictStore` rather than extending the `modalStore` stack machine (KTD4).
  - `apps/wallet/app/module/common/component/ModalErrorToast/index.tsx` — create the toast.
  - `apps/wallet/app/module/common/component/AppShell/index.tsx` — mount the toast in the banner stack.
  - `packages/wallet-shared/src/i18n/locales/en/translation.json` — add the toast's title, message, and action strings.
  - `apps/wallet/app/module/common/component/ModalOutlet/ModalOutlet.test.tsx` — create.
- **Approach:**
  1. Wrap the existing `Suspense` in U2's boundary so a rejected dynamic import is caught rather than escalated (R9).
  2. On catch, report through `recordError` with U1's source, close the modal via the store's existing `closeModal`, and raise the toast flag (KTD4).
  3. Render the toast in the banner stack alongside its siblings; it is dismissible and carries the hard-reload action (R10).
  4. Add i18n keys for the toast — it renders inside a working shell, so KTD3's hardcoding exception does not apply here.
  5. Label the toast's action for reloading, not retrying, so it matches what it does (R8). `AlertMessage` already carries `role="alert"`, so the announcement in R12 comes from reusing it.
- **Patterns to follow:** `EnsureConflictToast/index.tsx` for the store-driven toast shape, `AlertMessage` usage, and dismiss wiring; `ensureConflictStore` for the raise/dismiss store shape; `AppShell/index.tsx:112-118` for banner-stack placement.
- **Test scenarios:**
  - A lazy modal whose import rejects closes the modal and leaves the page beneath rendered — AE2.
  - The same failure raises the toast flag and reports through `recordError` once.
  - The toast renders when raised, is absent when not, and dismisses on the dismiss action — AE6.
  - The toast's action performs a hard reload, matching the fallback's behavior.
  - A modal that loads normally raises no toast and reports nothing.
  - A throw inside an already-rendered modal (not a load failure) is caught the same way rather than escalating to the layout boundary.
  - The toast's action and dismiss controls each meet the repo's 44px minimum tap target.
  - A toast raised while an offline banner is already shown stacks without displacing it.
- **Verification:** a rejecting dynamic import closes the modal, surfaces the toast, and reports once; a healthy modal is unaffected.

### U5. Prove the containment end to end

- **Goal:** The audit's two named failure modes no longer blank the app, verified against the running surface.
- **Requirements:** R1, R8, R9, R10.
- **Dependencies:** U3, U4.
- **Files:**
  - `apps/wallet/tests-light/specs/` — a light-suite spec if the failure is reproducible there.
- **Approach:** Exercise both audit failure modes against a running wallet: a throw inside a shell route, and a modal whose chunk cannot load. Confirm the app keeps chrome, shows the fallback or toast, and never renders blank. Where the light suite cannot induce a chunk 404, verify by temporarily forcing the import to reject in a scratch build and report that method instead.
- **Execution note:** This unit is verification, not new behavior — prefer a runtime smoke check over adding unit coverage that U2 through U4 already carry. Mutation-check the boundaries: disable the catch and confirm the suites from U2 through U4 go red.
- **Patterns to follow:** `apps/wallet/tests-light/specs/glass-button.check.ts` for light-suite spec shape and its mutation-verified convention.
- **Test scenarios:**
  - A route-level throw in a running wallet leaves the tab bar and banner stack visible and the app non-blank.
  - A failed modal chunk leaves the underlying page interactive with the toast visible.
- **Verification:** both audit failure modes reproduce as contained failures, and disabling either boundary turns the relevant suite red.

---

## Verification Contract

| Gate | Command | Applies to |
|---|---|---|
| Types | `bun run typecheck` | U1–U4 |
| Unit tests | `bun run test` (never `bun test`) | U2, U3, U4 |
| Lint + format | `bun run lint` and `bun run format` | all units |
| Comment budget | `bun run lint:comments` | U2 (the reload comment) |
| Runtime proof | `bun run test:light`, or the scratch-build method U5 names | U5 |

The wallet unit project is `wallet-unit`. Mutation check before declaring done: disable each boundary's catch in turn and confirm the corresponding suite fails.

---

## Definition of Done

- Every requirement R1–R13 is satisfied by a landed unit, and AE1–AE9 each have a passing test or a named runtime verification.
- The four `AppShell` layouts preserve their chrome through a caught error; `_wallet` renders its fallback with no providers above it.
- A failed modal closes, announces, and reports; the app does not blank in either audit failure mode.
- One `AppErrorSource` value covers every boundary catch; no second reporting path was added.
- The whole gate passes: `bun run format`, `bun run lint`, `bun run typecheck`, `bun run test`.
- The reload action carries its one-line service-worker comment, and `bun run lint:comments` stays green.
- No scaffolding, throwaway throw-injectors, or commented-out experiments remain in the diff.
- `docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md` §6.2 #3 and sequencing item #8 are updated to reflect the shipped state.
