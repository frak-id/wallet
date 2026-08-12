# Native share payload — giving the OS share sheet something to say

The sheet's own UI is rich. The moment it hands off to `Intent.ACTION_SEND` /
`UIActivityViewController`, everything is thrown away and a bare tracking URL goes out. This doc
closes that gap by reusing config the backend already localises and both SDKs already decode.

## 1. What ships today

**Android** — `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/NativeShare.kt`

```kotlin
Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, link)               // bare URL
    title?.let { putExtra(Intent.EXTRA_TITLE, it) } // merchant displayName
}
Intent.createChooser(send, title)
```

No `EXTRA_SUBJECT`, no `ClipData` thumbnail. On API 29+ the Sharesheet preview renders the merchant
name over a raw `?fCtx=…` URL and no image.

**iOS** — `sdk/ios/Sources/FrakSDKUI/NativeShare.swift`

One `UIActivityItemSource` carrying the `URL`, `subject` = merchant displayName. No
`activityViewControllerLinkMetadata`, so iOS falls back to scraping OpenGraph off the tracking URL at
present time — slow, and usually a grey placeholder. No body text on any path.

Both sites receive `shareTitle = merchant.displayName` and nothing else
(`SharingSessionBuilder.kt` `resolve()`, `SharingSheetModel.swift:477`). The tier-3 fallback — config
resolution failed, no page — passes `shareTitle = null`, so a degraded share is a naked URL.

## 2. What already exists and is not wired

| Asset | Where | State |
|---|---|---|
| `sharing.title` / `sharing.text` | `packages/wallet-shared/src/i18n/locales/{en,fr}/common.json` | Live for web |
| `sdkConfig.translations` map | `MerchantResolveService.resolveLocalizable()` collapses `{default,en,fr}` server-side per requested `lang` | Live |
| `ResolvedSdkConfig.translations` | `FrakResolvedConfig.kt` / `FrakResolvedConfig.swift`, cached in `ConfigStore` | Decoded, **read by nothing** |
| Rich share payload, both platforms | `apps/wallet/src-tauri/plugins/tauri-plugin-frak-share/` | Complete reference implementation |
| `SharingProduct.imageUrl` | `SharingRequest.kt` / `.swift`, already in the page's `products` JSON | Live, unused for sharing |

The Tauri plugin is the important one: `LPLinkMetadata` + async `iconProvider` under a 2 s cap and
separate URL/text activity items on iOS; `EXTRA_SUBJECT` + `EXTRA_TITLE` + a FileProvider-backed
`ClipData` thumbnail on Android. This is a port, not a design.

## 3. What the user actually sees

Two surfaces get conflated, and only one of them travels:

- **Sender-side chrome** — the Android chooser preview tile and the iOS `LPLinkMetadata` header.
  Title and image. Never leaves the device.
- **Recipient-visible content** — the `text` body and the URL, nothing else. The card the recipient
  sees in WhatsApp/iMessage is built from OG tags at the destination, which is the merchant's own
  page. Out of our reach without a wallet-hosted redirect hop, which is not worth the link-trust cost.

So the prefilled localised **text** is the win. The image is polish.

## 4. Decision

Reuse the existing `sharing.title` / `sharing.text` translation keys rather than adding a typed
`components.shareSheet` block. Zero backend schema work, zero decoder work, and web and native
resolve from one source of truth. The cost — no merchant-facing editor for these keys in
`apps/business`, and no dedicated preview-image field — is accepted for now; the image falls back
through the product, then `sdkConfig.logoUrl`.

The page, not the SDK, resolves the final payload. It already owns product selection, i18next
interpolation and the merchant config, and duplicating that natively would drift. The SDK resolves
only on the tier-3 path, where there is no page.

## 5. Precedence

Resolved in `useSharingPageController`, applied to web and native alike:

1. Per-call override from `SharingRequest` (arrives as a page param)
2. Selected `SharingProduct` — `title` → share title, `imageUrl` → share image
3. Merchant `translations["sharing.title" | "sharing.text"]`
4. Bundled `common.json` defaults

Placement in `useSharingPageController`: between the `t` wrapper and the `useShareLink` call, as a
memoised `shareData` feeding both `useShareLink`'s second argument and `outcomes.share`. A selected
product with no `imageUrl` falls through to `merchant.logoUrl` rather than sending an empty image;
same for an empty-string `title`, so normalise `""` → `undefined` rather than relying on `??`.

Leave the `t` wrapper's `productName: appName` binding alone. It binds the *merchant* name, not the
product title, and that is pre-existing web behaviour — step 2 already sits above the translation, so
a product-scoped share takes the product title from the override and a merchant with no products
keeps today's copy byte-for-byte.

Step 3 is a fix in its own right: `apps/listener` merges merchant translations into i18next via
`ListenerUiProvider`, but `apps/wallet`'s `/sharing` route (`SharingView.tsx`) uses `rawT` straight
from `useTranslation()`. A merchant's `sharing.title` override is silently dropped on every native
share today.

It is also a smaller fix than it looks. The namespace plumbing is already correct: the wallet boots
with `fallbackNS: ["customized", "common"]` (`entry/shared/bootstrap.tsx`) and `sharing.*` lives only
in `common.json`, so `t("sharing.title")` already resolves `translation` → `customized` → `common`,
consulting merchant overrides first. The single missing piece is that nobody calls
`addResourceBundle` on this route. Port the listener's block, keyed on
`config?.sdkConfig?.translations`.

`translationKeyPathToObject` currently lives in `apps/listener/app/module/utils/i18nMapper.ts`, and
`apps/wallet` must not import from `apps/listener`. Move it to `packages/wallet-shared` and update the
listener's import — a fourth directory outside the three lanes, so it belongs to whoever does this
step.

## 6. Wire contract

### Inbound — native → page

Three params in `apps/wallet/app/module/sharing/params/table.ts`, transport `both` so a warmed page
can receive them on the activation fragment. Sourced from three new `SharingRequest` fields
(`shareTitle`, `shareText`, `shareImageUrl`) — Builder methods on Android, defaulted init params on
iOS, both additive.

| Param | Codec |
|---|---|
| `shareTitle` | `str`, capped at 120 |
| `shareText` | `str`, capped at 280, control chars stripped |
| `shareImage` | new `sanitizeShareImage` — https only, capped at 512 |

Written by `SharingPageUrl.build()` / `.activationFragment()` (Kotlin) and `SharingPageURL.swift`.

**On `transport: "both"` and warm-page reuse.** A reviewer flagged this as leaking across sessions:
session A sets `shareText`, `resetToWarm()` recycles the view, session B inherits A's copy. It does
not, and the reason is worth recording because it is the same mechanism `logoUrl` already depends on.
`useActivationParams` replaces its state wholesale on every `hashchange`
(`setParams(parseSharingFragment(...))`, `fragment.ts`), and both `resetToWarm()` and
`activationFragment()` write a *complete* fragment rather than mutating the previous one. So an
absent key falls through to `search`, which on a warm URL never carried these params — `undefined`,
not A's value. Any future change that merges activations instead of replacing them breaks this, and
`logoUrl` with it.

### Outbound — page → native

`buildHostResultUrl` currently admits `value`/`exp` for `action=code` only. Extend it with an
optional `share?: { title?, text?, image?, rect? }`, leaving `value`/`exp` untouched:

```
frak-<pkg>://result?action=share&sid=…&title=…&text=…&image=…&rect=x,y,w,h
```

Every field optional; absent means today's behaviour exactly. `rect` is CSS pixels relative to the
viewport, four comma-separated integers, iOS-only (Android drops it at the parser rather than
carrying a dead field).

Parsed in `SharingWebView.kt` `SharingPageAction.fromWire()` (currently `action`/`value`/`exp`) and
its iOS twin in `SharingWebView.swift`. `Share` becomes a data class/case carrying the payload.
**Empty-string values decode to null, not `""`** — an empty `EXTRA_SUBJECT` is worse than an absent
one.

The dedupe needs no change: `REPEATABLE_ACTIONS` already contains `share`, so `sentActions` never
keys on the payload.

**Length budget**, enforced once on the page side at the point of resolution so web, Tauri and native
all see the same string:

| Field | Cap | Why |
|---|---|---|
| `text` | 280 | SMS/X-shaped composition; ~840 bytes percent-encoded worst case |
| `title` | 120 | A headline, not a body |
| `image` | 512 | A URL |

Worst case ≈ 1.6 KB, inside every relevant limit. **Past the cap, truncate on a grapheme boundary and
append `…` — never drop the field.** Clipped copy beats a bare URL. No chunking protocol: a field
that overruns this budget is bad copy, not a transport problem.

Percent-encoding round-trips cleanly. Both native encoders are strict RFC 3986 over UTF-8 with an
unreserved set of `A-Za-z0-9-._~` (`PercentEncoding.kt`, `PercentEncoding.swift`), so newlines, `&`,
`#` and emoji all survive; the page emits via `URLSearchParams`, whose `+`-for-space is handled by
both decoders in query position.

Safe for the same reason the existing channel is: the host intercepts this navigation inside its own
web view. Share copy is not sensitive. **`image` must still be re-validated native-side** — see §6b.

### 6b. Sanitization

**Page side, outbound** — once, in the resolution step:

- `text` / `title`: strip C0/C1 controls except `\n` in `text`
  (`/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g`); strip bidi overrides `\u202A-\u202E\u2066-\u2069`
  (RTL-override spoofing); collapse `\n{3,}` → `\n\n`; trim; then truncate. `title` strips all `\n`.
- `image`: `new URL()` parse, require `protocol === "https:"`, reject non-empty `username`/`password`
  (credential smuggling). Shaped like `sanitizeRedirectUrl` but **keeps the query string** — CDN image
  URLs are signed.

**Native side, inbound** — the page is first-party, but iOS *fetches* `image`, so re-validate:

- iOS: reject non-https; reject private/link-local hosts (`10.`, `172.16-31.`, `192.168.`, `169.254.`,
  `.local`) — the app's network position is not ours to lend; cap the response at 2 MB and the fetch
  at 2 s (matching the Tauri plugin); require an `image/*` content type; abort if `UIImage(data:)`
  returns nil.
- Android: drops `image` at the parser. No fetch, no risk.
- Both: re-apply the §6 length caps defensively before `EXTRA_TEXT` / `LPLinkMetadata`. A megabyte
  `Intent` extra is `TransactionTooLargeException` in the *merchant's* process.
- `rect` (iOS): require four finite values, `w`/`h` > 0, and intersection with the web view bounds
  after conversion. Otherwise fall back to centre.

## 7. Native changes

### Android

- `NativeShare.share()` takes `text`.
- `EXTRA_TEXT` = `"$text\n\n$link"` when text is present, else `link`. This is the only field that
  reaches the recipient.
- Add `EXTRA_SUBJECT` alongside `EXTRA_TITLE`.
- **No preview thumbnail.** The Sharesheet renders in the system chooser process, so it cannot fetch
  an `https://` URL and cannot read our files; the only way in is a `content://` URI plus
  `FLAG_GRANT_READ_URI_PERMISSION`, which means an SDK-owned FileProvider and the first
  `<application>` block this SDK would ever merge into a merchant manifest. That buys a ~64 dp tile
  visible to the sharer, in a system UI, for the duration of the chooser — it never travels. Not
  worth the manifest footprint. iOS has no equivalent cost because `LPLinkMetadata.iconProvider`
  takes an in-process `NSItemProvider`, so the image ships there and not here.
- `apiDump` required — `NativeShare` is internal, but `SharingRequest`'s new fields are not.

### iOS

- `import LinkPresentation` (iOS 13+, floor is 15).
- Build `LPLinkMetadata` with `title`, `url`/`originalURL`, and `iconProvider` from the fetched image.
- Split into `LinkActivityItemSource` + `TextActivityItemSource` so single-item activities get the
  URL, not text-glued-to-URL.
- `activityViewControllerLinkMetadata` returns the metadata.
- iPad popover anchor — see below.

### iPad popover anchor

`NativeShare.share` anchors the popover to the centre of `topViewController().view` with
`permittedArrowDirections = []`. What that means depends on which path raised it, and only one of
the two is worth fixing now:

- **Sheet up (normal path).** The top view controller is our own sharing sheet, so the popover lands
  mid-sheet with the arrow suppressed. Tolerable, not right — it should point at the Share CTA. That
  CTA lives inside the `WKWebView`, so its frame is not knowable natively; the page has to report the
  rect. Cheap, because §6 already opens the bridge payload — add `rect=x,y,w,h` to `action=share`,
  convert from CSS pixels through the web view's coordinate space, and fall back to today's centre
  when absent or implausible.
- **Tier 3 (no page, no sheet).** The top view controller is the merchant's own screen and the
  popover lands dead centre of it, pointing at nothing. The only correct anchor is the merchant's own
  share button, which needs a merchant-supplied anchor — deferred with the rest of the customisation
  surface (§11). Leave the centre fallback; on a path that only fires when config resolution has
  already failed, an unanchored popover is not the worst thing happening.

Both cases are iPad-only. `permittedArrowDirections = []` stays wherever the anchor is a fallback:
an arrow pointing confidently at nothing reads worse than no arrow.

### iOS only — image prefetch

Prefetch the icon during `FrakSharing.warm` through the existing `HTTPClient`, so the first tap is
not stalled behind a 2 s fetch. The warm URL already carries `logoUrl`; a product image is only known
at tap time, so warm prefetches the logo and the tap path upgrades opportunistically under a short
deadline. Android needs none of this — it ships no image.

### Tier-3 fallback

No page, so the SDK resolves it — but **not from `translations`**. Tier 3 is entered from the
`catch (FrakError)` around `resolveConfig()` in `SharingSessionBuilder.resolve()` /
`SharingSheetModel`, i.e. it exists precisely because the resolved config is unavailable. Anything
sourced from `sdkConfig` is out of reach on this path by construction.

What *is* available is local: the `SharingRequest` in memory, and `FrakMetadata` (merchant-supplied,
fixed at build time — `name`, `logoUrl`, `homepageLink`). So the chain is:

1. `SharingRequest.shareTitle` / `.shareText` — the per-call override
2. First product's `title`
3. Built-in en/fr constants

Interpolation is `{{productName}}` only, bound to `FrakMetadata.name`, which survives a config
failure. `SharingDependencies` does not expose it yet — add a `metadataName(): String?` member.
Skip the placeholder entirely when `name` is null rather than rendering an empty gap.

`{{estimatedReward}}` is **not** available here: `seedReward` calls `dependencies.bestReward()`,
which needs the network that just failed. No reward-bearing key in the tier-3 constants.

Which locale to pick for the constants: `FrakMetadata.lang`, falling back to the device locale
(see §8), falling back to `en`.

## 8. Device locale

`FrakMetadata.lang` defaults to `nil` on both platforms, so the backend falls back to the *merchant's*
configured language rather than the user's phone. French copy on an English handset reads as a bug.

Defaulting `lang` to the device locale — mapped to `en`/`fr`, `nil` if neither — fixes the whole
sheet, not just sharing. It changes the `ConfigStore` cache key (`MerchantQuery.cacheKey()` already
includes `lang`, so this is a cache-miss, not a correctness problem). Worth doing in the same pass,
worth its own commit.

## 9. Sequence

1. Merge merchant `translations` into the wallet `/sharing` page's i18next instance (fixes step 3 of
   the precedence chain on its own, no native release).
2. Precedence + `shareData` resolution in `useSharingPageController`; benefits web and Tauri
   immediately.
3. Page param table + `SharingPageUrl` writers on both platforms.
4. Bridge payload on `action=share`, both parsers.
5. `NativeShare` rewrite on both platforms, ported from the Tauri plugin.
6. iOS warm-path icon prefetch.
7. iPad popover anchor from the page-reported CTA rect (rides on step 4's bridge payload).
8. Device-locale `lang` default.
9. `apiDump` + `.api` review.

### Lanes

The steps map onto three near-disjoint directory lanes:

| Lane | Owns | Steps |
|---|---|---|
| A — web | `apps/wallet`, `packages/wallet-shared`, + the `i18nMapper` move in `apps/listener` | 1, 2, web halves of 3-4 |
| B — Android | `sdk/android` | Android halves of 3-4, 5 |
| C — iOS | `sdk/ios` | iOS halves of 3-4, 5, 6, 7 |

Three things are genuinely *not* disjoint, and each is handled rather than discovered:

- **`buildHostResultUrl` is a shared schema.** Lane A writes it, B and C parse it. §6 is exact enough
  that all three can start together, but A must land first — B and C code against the spec, not
  against A's diff.
- **`translationKeyPathToObject` moves packages**, touching `apps/listener`, which is in no lane.
  Lane A owns the move and the listener's import.
- **Device-locale `lang` (step 8) is not disjoint at all.** It lives in `frak-sdk` core on both
  platforms, and it changes `MerchantQuery.cacheKey()`, which changes *which* `translations` map comes
  back — i.e. it changes the input to precedence step 3. Do not let B and C touch `FrakMetadata`
  concurrently. It lands last, as its own commit, after the sharing work is green.

`apiDump` (step 9) runs after B. `SharingRequest` gains three fields, so the `.api` diff will be
non-empty; review it rather than rubber-stamping.

## 10. Open

- **A1** — *Closed: no Android thumbnail.* The FileProvider cost is an `<application>` block in every
  merchant manifest for sender-side chrome that never travels. If a merchant ever asks for the tile,
  §7 has the chain; the `shareImage` param stays on the wire for iOS regardless.
- **A2** — *Closed: no golden fixture.* Pinning page-resolved and tier-3 payloads to each other would
  assert something false — tier 3 has no merchant copy *by design*, because it is the path taken when
  config resolution failed. The corpus in `04-golden-fixtures.md` exists for wire formats where a
  byte-level disagreement is silent and unrecoverable; this is not one. A unit test per platform that
  tier 3 prefers the product title over null is the right size.
- **A3** — No merchant UI for `sharing.title` / `sharing.text`. They are API-settable only until
  someone builds the editor, at which point the `components.shareSheet` question reopens.

## 11. Merchant customisation — deferred, with the traps recorded

No hook for customising the share. Adding methods to `FrakSharing.Builder` is purely additive, so
deferring forecloses nothing, and the sheet has had zero device passes on either platform and no
merchant in production — designing extension points before the default is proven is backwards.

Recorded so the obvious implementation is not reached for later without knowing what it costs.

**Do not expose the platform object.** `(Intent) -> Unit` / `(UIActivityViewController) -> Void` is
the tempting shape and the wrong one:

- It publishes the *mechanism* as contract. Under `explicitApi()` + `apiDump`, with merchant binaries
  frozen at store submission, handing out the `Intent` means `ACTION_SEND` + `createChooser` can
  never be replaced — not by `ShareCompat`, not by `EXTRA_CHOOSER_CUSTOM_ACTIONS`, not by whatever
  Android ships next.
- It lets a merchant break an invariant they cannot see. `SharingSheetState.share()` fires
  `track(Interaction.sharing())` when the chooser opens, and that is reward-bearing. A merchant
  appending a hashtag to `EXTRA_TEXT` can drop the `fCtx` and still trigger payout on a share that
  attributes to nobody.
- On iOS it deadlocks. `NativeShare.share` awaits a continuation resumed from
  `completionWithItemsHandler` behind `ResumeLatch`. The first thing a merchant sets on a handed-out
  controller is that handler, and then the continuation never resumes.

**If it is ever needed, the shape is a takeover, not a mutation.** `(SharingPayload) -> Boolean`,
where `SharingPayload` is `link`/`title`/`text`/`imageUrl` — resolved, localised, product-selected,
no platform types, identical on both platforms. True means the merchant handled it and the sheet
still records the interaction and moves to confirmation. This is the same contract the page already
runs on one layer down: `outcomes.share?.()` returns "handed off" and `useSharingPageController`
branches on it.

**And note a DIY path already exists.** `client.sharing.buildLink()` is public, fully local, and
needs no web view. A merchant wanting complete control has it today, minus the sheet's UI, the
install handoff and the tracking — which is what makes the takeover callback a narrower ask than it
first sounds.
