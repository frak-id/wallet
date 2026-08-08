# Native SDK — design and public API

What the SDKs do, what they are allowed to cost, and the shape they expose. The sharing
sheet and the install handoff have their own document
([`03-sharing-and-install.md`](./03-sharing-and-install.md)); building and shipping is
[`05-build-and-release.md`](./05-build-and-release.md).

Design rules: port the capability, not the architecture (no iframe, no `postMessage` RPC
— a native app is already a trust boundary); zero third-party runtime dependencies;
native where the user can feel it (share sheet, buttons, haptics, store presentation),
hosted from `/sharing` where they cannot (reward card, FAQ, legal copy); one reward
amount computed once and displayed identically on iOS, Android and the web.

## 1. Artifacts

Two per platform, so a merchant taking only tracking never pulls in a web view.

| | Android | iOS |
|---|---|---|
| Core | `id.frak.sdk:core` | `FrakSDK` |
| UI (sharing sheet) | `id.frak.sdk:ui` | `FrakSDKUI` |
| Minimum | `minSdk 24`, Kotlin 2.2+ | iOS 15, Swift 5.9+ declared |
| Namespace | `id.frak.sdk` | module `FrakSDK` |
| Distribution | Maven Central (Portal) | SPM — `05` §3 |

Budget: 256 KB of dex per platform, enforced on Android (`frak.sdk.dexBudgetKb` /
`checkDexSizeBudget`, wired into `check`), by nothing on iOS. Declared Swift tools
version is 5.9 while sources use Swift 6-only syntax and no target sets
`swiftSettings` — `06-open-findings.md` §1.

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

## 2. Anonymous identity

Derived from a device-held P-256 keypair, per app installation, lowercase canonical form:

```
keypair  = P-256 (AndroidKeyStore / Secure Enclave)
clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 bits set
```

Native has no legacy ids — cryptographic-only, no trust-on-first-use path. Sensitive
calls carry an opaque `proof` (`v ‖ pk ‖ ts ‖ sig`, base64url), validity window per op:
±2 min for `merge`, 30 days for `install` (minted on the sharer's device, consumed days
later on another). The native surface mints exactly those two: `ensure` needs a wallet
session token no native client holds, and there is no native SSO surface, so neither
`frak-ensure-v1` nor `frak-sso-v1` has a case in the native `ProofOp`. Never signed on
`track/*` — a future optional `frak-track-v1` is sketched on the `ProofOp` union in
`sdk/core/src/identity/types.ts`. Layout frozen in
`sdk/core/src/identity/canonical.ts`, pinned by fixtures. Ship signing even while the
backend arm is permissive — a released binary cannot be retrofitted. Generate key and id
atomically: a surviving key with a lost id silently fails derivation.

| | Storage | Uninstall |
|---|---|---|
| Android | `SharedPreferences`, SDK-owned file, excluded from backup | wiped |
| iOS | `UserDefaults`; key in the Secure Enclave | wiped |

Keychain is rejected on iOS: it survives uninstall/reinstall, resurrecting a "fresh"
user's id, inconsistent with Android and the web. Android backup exclusion needs both
`<cloud-backup>` and `<device-transfer>` blocks in `data_extraction_rules.xml`, or a
standard phone transfer clones the id; the attribute is singular, so a host with its own
rules file fails the manifest merge unless it adds `tools:replace` itself. Documented as
an integration step; today neither rules file is referenced by anything
(`06-open-findings.md` S3). Swift's `UUID.uuidString` is uppercase; normalise once at
the boundary or the break lands upstream, in cache keys, `merchantId` equality and the
self-referral guard.

Scope is one id per app installation — store `merchantId` alongside it and regenerate
defensively if it ever changes. **Linking to the wallet** needs no backend change: the
SDK opens `frakwallet://install?m=&a=`, which the wallet routes to `/install` and queues
an `ensure` under its own session (the SDK has no session of its own). Trigger this only
where an app switch is already expected (the install CTA), never opportunistically on
init.

**Inbound merge (`?fmt=`), shipped.** A link opened from the wallet explorer deep-links into
the merchant's app carrying `?fmt=<mergeToken>` next to its `fCtx`. The native SDK is the
merge *target*: `handleReferral` reads the token, signs `frak-merge-v1` binding
`SHA-256(mergeToken)` and posts `/user/identity/merge/execute` with its own id as
`targetAnonymousId`. Same shape as the web SDK's `?fmt=` handling, except the web SDK routes
the token through the listener and native posts it directly. See `identity/IdentityMerge`.

The token is consumed once per process, the proof is **mandatory** (unlike the web arm, which
must keep working for keyless legacy ids), and a link carrying only `?fmt=` still merges but
answers `false` from `handleReferral` — that value has always meant "was there referral context".
It did not need to wait for `ROLLOUT-STEP-3`: native always signs, and the latch only ever gated
ids that could not.

The **outbound** arm — `POST /user/identity/merge/initiate`, minting a token for another
context to consume — has no native caller and no identified need. Nothing in the native
surface hands identity out to a foreign browser context: the sharing sheet's web view is
passed `clientId` explicitly and `useSharingIdentity` honours only that param under `embed`,
and the Play-referrer install path adopts the native id outright rather than merging.

Moving from the `frakwallet://` scheme to a universal link (`https://wallet.frak.id/install?…`,
app-detection for free) is open work, not blocked. *(v0.2, Android only)*: silent linking
with no app switch via a signature-guarded bound `Service`; iOS has no equivalent.

## 3. Dependencies

Hard rule: zero third-party runtime dependencies. Accepted: `kotlinx-coroutines-core`
and Compose on Android. Rejected: Retrofit, Moshi, Gson, Alamofire, Room, RxJava, any DI
or analytics framework — the queue is an append-only JSONL file, one FIFO table does not
justify Room/CoreData.

| Need | Android | iOS |
|---|---|---|
| HTTP / JSON | `HttpURLConnection` / `org.json` | `URLSession` / `Codable` |
| Base64url / UUID / currency | platform | platform |
| Storage / web view | `SharedPreferences` / `WebView` | `UserDefaults` / `WebKit` |

`<queries>` with `id.frak.wallet` and its `.dev` sibling ship via the Android manifest
merger; iOS has no merger, so `LSApplicationQueriesSchemes` must be a documented
integration step. Never `QUERY_ALL_PACKAGES` — attempt the open and fall back instead of
widening visibility. `PrivacyInfo.xcprivacy` is a hard shipping gate on both iOS
targets: a required-reason API (`UserDefaults` is one of the five categories)
undeclared gets the upload rejected with ITMS-91053, on the merchant's upload. Data
collection (`DeviceID`, `UserID`, `ProductInteraction`, `PurchaseHistory`) is declared
too.

## 4. Config, rewards, tracking

Config resolution is 4-tier — placement config, merchant-global config (the tier that's
easy to miss), host-supplied default, built-in i18n default. Native chose SWR over a
literal port of the web's cache (never expires, negative-caches failures for 1 s); the
revalidation half is currently unobservable (`06` C3).

Reward selection is server-preferred (`?formatted=1`), local formatter as offline
fallback, both pinned to the same fixtures. Percentage rewards are suppressed from
`{REWARD}` substitution (no concrete amount to advertise); currency comes from the
static SDK config, not the backend response or device locale, and drives the formatting
locale; `formatRewardOrHide` / `rewards/conditions.ts` need an explicit native
hide-vs-null-vs-fallback mapping. A public `FrakFormat` exposing formatting primitives,
so a merchant's own UI matches the web exactly, was designed but is **not implemented**.

`rewards.best` answers "the best reward in *this* context," not "per item" — a listing
screen calls it once for the whole visible set, not once per row (N rows would become N
cache keys against a `limitedParallelism(4)` budget). Documented as an anti-pattern on
both platforms; a per-product sibling doesn't exist yet (`05` §5 Q7). `targetInteraction`
is not cosmetic: it narrows campaign selection and is part of the reward cache key.

The event queue is append-only JSONL, compaction on flush:

| Concern | Rule |
|---|---|
| Idempotency | stamp `idempotencyKey` at enqueue, never per attempt |
| Timestamps | capture-time, not flush-time |
| Ordering | strict FIFO |
| Single writer | one process; assert in debug builds — a `:remote` process corrupts the file and `SharedPreferences` |
| Compaction | write-temp + `rename`, never in place |
| Torn tail | tolerate and discard a truncated last line |
| Bounds | cap by count and age, drop oldest — enforced on read only today, `06` 2.6 |
| Poison messages | evict after N permanent 4xx |
| Backoff | exponential with jitter, honouring `Retry-After` |
| Erasure | `resetAnonymousId()` purges unconditionally on iOS, only after keystore-delete confirmation on Android (`06` 4fp). Never emit under a dead id |

Never derive merchant identity client-side: resolve by server-issued `merchantId`, or by
`packageId` via the resolve arm (`01` §3). Native never computes `productId`. Inbound
links are configured explicitly through `FrakConfig.deepLink` — native has no ambient
equivalent to the web's `setupReferral`:

- **Automatic** (default, Android only): `ActivityLifecycleCallbacks` reading
  `Intent.data` on create *and* on new intent — the warm-start miss is the most common
  integration bug.
- **Manual**: `handleReferral(url)` returns whether the URL was consumed. The only mode
  on iOS — a library cannot observe a host's `Scene`/`AppDelegate` without swizzling.
- **Disabled**.

The self-referral guard is mandatory: skip arrival tracking when the incoming `fCtx`
identity matches this device's, or a user who reopens their own link is tracked as their
own referee. Do not port the web's fallback heuristics (visibility timeout, `intent://`
rewrite) — native has synchronous OS APIs. There is no ambient URL to rewrite after an
arrival, so `buildLink` always builds from the explicit request; merchants building
"share this screen" flows must pass live context or an onward share attributes to the
original sharer.

## 5. Public API

`FrakClient` is a sealed concrete class — `public class FrakClient internal
constructor` on Kotlin, `public final class FrakClient: Sendable` on Swift — with five
domain namespaces:

```
root       environment · anonymousId · resetAnonymousId
           setTrackingEnabled · isTrackingEnabled
           — no shutdown here: that's Frak.shutdown() on the facade, so it doesn't kill
             a client Frak.client keeps handing out
.config    resolve · updates · current (iOS)
.rewards   campaigns · best
.sharing   buildLink
.tracking  track · purchase
.appLink   handleReferral · isFrakAppInstalled · openFrakApp · installUrl · installPageUrl
           (Swift spells the last two `installURL` / `installPageURL`)
```

```kotlin
Frak.client.rewards.best(RewardRequest { targetInteraction = "purchase"; products = items })
Frak.client.tracking.purchase(customerId, orderId, token)
```
```swift
try await Frak.client.rewards.best(targetInteraction: "purchase", products: items)
await Frak.client.appLink.handleReferral(url)
```

`config.current` is iOS-only (`AsyncStream` has no synchronous "latest value"; Kotlin
reads `updates.value`), and `config.updates` must be multicast. Two deliberate renames
vs. the JS SDK: `getMerchantInformation()` → `rewards.campaigns()`, `MerchantReward` →
`Campaign`.

Not an interface: an abstract member addition is an unconditional compile-time break for
every implementer (`AbstractMethodError` at runtime on the JVM). Fakes go through
`FrakEnvironment.Custom(wallet:backend:)` against a stub server instead — the SDK's own
UI module takes injected functions rather than a client abstraction. On Swift,
`FrakClient` is a nonisolated root over an internal `DefaultFrakClient` actor, so
`Frak.client` stays throwing-synchronous with no extra suspension hop — `Frak.swift`'s
hand-rolled `NSLock` is deliberate, do not "modernise" it to an actor. A Swift call site
wants a `client() -> FrakClient?` helper since `try await Frak.client.rewards.best(…)`
is not one expression (idiom in `sdk/ios/README.md`).

`SharingProduct` and `ProductDetails` stay separate — `ProductDetails` mirrors the
backend's `PRODUCT_SCOPE_FIELDS` allowlist, so merging would put unmatched fields on the
wire; `toProductDetails()` closes the gap additively. iOS `.macOS(.v12)` is a real floor,
not a leftover: `HTTPClient` calls `URLSession.data(for:delegate:)` from shipping code.

### 5.1 Error model

Four styles across fifteen members, undocumented as a rule:

| Shape | Members | Intent |
|---|---|---|
| `FrakResult` | `tracking.track`, `tracking.purchase` | telemetry must never take down a checkout path |
| throws | `config.resolve`, `rewards.campaigns`, `rewards.best` | data fetch; caller must handle failure |
| nullable, error swallowed | `sharing.buildLink`, `appLink.installUrl`, `appLink.installPageUrl` | "nothing worth showing" — but also hides real failures |
| `Bool`/enum, error swallowed | `appLink.handleReferral`, `appLink.openFrakApp` | best-effort, structurally cannot throw |

Android added a **fifth** shape in `09-android-api-surface.md` step 4, and deliberately: each of these
members now has a Java `*Async` twin whose failure arrives as a future completed exceptionally, wrapped
in a `CompletionException`. The twins mirror their suspending member rather than re-wrapping everything in
`FrakResult` — `resolveAsync` fails with the `FrakError` `resolve` throws, `trackAsync` returns the
`FrakResult` `track` returns — so this is one shape per member per language, not a new axis of choice.
iOS needs no equivalent: `async`/`await` is Swift's idiom and Swift can call a `suspend`-shaped API.

Writing the rule down is owed before the wallet-session cluster lands (`05` §5 Q5);
unifying onto `FrakResult` is not recommended — bigger break, smaller gain. The three
throwing members carry `@Throws(FrakError::class)` on Kotlin, which has no checked
exceptions otherwise; `handleReferral` swallows on both platforms. Known gaps — no
`Internal` arm, no equality, backoff refusal disguised as a network error — are
`06-open-findings.md` §1.

### 5.2 Threading

| Member | Nullable | Thread | Network |
|---|---|---|---|
| `initialize` | non-null | any | no |
| `anonymousId` | null when tracking is off | any | no |
| `resetAnonymousId` | `Boolean` — false when the keystore refused (4fp) | any | no |
| `setTrackingEnabled` / `isTrackingEnabled` | non-null | any | no (disk on first read) |
| `Frak.shutdown` | non-null | any | no |
| `config.resolve` | throws | any | yes (cached), ungated — S9 |
| `rewards.campaigns` | non-null, may be empty | any | yes (30 s cache) |
| `rewards.best` | nullable | any | yes (cached) |
| `tracking.*` | `FrakResult` | any | yes (queued), consent-gated |
| `sharing.buildLink` | nullable | any | no — null with tracking off, since the link *is* the id |
| `appLink.handleReferral` | `Bool` (consumed) | any | yes (queued), tracking half consent-gated |

"Thread: any" holds for the `suspend` form on both platforms. It does **not** describe Android's Java
`*Async` twins, which are a second column this table does not have: a twin's body runs on the SDK's IO
dispatcher, its *completion is signalled on the main thread*, and it must never be `get()`/`join()`ed
from the main thread — completion needs a main-looper turn, so a blocked main thread is a deterministic
ANR. A twin called after `Frak.shutdown()` returns an already-cancelled future where the `suspend` form
would still run. Full contract on `DefaultFrakClient.asFuture`; the decisions are in
`09-android-api-surface.md` §2a.

Two divergences: `isFrakAppInstalled()` is `async` on Swift, synchronous on Kotlin,
neither `@MainActor`; Swift alone overloads `parseReferralLink`/`handleReferral` on `URL`
beside `String` (`onOpenURL` hands iOS a `URL`), Kotlin stays `String`-only
(`Intent.dataString`, and its JVM test suite stubs `android.jar` with no `Uri` support).

`sdk/android/README.md` and `sdk/ios/README.md` are the shipped contract; this section
is the design intent behind it.

## 6. Roadmap

**v0.2:** native `FrakShareButton` / `FrakBanner` / `FrakPostPurchaseCard` with no web
view; `allowed_package_ids` auto-verification (Digital Asset Links on Android,
self-declared plus review on iOS); Android silent identity linking via bound service
(§2); a `frakAction=share` equivalent mapping an inbound URL or push payload to a sheet.

**Deferred:** wallet session, passkey login, embedded wallet, `displayModal`, SSO,
pairing — depend on a wallet session the anonymous path doesn't need. Fully native
sharing UI, pending the performance gate (`03` §3). iOS App Clip, superseded by the
install-code flow.

## 7. Open questions

1. **ATT — needs a legal decision before iOS ships.** Apple's FAQ says third-party
   deep-linking tools that "create a shared identity of the user between applications
   from different companies" require the prompt; the counter-argument is that Apple
   scopes tracking to advertising and ad measurement, which reward linking is not.
   Getting it wrong is rejection risk under 5.1.1(iv) for every merchant.
2. **Cross-surface attribution.** A user in the merchant's app and on the merchant's
   website are two unrelated identities server-side. Share-from-native →
   open-in-browser is the common case and has never been validated end to end.
3. **No telemetry on native funnels.** The web SDK emits ~10 first-party OpenPanel
   events with no native equivalent, so init failures and funnel drop-off are invisible,
   including the performance gate, which needs field data. The hosted `/sharing` page
   does fire `sharing_page_viewed` wallet-side with a `native` property.
4. **Merchant app-link routing.** Without Universal/App Links registered for merchant
   apps, an `fCtx` link on a device with the merchant's app still opens a browser.
   Package-id identity does not fix this.
5. **Store review posture.** Apple 3.1.1 forbids unlocking content with cryptocurrency
   wallets; Google Play's blockchain policies can pull a merchant into regional
   licensing obligations. SDK rule: never gate functionality on a reward balance, keep
   redemption outside the native app, and say so to integrators.
