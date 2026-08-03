# Native SDK — high-level overview

What we build, why, and how it stays light and fast.

---

## 1. Philosophy

Four principles, in priority order. When they conflict, the higher one wins.

### 1.1 Port the capability, not the architecture

The web SDK's iframe + `postMessage` RPC exists **solely** to work around browser
origin isolation. A native app is already a trust boundary. We port what the SDK
*does*, never how it is forced to do it.

Concretely: no iframe, no RPC transport, no listener, no heartbeat handshake, no
lifecycle-message discrimination, no origin pinning. Those are ~1500 lines of
accidental complexity that solve a problem native does not have.

### 1.2 Invisible to the host app

Merchant apps are dependency-sensitive; version conflicts are the number-one native SDK
integration complaint. Therefore:

- **zero third-party runtime dependencies** (see §5)
- < 150 KB per platform, no transitive bloat
- `initialize()` itself is non-blocking, performs **no I/O**, and **never throws** — it does
  launch one background task, draining whatever the event queue held from a previous
  session, because nothing else ever triggers that drain (`09-api-shape.md` §5)
- never crashes the host: every public entry point degrades to a no-op or a typed error
- no analytics vendor SDK, no IDFA/AAID — which merchants will ask about, but note this
  does **not** by itself settle the ATT question; see §12.1

### 1.3 Native where the user can feel it, hosted where they cannot

The OS share sheet, the bottom sheet, buttons, haptics, the App Store presentation —
all native. The reward card, FAQ, legal copy, and how-it-works stepper are hosted from
the existing `/sharing` route.

The line is drawn where the user perceives a difference. A share sheet that isn't
`UIActivityViewController` feels wrong instantly. A FAQ accordion does not.

### 1.4 One source of truth for money

Any number representing a reward must be computed once and displayed identically
everywhere. Divergent reward amounts between a merchant's iOS app, Android app, and
website are a trust problem, not a cosmetic one. This drives the server-side
pre-formatted reward projection (see `01-platform-changes.md` §3.1) and the
golden-fixture testing requirement (§8).

---

## 2. What we build

Two artifacts per platform, so a merchant taking only tracking never pulls in a web view.

| | Android | iOS |
|---|---|---|
| Core | `id.frak:frak-sdk` | `FrakSDK` |
| UI | `id.frak:frak-sdk-ui` | `FrakSDKUI` |
| Distribution | Maven Central | SPM + CocoaPods |
| Minimum | `minSdk 24`, Kotlin 2.2+ | iOS 15, Swift 5.9+ (Swift 6 strict-concurrency clean) |
| Namespace | `id.frak.sdk` | module `FrakSDK` |

> The Android Kotlin minimum was **1.9** until the toolchain moved to Kotlin 2.4.
> Kotlin 2.4 removed `-language-version=1.9` along with the K1 compiler, so an
> artifact consumable by a 1.9 compiler can no longer be produced. 2.2 is the
> lowest floor worth committing to — 2.4 still accepts 2.0 and 2.1, but both are
> already deprecated. Nothing had been published when this changed, so no existing
> merchant was affected.

Core is UI-free and headlessly testable. UI carries the sharing sheet.

### Module layout (symmetric across platforms)

```
FrakSDK
├── Core        FrakConfig · FrakClient facade · FrakError
├── Net         URLSession / HttpURLConnection. JSON only. injects x-frak-client-id
├── Identity    AnonymousIdStore (UUIDv4, lowercase)
├── Config      dual SWR cache (config + bare merchantId) · PlacementResolver (4-tier copy)
├── Rewards     RewardRepository · RewardSelector · RewardFormatter
├── Tracking    InteractionTracker · PurchaseTracker · durable offline queue
├── Sharing     FrakContextCodec (V2 binary) · AttributionMerger · LinkBuilder · Presenter
└── AppLink     DeepLinkBuilder · InstallRedirector · AppInstalledProbe
```

---

## 3. Goals per SDK

Both SDKs expose the same capability set with idiomatic ergonomics. Symmetry is a hard
requirement: a merchant with both apps must not have to learn two mental models. See
the naming map in §9.

### Android

- coroutine-first: `suspend` for one-shot, `StateFlow` for observable config
- Compose-first UI with a View/Activity fallback for imperative call sites
- **embedded `WebView`** as the sharing transport, mirroring iOS `WKWebView`
- ship `<queries>` via manifest merger — `<package android:name="id.frak.wallet"/>` for
  app detection. **Never `QUERY_ALL_PACKAGES`**: Play policy restricts it to apps whose
  core purpose requires broad visibility, and requesting it would drag every integrator
  into a Permissions Declaration review.
- ship `data_extraction_rules.xml` excluding SDK prefs from backup (see §4)
- consumer R8/ProGuard rules included

> **Chrome Custom Tabs cannot implement this design.** An earlier draft named Custom
> Tabs the primary transport. It is architecturally impossible: a Custom Tab is a
> separate browser Activity, so it cannot be embedded in a bottom sheet, cannot have
> native buttons below it, and cannot lose the browser toolbar. Partial Custom Tabs
> (`setInitialActivityHeightPx`) give a sheet-*shaped* browser, still with Chrome chrome
> and no native footer. It also breaks the `?confirmed=1` reload, gives only coarse
> navigation callbacks (so no reliable load-failure detection for the tier-3 timeout),
> and cannot do origin-pinned navigation interception. `WebView` it is.

### iOS

- `async`/`await` with typed throws; `AsyncStream` for observable config
- SwiftUI-first (`.frakSharingSheet` modifier) with a `UIViewController` fallback
- `WKWebView` in a `UISheetPresentationController` as the sharing transport
- `UserDefaults`, **not Keychain**, for the anonymous id (see §4)
- document the required `LSApplicationQueriesSchemes` entry — the SDK cannot inject it
- **ship a `PrivacyInfo.xcprivacy` privacy manifest** — see §5.1; without it, merchant
  app uploads can be rejected

### Deep-link handling — configured, not optional

Inbound `fCtx` handling is **MVP**, and how the merchant wires it is a design decision
in its own right (see §6.1). The SDK must make the wiring hard to get wrong, because
the failure mode is silent: a missed hook means arrivals are never tracked and nobody
sees an error.

---

## 4. Anonymous identity

**Derived from a device-held P-256 keypair**, persisted per app installation,
**lowercase canonical form**:

```
keypair  = P-256 (Keystore / Secure Enclave)
clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 bits set
```

This makes identity self-authenticating and closes the merge vulnerability described in
[`../identity-proof-of-possession/`](../identity-proof-of-possession/). Native has **no
legacy ids**, so it is cryptographic-only — no trust-on-first-use path, unlike web.

Sensitive calls carry an opaque `proof` blob (`v ‖ pk ‖ ts ‖ sig`, base64url). The
validity window is **per op, not global** — ±2 min for `merge`, 90 days for `ensure`,
30 days for `install` — because an install proof is minted on the sharer's device and
consumed days later on another one. Never signed on `track/*`; signing stays off the
hot path.

**Ship this in v0.1 even if backend enforcement lands later.** A released binary cannot
be retrofitted; enforcement then becomes a pure backend flip with no version skew.
Generate key and id **atomically** — a surviving key with a lost id (or vice versa)
silently fails derivation.

> Swift's `UUID.uuidString` is **uppercase**. Lowercase at the boundary, always.
>
> The failure is *not* in the codec. `UUID_RE` carries the `i` flag
> (`frakContextV2Codec.ts:46`) and the hex read is case-insensitive, so an uppercase
> UUID validates and encodes to correct bytes; `bytesToUuid` (line 65) then always
> emits lowercase, so a round-trip silently **normalises** case.
>
> That silent normalisation is exactly what makes this dangerous. The break happens
> upstream, wherever an uppercase `uuidString` meets a lowercased decoded value as a
> *string*: cache keys, storage keys, `merchantId` equality checks, and the self-referral
> guard in §6.1. Normalise once at the Swift boundary rather than at each call site.
>
> The one place it *cannot* bite is the identity signing layout, which took the same
> hazard seriously and removed it — `sdk/core/src/identity/canonical.ts` signs UUIDs as
> their raw 16 bytes, never their 36-character text form, precisely so two platforms
> cannot sign different bytes for the same id.

| | Storage | Uninstall |
|---|---|---|
| Android | `SharedPreferences` (SDK-owned file), excluded from backup | wiped |
| iOS | `UserDefaults` | wiped |

**Android backup exclusion needs both blocks, and may not apply at all.** Two distinct
mechanisms carry app data across installs, controlled separately in
`data_extraction_rules.xml`:

```xml
<data-extraction-rules>
    <cloud-backup>   <exclude domain="sharedpref" path="id.frak.sdk.xml"/> </cloud-backup>
    <device-transfer><exclude domain="sharedpref" path="id.frak.sdk.xml"/> </device-transfer>
</data-extraction-rules>
```

Excluding only `<cloud-backup>` still lets a **device-to-device transfer** (the standard
new-phone flow) clone the anonymous id — resurrecting identity exactly the way Keychain
would on iOS, which is the thing this design explicitly rejects.

Worse, `android:dataExtractionRules` is a **singular attribute** on `<application>`. If
the host app declares its own rules file, Gradle's manifest merger does **not** union
them — the SDK's file is dropped or the build fails pending `tools:replace`. So "we ship
it via manifest merger" is not sufficient. Required: document the exclusion as an
integration step for any merchant with existing backup rules, and add a runtime
debug-build assertion that warns when the SDK's prefs file is not excluded.

**Keychain is explicitly rejected on iOS.** Keychain items survive uninstall/reinstall,
which would resurrect a "fresh" user's anonymous id across a delete–reinstall cycle.
That is a persistent cross-install identifier — a privacy problem, inconsistent with
Android (where prefs are wiped), and inconsistent with the web, where clearing site data
resets the id. `UserDefaults` gives correct parity. Same reasoning as Firebase's
app-instance id.

Scope: one id per app installation. A native app maps to exactly one merchant, so
app-scope equals merchant-scope. Store the `merchantId` alongside and regenerate
defensively if it ever changes.

Public controls: `anonymousId`, `resetAnonymousId()` (GDPR erasure — must also purge the
pending event queue so nothing is emitted under a dead id), `setTrackingEnabled(_:)`
(when false: no id generated, no network issued).

### Linking to the wallet

> ⚠️ **The merge path below waits on enforcement, not on a fix.**
> [`../identity-proof-of-possession/`](../identity-proof-of-possession/) shipped, but
> `merge/execute` is latch-gated rather than mandatory: a present proof is verified, an
> absent one is accepted unless that id has latched before. Until `ROLLOUT-STEP-3` flips
> the wallet arms — gated on the store binary being live — **do not ship the `?fmt=`
> merge flow**. The `ensure` path is unaffected and is the MVP mechanism.

When the Frak app is installed, the anonymous id can be linked to the user's wallet with
**no backend changes** — the plumbing already exists:

```
SDK: canOpenURL("frakwallet://") → installed
SDK: open frakwallet://install?m=<merchantId>&a=<anonymousId>
  → apps/wallet deepLink.ts routes `install` (publicActions + routeResolvers)
  → /install → pendingActionsStore.addAction({type:"ensure", merchantId, anonymousId})
  → useExecutePendingActions → POST /user/identity/ensure (wallet's own session)
  ✅ linked
```

`POST /user/identity/ensure` requires a wallet or SDK session, which the merchant SDK
does not have — so the **wallet performs the link, not the SDK**. When the wallet
already holds a competing anonymous id, use the merge path instead: the SDK can call
`POST /user/identity/merge/initiate` with **no session at all** (the route is
`withOptionalWalletOrSdkAuthent`, needs only `{sourceAnonymousId, merchantId}`), then
pass `?fmt=<mergeToken>` for the wallet to `merge/execute`.

**Do not trigger this opportunistically on init.** It is an app switch; yanking a user
out of the merchant's app just to link an id is bad. Do it only where an app switch is
already expected — the Install CTA (§6). There, `isFrakAppInstalled == true` means skip
the store, skip the install code, deep link straight through.

*(v0.2, Android only)* Silent linking with no app switch: the wallet exports a
signature-guarded bound `Service`/`ContentProvider`; the SDK binds and passes
`{merchantId, anonymousId}`. iOS has no equivalent app-to-app IPC — accept the
asymmetry.

---

## 5. Dependency budget

**Hard rule: zero third-party runtime dependencies.**

| Need | Android | iOS |
|---|---|---|
| HTTP | `HttpURLConnection` | `URLSession` |
| JSON | `org.json` | `Codable` |
| Concurrency | `kotlinx-coroutines-core` | native `async/await` |
| Base64url | `android.util.Base64` (`URL_SAFE\|NO_PADDING\|NO_WRAP`) | manual transform |
| UUID | `java.util.UUID` | `Foundation.UUID` |
| Currency | `NumberFormat.getCurrencyInstance` | `NumberFormatter` |
| Web view | `android.webkit.WebView` (platform) | `WebKit` |
| Storage | `SharedPreferences` | `UserDefaults` |
| Queue | append-only JSONL file | append-only JSONL file |

**Accepted:** `kotlinx-coroutines-core` only. Dropping Custom Tabs also drops
`androidx.browser`, so the UI artifact now has **zero** third-party dependencies —
`WebView` is platform-provided.

**Rejected:** Retrofit, Moshi, Gson, Alamofire, Room, RxJava, Combine wrappers, any DI
framework, any analytics SDK.

### 5.1 iOS privacy manifest — a hard shipping gate

Since **1 May 2024**, an app or SDK using a *required-reason API* must declare it in a
privacy manifest or App Store Connect can reject the upload with **ITMS-91053 (Missing
API declaration)**. `UserDefaults` — which this SDK uses for the anonymous id — is one
of the five required-reason categories.

This rejection lands on the **merchant's** upload, not ours. Shipping without it means
every integrator's release breaks, which is the worst possible first impression.

Ship `PrivacyInfo.xcprivacy` inside the SDK bundle:

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array><dict>
  <key>NSPrivacyAccessedAPIType</key>
  <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
  <key>NSPrivacyAccessedAPITypeReasons</key>
  <array><string>CA92.1</string></array>
</dict></array>
```

`CA92.1` = access scoped to the app itself. Verify against Apple's live reason list
before release; `C56D.1` (SDK-owns-its-own-namespace) may be the better fit and is what
many third-party SDKs ship.

Also declare data collection accurately: the anonymous id is collected and linked to a
user identity. `NSPrivacyTrackingDomains` interacts with the ATT question in §12.

**Code signing:** Frak is *not* on Apple's [commonly-used third-party SDK
list](https://developer.apple.com/support/third-party-SDK-requirements/), so the
signature requirement does not currently apply. Sign the XCFramework anyway — it is
cheap, it is a supply-chain signal merchants may ask about, and being added to that list
later would make it mandatory.

The event queue uses a plain append-only JSONL file with compaction on flush rather than
Room/CoreData — a single FIFO table does not justify a database dependency.

---

## 6. The sharing flow

The exact web flow is preserved, with one native-only shortcut.

```
Merchant surface (product page / post-purchase / event)
 → "Share and earn {REWARD}"        ← copy + reward from SDK, {REWARD} pre-substituted
 → presentSharing(...)
    ┌──────────────────────────────────┐
    │  merchant logo          [ ✕ ]    │  ← NATIVE header
    ├──────────────────────────────────┤
    │  hosted /sharing?native=1        │  ← reward card, products,
    │  (chromeless)                    │    how-it-works, FAQ
    ├──────────────────────────────────┤
    │  [ Share ]         [ Copy ]      │  ← NATIVE, real OS share sheet
    └──────────────────────────────────┘
 → user shares/copies → SDK fires Interaction.sharing automatically
 → SDK reloads web view with &confirmed=1        ← REQUIRED, see below
 → page shows PostShareConfirmation: "create your wallet to get your rewards"
 → Install CTA → <scheme>://result?action=install&sid= → back to native
      ├─ Frak app installed → frakwallet://install?m=&a=  → linked, done
      └─ not installed:
           Android → /install page (Play Install Referrer, unchanged)
           iOS     → native install-code flow (below)
```

**Two non-obvious requirements in that diagram.**

1. **`&confirmed=1` is load-bearing.** The page only shows `PostShareConfirmation` when
   its *own* share/copy handlers fire. Under `native=1` those are hidden, so without an
   inbound signal the user shares and the page just sits there — no confirmation, no
   Install CTA, no wallet. The entire funnel dies silently. See
   `01-platform-changes.md` §1.2b.
2. **The SDK owns 100% of sharing tracking.** `apps/wallet/app/routes/sharing.tsx` wires
   only `onSuccess`, never `onShared` — it never emits `create_referral_link`, not even
   for the existing Tauri consumer. An implementer who assumes the page tracks will ship
   silently untracked shares. Queue the interaction **before** opening the OS share
   sheet, so tracking survives process death.

### 6.1 Inbound links, arrival tracking, and self-referral

MVP. The web SDK does this automatically on every page load via `setupReferral`
(`initFrakSdk.ts:84`, unconditional). Native has no ambient navigation, so it must be
wired — and the wiring must be hard to get wrong.

**Configuration.** `FrakConfig.deepLink` selects the strategy explicitly, so the choice
is visible in review rather than implied by absence:

```kotlin
FrakConfig(
    deepLink = DeepLinkHandling.Automatic,      // default
    // DeepLinkHandling.Manual  — merchant calls frak.handleReferralLink(url)
    // DeepLinkHandling.Disabled
)
```

- **Automatic** (default): Android registers a `SingleTask`-safe `ActivityLifecycleCallbacks`
  hook reading `Intent.data` on create **and** `onNewIntent`; iOS swizzle-free opt-in via
  a `FrakSceneDelegate` helper or a one-line `.onOpenURL { Frak.handle($0) }` the SDK
  documents. Covers cold **and** warm start — the warm-start miss is the most common
  integration bug.
- **Manual**: for apps with a centralised router. `handleReferralLink(url)` returns
  whether the URL was consumed, so it composes with existing routers.
- Debug builds log loudly when an `fCtx` URL is observed but no handler is configured.

**Self-referral guard is mandatory.** `processReferral.ts:104-129` skips arrival tracking
when the incoming `fCtx` wallet/clientId matches the current device's identity. Without
it, a user who reopens or reshares their own link is tracked as their own referee —
corrupting the referral graph. Native must replicate this check exactly.

**No ambient URL to rewrite.** Web rewrites the page URL's `fCtx` to the current user
after arrival (`FrakContextManager.replaceUrl`) so an onward share attributes correctly.
Native has no such ambient state, so `buildSharingLink` always builds from the explicit
`SharingRequest` — fine, but merchants building "share this screen" flows must be told
to pass live context.

**Do not port the web fallback heuristics.** `deepLinkWithFallback.ts` uses a 2.5s Page
Visibility timeout plus a Chromium `intent://` rewrite to detect whether an app opened.
Those are browser workarounds. Native has synchronous OS APIs (`canOpenURL` /
`PackageManager`); cargo-culting the timeout would be strictly worse.

### 6.2 `presentSharing` lifecycle

Underspecified lifecycle is where async sheet APIs actually break. The contract:

| Situation | Behaviour |
|---|---|
| **Re-entrancy** | second call while one is active → `.failed(.alreadyPresenting)`. Never queue or silently cancel. |
| **Terminal result** | a session can be shared *then* install-clicked *then* dismissed. Result = **most significant** event (install > shared/copied > dismissed); the rest stream via `analyticsEvents`. |
| **Dismiss mid-load** | cancel the load, return `.dismissed`. Queued interactions unaffected. |
| **Web view fails to load** | tier-3 fallback — fire the native share sheet with the locally-built link. Never show a broken sheet. |
| **Rotation / config change** | Android: sheet state survives via `SavedStateHandle`; never re-create the web view (it would re-fetch and lose scroll). |
| **Process death** | the continuation is **gone** and the result is lost. This is why the `sharing` interaction is queued *before* the OS share sheet opens — tracking survives even when the callback does not. Documented as best-effort. |

The process-death case is the one to internalise: Android can kill the host while the OS
share sheet is foregrounded. Any design that only records the share when the callback
returns will lose events in the field.

### iOS install flow (App Clip excluded)

```
1. SDK: POST /user/identity/install-code/generate
     { merchantId, anonymousId, pubkey, ts, sig }   ← signed here, see note below
   → { code, expiresAt (+72h) }
2. SDK: UIPasteboard.general.setItems([...], options: [.expirationDate: expiresAt])
3. SDK: present SKStoreProductViewController(id: 6740261164)   ← IN-APP App Store
4. user installs, opens Frak
5. wallet first launch: code field autofocused → iOS keyboard suggestion bar offers
   the clipboard value → one tap
6. POST /user/identity/install-code/resolve → ensure → linked
```

Design notes:

- **`SKStoreProductViewController`, not a store URL.** The App Store page presents
  *inside* the merchant's app. The user never leaves, never loses context, and the
  merchant app is not backgrounded. Measurable conversion difference versus bouncing out.
  ⚠️ **Presenting it while a `UISheetPresentationController` is already up is a known
  field failure** — blank/black content, or `productViewControllerDidFinish` never
  firing. Since our sharing sheet *is* a `UISheetPresentationController`, this is the
  default path, not an edge case. Dismiss the sharing sheet first, then present from the
  top-most view controller in the completion block. Add a load timeout with a fallback
  to the plain App Store URL — `loadProduct` fails or hangs non-rarely.
- **Never read the pasteboard.** `UIPasteboard.general.string` triggers the "pasted
  from…" banner and, since iOS 16, a permission alert. **Writing never triggers
  anything**, including with `expirationDate`. Use `detectPatterns(for:)` if presence
  detection is genuinely needed.
- **The keyboard suggestion bar is best-effort, not an API contract.** It has an
  undocumented freshness window (order of a minute or two), can be suppressed by
  third-party keyboards, disabled predictive text, or a `textContentType` mismatch. It
  is a nice accelerant when it fires — **never the primary mechanism**.
- **Manual code entry remains the floor**, and given the point above it is the real
  path, not the fallback. The existing 6-char / 31-symbol code is adequate as a UX
  primitive; its security problem — an unauthenticated `anonymousId` oracle — was closed
  by [`../identity-proof-of-possession/`](../identity-proof-of-possession/), which added
  an atomically-enforced attempt cap and replaced the leaked id with a short-lived
  ticket.
- **The SDK signs at `generate`, not at `resolve`.** The SDK holds the private key; the
  Frak wallet app that later resolves the code is a different app on a possibly
  different device and cannot produce that signature. `resolve` therefore returns an
  opaque **ticket** rather than the `anonymousId`, and the wallet drains the ticket
  against `ensure` post-auth. Note that `install-code/generate` itself stays permissive
  — the wallet's own sharing page reaches it with a `clientId` it cannot sign for, so a
  required proof would break the arm rather than secure it; the ticket is the protection.

Net: iOS goes from "read a 6-digit code off a web page and type it" to "tap Get, tap the
suggestion". Still short of Android's Install Referrer, but no longer painful. **No
backend changes required.**

### Why the sharing page is hosted, not native

With `sdkConfig.css` being removed, the remaining case is narrower than it once was, but
still holds for MVP:

- `packages/wallet-shared/src/sharing/component/SharingPage/index.tsx` already has three
  consumers (listener iframe, wallet `/sharing` route, Tauri wallet). Two native forks
  make five, of which two cannot share code.
- ~45 i18n keys across en/fr with i18next interpolation and `_tiered` / `_min` /
  `_lockup` context variants, plus legal copy and a 6-item FAQ — every change would
  become a three-implementation edit gated on merchant app-store release cycles.
- `RewardBreakdown` embeds non-trivial tier/percentage math.
- This is Frak's primary conversion surface — the one place iteration speed matters most.

**This is a v2 decision, not a permanent architecture.** The public API returns only a
`SharingResult` and never leaks the web view, so swapping to native UI later is a
non-breaking internal change. The offline fallback (§7) and seeded-state work both move
us toward it.

---

## 7. Performance

The architecture hides most latency structurally: **the sheet is native**. It animates
in instantly with the real header, buttons and a skeleton; the web view loads *during*
the ~300 ms presentation animation.

Optimisations, in order of payoff:

| # | Lever | Effect |
|---|---|---|
| 1 | **Seeded initial state** (`?r=&n=&l=`) | removes a full round-trip from the critical path — the page currently mounts, *then* fetches the reward, *then* renders the headline |
| 2 | **Android: warm `WebView`** | offscreen instance created + `loadUrl()`ed ahead of the tap. Symmetric with iOS. (`CustomTabsClient.mayLaunchUrl()` is **not** available to us — see the Custom Tabs note in §3) |
| 3 | **iOS: warm `WKWebView`** | offscreen instance `load()`ed at init kills web-content process spawn + navigation. ~30–60 MB resident, so gated behind `preloadSharing` (default off) |
| 4 | **Service worker + preconnect** | caches the `/sharing` shell; also powers offline tier 2. **Android only** — service workers do not run in `WKWebView` (see `01-platform-changes.md` §2.3); iOS relies on `URLCache` + seeded params |

Warm-up triggers: create the offscreen web view when a share surface becomes visible
(e.g. a product screen appears), not at init — it is memory, and §1.2 says stay
invisible.

**Budget with a gate, not an assumption.** Instrument time-to-first-meaningful-paint
from the native side:

| | Target |
|---|---|
| p75 | < 400 ms to content |
| p95 | < 1 s |
| fallback | > 1.5 s → skip the page, fire the native share sheet directly |

Expected: cold ~600 ms–1.2 s; warmed + pre-rendered + seeded ~100–300 ms. Behind an
already-animating native sheet, imperceptible.

If real-device numbers on low-end Android miss the budget after all four levers, **that
is the concrete trigger to go native on the sharing screen** — and by then the offline
fallback has already built most of the data layer.

> These targets were originally set assuming Custom Tabs with `mayLaunchUrl()`
> pre-rendering. On the `WebView` path they must be **re-measured on low-end Android**
> before being treated as commitments.

### Web view hardening (both platforms)

The sheet renders wallet-origin content inside the merchant's app with **no visible URL
bar** — so a mid-session cross-origin navigation would be indistinguishable from
trusted content. Non-negotiable:

- **Pin navigation to the wallet origin.** Reject any cross-origin navigation in
  `WKNavigationDelegate` / `WebViewClient.shouldOverrideUrlLoading`; open external links
  in the system browser instead.
- Disable file access (`allowFileAccess`, `allowUniversalAccessFromFileURLs`) and block
  mixed content.
- **Keep the no-bridge architecture.** No `addJavascriptInterface`, no
  `WKScriptMessageHandler`. State goes in via query params and comes out via the
  intercepted result URL. Adding a bridge later means re-deriving the origin checks the
  `apps/listener` postMessage layer needed — the exact complexity this design removes.
- Use a non-persistent data store so the sheet does not accumulate cookies in the host
  app's container.

### Offline

Three tiers (detail in `01-platform-changes.md` §4). The key property:
`buildSharingLink()` is **100 % local computation** — `merchantId` + `clientId` +
`Date.now()/1000` through the FrakContext v2 codec, no network ever. So offline sharing
*works*: native share sheet, correct link, `sharing` interaction queued and flushed on
reconnect, attribution fully preserved. Only the reward pitch and FAQ are lost, which is
the correct thing to lose.

### 7.1 The event queue — specified, because JSONL is weakest exactly here

A plain append-only JSONL file with compaction on flush. Correct choice — a single FIFO
table does not justify Room/CoreData — but the failure modes must be pinned down:

| Concern | Rule |
|---|---|
| **Idempotency** | stamp `idempotencyKey` (UUID) at **enqueue**, never per attempt. Without it, retries create duplicate `create_referral_link` rows (`01-platform-changes.md` §3.4). |
| **Timestamps** | capture-time, not flush-time. Otherwise offline events land in the wrong attribution window. |
| **Ordering** | strict FIFO. |
| **Single writer** | one process only. Android multi-process apps (`:remote`) would corrupt both the file and `SharedPreferences` — document main-process-only init and assert in debug builds. |
| **Atomic compaction** | write-temp + `rename`. Never compact in place. |
| **Torn tail** | last line may be truncated by a kill mid-write — tolerate and discard on read. |
| **Bounds** | cap by count **and** age (e.g. 1000 events / 14 days), drop oldest. A week offline must not grow unbounded. |
| **Poison messages** | evict after N permanent 4xx failures. Otherwise one rejected event blocks the FIFO forever. |
| **Backoff** | exponential with **jitter**, honouring `Retry-After`. Jitter matters: without it, a regional connectivity blip synchronises a merchant-wide flush stampede into the new rate limits. |
| **429** | back off without dropping events or poisoning the head. |
| **`resetAnonymousId()`** | purge the queue — never emit events under a dead id. |

---

## 8. Correctness risks

Ranked by (impact × likelihood of silent divergence).

### 8.1 FrakContext v2 binary codec — highest

Verified layout (`sdk/core/src/context/frakContextV2Codec.ts`):

```
byte  0        header: bits0-3 version(=2), bit4 has_c, bit5 has_w, bits6-7 reserved(=0)
bytes 1..16    merchant UUID   (16 bytes, mandatory)
bytes 17..20   timestamp       (uint32 BIG-endian, unix seconds)
bytes 21..36   client UUID     (16 bytes, if has_c)
bytes 37..56   wallet address  (20 bytes, if has_w)
```

Sizes 37 / 41 / 57. V1 is exactly 20 bytes (raw address), disambiguated purely by
length. Then **unpadded base64url** into `?fCtx=`.

Every one of those is a silent-failure trap: big-endian, unpadded base64url, exact
length disambiguation. A mistake produces links that *look* valid and fail attribution
with no error anywhere.

UUID case is a trap too, but a different one — the codec tolerates either case and
normalises to lowercase on decode, so the break lands upstream in string comparisons
rather than in the bytes. See the note in §4.

**Non-negotiable:** generate golden fixtures from `frakContextV2Codec.test.ts`, commit
them as a shared JSON file, and assert against them in both native test suites.
Round-trip tests alone are insufficient — two identically-wrong implementations
round-trip perfectly.

### 8.2 Reward selection + formatting

Mitigated by the server-side pre-formatted projection (`01-platform-changes.md` §3.1).
Native keeps a local formatter only as an offline fallback, tested against the same
fixtures.

Three behaviours that must be replicated exactly, all easy to miss:

- **Percentage rewards are suppressed from `{REWARD}` substitution.**
  `useReward.ts:41-44`: "Percentage rewards carry no concrete amount to advertise on
  this surface, so we treat them as no reward." A native integrator naively substituting
  a percentage will advertise something web deliberately hides.
- **Currency comes from the *static SDK config*** (`client.config.metadata.currency`,
  `useReward.ts:37`), not the backend resolve response and not the device locale. It
  then drives the formatting locale. `bestReward(currency:)` taking a caller-supplied
  currency invites exactly the drift §1.4 exists to prevent — drop the parameter and
  read config.
- **`formatRewardOrHide` and `rewards/conditions.ts` are unmapped.** `FrakFormat`
  currently exposes only `reward`/`rewardOrNil`. The hide-vs-null-vs-fallback condition
  logic is a dedicated module and needs an explicit native mapping before MVP.

### 8.2b Config resolution is 4-tier, not 3

The module layout's "3-tier copy precedence" is wrong. Actual precedence, split across
`ButtonShare.tsx:72-73` (tiers 1–2) and `85-88` (tiers 3–4):

```
1. placement-specific backend component config
2. merchant-global backend component config   ← the tier that was missing
3. host-supplied default (the JS `text` prop)
4. built-in i18n default
```

Tier 2 (`ResolvedSdkConfig.components`) is a separate branch from placements. Omitting
it means a merchant who sets a global default sees it silently ignored on native. The
`copy()` API also needs a host-default parameter to express tier 3.

Also undocumented and worth deciding on deliberately rather than by accident:

- **The config cache never expires.** `sdkConfigStore.resolve()` passes
  `cacheTime: Number.POSITIVE_INFINITY` (`sdkConfigStore.ts:238`) — not the 30s
  `DEFAULT_CACHE_TIME`, which applies to *other* actions (`getMerchantInformation`,
  `getUserReferralStatus`). And `withCache` is **not** stale-while-revalidate: it is a
  blocking cache-or-fetch that never serves stale data while refreshing
  (`utils/cache/withCache.ts`). Native must choose its own policy deliberately — a literal port
  means config never refreshes for the life of the process, which is defensible on web
  (page reloads) but wrong for a long-lived app.
- `sdkConfigStore` is a **dual** cache: full config plus a separate bare-`merchantId`
  fast path that resolves even when the full config is absent
  (`getMerchantId()`, `sdkConfigStore.ts:242-253`).
- `withCache` does **negative caching**: a failed fetch is remembered for 1s and
  short-circuits retries (`NEGATIVE_CACHE_TIME`, `utils/cache/withCache.ts:12`, checked
  at 78-81).
  Native should decide explicitly whether to match this.

### 8.3 Never derive merchant identity client-side

Always resolve merchants by server-issued `merchantId` (opaque UUID), or by
`packageId` once the resolve arm lands. Native SDKs never compute `productId` —
`computeLegacyProductId` was already removed from the public JS SDK for precisely this
reason.

`productId` itself is a **legacy field** (nullable, one remaining consumer behind
`legacyRoutes.ts`, no on-chain use — see `01-platform-changes.md` §3.5). It is neither
a constraint on the app-identity design nor something native ever touches.

### 8.4 Frak has no telemetry on native funnels

The web SDK emits a first-party OpenPanel stream that has **no native equivalent in this
plan**: `sdk_initialized`, `sdk_init_failed`, `user_referred_started/completed`,
`share_button_clicked`, `share_modal_error`, `open_in_app_clicked`, `app_not_installed`,
`banner_impression`, `post_purchase_impression/clicked`.

`analyticsEvents: AsyncStream` in §9 is an SDK→host observability hook — it sends
nothing to Frak. As specified, we would ship native with **zero visibility** into funnel
drop-off, init failure rates, or referral success, which directly undercuts the
measurement posture §1.4 and §7 depend on (including the p75/p95 perf gate, which needs
field data to enforce).

Decide before MVP: either emit the equivalent events to Frak's analytics backend, or
consciously accept flying blind on native for v0.1. Note that a hosted `/sharing`
presentation *does* still fire `sharing_page_viewed` wallet-side, so native sessions
already pollute that funnel's denominator with no `native=1` dimension to segment them.

### 8.5 Anonymous id continuity across surfaces

A user in the merchant's native app (clientId A) and on the merchant's website
(clientId B) are two unrelated identities server-side. Cross-surface shares — share from
the native app, recipient opens in a mobile browser, the overwhelmingly common case —
depend on the campaign engine resolving referrer↔referee across that gap. **Validate
end to end before launch.**

Related: with no App Links registered for merchant apps, an `fCtx` link opened on a
device that *has* the merchant's app installed still always opens a browser. Solving
package-id identity (§3.5 of the platform doc) does not by itself fix link routing —
that needs Universal/App Link registration too.

---

## 9. API surface

> The shape below predates `09-api-shape.md`: it still reads as flat `client.method()`.
> As shipped, every member listed here lives under one of five namespaces on `FrakClient`
> — `config`, `rewards`, `sharing`, `tracking`, `appLink` — for example
> `client.rewards.best(...)`, not `client.bestReward(...)`. `environment`, `anonymousId`
> and `resetAnonymousId` are the only members still on the root. See `09` for the mapping
> and the rationale.
>
> This section predates more than the namespace split, and was never fully implemented
> for v0.1: `copy`/`ResolvedCopy`, `referralStatus`/`ReferralStatus`, `InteractionType`,
> `FrakComponent`, `presentSharing` as an imperative call, and `openFrakApp`'s `path`/
> `fallback` parameters do not exist in the shipped SDK — the real sharing UI is
> `rememberFrakSharingLauncher`/`FrakShareButton` (Kotlin) and `.frakSharingSheet`
> (Swift), and `openFrakApp()`/`isFrakAppInstalled()` take no parameters on either
> platform. `isFrakAppInstalled()` is `async` on Swift and plain-`fun` synchronous on
> Kotlin — a real platform divergence, not a doc slip, and neither is `@MainActor`.
> `config.current` (iOS-only, a synchronous snapshot of the
> latest resolved config, since `AsyncStream` has no `.value`) is real and shipped but
> missing from the code block and naming map below. Treat this section as describing
> *intent*, not the shipped contract; `sdk/android/README.md` and `sdk/ios/README.md`
> list what actually ships. The Threading and network table further down carries the
> same flat-spelling and not-yet-shipped caveats.

```swift
// ── Setup ─────────────────────────────────────────────────────────
FrakConfig(merchantId:, bundleId:, metadata:, attribution:, deepLink:,
           env:, i18nOverrides:, preloadSharing:, logLevel:, trackingEnabled:)
// merchantId optional — resolved from bundleId when omitted (01 §3.5)
// deepLink: .automatic (default) | .manual | .disabled   — see §6.1
Frak.initialize(_:)                     // non-blocking, no I/O, never throws

// ── Story 1 & 4 — config, placements, rewards, campaigns ──────────
func resolveConfig(forceRefresh:) async throws -> FrakResolvedConfig
var  configUpdates: AsyncStream<FrakResolvedConfig>        // Kotlin: StateFlow
func campaigns(forceRefresh:) async throws -> [Campaign]
func bestReward(targetInteraction:, audience:) async throws -> BestReward?
     // currency is NOT a parameter — it comes from FrakConfig.metadata (§8.2)
func copy(placement:, component:, default:) async throws -> ResolvedCopy
     // {REWARD} pre-substituted; `default` = tier-3 host-supplied copy (§8.2b)
func referralStatus() async throws -> ReferralStatus

// ── Story 2 — tracking ────────────────────────────────────────────
func trackPurchase(customerId:orderId:token:) async -> Result<Void, FrakError>
func track(_ interaction: Interaction) async -> Result<Void, FrakError>
     // .arrival(referrerWallet:referrerClientId:referrerMerchantId:referralTimestamp:)
     // .sharing(timestamp:purchaseId:)
     // .custom(type:data:idempotencyKey:)
static func parseReferralLink(_ url: URL) -> FrakContext?         // decodes fCtx
@discardableResult
func handleReferralLink(_ url: URL) async -> Bool  // consumed? applies self-referral guard

// ── Story 3 — sharing ─────────────────────────────────────────────
@MainActor
func presentSharing(from: UIViewController, request: SharingRequest) async -> SharingResult
// SharingRequest(products:link:attribution:targetInteraction:placement:logoUrl:)
// SharingResult = .shared(link) | .copied(link) | .installStarted | .dismissed
//                 | .failed(FrakError)      — .installStarted is informational only
func buildSharingLink(request:) async -> URL?      // headless, no network, nullable
// SwiftUI: .frakSharingSheet(isPresented:request:onResult:)
// Compose: rememberFrakSharingLauncher { } · FrakShareButton { }

// ── Story 5 — Frak app ────────────────────────────────────────────
@MainActor func openFrakApp(path:, fallback: .store|.installPage|.none) async -> OpenAppResult
@MainActor func isFrakAppInstalled() -> Bool   // canOpenURL is main-actor isolated
func installURL() async -> URL?
// NOTE: openFrakApp must ATTEMPT the open and fall back on failure rather than
// trusting isFrakAppInstalled — canOpenURL returns false when the merchant forgot
// LSApplicationQueriesSchemes, but open(_:) is not gated by it. Trusting the probe
// turns a manifest omission into a dead feature; attempting turns it into a working one.

// ── Privacy / observability ───────────────────────────────────────
var  anonymousId: String?
func resetAnonymousId()
func setTrackingEnabled(_:)
var  analyticsEvents: AsyncStream<FrakAnalyticsEvent>      // Kotlin: FrakAnalyticsListener
```

Kotlin mirrors this with `suspend` + `Flow` + a **sealed `FrakResult`** — *not*
`kotlin.Result`, which is not error-typed and cannot express `FrakError` exhaustively.

### Error model

One rule, applied consistently:

| Shape | Meaning |
|---|---|
| **throws** | programmer or environment error — `notInitialized`, `network`, `server`, `decoding` |
| **nullable** | "nothing worth showing" — a valid, expected outcome |
| **Result** | fire-and-forget where the caller usually ignores the outcome |

`FrakError` is a sealed type: `.notInitialized`, `.network(underlying:)`,
`.server(status:code:)`, `.decoding`, `.cancelled`, `.alreadyPresenting`,
`.trackingDisabled`, `.merchantResolutionFailed`.

`buildSharingLink` is **nullable, not throwing** — it returns `nil` when there is no
identity to build from. (An earlier draft marked it both; that was a contradiction.)

`configUpdates` must be **multicast**. A single-consumer `AsyncStream` silently starves
the second subscriber, and merchant apps will have more than one.

Data models: `TokenAmount`, `EstimatedReward` (sealed `fixed` | `percentage` | `tiered`),
`RewardTier`, `Campaign`, `FrakResolvedConfig`, `Placement`, `ComponentConfig`,
`InteractionType`, `SharingProduct`, `AttributionParams`, `SharingResult`, `FrakError`.

`FrakFormat` exposes formatting primitives publicly (`amount`, `reward`, `rewardOrNil`,
`applyRewardPlaceholder`, `selectDisplayCampaign`, `selectBestReward`) so merchants can
build their own UI with numbers identical to web.

### Naming map

| JS SDK | Kotlin | Swift |
|---|---|---|
| `setupClient(config)` | `Frak.initialize(context, config)` | `Frak.initialize(_:)` |
| `FrakWalletSdkConfig` | `FrakConfig` | `FrakConfig` |
| `config.domain` | `FrakConfig.packageId` | `FrakConfig.bundleId` |
| `getClientId()` | `client.anonymousId` | `client.anonymousId` |
| `sdkConfigStore.resolve()` | `client.config.resolve()` | `client.config.resolve(forceRefresh:)` |
| — (no equivalent; `StateFlow.value`) | `client.config.updates.value` | `client.config.current` (`AsyncStream` has no synchronous "latest value") |
| `getMerchantInformation()` | `client.rewards.campaigns()` | `client.rewards.campaigns(forceRefresh:)` |
| `MerchantReward` | `Campaign` | `Campaign` |
| `selectBestReward()` | `client.rewards.best(targetInteraction:audience:forceRefresh:products:)` | `client.rewards.best(targetInteraction:audience:forceRefresh:products:)` |
| `formatAmount()` | `FrakFormat.amount()` | `FrakFormat.amount(_:currency:)` |
| `sendInteraction()` | `client.tracking.track(interaction)` | `client.tracking.track(_:)` |
| `trackPurchaseStatus()` | `client.tracking.purchase()` | `client.tracking.purchase(customerId:orderId:token:)` |
| `displaySharingPage()` | `client.presentSharing(activity, request)` | `client.presentSharing(from:request:)` |
| `buildSharingLink()` | `client.sharing.buildLink()` | `client.sharing.buildLink(request)` (unlabeled first param) |
| `FrakContextManager.parse()` | `Frak.parseReferralLink()` | `Frak.parseReferralLink(_:)` |
| `openFrakWalletApp()` | `client.appLink.openFrakApp()` | `client.appLink.openFrakApp(path:fallback:)` |
| `FrakRpcError` | `FrakError` (sealed) | `FrakError` (enum, typed throws) |
| `<frak-button-share>` | `FrakShareButton` (Compose) | `FrakShareButton` (SwiftUI) |

### Threading and network

> Same caveat as §9's banner: `presentSharing`/`copy` are not shipped, and
> `openFrakApp`/`isFrakAppInstalled` take no parameters and are not main-thread-bound
> on either platform.

| Member | Nullable | Thread | Network |
|---|---|---|---|
| `initialize` | non-null | any | **no** |
| `anonymousId` / `resetAnonymousId` | null when disabled | any | no |
| `resolveConfig` | throws | any | yes (cached) |
| `campaigns` | non-null, may be empty | any | yes (30 s cache) |
| `bestReward` | **nullable** — nothing worth showing | any | yes (cached) |
| `copy` | non-null | any | yes (cached) |
| `track*` | `Result` | any | yes (queued) |
| `buildSharingLink` | **nullable** | any | **no** |
| `presentSharing` | non-null | **main** | yes (web view) |
| `openFrakApp` / `isFrakAppInstalled` | non-null | **main** | no |
| `handleReferralLink` | `Bool` (consumed) | any | yes (queued) |
| `FrakFormat.*` | see signatures | any | **no** (pure) |

`getMerchantInformation()` → `campaigns()` and `MerchantReward` → `Campaign` are
**deliberate renames**: implementers diffing against the JS SDK should expect them.

---

## 10. Integration sketch

> Same caveat as §9: namespaced spelling per `09-api-shape.md` (`frak.rewards.best(...)`,
> not `frak.bestReward(...)`), and `copy`/`FrakComponent`/`InteractionType` below are not
> shipped — see the §9 banner.

### Android

```kotlin
// Application.onCreate — non-blocking, no I/O
Frak.initialize(this, FrakConfig(
    merchantId = BuildConfig.FRAK_MERCHANT_ID,
    packageId  = BuildConfig.APPLICATION_ID,
    metadata   = FrakMetadata(name = "Acme", currency = FrakCurrency.EUR),
    attribution = AttributionParams(utmSource = "android-app"),
))

// Product screen
val reward = frak.rewards.best(targetInteraction = InteractionType.Purchase)
val cta    = frak.copy(placement = "product-page",
                       component = FrakComponent.SHARE_BUTTON)["text"]  // {REWARD} substituted

val sharing = rememberFrakSharingLauncher { result ->
    when (result) {
        is SharingResult.Shared, is SharingResult.Copied -> Unit  // tracked automatically
        // InstallStarted is a NOTIFICATION — the SDK already handled it end to end.
        // Do not call openFrakApp() here: on iOS that skips pasteboard seeding and
        // silently loses the identity link.
        is SharingResult.InstallStarted -> Unit
        SharingResult.Dismissed -> Unit
    }
}
Button(onClick = { sharing.launch(SharingRequest(
    products = listOf(SharingProduct(product.name, product.imageUrl, product.url)),
    targetInteraction = InteractionType.Purchase,
    placement = "product-page",
)) }) { Text(cta ?: "Share") }

// Order confirmation
frak.tracking.purchase(order.customerId, order.id, order.checkoutToken)

// Deep links: nothing to wire with DeepLinkHandling.Automatic (the default).
// With .manual, from your router:
//   if (frak.appLink.handleReferral(uri.toString())) return
```

### iOS

```swift
// App init
Frak.initialize(FrakConfig(
    merchantId: Secrets.frakMerchantId,
    bundleId: Bundle.main.bundleIdentifier,
    metadata: .init(name: "Acme", currency: .eur),
    attribution: .init(utmSource: "ios-app")
))

// Product screen
.task {
    reward = try? await Frak.client.rewards.best(targetInteraction: .purchase)
    cta = (try? await Frak.client.copy(placement: "product-page",
                                       component: .shareButton))?["text"]
}
.frakSharingSheet(isPresented: $showSharing, request: .init(
    products: [.init(title: product.name, imageUrl: product.imageUrl, link: product.url)],
    targetInteraction: .purchase,
    placement: "product-page"
)) { result in
    // .installStarted is informational — the SDK owns the install flow
}

// Order confirmation
await Frak.client.tracking.purchase(customerId: order.customerId,
                                    orderId: order.id,
                                    token: order.checkoutToken)

// Deep links: handled automatically by default.
// With .manual: .onOpenURL { url in Task { await Frak.client.appLink.handleReferral(url) } }
```

---

## 11. Phasing

### MVP (v0.1)

- `FrakConfig`; init; anonymous id
- **package-id merchant resolution** — `merchantId` optional, derived from bundle/package id
- HTTP layer, backend URL derivation, dual SWR config cache
- `GET /user/merchant/resolve` + `GET /user/merchant/estimated-rewards`
- reward selection + formatting (server-preferred, local fallback), incl. percentage
  suppression and `formatRewardOrHide` semantics
- `POST /user/track/interaction` + `POST /user/track/purchase` with durable offline queue
  (§7.1) and enqueue-time idempotency keys
- **inbound `fCtx` → `arrival` interaction, with the self-referral guard** and the
  `deepLink` configuration surface (§6.1)
- sharing sheet: native shell + hosted `/sharing?native=1` + native OS share sheet +
  `?confirmed=1` return channel
- post-share confirmation → install flow, **owned entirely by the SDK** (deep link / Play
  referrer / iOS pasteboard + `SKStoreProductViewController`)
- headless `buildSharingLink()` + FrakContext v2 codec with golden fixtures
- iOS `PrivacyInfo.xcprivacy`; Android backup exclusion (both blocks)
- version pinning: `?sdkv=`, `x-frak-sdk-version`, kill switch

Gated on platform changes 1.0, 1.1, 1.2, 1.2b, 1.3, 1.5 and 2.2 — all shipped, see
`01-platform-changes.md` §6.

**The identity gate is discharged.**
[`../identity-proof-of-possession/`](../identity-proof-of-possession/) shipped, taking
with it the `merge`/`track` reward-theft chain, the raw-hex-address bypass, the
`anonymousId` oracles behind `install-code/resolve` and `order-client`, `track/*` rate
limiting, and `WALLET_CONFLICT` handling on `ensure`. What remains there is enforcement
rather than a fix — making the wallet arms mandatory once the store binary is live,
tracked as `ROLLOUT-STEP-3` in that plan's `ROLLOUT.md`. The one security item still
owned by this plan before public release is `01` §3.3's rate limits on
`merchant/resolve` and `estimated-rewards`, which are native-specific.

### v0.2

- native `FrakShareButton` / `FrakPostPurchaseCard` / `FrakBanner` (all self-rendered, no web view)
- `allowed_package_ids` auto-verification (Android via Google's Digital Asset Links API; iOS self-declared + reviewed)
- Android silent identity linking via bound service
- a `frakAction=share`-equivalent primitive: map an inbound URL/push payload straight to
  a presented sharing sheet (web has this via `initFrakSdk.ts:118-158`; native has no
  analogue today)
- first-party telemetry to Frak's analytics backend, if not pulled into v0.1 (§8.4)

### Deferred

| Feature | Why |
|---|---|
| Wallet session / passkey login | needs WebAuthn + ERC-4337 + SSO ported. The anonymous path covers every MVP use case. |
| Embedded wallet, `displayModal` multi-step, SSO, pairing | all depend on a wallet session |
| Fully native sharing UI | pending the §7 performance gate; non-breaking to adopt later |
| iOS App Clip | explicitly excluded; the pasteboard + in-app App Store flow supersedes it for now |

---

## 12. Open questions

1. **ATT — needs a legal decision before iOS ships.** Apple's own FAQ is explicit:
   *"Do I need to use the AppTrackingTransparency framework to get user permission to
   use third-party deep-linking or deferred deep-linking tools? **Yes.** If your
   application uses any third-party services that pass unique identifiers or create a
   shared identity of the user between applications from different companies…"*
   That describes this SDK's architecture almost verbatim. The counter-argument is that
   Apple's definition of tracking is scoped to *advertising or ad measurement*, and
   linking a wallet identity to let the same user earn rewards across merchants is
   neither. This is a genuine gray zone that public documentation does not resolve.
   Getting it wrong means rejection risk under 5.1.1(iv)/2.3.1 for **every merchant**,
   not just us. Not touching IDFA helps but is not dispositive — ATT's definition is
   broader than IDFA access. **Needs legal sign-off, not an engineering judgment call.**
2. **Cross-surface attribution (§8.5)** — needs end-to-end validation of the
   referrer↔referee chain when the sharer is native and the recipient is web.
3. **Merchant app link routing** — should merchant apps register Universal/App Links for
   their own `fCtx` links, so a shared link opens the app rather than a browser? Needs a
   product decision; it is additional work beyond package-id identity. Domain-verified
   links would also let us replace the spoofable custom-scheme return channel.
4. **Store review posture (both stores).** Apple 3.1.1 forbids unlocking app content via
   "cryptocurrencies and cryptocurrency wallets"; the safe pattern is Apple's own NFT
   language — users may *view* holdings, but holdings must not unlock features. Google
   Play's Blockchain-based Content and Financial Services policies can pull a merchant
   into regional licensing and Data Safety obligations. In both cases the compliance
   burden lands on the **merchant's** listing. Concrete SDK rule: never gate merchant app
   functionality on reward balance, and keep any redemption/exchange flow outside the
   native app. Worth an explicit integrator-facing note.
5. **Telemetry decision (§8.4)** — emit first-party events for native in v0.1, or
   consciously accept no funnel visibility?
6. **Team capability** — the existing mobile wallet is Tauri (Rust + WebView), not
   hand-written native. These SDKs would be the org's first production Kotlin/Swift
   codebase; relevant to scoping and velocity.
