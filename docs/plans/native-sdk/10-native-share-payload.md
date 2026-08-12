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

Note step 3 is a fix in its own right: `apps/listener` merges merchant translations into i18next via
`ListenerUiProvider`, but `apps/wallet`'s `/sharing` route (`SharingView.tsx`) uses `rawT` straight
from `useTranslation()`. A merchant's `sharing.title` override is silently dropped on every native
share today.

## 6. Wire contract

### Inbound — native → page

Three params in `apps/wallet/app/module/sharing/params/table.ts`, transport `both` so a warmed page
can receive them on the activation fragment:

| Param | Codec |
|---|---|
| `shareTitle` | `str`, length-capped |
| `shareText` | `str`, length-capped, control chars stripped |
| `shareImage` | new `sanitizeShareImage` — https only, length-capped |

Written by `SharingPageUrl.build()` / `.activationFragment()` (Kotlin) and `SharingPageURL.swift`.
Sourced from three new `SharingRequest` fields.

### Outbound — page → native

`buildHostResultUrl` currently admits `value`/`exp` for `action=code` only. Extend it so
`action=share` carries `title`, `text` and `image`:

```
frak-<pkg>://result?action=share&sid=…&title=…&text=…&image=…
```

Parsed in `SharingWebView.kt` `SharingPageAction.fromWire()` (currently `action`/`value`/`exp`) and
its iOS twin in `SharingWebView.swift`. `Share` becomes a data class/case carrying the payload;
absent fields keep today's behaviour.

Safe for the same reason the existing channel is: the host intercepts this navigation inside its own
web view. Share copy is not sensitive. **`image` must still be re-validated native-side** — https
only, capped download size — because the SDK fetches it and writes it into a FileProvider cache dir.

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

No page, so the SDK resolves it: request override → first product → `translations` → built-in en/fr
constants. Interpolation is limited to `{{productName}}` — a ~20-line replacer. `{{estimatedReward}}`
is available via `SharingSessionBuilder.seedReward`, but it is nullable under a 40 ms budget, so any
key using it needs a no-reward variant, the same shape as `buttonShare.noRewardText`.

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

## 10. Open

- **A1** — *Closed: no Android thumbnail.* The FileProvider cost is an `<application>` block in every
  merchant manifest for sender-side chrome that never travels. If a merchant ever asks for the tile,
  §7 has the chain; the `shareImage` param stays on the wire for iOS regardless.
- **A2** — No test asserts page-resolved and SDK-resolved (tier-3) payloads agree. The golden-fixture
  pattern from `04-golden-fixtures.md` is the obvious tool if drift proves real.
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
