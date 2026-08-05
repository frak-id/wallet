# Sharing page — param contract, controller extraction and component split

Status: **planned, not implemented**. Six phases, each shippable on its own.

Covers `apps/wallet/app/routes/sharing.tsx` (719 lines), the shared component tree in
`packages/wallet-shared/src/sharing/`, and the second consumer at
`apps/listener/app/module/sharing/component/SharingPage/index.tsx`.

| Section | Content |
|---|---|
| [§1](#1-who-produces-the-url) | The consumer census that decides what is frozen |
| [§2](#2-the-param-contract) | What stays, what is renamed, why there is no version param |
| [§3](#3-defects-found) | Three standalone bugs, shippable before anything else |
| [§4](#4-route-decomposition) | Splitting the 719-line route into a module |
| [§5](#5-the-controller-hook) | Killing ~130 duplicated lines between wallet and listener |
| [§6](#6-sharingpageprops) | 27 flat props → 10 grouped |
| [§7](#7-component-split) | `SharingPage/index.tsx` (683 lines, 8 components, 1 file) |
| [§8](#8-sequencing) | Order, and what blocks on the in-review Android PR |

---

## 1. Who produces the URL

Exhaustive — verified by grepping every `/sharing` URL construction in the repo.

| Producer | Status | Params sent |
|---|---|---|
| `apps/shopify/extensions/checkout-post-purchase/src/PostPurchaseCard.tsx` | **live, merchants depend on it** | `merchantId`, `clientId`, `link`, `appName`, `logoUrl`, `products`, `checkoutToken`, `redirectUrl` |
| `sdk/android/frak-sdk-ui/.../SharingPageUrl.kt` | not shipped | `native`, `merchantId`, `clientId`, `returnScheme`, `sid`, `sdkv`, `appName`, `logoUrl`, `link`, `products`, `r`, `preload`, `confirmed`, `cornerRadius` |
| `sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift` | not shipped | same minus `cornerRadius` |

Nothing else. In particular **nothing sends `attribution`, `utm_*`, `ref` or `via`** — the
entire `parseAttributionFromSearch` dual-form (JSON object, individual UTMs, and the
`attribution=null` sentinel) has no live producer.

This census is the whole basis for §2: the frozen set and the badly-named set do not
intersect.

---

## 2. The param contract

### 2.1 No version param

A `pv=2` param plus a v1→v2 adapter is only worth its weight if a frozen consumer must keep
sending the old shape while new consumers send the new one. That is not the situation:

- Shopify's eight params are all already camelCase, unambiguous, and worth keeping. Nothing
  about them needs to change.
- Every param worth renaming is native-only, and no native binary has shipped.

So the contract changes by renaming only the half that has no consumers, and the wallet keeps
accepting the Shopify eight forever. No version negotiation, no adapter, no dual-parse.

### 2.2 Frozen — unchanged, byte for byte

`merchantId` · `clientId` · `link` · `appName` · `logoUrl` · `products` · `checkoutToken` ·
`redirectUrl`

Two of them change *meaning* without changing the wire shape:

- **`appName`, `logoUrl` become optional overrides.** The page already runs
  `useMerchantResolvedConfig`, whose response carries `name` and `sdkConfig.logoUrl`
  (`services/backend/src/domain/merchant/schemas/index.ts:237-274`). Resolution order becomes
  `param ?? config ?? ""`. Shopify keeps sending them and nothing breaks; the native SDKs stop
  sending them, which shortens the warm URL and removes the "per-request logo override vs
  warmed config value" special case that `activationFragment` currently documents at length.
- **`products` accepts both encodings.** Raw JSON (what Shopify sends today, and what the
  router's JSON search parser hands over as an object) *and* the `compressJsonToB64` form that
  `sdk/components`' `initFrakSdk` already decodes via `decodeProductsParam`. One decoder tries
  b64 first, falls back to the parsed object, and **always** ends in
  `sanitizeSharingProducts` — see §3.1.

### 2.3 Renamed — native-only, free

| now | new | why |
|---|---|---|
| `native=1` | `embed=native` | an enum, not a flag; leaves room for `iframe` without another boolean |
| `returnScheme` | `hostScheme` | groups the host contract under one prefix |
| `sid` | `hostSession` | `sid` reads like a session cookie; it is the host's correlation token |
| `sdkv` | `sdkVersion` | |
| `r` | `seedReward` | one letter for a param that needs the most explaining |
| `preload=1` / `preload=0` | `state=warm` / `state=live` | the fragment's `preload=0` becomes `state=live`, which says what it does instead of negating what it isn't |
| `confirmed=1` | `view=confirmation` (default `view=share`) | matches the two views `SharingPage` already switches between |
| `attribution` (JSON) | *removed* | see §2.4 |
| `utm_*`, `ref`, `via` | *removed* | see §2.4 |
| `cornerRadius` | *(unchanged)* | just landed with tests on both sides; renaming it for symmetry is churn |

### 2.4 URL attribution is removed outright

The `/sharing` route currently accepts attribution three ways: a JSON `attribution` object, flat
`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term` / `ref` / `via` params,
and an `attribution=null` sentinel that disables the merchant's backend defaults
(`parseAttributionFromSearch`, ~30 lines).

**None of the three has a producer.** Not the Shopify extension, not either native SDK, not
`sdk/components`, and nothing in `docs/`. Confirmed by grep across the whole repo.

So the wallet route stops parsing attribution from the URL entirely and passes
`attribution: undefined` to `buildSharingLink`, which leaves the merchant's backend
`defaultAttribution` as the only source — exactly what every real caller gets today.

What this does **not** touch:

- `mergeAttribution`'s `perCall === null` disable semantics: still used by the listener, which
  receives `attribution` over RPC (`currentRequest.params.attribution`), not over a URL.
- `buildSharingLink`'s `attribution` / `defaultAttribution` parameters, and their tests.
- `AttributionParams` / `AttributionDefaults` in `sdk/core`.

Only the wallet route's URL-side parsing goes. If a merchant-facing use case for URL attribution
appears later, it comes back as one codec-table row, not three parsing paths.

### 2.5 One codec table, two transports

The bug class this closes: `validateSearch` and `parseActivationHash` are two hand-written
codecs over the same key set that must agree. `apps/wallet/app/routes/sharing.test.ts` already
carries a `describe("/sharing activation fragment hardening")` block whose entire job is
asserting they still do — including that a rejected `seedReward` is *omitted* rather than set
to `undefined`, because the fragment result is spread over the query params and a present-but-
undefined key erases the warmed value underneath it.

Replace both with a declared table:

```ts
// apps/wallet/app/module/sharing/params/table.ts
type Codec<T> = {
    decode(raw: unknown): T | undefined;
    /** Fragment-activatable, or query-only? */
    transport: "query" | "both";
    /** Only read once `embed=native` is confirmed. */
    nativeOnly?: boolean;
};

export const SHARING_PARAMS = {
    merchantId:    { decode: str,                  transport: "query" },
    clientId:      { decode: str,                  transport: "query" },
    link:          { decode: str,                  transport: "both"  },
    products:      { decode: productList,          transport: "both"  },
    appName:       { decode: str,                  transport: "query" },
    logoUrl:       { decode: httpsUrl,             transport: "both"  },
    checkoutToken: { decode: str,                  transport: "query" },
    redirectUrl:   { decode: sanitizeRedirectUrl,  transport: "query" },
    embed:         { decode: oneOf("native"),      transport: "query" },
    hostScheme:    { decode: sanitizeReturnScheme, transport: "query" },
    hostSession:   { decode: loose string,         transport: "both"  },
    sdkVersion:    { decode: loose string,         transport: "query" },
    cornerRadius:  { decode: clampedInt(0, 48),    transport: "query", nativeOnly: true },
    seedReward:    { decode: sanitizeSeededReward, transport: "both"  },
    state:         { decode: oneOf("live","warm"), transport: "both"  },
    view:          { decode: oneOf("share","confirmation"), transport: "both" },
} satisfies Record<string, Codec<unknown>>;
```

Then the two entry points are adapters, not codecs:

```ts
export const parseSharingSearch   = (s: Record<string, unknown>) => decodeAll(SHARING_PARAMS, s);
export const parseSharingFragment = (hash: string) => decodePresent(SHARING_PARAMS, hash);
```

`decodePresent` implements the omit-absent-keys contract **structurally** — it only writes keys
the fragment carries and whose codec returned a value. That makes the hardening tests assert a
property of one function instead of an agreement between two, and any future param becomes
fragment-activatable by declaring `transport: "both"`.

Three things the table encodes that today live in prose:

- `cornerRadius` is `transport: "query"` because a host sets it once at load, never per tap —
  currently a five-line comment at the destructuring site.
- `cornerRadius` is `nativeOnly` because a web visitor passing `?cornerRadius=200` must not
  reach into the page's geometry — currently an inline ternary in `validateSearch`.
- `state` defaults to `live` on a fragment even when the host omits it, because a fragment only
  ever arrives from a tap. That default belongs on the codec.

The loose-string decode (`readString`) and flag decode (`readFlag`) stay as shared codec
helpers: the router JSON-parses search values, so `?hostSession=1738147200000` genuinely
arrives as a number and `?embed=native` vs a numeric `1` still need normalising. That is a
property of the router, not of any one param, and belongs in the codec layer exactly once.

### 2.6 Consumer changes

- `sdk/android/frak-sdk-ui/.../SharingPageUrl.kt` — rename in `build`, `warm`,
  `activationFragment`; drop `appName`/`logoUrl`; update `SharingPageUrlTest.kt`,
  `SharingSheetStateTest.kt`.
- `sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift` — same, plus `SharingPageURLTests.swift`,
  `SharingSheetLogicTests.swift`. `warmSessionId` stays as-is under the `hostSession` key.
- `apps/shopify/.../PostPurchaseCard.tsx` — **no change**.

---

## 3. Defects found

All three are independent of the refactor and can ship first.

### 3.1 The wallet does not sanitize `products`

`validateSearch` does `typeof search.products === "object" ? (search.products as SharingPageProduct[]) : undefined`
— a raw cast on URL-supplied input. That value then reaches `<img src>` and `product.title` in
`ProductCard`, and feeds campaign selection through `rewardProductsForSelection`'s numeric scope
fields.

The listener, given the exact same shape over RPC, runs `sanitizeSharingProducts` and documents
why: *"Sanitized rather than cast: `params.products` is an unvalidated RPC payload whose numeric
scope fields now feed campaign selection."* The wallet's input is strictly less trusted than the
listener's.

Fix: route `products` through `decodeProductsParam`-or-`sanitizeSharingProducts` in the codec
(§2.2). Both already exported from `@frak-labs/core-sdk`.

### 3.2 The listener never passes `canShare`

`useShareLink` returns `canShare`; `ListenerSharingPage` destructures only `mutate` and
`isPending`. `SharingPageProps.canShare` defaults to `true`, while `useShareLink`'s `mutationFn`
opens with `if (!canShare) return;`. On any browser without `navigator.share` — desktop Chrome
outside Windows, desktop Firefox — the listener renders a Share button that silently does
nothing.

Fix: destructure and pass it, as the wallet route already does.

### 3.3 Escape never dismisses

Both `SharingPage` and `PostShareConfirmation` put `onKeyDown` on the backdrop `div` and
`onKeyDown={(e) => e.stopPropagation()}` on the inner container. The backdrop is not focusable,
so it never receives a `keydown`; anything that does reach the container is stopped. The handler
is unreachable in both components.

Fix: a `useEffect` `keydown` listener on `document`, gated on `!chromeless`. While there:
neither overlay has `role="dialog"`, `aria-modal`, a focus trap, or an initial focus target.

---

## 4. Route decomposition

`apps/wallet/app/routes/sharing.tsx` is 719 lines doing six jobs. `parseActivationHash` is
exported purely so the test can reach it — the file asking to be a module.

```
apps/wallet/app/module/sharing/
├── params/
│   ├── table.ts            SHARING_PARAMS + codec helpers (§2.5)
│   ├── search.ts           parseSharingSearch  — Route.validateSearch
│   └── fragment.ts         parseSharingFragment + useActivationParams
├── host/
│   ├── bridge.ts           moved from module/common/utils/buildHostResultUrl.ts
│   ├── useHostBridge.ts    returnToHost + the `ready` rAF effect
│   └── useHostCornerRadius.ts   the transparent-background effect
├── useSharingIdentity.ts   param → clientIdStore → order-client query
└── index.ts
```

Route file lands at ~120 lines: `createFileRoute`, `beforeLoad`, and a component that wires
four hooks into `<SharingPage {...controller} />`.

Two notes:

- `beforeLoad` currently performs a **navigation** as a side effect (`sendHostResult` on a
  native launch with no `clientId`). Route guards are re-entrant — the router re-resolves the
  location whenever `validateSearch` rewrites the URL — which is the entire reason
  `buildHostResultUrl.ts` carries a module-level mutable `sentActions` Set with a
  `REPEATABLE_ACTIONS` exception list and a `resetHostResults` test seam. Moving the
  tell-the-host-and-close path into the component (or an error boundary) lets that dedupe shrink
  to the genuinely repeatable cases.
- `useHostCornerRadius` isolates the `document.documentElement.style.backgroundColor` mutation,
  which today sits inline in the route with a nine-line comment explaining why it cannot be a
  `globalStyle` (root `AGENTS.md` forbids it) and why `document` is safe to touch (wallet has
  SSR disabled).

---

## 5. The controller hook

The wallet route and `ListenerSharingPage` independently implement the same ~130 lines:
selection state → `rewardProductsForSelection` memo → `useFormattedEstimatedReward` → a `t`
wrapper injecting `estimatedReward` → `buildSharingLink` memo → `installUrl` memo →
`getSavedConfirmation` state → `useShareLink` with an identical `onSuccess` → an identical copy
handler → an identical six-field `rewardBreakdown` spread.

They have already drifted in four places — §3.1, §3.2, plus:

- `sharing_page_viewed` carries `sdk_version` and `native` from the wallet, nothing from the
  listener.
- The wallet passes `imageUrl: logoUrl` to the share sheet for the iOS `LPLinkMetadata` /
  Android chooser preview; the listener does not.

```ts
// packages/wallet-shared/src/sharing/hooks/useSharingPageController.ts
export function useSharingPageController(input: {
    merchantId?: string;
    clientId?: string;
    wallet?: Address;
    link?: string;
    products?: SharingPageProduct[];
    merchant: { name?: string; logoUrl?: string };
    attribution?: AttributionParams | "off";
    defaultAttribution?: AttributionDefaults;
    /** Listener-only reward inputs; the wallet has no equivalent. */
    reward?: { currency?: Currency; targetInteraction?: string; context?: string };
    source: SharingSource;
    installUrl: string | null;
    t: RawTranslate;
    outcomes: SharingOutcomes;
}): SharingPageProps;

type SharingOutcomes = {
    /** Return true when the outcome was handed off, so the page does not also act on it. */
    share?(): boolean;
    copy?(): boolean;
    dismiss(): void;
    shareAgain?(): void;
    install(): void;
    confirmationDismiss?(): void;
    /** The listener resolves its RPC here; the wallet has nothing to do. */
    onConfirmed?(action: "shared" | "copied"): void;
};
```

`outcomes` is the only thing that genuinely differs between the three hosts (web, listener RPC,
native scheme hand-off), and it is the one thing the current duplication makes hardest to see.

Both consumers collapse to `<SharingPage {...useSharingPageController({ … })} />`: wallet route
≈ 120 lines, listener component ≈ 90. All four drifts become unrepresentable.

One behaviour the extraction must preserve rather than "fix": the wallet fires
`sharing_link_copied` even when the copy was handed off to a native host, and the host's SDK
records an interaction for the same tap. **This double-count is deliberate and the two records
are not the same thing** — `sharing_link_copied` is an OpenPanel event feeding our own funnel
analytics, while the native interaction is the on-chain-adjacent record that can earn a reward.
Neither can stand in for the other. The controller carries this as a comment on the copy path so
the next reader does not de-duplicate it.

---

## 6. `SharingPageProps`

27 props, flat. Six of them (`isRewardLoading`, `rewardType`, `minPurchaseAmount`,
`isProductScoped`, `lockupDurationDays`, `rewardBreakdown`) are one reward object destructured
field-by-field at *both* call sites. Six more are callbacks. `chromeless` and `hostCornerRadius`
are one concept split across two props, with the same
`chromeless && hostCornerRadius && hostCornerRadius > 0` computation now copy-pasted into
`PostShareConfirmation`.

```ts
type SharingPageProps = {
    merchant: { name: string; logoUrl?: string };
    view: "share" | "confirmation";
    chrome: { mode: "full" | "none"; cornerRadius?: number };
    sharingLink: string | null;
    installUrl: string | null;
    reward: { status: "loading" } | { status: "ready"; … };
    products?: { items: SharingPageProduct[]; selectedIndex: number; onSelect(i: number): void };
    share: { canShare: boolean; isSharing: boolean };
    actions: { onShare; onCopy; onDismiss; onShareAgain; onInstall; onConfirmationDismiss };
    t: SharingT;
};
```

`chrome` as an object kills the "radius only means something with `chromeless`" invariant that
is currently enforced by a comment and a duplicated guard — an absent `cornerRadius` under
`mode: "none"` is the only way to express "no rounding", and `mode: "full"` cannot carry one.
`PostShareConfirmation` takes the same `chrome` object, so the computation lives in one place.

---

## 7. Component split

`packages/wallet-shared/src/sharing/component/SharingPage/index.tsx` is 683 lines holding eight
components and two parsing helpers. Split into `PageHeader.tsx`, `RewardCard.tsx` (with
`CreditCardAmount`, `CardTagline`), `Steps.tsx` (with `splitStep`, `getStep2Context`),
`Faq.tsx`, `ProductCard.tsx`, `Footer.tsx`, leaving `index.tsx` as layout at ~120 lines.

While in there:

- **FAQ magic indexes.** `[1, 2, 3, 4, 5, 6].map(...)` with `i === 6 && rewardBreakdown` couples
  the breakdown to an ordinal. Replace with a declared `FAQ_ITEMS` list carrying an explicit
  `slot: "rewardBreakdown"`.
- **`splitStep` — DROPPED from this plan.** Recon killed it. Splitting the translated string at
  its first `.` really is a presentation rule smuggled into copy, but the fix is unsafe:
  merchant translation overrides are a **freeform `Record<string, string>`** on both surfaces
  that carry them (`TranslationOverridesSchema` in
  `services/backend/src/domain/merchant/schemas/index.ts`, and `LocalizedI18nConfig` in
  `sdk/core/src/types/config.ts`, i.e. the public `frak_displaySharingPage` `i18n` param). The
  listener turns those flat dotted keys into a tree (`translationKeyPathToObject` in
  `apps/listener/app/module/utils/i18nMapper.ts`) and deep-merges them with `overwrite: true`.
  So a merchant who has stored `"sdk.sharingPage.steps.1"` as a flat string would clobber a new
  `{ title, description }` node back down to a string, and `t("...steps.1.title")` would then
  resolve to nothing — **silently, for that merchant only**. We cannot rule that out from the
  repo; it needs a production query on `translations` / `placements[].translations`.

  Instead: move `splitStep` into its own module with tests and a comment stating that the flat
  key shape is load-bearing because it is a merchant-override surface. Revisit only with (a) a
  DB check confirming zero stored overrides and (b) a decision on new key names vs. a data
  migration.

  Note for whoever revisits it: `packages/ui-preview/src/sharing-page/index.tsx` is a **third**
  consumer of these keys with its own inlined copy of `splitStep`. It does not import
  `SharingPage` (ui-preview has no `wallet-shared` dependency, per the scope rule), so it is
  unaffected by §6 — but it reads the same locale JSON and would break with any key reshape.
- **`CreditCardAmount` — additive `parts`, string fallback stays.** Two regexes re-parse an
  already-formatted amount to re-split integer / decimals / symbol. Recon corrected two things
  about this:

  1. The producer is **not** `packages/wallet-shared/src/common/utils/formatCurrency.ts` (that
     one feeds wallet history/balance and never touches sharing). It is
     `sdk/core/src/rewards/format.ts` (`formatEstimatedReward`) → `sdk/core/src/rewards/select.ts`
     (`BestReward.formatted`) → `selectFormattedReward` → `useFormattedEstimatedReward`. The new
     field belongs on `BestReward`, in `sdk/core`.
  2. `formatted` **must stay a byte-identical plain string**: four consumers interpolate it into
     i18next (`sharing.tsx`, `install.tsx`, the listener page, `ListenerUiProvider`), and
     `card.tagline1` embeds it mid-sentence (`"Earn {{ estimatedReward }},"`). So `parts` is
     strictly additive.

  Shape: `parts?: { integer: string; decimals?: string; unit: string; unitPosition: "prefix" | "suffix" }`
  — what the component actually needs, not raw `Intl.NumberFormatPart[]`. Money branches derive
  it from `Intl.NumberFormat(...).formatToParts()`; the `"percentage"` branch is a hand-built
  template literal (`` `${reward.percent} %` ``) with no `Intl` call behind it, so it synthesises
  its parts directly — switching it to `style: "percent"` would be a behaviour change against
  the golden fixtures in `sdk/core/src/rewards/fixtures/golden-rewards.json`, not a refactor.

  **`CreditCardAmount` keeps a string path.** The host-seeded `seedReward` param is a bare
  attacker-controllable string painted on the first frame, fused with `reward.formatted` at
  `const estimatedReward = reward?.formatted ?? seededReward`. It can never carry `parts`
  without re-parsing, which is the thing being deleted. So: render from `parts` when present,
  fall back to the plain unsplit string when absent. That costs the seeded first paint its
  small-caps decimals and nothing else — do **not** teach `sanitizeSeededReward` to emit parts,
  which would mean parsing untrusted input into more structure.
- **`<Toaster />` inside a shared presentational component.** `SharingPage` mounts a global
  sonner toaster; the listener's embedded `Wallet` mounts its own. Hoist it to the consumers.
- **Overlay a11y**, per §3.3.
- **`clearConfirmation()`** removes the single global key while `saveConfirmation(merchantId)`
  writes a merchant-scoped record. Harmless today (one merchant at a time) — make it symmetric
  or document the asymmetry.

---

## 8. Sequencing

| Phase | Content | Depends on |
|---|---|---|
| 0 | §3 defects: sanitize `products`, pass `canShare`, fix Escape | — |
| 1 | §4 route decomposition + §2.5 codec table + §2.4 attribution removal, **old param names** | 0 |
| 2 | §2.3 rename, across wallet + `sdk/android` + `sdk/ios` | 1 |
| 3 | §5 controller hook, both consumers rewired | 1 |
| 4 | §6 props reshape | 3 |
| 5 | §7 component split + internal cleanups (incl. `sdk/core` reward `parts`) | 4 |

Phase 1 deliberately keeps the current param names so the table lands as a pure refactor against
the existing `sharing.test.ts` — the rename in phase 2 is then a mechanical edit of one table
plus the two SDK builders, and any test that breaks in phase 2 is a naming miss, not a logic one.

The Android `cornerRadius` work is **already in this working tree** (staged, uncommitted), so
phase 2 edits it in place rather than waiting on a merge. Nothing is committed by any phase —
the whole series lands as working-tree changes for manual review, on top of that staged work.

Quality gate per phase: `bun run format && bun run lint && bun run typecheck && bun run test`,
plus `bun run --filter '*/native-*' lint` for phase 2.

---

## 9. As built — deviations from the plan above

Status: **implemented**, working tree only, nothing committed. Everything in §§2–7 landed except
where noted here. Full gate green: `format`, `lint`, `typecheck`, `test` (570 files / 5506 tests),
plus `sdk/ios` lint + 365 tests and `sdk/android` ktlint + unit tests.

**`returnScheme` and `sid` were NOT renamed.** The plan had them becoming `hostScheme` /
`hostSession`. `/install` reads the same two params from its own hosts
(`apps/wallet/app/routes/install.tsx`), and the native SDKs do not send them there — so renaming
on `/sharing` alone would have split one host contract across two spellings for no gain. Renamed
only where the name was actually bad: `native`→`embed`, `r`→`seedReward`, `sdkv`→`sdkVersion`,
`preload`→`state`, `confirmed`→`view`. That also removes every boolean from the contract, so the
four-way flag parsing (`1` / `"1"` / `true` / `"true"`) is gone with it.

**The native SDKs still send `appName` and `logoUrl`.** §2.2 planned to drop them now that the
merchant config supplies both. Kept, because the config arrives from a query: dropping them would
leave the merchant name and logo blank on the first frame — the exact problem `seedReward` exists
to avoid, reintroduced one field over. The route resolves `param ?? config ?? ""`, so the config
is the fallback for callers that omit them (which is what makes them optional at all).

**URL attribution removed outright** (§2.4), as agreed: no producer, so `parseAttributionFromSearch`
and its `attribution=null` sentinel are gone. `mergeAttribution`'s `perCall === null` semantics,
`buildSharingLink`'s parameters and `sdk/core`'s types are untouched — the listener still passes
attribution over RPC.

**`beforeLoad` no longer navigates.** The guard now throws a typed `MissingHostClientIdError` and
the route's `errorComponent` tells the host. `sentActions` in `host/bridge.ts` survives but its
comment now says what it actually protects (double taps on terminal outcomes), not route-guard
re-entrancy, which no longer applies.

**Both `CreditCardAmount` regexes are gone.** The string fallback prints the seeded headline whole
rather than re-parsing it. One visible consequence beyond that: a prefix-currency locale
(`en-US`, `"$12.50"`) previously matched neither regex and rendered unstyled; it now gets the same
small-caps treatment as a suffix locale. That is a rendering change, not a refactor — flagged
rather than hidden.

**Two rendering changes, not one.** §9 originally claimed the `en-US` prefix-currency styling was
the only intentional visual change; review found a second, previously unflagged one. For a
*fractional* percent (`7.5`), the old percent regex `/^([\d\s]+)\s*%$/` did not match (no `.` in
the class), so the string fell through to the general regex and rendered large **"7"** + small
**".5 %"** — splitting the number mid-way. The parts path renders large **"7.5"** + small
**"%"**, which is what it should always have done. Reachable only if the backend sends a
non-integer `percent`; every golden fixture uses whole numbers, so it was untested before and
after. Called out here rather than left as a surprise.

**`splitStep` removed after all** (§7). It was kept in the first pass because the step keys are a
merchant-override surface: overrides are stored as a freeform `Record<string, string>` and
deep-merged with `overwrite: true`, so a merchant holding a flat `sdk.sharingPage.steps.1` would
clobber a new `{ title, description }` node back to a string and silently blank their own copy.
The user confirmed no merchant uses this and the option has been removed from the business
dashboard, so the split shipped: `steps.{1,2,3}` are now `{ title, description }`, with step 3
carrying `lockup` and step 2 carrying i18next context variants on *both* halves.

Contexts append to the last key segment, so `t("steps.2.title", { context: "product" })` resolves
`steps.2.title_product` and falls back to `steps.2.title` when the variant is absent. Only the
variants that actually differ are translated — `title_min` deliberately does not exist, since step
2's title is the same with and without a minimum. `Steps.test.tsx` renders against a real i18next
instance loaded with the real locale file rather than a stub `t`, because that fallback is the
thing under test and a hand-written mock would implement it differently.

The dead `steps.title` key (empty string, never read) went with the reshape, and the split rule's
collateral damage on tests went with it: `chromeless.test.tsx` no longer needs period-free
stand-ins for step copy, since nothing carves up the dotted key any more.

**`<Toaster />` hoisted to both consumers.** Note this was load-bearing: the listener's sharing
page had no toaster of its own and relied on `SharingPage` mounting one, so hoisting without
adding it back would have silently removed every toast from that surface.

**Files added:** `apps/wallet/app/module/sharing/{params/{table,search,fragment}.ts,host/{bridge,useHostBridge,useHostCornerRadius}.ts,useSharingIdentity.ts}`;
`packages/wallet-shared/src/sharing/hooks/useSharingPageController.ts`;
`packages/wallet-shared/src/sharing/component/useOverlayBehaviour.ts`;
`packages/wallet-shared/src/sharing/component/SharingPage/{types,PageHeader,RewardCard,Steps,Faq,ProductCard,Footer}.tsx`;
`sdk/core/src/utils/format/formatAmountParts.ts`.

**Line counts:** `apps/wallet/app/routes/sharing.tsx` 738 → 205.
`packages/wallet-shared/src/sharing/component/SharingPage/index.tsx` 730 → 152.
`apps/listener/app/module/sharing/component/SharingPage/index.tsx` 288 → 148.
`SharingPageProps` 27 flat props → 10 grouped.

**Found in review, fixed:** `useOverlayBehaviour` listed `onDismiss` in its effect deps. Both
consumers build their outcome handlers as inline closures, so that identity changes on every
render — meaning the focus-trap effect reinstalled its listener *and re-ran the "move focus in"
step* on every unrelated re-render (reward query resolving, product selection, `isSharing`
toggling), yanking keyboard focus back to the first control mid-interaction. Worse for a keyboard
user than no focus management at all. Fixed by reading `onDismiss` through a ref so the effect
runs once per `enabled` transition; `useOverlayBehaviour.test.tsx` covers it, and that test fails
against the pre-fix code. The same review pass also replaced an `offsetParent` visibility filter
that jsdom cannot model — it reported "nothing is focusable" under test while behaving
differently in a browser, which is how a broken trap ships green.

**Not done:** nothing from §§2–7 remains outstanding. The one open question is the DB check in §7
that would let the step-key split be revisited.
