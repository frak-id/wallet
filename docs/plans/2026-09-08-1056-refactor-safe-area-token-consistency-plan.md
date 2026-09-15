---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
date: 2026-09-08
topic: Safe-area inset token consistency
---

# Safe-Area Inset Token Consistency

## Goal Capsule

**Objective:** Safe-area insets resolve correctly on every wallet surface on every
host — notched iOS, edge-to-edge Android, and web — and a bypass that would
silently reintroduce a clipped CTA cannot reach `dev`.

**Means:** Route all nine hand-typed `env(safe-area-inset-*)` call sites through
the existing `safeArea` token, then gate the raw spelling out of `.css.ts`
(KTD1, KTD2).

**Product authority:** Audit item §6.2 #6 in
`docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md`, re-grounded against the tree on
2026-09-08. The audit entry is stale in both directions and is corrected by this
plan (see Problem Frame). Business-app edge-to-edge and the native sharing-sheet
inset contract are not active scope.

**Open blockers:** None.

**Stop conditions:** Stop and ask before changing any `.kt` or `.swift` file, before
touching `apps/business`, and before running `test:light:update`. A pixel diff is a
regression to diagnose, never a baseline to refresh.

**Execution profile:** Behavior-preserving refactor plus one new gate. The proof is
the existing pixel suite showing no change, not new tests — only the gate earns a
verification of its own, and by mutation (KTD3).

## Product Contract

### Summary

Nine `.css.ts` sites hand-type `env(safe-area-inset-*)` instead of importing the
`safeArea` token that exists for exactly this purpose. Four of them drop the
`var()` wrapper entirely and therefore resolve to `0` on Android Tauri, clipping
content behind the navigation bar. All nine move to the token, leaving the seed
in `reset-globals.css.ts` as the only file allowed to name `env()` directly, and
a lint gate holds that line.

### Problem Frame

The `safeArea` token is documented, correct, and already used by roughly fifteen
sites. It was still bypassed nine times. That ratio — not any single clipped
button — is the actual finding: the token is advisory, so consistency decays
every time someone writes the expression from memory.

The bypasses fall into two kinds, and only one is a live defect.

Four sites use bare `env(safe-area-inset-*)` with no `var()` wrapper. Android
Tauri's WebView draws edge-to-edge but never populates the CSS `env()` values —
`packages/design-system/src/tokens.css.ts:384-392` documents this — so these
resolve to `0` and bottom content sits under the nav bar. `Drawer` is the
consequential one: it is what every mobile `ResponsiveModal` renders, and the
same file already uses the token correctly twenty-five lines further down.

Three more sites hand-inline the token's exact composite expression. They are
byte-identical in output today and are not bugs. They matter because they are the
copy-paste source for the next bypass, and because a gate cannot be
exception-free while they exist.

Two audit claims did not survive re-grounding, and this plan supersedes them.
`packages/design-system/src/reset-globals.css.ts:28-35` now seeds
`--safe-area-inset-*` from `env()` on `:root`, which the audit predates — so the
token resolves on iOS and web, and the finding is narrower than filed. In the
other direction the audit counted four bypasses and there are six, having missed
both sharing sites.

### Key Decisions

- **Import the token at all nine sites rather than inlining its composite.**
  (session-settled: user-directed — chosen over inlining the
  `var(--safe-area-inset-*, env(…, 0px))` form: inlining forces the gate into a
  negative-lookbehind regex that still cannot catch a wrong fallback or a
  `top`/`bottom` axis mismatch inside the wrapper.) Governs R1, R2, R3, R6.

- **The gate is a flat ban with exactly one allowlisted file.**
  (session-settled: user-directed — chosen over allowlisting the sharing files:
  an exception justified by a contract documented in another file outlives the
  reason a reader can see.) Governs R6, R7.

- **The two sharing sites are swapped, not excepted.** (session-settled:
  user-directed — chosen over allowlisting them as native-contract-bound: the
  emitted CSS is equivalent on both native hosts, so the swap is a spelling
  change and the native contract is untouched.) Governs R3, R9.

- **Business-app edge-to-edge is a product call, not part of this work.**
  (session-settled: user-directed.) `apps/business/index.html:5` carries no
  `viewport-fit=cover` and `apps/business/src/styles/all.ts` imports
  `design-system/theme` rather than `/global`, so it never loads the seed.
  Adding an inset to `FloatingFooter` would resolve to `0px` twice over.
  It governs no requirement — the exclusion is recorded in Scope Boundaries.

### Requirements

**Correctness — the live defect**

- **R1.** The four sites that resolve to `0` on Android Tauri import `safeArea`
  from `@frak-labs/design-system/tokens` and consume the matching axis:
  `packages/design-system/src/components/Drawer/drawer.css.ts:31`,
  `packages/design-system/src/components/DetailSheet/detailSheet.css.ts:62`,
  `packages/design-system/src/styles/inAppBanner.css.ts:19`, and
  `apps/wallet/app/module/common/component/FullScreenGate/index.css.ts:19`.

- **R2.** `FullScreenGate` and `Drawer` each use the token on both of their inset
  lines. Both files currently mix the two spellings within a few lines of each
  other.

- **R3.** The two sharing sites import the token:
  `packages/wallet-shared/src/sharing/component/PostShareConfirmation/postShareConfirmation.css.ts:97`
  and
  `packages/wallet-shared/src/sharing/component/SharingPage/sharingPage.css.ts:350`.
  Emitted CSS is unchanged on every host; only the spelling moves.

**Consistency — removing the copy-paste source**

- **R4.** The three sites that inline the token's composite expression import it
  instead: `apps/wallet/app/module/authentication/component/AuthActions.css.ts:12`
  and `packages/design-system/src/components/DetailSheet/detailSheet.css.ts:9,31`.

- **R5.** No `.css.ts` file outside the allowlist contains the literal
  `env(safe-area-`.

**Enforcement**

- **R6.** A check script bans the literal `env(safe-area-` in `.css.ts` files
  under `apps/`, `packages/`, and `sdk/`. It follows the existing
  `scripts/check-*.ts` shape (see `scripts/check-ios-floor.ts`) and is wired into
  `bun run lint` alongside the other `check:*` entries at `package.json:54`.

- **R7.** `packages/design-system/src/reset-globals.css.ts` is the sole
  allowlisted file. It must keep raw `env()`: it assigns the custom properties the
  token reads, and WKWebView does not evaluate `env()` from inside a `var()`
  fallback, so the seed is what makes the token resolve on iOS at all.

- **R8.** The gate is scoped to `.css.ts`. It does not scan `.kt` or `.swift`,
  where `env(safe-area-inset-bottom)` appears in prose comments
  (`sdk/android/…/FrakSharingSheet.kt`, `sdk/ios/…/SharingWebView.swift:111-114`)
  and would false-positive.

- **R8a.** The `AuthActions.css.ts` docblock at line 7 names
  `env(safe-area-inset-top)` in prose and trips the literal ban even after R4
  swaps line 12. Rewrite the comment to describe the trap without spelling the
  banned literal. Scoped to that: `bun run lint:comments` does not reach this file
  (`scripts/check-comments.ts:15-18` lists native roots only), so no gate governs
  the docblock's length and any further trimming is the implementer's judgment.

**Provenance**

- **R9.** The commit body states that the native contract is unchanged because the
  seed still comes from `env()`, citing
  `apps/wallet/app/entry/shared/bootstrap.tsx:28` (the standalone pages load the
  seed) and `sdk/android/…/FrakSharingSheet.kt:146` (Android pads natively via
  `windowInsetsPadding(safeDrawing)`). This exists so a later reader does not
  mistake the sharing swap for a contract change.

- **R10.** `docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md` §6.2 #6 records the outcome and
  corrects the two stale claims: the seed added since the audit, and the true
  bypass count of six rather than four.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan owns one area: token consistency across the wallet and design-system
`.css.ts` surfaces, plus the gate that keeps it. The breakdown below is how the
safe-area work is understood today, not a committed roadmap.

- **Native sharing-sheet inset contract** — *Can proceed independently of* this
  plan. Android pads via `windowInsetsPadding(safeDrawing)` and iOS delegates to
  the page's inset by setting `contentInsetAdjustmentBehavior = .never`. Settled
  in `docs/plans/native-sdk/decisions.md`; this plan changes the CSS spelling
  those hosts consume, not the contract itself.
  - *Shares* the `safeArea` token with this plan, which is why R3 keeps the
    sharing sites inside the gate rather than excepting them.
- **Business-app edge-to-edge** — *Depends on* nothing here and is blocked by a
  product question, not a technical one: whether business mobile-web is a
  supported surface worth the layout risk. `FloatingFooter` is its symptom.
  - *Still to decide*: if that answer is ever yes, the gate this plan installs
    already covers `apps/business` `.css.ts` files, so the work starts from an
    enforced baseline rather than a fresh audit.

### Scope Boundaries

**In scope:** the nine `.css.ts` sites; the check script and its `bun run lint`
wiring; the audit record.

**Out of scope:**

- Business-app edge-to-edge. `FloatingFooter` keeps `bottom: 0` with no inset.
  Making it real means opting the whole app into `viewport-fit=cover` and loading
  `reset-globals` — a product decision about whether business mobile-web is a
  supported surface, not a CSS fix.
- Any native change. `FrakSharingSheet.kt` and `SharingWebView.swift` keep their
  current inset behavior; the decisions in `docs/plans/native-sdk/decisions.md`
  stand.
- No new token, no change to the `safeArea` shape, and no change to
  `apps/wallet/app/utils/safeArea.ts` or its keyboard-collapse behavior.

### Success Criteria

- On Android Tauri, the `Drawer` that every mobile `ResponsiveModal` renders
  clears the navigation bar.
- `bun run lint` fails on a newly introduced raw `env(safe-area-` in any
  `.css.ts`.
- `bun run test:light:pixels` on `/sharing` shows zero pixel diff. **Any diff is
  a regression, not a re-baseline** — do not run `test:light:update`. The pixel
  variant is required: plain `bun run test:light` does not shoot snapshots, so it
  would pass by not looking.

### Outstanding Questions

None. Both questions carried from the brainstorm were resolved during planning:
`/install` does have pixel coverage (`install.check.ts:81`, four baselines), and
the verification command is pinned in the Verification Contract below.

## Planning Contract

**Product Contract preservation:** unchanged. Planning added R8a (a gate
collision the brainstorm did not have the grep evidence to see) and resolved both
Outstanding Questions; no requirement was weakened, reworded, or rescoped.

### Key Technical Decisions

- **KTD1. Build the gate before swapping any site.** The script's failure output
  is the authoritative worklist, so the swap is verified by the gate turning green
  rather than by re-running a grep that could differ from what the gate matches.
  Instantiates the product decision governing R6, R7.

- **KTD2. Match on the literal `env(safe-area-`, not a parsed CSS value.**
  `.css.ts` files are TypeScript template strings, so the inset expression is not
  reachable by a CSS parser without evaluating vanilla-extract. A literal scan is
  what the existing `scripts/check-*.ts` family does and is sufficient because R4
  and R8a remove every legitimate occurrence outside the allowlist. Cites R6.

- **KTD3. Prove the gate by mutation, not by a unit test.** Reintroduce a raw
  `env(` in a scratch edit, confirm `bun run lint` goes red, revert. This matches
  how `packages/rpc`'s origin guard and the `GlassButton` focus ring were verified
  in this repo — a gate that has never been observed failing is not known to work.

- **KTD4. Verify against existing baselines; never regenerate as part of this
  work.** Confirmed on 2026-09-08: 30 baselines, newest `10:35`, against a newest
  target-file mtime of `2026-09-04 18:21`. Every baseline predates every edit, so
  a diff is signal. Regenerating would validate the new output against itself.

### Sequencing

U1 → U2 → U3 → U4, and **U1–U3 land as one commit**. U1 wires `check:safe-area`
into `bun run lint` while the nine sites are still unswapped, so the gate is red
until U3 completes; `AGENTS.md:16` makes that four-command gate mandatory
pre-commit, and splitting the units would create a commit that is born failing.
U4's audit edit is a separate commit.

The commit body for U1–U3 carries four things:

1. **R9's native-contract note.** The contract is unchanged because the seed
   still comes from `env()` — cite `apps/wallet/app/entry/shared/bootstrap.tsx:28`
   (standalone pages load `reset-globals`) and
   `sdk/android/…/FrakSharingSheet.kt:146` (Android pads natively). Without this a
   later reader misreads the sharing-site swap as a contract change.
2. **The Drawer behavior change is the intended fix.** On Android the Drawer now
   clears the nav bar and collapses that clearance under the keyboard, per
   `apps/wallet/app/utils/safeArea.ts:33-40`. It is not a regression.
3. **What the light suite proved.** No web regression only — both Playwright
   projects are Chromium, so the Android path is untested there.
4. **What still needs a hand check.** The Android inset fix, on a Tauri build.

## Implementation Units

### U1. Add the raw-`env()` gate

**Goal:** `bun run lint` fails on a raw `env(safe-area-` in any non-allowlisted
`.css.ts`. Covers R6, R7, R8.

**Files:**
- `scripts/check-safe-area.ts` (new)
- `package.json` — add `check:safe-area`, append to the `lint` chain at line 54

**Approach:** Take the output shape from `scripts/check-ios-floor.ts` — a `die()`
helper that exits non-zero with the offending `file:line`, and a success line
naming how many files were scanned. Take the tree walk from elsewhere: that script
iterates a fixed `SITES` array and has no walk to copy. `scripts/check-es-version.ts:76-85`
uses `node:fs/promises` `glob` with a `node_modules` exclude and is the closer
idiom; `scripts/check-comments.ts:70-87` hand-rolls a `readdirSync` recursion.
Prefer the `glob` form. Walk `.css.ts` under `apps/`, `packages/`, `sdk/`; skip
the single allowlisted path. An empty match set across the whole tree is a
failure, not a pass — it means the walk found nothing and the gate is inert.

**Test scenarios:**
- Clean tree after U2 and U3 → exits 0, reports the scanned-file count.
- Raw `env(safe-area-inset-bottom)` added to any `.css.ts` → exits non-zero and
  names that file and line.
- The same literal added to `reset-globals.css.ts` → still exits 0 (allowlisted).
- The same literal added to a `.kt` or `.swift` file → exits 0; the walk never
  reaches those extensions (R8).
- Walk finds zero `.css.ts` files → exits non-zero rather than reporting success.

**Verification:** `bun run check:safe-area`. Expect it to fail here, naming the
nine unswapped sites — that output is the worklist. Do not run `bun run lint` for
a green result until U3 lands; U1–U3 are one commit (see Sequencing).

### U2. Swap the design-system and wallet sites

**Goal:** the seven non-sharing sites consume the token. Covers R1, R2, R4, R8a.

**Files:**
- `packages/design-system/src/components/Drawer/drawer.css.ts:31`
- `packages/design-system/src/components/DetailSheet/detailSheet.css.ts:9,31,62`
- `packages/design-system/src/styles/inAppBanner.css.ts:19`
- `apps/wallet/app/module/common/component/FullScreenGate/index.css.ts:19`
- `apps/wallet/app/module/authentication/component/AuthActions.css.ts:7,12`

**Approach:** Import `safeArea` and substitute the matching axis. Preserve every
surrounding `max()` / `calc()` wrapper and its spacing argument — the wrapper is
the design intent; only the inset expression changes.

**Import depth differs by file; extend the existing token import rather than
adding a second one.** `drawer.css.ts:4` and `detailSheet.css.ts` already import
from `../../tokens.css` (they sit in `components/<Name>/`), but
`inAppBanner.css.ts:4` imports from `../tokens.css` — one level, because it sits
in `src/styles/`. Wallet-side files use the `@frak-labs/design-system/tokens`
specifier.

`AuthActions.css.ts` also needs its docblock rewritten: it names the banned
literal in prose, so the gate fails on it even after line 12 is swapped. Rewrite
it to describe the trap without spelling `env(safe-area-…`. Note that
`bun run lint:comments` does **not** cover this file — `DEFAULT_ROOTS` in
`scripts/check-comments.ts:15-18` is native-only — so nothing gates the docblock's
length; trimming beyond removing the literal is judgment, not a requirement.

**Watch:** `inAppBanner.css.ts` uses `top`, not `bottom`; `FullScreenGate:19` uses
`top` while `:20` uses `bottom`. An axis mismatch here is exactly the defect the
token exists to prevent and the gate cannot catch.

**Test scenarios:**
- `bun run check:safe-area` reports only the two sharing sites remaining.
- `bun run typecheck` passes — every added import resolves.
- Emitted CSS for `FullScreenGate:20`, `drawer.css.ts:56`, and
  `detailSheet.css.ts:9,31` is unchanged; those already used the token or its
  exact composite.

**Verification:** `bun run typecheck && bun run lint:comments`.

### U3. Swap the two sharing sites

**Goal:** the sharing surfaces consume the token with no native change. Covers
R3, R9.

**Files:**
- `packages/wallet-shared/src/sharing/component/PostShareConfirmation/postShareConfirmation.css.ts:97`
- `packages/wallet-shared/src/sharing/component/SharingPage/sharingPage.css.ts:350`

**Approach:** Identical substitution to U2. Emitted CSS is equivalent on both
native hosts: `reset-globals.css.ts:28-35` seeds the var from `env()` and
`apps/wallet/app/entry/shared/bootstrap.tsx:28` loads it on the standalone pages,
so iOS WKWebView resolves the real inset; on the Android SDK WebView both
spellings yield `0` and `FrakSharingSheet.kt:146` supplies the padding natively.

**Execution note:** the commit body must state this (R9). A later reader seeing
the sharing files in a safe-area diff will otherwise assume the native contract
moved.

**Test scenarios:**
- `bun run check:safe-area` exits 0 — no sites remain.
- `/sharing` pixel-identical at all five viewports (iphone, android, ipad, short,
  landscape).
- `/install` pixel-identical across its four baselines.

**Verification:** `bun run check:safe-area && bun run lint`, then the pixel run in
the Verification Contract.

### U4. Record the outcome in the audit

**Goal:** §6.2 #6 reflects what was actually found and fixed. Covers R10.

**Files:** `docs/audits/2026-08-05-frontend-findings-ranked-by-gain.md` (§6.2 row 6; §7 item 10)

**Approach:** Strike the row in the style the file already uses for resolved
findings, and correct both stale claims: `reset-globals.css.ts` seeding postdates
the audit, and the true bypass count was six, not four — the two sharing sites
were missed. Note the gate as what prevents recurrence, and record that the light
suite proved no web regression only — the Android inset fix was confirmed by hand
on a Tauri build, since both Playwright projects are Chromium.

**Test expectation: none** — documentation only.

## Verification Contract

| Gate | Command | Expected |
|---|---|---|
| Types | `bun run typecheck` | clean |
| Lint + gate | `bun run lint` | clean; includes `check:safe-area` |
| Comments | `bun run lint:comments` | clean (does not reach these files; runs as part of `lint`) |
| Unit tests | `bun run test` | unchanged; no test touches these files |
| Pixels | `bun run --cwd apps/wallet test:light:pixels` | **zero diff** |

**The pixel run is the load-bearing gate and has three traps.** Plain
`bun run test:light` does not shoot snapshots — `ignoreSnapshots` is gated on
`LIGHT_SNAPSHOTS` (`playwright.light.config.ts:55`) — so only the `:pixels`
variant proves anything. Baselines are gitignored and machine-local
(`playwright.light.config.ts:50-55`), so **never run `test:light:update`**: any
diff is a regression in this work, not a stale baseline. Three specs carry
coverage — `sharing.check.ts` (16), `install.check.ts` (4), and `pages.check.ts`
(9), whose SPA surfaces render `Drawer` and `FullScreenGate`.

**What the pixel suite cannot prove.** Both Playwright projects run
`devices["Desktop Chrome"]` (`playwright.light.config.ts:59-81`); the `iphone` and
`android` entries in `sharing.check.ts` are viewport sizes on Chromium, not real
WebViews. There, `env()` resolves to `0` and `--safe-area-inset-*` is seeded to
`env()` by `reset-globals.css.ts`, so both the old and new spellings compute to
`0` and the suite is a **no-change regression check, not proof of the R1 fix**.
R1's actual effect — the Drawer clearing the Android nav bar — is only observable
on an Android Tauri build and must be confirmed there by hand.

**Expected behavior change on Android, by design.** After the swap,
`drawer.css.ts:31` reads `safeArea.bottom`, which on Android resolves to
`calc(var(--nav-bar-inset, 0px) * (1 - var(--keyboard-open, 0)))`
(`apps/wallet/app/utils/safeArea.ts:33-40`). The Drawer therefore gains nav-bar
clearance when the keyboard is closed and collapses it when open — matching what
`drawer.css.ts:56` already does on the edge-to-edge variant. This is the fix, not
a regression, and no double-inset arises because the bare `env()` it replaces was
contributing `0`.

The SPA project needs a dev server (`bun dev`, which requires `bun run build:sw`
first); the standalone project builds and serves itself.

## Definition of Done

- All five Verification Contract gates pass.
- `bun run check:safe-area` exits 0, and its failure has been observed at least
  once by mutation (KTD3) — an unfailed gate is unverified.
- No `.css.ts` outside `reset-globals.css.ts` contains `env(safe-area-`.
- U1–U3 landed as one commit whose body carries all four items in Sequencing:
  the R9 native-contract note with both citations, the Drawer change named as the
  intended fix, what the light suite proved, and what still needs a hand check.
- The Android inset fix was confirmed by hand on a Tauri build — the pixel suite
  cannot reach it.
- The audit row is updated with the corrected bypass count and the hand-check
  note (R10), as a separate commit.
- No scratch mutation edits remain in the tree.
