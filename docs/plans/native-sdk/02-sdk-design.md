# Native SDK — design and public API

What the SDKs do, what they are allowed to cost, and the shape they expose.
The sharing sheet and the install handoff have their own document
([`03-sharing-and-install.md`](./03-sharing-and-install.md)); building and shipping is
[`05-build-and-release.md`](./05-build-and-release.md).

## 1. Principles, in priority order

1. **Port the capability, not the architecture.** The iframe + `postMessage` RPC exists
   solely for browser origin isolation. A native app is already a trust boundary, so no
   iframe, no RPC transport, no heartbeat handshake, no origin pinning — ~1500 lines of
   accidental complexity that solve a problem native does not have.
2. **Invisible to the host app.** Zero third-party runtime dependencies (§4), a dex/binary
   budget (§2), no crash path out of any public entry point, no IDFA/AAID, no analytics
   vendor. `initialize()` performs no I/O and never throws — it does launch exactly one
   background task, draining whatever the event queue held from a previous session,
   because nothing else ever triggers that drain.
3. **Native where the user can feel it, hosted where they cannot.** OS share sheet, bottom
   sheet, buttons, haptics, store presentation: native. Reward card, FAQ, legal copy:
   hosted from `/sharing`.
4. **One source of truth for money.** A reward amount is computed once and displayed
   identically on iOS, Android and the web. This is what drives the server-side
   pre-formatted projection (`01-platform-changes.md` §3) and the golden corpus
   ([`04-golden-fixtures.md`](./04-golden-fixtures.md)).

## 2. Artifacts

Two per platform, so a merchant taking only tracking never pulls in a web view.

| | Android | iOS |
|---|---|---|
| Core | `id.frak:frak-sdk` | `FrakSDK` |
| UI (sharing sheet) | `id.frak:frak-sdk-ui` | `FrakSDKUI` |
| Minimum | `minSdk 24`, Kotlin 2.2+ | iOS 15, Swift 5.9+ declared (see below) |
| Namespace | `id.frak.sdk` | module `FrakSDK` |
| Distribution | Maven Central (Portal) | SPM — `05` §3 |

Kotlin's floor moved from 1.9 to 2.2 when the toolchain adopted Kotlin 2.4, which removed
`-language-version=1.9` with the K1 compiler. Nothing was published, so no merchant was
affected.

**Budget: 256 KB of dex per platform.** The original figure was 150 KB; it had to be raised
once the surface was complete. Enforced mechanically on Android — `frak.sdk.dexBudgetKb`
in `gradle.properties`, checked by `checkDexSizeBudget` in the convention plugin and wired
into `check` — and enforced by nothing on iOS.

> The declared Swift tools version is 5.9 while the sources use Swift 6-only syntax, and no
> target sets `swiftSettings` — see `06-open-findings.md` §1.

Module layout, symmetric across platforms:

```
FrakSDK
├── Core        FrakConfig · FrakClient · FrakError
├── Net         URLSession / HttpURLConnection. JSON only
├── Identity    P-256 key, anonymous id, proof signing
├── Config      SWR cache · placement/copy resolution
├── Rewards     RewardRepository · selection · formatting
├── Tracking    interaction + purchase, durable JSONL queue
├── Sharing     FrakContext v2 codec · link building
└── AppLink     deep links · install handoff · store URLs
```

## 3. Anonymous identity

Derived from a device-held P-256 keypair, per app installation, lowercase canonical form:

```
keypair  = P-256 (AndroidKeyStore / Secure Enclave)
clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 bits set
```

This is what closes the merge vulnerability that
[`../identity-proof-of-possession/`](../identity-proof-of-possession/) was written for.
Native has **no legacy ids**, so it is cryptographic-only — no trust-on-first-use path.

Sensitive calls carry an opaque `proof` (`v ‖ pk ‖ ts ‖ sig`, base64url). The validity
window is per op: ±2 min for `merge`, 90 days for `ensure`, 30 days for `install` — an
install proof is minted on the sharer's device and consumed days later on another one.
Never signed on `track/*`; signing stays off the hot path. The signed byte layout is frozen
in `sdk/core/src/identity/canonical.ts` and pinned by fixtures.

**Ship signing even while the backend arm is permissive.** A released binary cannot be
retrofitted; enforcement then becomes a backend flip with no version skew. Generate key and
id **atomically** — a surviving key with a lost id silently fails derivation.

| | Storage | Uninstall |
|---|---|---|
| Android | `SharedPreferences`, SDK-owned file, excluded from backup | wiped |
| iOS | `UserDefaults`; key in the Secure Enclave | wiped |

**Keychain is rejected on iOS**: Keychain items survive uninstall/reinstall, resurrecting a
"fresh" user's id — a persistent cross-install identifier, inconsistent with both Android
and the web. Same reasoning as Firebase's app-instance id.

**Android backup exclusion needs both blocks and may not apply at all.**
`data_extraction_rules.xml` must exclude the prefs file under `<cloud-backup>` *and*
`<device-transfer>`; excluding only the former lets the standard new-phone transfer clone
the id — exactly the resurrection the iOS decision rejects. Worse,
`android:dataExtractionRules` is a **singular** attribute, so the manifest merger does not
union it: a host app with its own rules file makes the merge **fail outright** (a build
error, not a silent drop) unless the merchant adds `tools:replace` themselves — a library
cannot apply `tools:replace` to its own consumer's manifest. It must be documented as an
integration step (see `sdk/android/README.md`'s "Backup and device-transfer exclusion"), and
a debug-build assertion should warn when the SDK's prefs files are not excluded. *Today
neither the SDK's rules file nor its API 24-30 counterpart is referenced by anything —
`06-open-findings.md` S3.*

> Swift's `UUID.uuidString` is **uppercase**; normalise once at the boundary. The codec
> itself is safe — it accepts either case and emits lowercase — so the break lands
> upstream, in cache keys, `merchantId` equality and the self-referral guard. The identity
> layout removed the hazard entirely by signing UUIDs as raw 16 bytes.

Scope is one id per app installation — a native app maps to exactly one merchant, so
app-scope equals merchant-scope. Store the `merchantId` alongside the id and regenerate
defensively if it ever changes.

**Linking to the wallet** needs no backend change: the SDK opens
`frakwallet://install?m=&a=`, `apps/wallet` routes it to `/install`, which queues an
`ensure` under the wallet's own session. The SDK cannot call `ensure` itself — it has no
session. Never trigger this opportunistically on init: it is an app switch, and yanking a
user out of the merchant's app just to link an id is bad. Do it only where an app switch is
already expected — the install CTA.

When the wallet already holds a competing anonymous id the mechanism is `merge` instead,
and it is specified but **not shippable until `ROLLOUT-STEP-3`**: the SDK calls
`POST /user/identity/merge/initiate` — the route takes no session
(`withOptionalWalletOrSdkAuthent`) and needs only `{sourceAnonymousId, merchantId}` plus a
proof, which a native id must send because it latches on first use and a latched id without
a proof is `403 PROOF_REQUIRED` — then passes `?fmt=<mergeToken>` for the wallet to
`merge/execute`. That second arm is still fail-open, so shipping the flow before enforcement
lands would ship the attack surface with it.

`https://wallet.frak.id/install?…` would do the app-detection work for free, and the
infrastructure is already deployed: `services/backend/src/api/common/wellKnown.ts` serves
both an `apple-app-site-association` with `paths: ["/*"]` and an `assetlinks.json`, and the
Tauri config registers `https://wallet.frak.id/.*` alongside the `frakwallet` scheme (dev
and prod are separated by host and scheme, not by the multiple signing fingerprints in
`assetlinks.json`, which are Play's and the upload key's for one app). The OS opens the app when it is installed and a
browser otherwise — no probe, no `LSApplicationQueriesSchemes`, no `<queries>`. The SDK
still uses the custom scheme; moving to the universal link is open work, not a blocked one.

*(v0.2, Android only)* Silent linking with no app switch: the wallet exports a
signature-guarded bound `Service`, the SDK binds and passes `{merchantId, anonymousId}`.
iOS has no equivalent app-to-app IPC — accept the asymmetry.

## 4. Dependencies

**Hard rule: zero third-party runtime dependencies.** Accepted: `kotlinx-coroutines-core`
and Compose on Android. Rejected: Retrofit, Moshi, Gson, Alamofire, Room, RxJava, any DI or
analytics framework. The queue is an append-only JSONL file with compaction on flush — one
FIFO table does not justify Room/CoreData.

| Need | Android | iOS |
|---|---|---|
| HTTP / JSON | `HttpURLConnection` / `org.json` | `URLSession` / `Codable` |
| Base64url / UUID / currency | platform | platform |
| Storage / web view | `SharedPreferences` / `WebView` | `UserDefaults` / `WebKit` |

Two manifest entries the SDK cannot supply for the merchant: `<queries>` with
`<package android:name="id.frak.wallet"/>` **and** its `.dev` sibling ship via the Android
manifest merger, but iOS
has no merger, so `LSApplicationQueriesSchemes` must be documented as an integration step.
**Never `QUERY_ALL_PACKAGES`**: Play policy restricts it to apps whose core purpose
requires broad visibility, and requesting it drags every integrator into a Permissions
Declaration review. This is the first thing someone reaches for when a probe returns false;
the answer is to attempt the open and fall back, not to widen visibility.

**`PrivacyInfo.xcprivacy` is a hard shipping gate**, on both iOS targets. Since 1 May 2024
an SDK using a required-reason API must declare it or the upload is rejected with
**ITMS-91053** — and that rejection lands on the *merchant's* upload. `UserDefaults` is one
of the five categories. Data collection is declared too (`DeviceID`, `UserID`,
`ProductInteraction`, `PurchaseHistory`). Frak is absent from Apple's commonly-used-SDK
list, so signing is not mandatory — but the list explicitly extends to SDKs that repackage
listed ones, which is another reason the zero-dependency rule earns its keep.

## 5. Config, rewards, tracking

### 5.1 Config resolution is 4-tier

Copy precedence, split across `ButtonShare.tsx:72-73` and `85-88`:

```
1. placement-specific backend component config
2. merchant-global backend component config      ← the tier that is easy to miss
3. host-supplied default
4. built-in i18n default
```

Omitting tier 2 means a merchant's global default is silently ignored on native. Three web
behaviours that native must decide about *deliberately* rather than by accident: the web
config cache never expires (`cacheTime: POSITIVE_INFINITY`), `withCache` is a blocking
cache-or-fetch and **not** stale-while-revalidate, and it negative-caches failures for 1 s.
A literal port means config never refreshes for the life of a long-lived app — defensible
on web, wrong here. Native chose SWR; the revalidation half is currently unobservable
(`06` C3).

### 5.2 Reward selection and formatting

Server-preferred (`?formatted=1`), local formatter as the offline fallback, both pinned to
the same fixtures. Three behaviours that are easy to get wrong:

- **Percentage rewards are suppressed from `{REWARD}` substitution** (`useReward.ts:41-44`)
  — they carry no concrete amount to advertise. A naive substitution advertises something
  the web deliberately hides.
- **Currency comes from the static SDK config**, not the backend response and not the
  device locale, and it drives the formatting locale. A caller-supplied `currency:`
  parameter would invite exactly the drift principle 4 exists to prevent.
- `formatRewardOrHide` and `rewards/conditions.ts` are a dedicated hide-vs-null-vs-fallback
  module and need an explicit native mapping.

**`rewards.best` answers "the best reward in *this* context" — a product page, a cart, an
order's line items — not "the best reward per item".** A listing screen calls it **once**
for the whole visible set. Both example-app integrators independently called it once per
row, because a single `BestReward?` cannot be attributed back to a row; the cache is keyed
on the encoded product list, so N rows became N cache keys and N requests against a
`limitedParallelism(4)` budget. The two integrators worked one platform each without seeing
the other's code, which is what makes a sample of two evidence: an independent same-wall
hit is an API problem, not a user problem. So: it is now documented as an anti-pattern on both platforms, and
the listing use case wants a per-product sibling that does not exist yet (`05` §5 Q7).

`targetInteraction` is **not cosmetic**: it narrows campaign selection, rides the wire, and
is part of the reward cache key. Two surfaces passing different values are asking the backend
different questions — which is exactly how the two example harnesses drifted while both
claimed parity. The same drift left the Android harness with no `metadata` and no `logLevel`,
i.e. **no SDK logging at all**, which reads exactly like a dead SDK.

The design also called for a public `FrakFormat` exposing the formatting primitives
(`amount`, `reward`, `rewardOrNil`, `applyRewardPlaceholder`, `selectBestReward`, …) so a
merchant building their own UI gets numbers identical to the web. **Not implemented.**

### 5.3 The event queue

Append-only JSONL, compaction on flush. The rules, because this is where the format is
weakest:

| Concern | Rule |
|---|---|
| Idempotency | stamp `idempotencyKey` at **enqueue**, never per attempt |
| Timestamps | capture-time, not flush-time — otherwise offline events land in the wrong attribution window |
| Ordering | strict FIFO |
| Single writer | one process. Document main-process-only init and assert it in debug builds; a `:remote` process corrupts both the file and `SharedPreferences` |
| Compaction | write-temp + `rename`, never in place |
| Torn tail | tolerate and discard a truncated last line |
| Bounds | cap by count **and** age, drop oldest — *currently enforced on read only, `06` 2.6* |
| Poison messages | evict after N permanent 4xx, or one rejected event blocks the FIFO forever |
| Backoff | exponential **with jitter**, honouring `Retry-After`. Without jitter a regional blip synchronises a merchant-wide flush stampede into the new rate limits |
| Erasure | `resetAnonymousId()` purges the queue on iOS unconditionally; on Android only once the keystore delete is confirmed — a throwing delete leaves the old identity in place, and purging anyway would discard events about to be re-sent under an id that never rotated (`06` 4fp). Never emit under a dead id either way |

### 5.4 Never derive merchant identity client-side

Resolve merchants by server-issued `merchantId`, or by `packageId` via the resolve arm
(`01` §3). Native never computes `productId`; `computeLegacyProductId` was removed from
the JS SDK for this reason.

### 5.5 Inbound links and the self-referral guard

Web does this on every page load via `setupReferral`. Native has no ambient navigation, so
it is configured explicitly through `FrakConfig.deepLink`:

- **Automatic** (default, Android only): `ActivityLifecycleCallbacks` reading `Intent.data`
  on create *and* on new intent — the warm-start miss is the most common integration bug.
- **Manual**: `handleReferral(url)` returns whether the URL was consumed, so it composes
  with an existing router. **This is the only mode on iOS**: a library cannot observe a
  host's `Scene`/`AppDelegate` without swizzling.
- **Disabled**.

Debug builds should log loudly when an `fCtx` URL is observed and no handler is configured
— the failure is otherwise silent: arrivals are never tracked and nobody sees an error.

**The self-referral guard is mandatory** (`processReferral.ts:104-129`): skip arrival
tracking when the incoming `fCtx` identity matches this device's. Without it a user who
reopens their own link is tracked as their own referee, corrupting the referral graph.

Do **not** port the web fallback heuristics (`deepLinkWithFallback.ts`'s 2.5 s visibility
timeout, the Chromium `intent://` rewrite). Those are browser workarounds; native has
synchronous OS APIs.

**There is no ambient URL to rewrite.** After an arrival, web rewrites the page URL's `fCtx`
to the current user (`FrakContextManager.replaceUrl`) so an onward share attributes
correctly. Native has no such ambient state, so `buildLink` always builds from the explicit
request — which means merchants building "share this screen" flows must be told to pass
live context, or the onward share attributes to the original sharer.

## 6. Public API

`FrakClient` is a **sealed concrete class** — `public class FrakClient internal
constructor` on Kotlin, `public final class FrakClient: Sendable` on Swift — with five
domain namespaces. It was an interface until the surface grew enough to prove that wrong.

```
root       environment · anonymousId · resetAnonymousId
.config    resolve · updates · current (iOS)
.rewards   campaigns · best
.sharing   buildLink
.tracking  track · purchase
.appLink   handleReferral · isFrakAppInstalled · openFrakApp · installUrl · installPageUrl
           (Swift spells the last two `installURL` / `installPageURL`)
```

```kotlin
Frak.client.rewards.best(targetInteraction = "purchase", products = items)
Frak.client.tracking.purchase(customerId, orderId, token)
Frak.client.config.updates                 // StateFlow
```
```swift
try await Frak.client.rewards.best(targetInteraction: "purchase", products: items)
await Frak.client.appLink.handleReferral(url)
```

`config.current` is iOS-only on purpose: `AsyncStream` has no synchronous "latest value",
where Kotlin callers just read `updates.value`. Two renames are deliberate and will show up
in any diff against the JS SDK: `getMerchantInformation()` → `rewards.campaigns()` and
`MerchantReward` → `Campaign`.

On Swift, `FrakClient` is a nonisolated root holding an internal `DefaultFrakClient` actor,
with each namespace a nonisolated struct forwarding into it — so there is no extra
suspension hop, and `Frak.client` stays throwing-**synchronous**. That is also why
`Frak.swift` uses a hand-rolled `NSLock` instead of being an actor. Do not "modernise" it.
The cost is that `try await Frak.client.rewards.best(…)` is not one expression, so a Swift
call site wants a three-line `client() -> FrakClient?` helper. Adding a non-throwing public
twin was rejected: two permanent public spellings of the same thing to save two lines, and
it would break symmetry with Kotlin. The helper is documented as the idiom in
`sdk/ios/README.md` instead.

**The namespace split was validated by rewiring both example apps onto the real SDK.**
`Frak.client.rewards.best(…)`, `.appLink.handleReferral(url)` and `.tracking.purchase(…)`
were unambiguous at every call site and nobody had to be told which namespace anything
lived in. What that exercise found instead is that the members *inside* the namespaces have
inconsistent contracts — §6.2 and `05` §5 Q5–Q7.

Two more shapes it examined and deliberately left alone. **`SharingProduct` and
`ProductDetails` stay separate** even though building the same logical product twice is
friction: `ProductDetails` mirrors the backend's `PRODUCT_SCOPE_FIELDS` allowlist, so adding
`title`/`link` would put fields on the wire that can never match, and merging the other way
would force a checkout screen that has only line items to invent display copy. A
`toProductDetails()` conversion helper closes the gap additively. And the iOS
`.macOS(.v12)` floor stays: it looked like a test-only artifact leaking into the published
contract, but `HTTPClient` calls `URLSession.data(for:delegate:)` from shipping code. The
number was right and only the comment explaining it was wrong.

### 6.1 Why not an interface

- Adding an abstract member is an **unconditional compile-time break for every
  implementer** — strictly worse than the `$default` constructor freeze (`05` §5 Q1). On
  the JVM it is not only a source break: a Kotlin interface member with a default body
  compiles to a default method plus `DefaultImpls`, and separately-compiled consumers can
  hit `AbstractMethodError`. Swift does not feel it yet only because the SDK ships as
  source; protocol witness tables are laid out when the *conformance* compiles, so the
  binary XCFramework plan (`05` §3) makes it real.
- The mitigation does not scale. `installPageUrl` shipped with a default body so it would
  not break fakes; applied as policy across the ~6–9 members a wallet session will add, it
  means every new capability ships as a plausible-looking no-op inside a merchant's
  substitute — worse than a compile error.
- **The justification was never delivered.** The KDoc promised fake substitution, but there
  was no way to *give* the fake to `Frak`. The replacement is
  `FrakEnvironment.Custom(wallet:backend:)` pointed at a stub server — the RevenueCat "Test
  Store" shape, and a stronger guarantee than a fake that can silently disagree with our
  wire format.
- The surface is not staying at 15 members. The deferred wallet-session cluster lands as a
  new `.wallet` namespace touching nothing that exists.

The SDK's own UI module was the one real consumer of the interface. It now receives
**injected functions** (`buildSharingLink`, `resolveConfig`, `bestReward`, `track`,
`installPageUrl`, `openFrakApp`, `anonymousId`, `environment`) instead of a client
abstraction, which deleted both hand-written `FakeFrakClient`s (~230 test LoC) and kept
every test. A narrow `SharingCapable` protocol was rejected: in Kotlin it must be `public`
to cross a module boundary, so it would be frozen by BCV and visible in merchant
autocomplete — relocating the hazard, not removing it.

The honest argument for the namespace split is **timing**: at 15 flat members it is
marginal, but it is free before the Maven publish and a major-version migration after
(OneSignal shipped exactly this as a breaking v5).

### 6.2 Error model

The intended rule — **telemetry returns a result, data-fetch throws, local best-effort
builders return null** — is not actually stated anywhere in the code, and the surface has
drifted into four styles across fifteen members:

| Shape | Members | Intent |
|---|---|---|
| `FrakResult` | `tracking.track`, `tracking.purchase` | telemetry must never take down a checkout path |
| throws | `config.resolve`, `rewards.campaigns`, `rewards.best` | data fetch; the caller must handle failure |
| nullable, error swallowed | `sharing.buildLink`, `appLink.installUrl`, `appLink.installPageUrl` | "nothing worth showing" — but also hides real failures |
| `Bool`/enum, error swallowed | `appLink.handleReferral`, `appLink.openFrakApp` | best-effort, structurally cannot throw |

`config.resolve` throwing while `sharing.buildLink` returns a silent `null` is an accident
of authorship, not a design. **Writing the rule down is owed before the wallet-session
cluster lands** (`05-build-and-release.md` §5 Q5); unifying all fifteen onto `FrakResult` is
explicitly *not* recommended — bigger break, smaller gain.

Two corrections the example rewiring forced, both shipped:

- **Kotlin's throwing tier was invisible.** Kotlin has no checked exceptions, so a throwing
  member looked identical to a safe one in autocomplete and a merchant who forgot
  `try/catch` had written a latent production crash. `config.resolve`, `rewards.campaigns`
  and `rewards.best` now carry `@Throws(FrakError::class)` — additive, zero runtime cost,
  and it fixes Java interop as a side effect. Deliberately *not* applied where failure is
  already encoded in the return type.
- **`handleReferral` could throw on Kotlin and structurally could not on Swift.** It was
  wrapped in `frakCall`, whose catch-all converts any unexpected `Throwable` into a thrown
  `FrakError`. Swift is right — the `Bool` means "was this a referral link", and arrival
  telemetry must not take down a merchant's URL routing — so Kotlin now mirrors it
  (rethrow `CancellationException`, log and swallow the rest). Worth recording that the
  first framing of the bug was wrong: "network down → Kotlin throws" does not reproduce,
  because `trackingCall` absorbs `FrakError` before `frakCall` sees it. The defect was
  structural — a landmine for any future unguarded exception, which Swift cannot have.

`config.updates` must be multicast — merchant apps will have more than one subscriber.

Known gaps in the taxonomy — no `Internal` arm, no equality, backoff refusal disguised as a
network error — are `06-open-findings.md` §1.

### 6.3 Threading

| Member | Nullable | Thread | Network |
|---|---|---|---|
| `initialize` | non-null | any | no |
| `anonymousId` / `resetAnonymousId` | null when disabled | any | no |
| `config.resolve` | throws | any | yes (cached) |
| `rewards.campaigns` | non-null, may be empty | any | yes (30 s cache) |
| `rewards.best` | **nullable** | any | yes (cached) |
| `tracking.*` | `FrakResult` | any | yes (queued) |
| `sharing.buildLink` | **nullable** | any | **no** |
| `appLink.handleReferral` | `Bool` (consumed) | any | yes (queued) |

Two real platform divergences, not doc slips: `isFrakAppInstalled()` is `async` on Swift and
synchronous on Kotlin, and neither is `@MainActor`.

`sdk/android/README.md` and `sdk/ios/README.md` are the shipped contract; this section is
the design intent behind it.

## 7. Phasing

**Shipped (both platforms):** identity + proof signing, FrakContext v2 codec and local link
building, interaction and purchase tracking over the durable queue, inbound `fCtx` with the
self-referral guard, the sharing sheet, the install handoff.

**Before a merchant sees it (MVP):** everything in `06-open-findings.md` §1, the wallet-arm
enforcement flip (`ROLLOUT-STEP-3`), CI and a publish path (`05` §6).

**v0.2:** native `FrakShareButton` / `FrakBanner` / `FrakPostPurchaseCard` with no web view;
`allowed_package_ids` auto-verification (Digital Asset Links on Android, self-declared plus
review on iOS); Android silent identity linking through a signature-guarded bound service
(iOS has no equivalent IPC — accept the asymmetry); a `frakAction=share` equivalent mapping
an inbound URL or push payload straight to a presented sheet.

**Deferred:** wallet session, passkey login, embedded wallet, `displayModal`, SSO, pairing
— all depend on a wallet session, and the anonymous path covers every MVP use case. Fully
native sharing UI, pending the performance gate (`03` §3). iOS App Clip, superseded by the
install-code flow.

## 8. Open questions

1. **ATT — needs a legal decision before iOS ships.** Apple's FAQ says third-party
   deep-linking tools that "create a shared identity of the user between applications from
   different companies" require the prompt; the counter-argument is that Apple's definition
   of tracking is scoped to advertising and ad measurement, which reward linking is not.
   Not touching IDFA helps but is not dispositive. Getting it wrong is rejection risk under
   5.1.1(iv) for **every merchant**. Legal sign-off, not an engineering call.
2. **Cross-surface attribution.** A user in the merchant's app and the same user on the
   merchant's website are two unrelated identities server-side. Share-from-native →
   open-in-browser is the *common* case and the referrer↔referee resolution across that gap
   has never been validated end to end.
3. **No telemetry on native funnels.** The web SDK emits ~10 first-party OpenPanel events
   (`sdk_initialized`, `share_button_clicked`, `app_not_installed`, …) with no native
   equivalent — the host-facing `analyticsEvents` stream the original design proposed was
   never implemented, and would have sent Frak nothing anyway. As specified we ship blind
   to init failures and funnel drop-off, including the performance gate, which needs field
   data. (The hosted `/sharing` presentation does still fire `sharing_page_viewed`
   wallet-side, and it already carries a `native` property, so those sessions are at least
   segmentable.)
4. **Merchant app-link routing.** Without Universal/App Links registered for merchant apps,
   an `fCtx` link on a device that has the merchant's app still opens a browser. Package-id
   identity does not fix this. Domain-verified links would also let us replace the
   spoofable custom-scheme return channel.
5. **Store review posture.** Apple 3.1.1 forbids unlocking content with cryptocurrency
   wallets; Google Play's blockchain policies can pull a merchant into regional licensing
   and Data Safety obligations. The burden lands on the **merchant's** listing. SDK rule:
   never gate merchant functionality on a reward balance, keep redemption outside the
   native app, and say so to integrators.
