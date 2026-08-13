# Frak native SDKs — security & privacy audit (adversarial)

Scope: `sdk/android`, `sdk/ios`, plus the backend routes and wallet pages they talk to.
Worktree `/home/dev/wallet-audit` @ `c0a0cec`. Read-only, no build/run — every claim below is
from source.

## Summary

The crypto and the plumbing are better than most first-alpha SDKs: proof-of-possession is a frozen
byte format with real server-side verification, origin checks in both web views are component-wise
(not prefix), the custom-env allowlist is closed, logs are genuinely clean of identifiers, and
`FrakSDKUI` never reaches for the network itself. What is *not* alpha-ready is the trust boundary
around handing identity to another process. **The single worst thing: Android's `openFrakApp()`
ships the anonymous id and a 30-day `frak-install-v1` bearer proof out through a bare implicit
`Intent(ACTION_VIEW, "frakwallet://install?…&p=<proof>")` with no `setPackage` — any app on the
device that declares the scheme collects it and can bind the user's identity (and their accrued
referral rewards) to the attacker's wallet.** The `?fmt=` inbound merge is the same class of hole
from the other direction: the SDK auto-signs and executes an attacker-supplied merge token with no
origin check and no user interaction.

Beyond that: the ATT question the plan itself flags as "needs a legal decision before iOS ships"
has been silently answered `false` in a shipped privacy manifest; the sharing page URL puts the
anonymous id in a query string that is then sent verbatim (`window.location.href`) to Frak's
OpenPanel analytics endpoint — a flow `PRIVACY.md` explicitly denies; and consent withdrawal
clears neither the WebView's wallet-origin storage nor the HTTP cache holding those URLs. The
sybil story should be stated honestly in writing: anonymous ids are unlimited and free, `/track/*`
authenticates nothing, and no register row says so.

Register accuracy: S10, S4, S5 confirmed. S11 is **overstated in one clause and understated in
another** (F5). S3/3.3 (key material at rest) I re-verified and largely agree with — but the
Android keystore config it calls closed is thinner than the doc implies (F11).

---

## Findings

### F1. Android hands the install proof + anonymous id to any app that claims `frakwallet://`

- **Severity**: blocker
- **Axis**: security
- **Complexity to fix**: trivial (<1h) on Android; medium on iOS
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/AppLauncher.kt:24-30` —
    `Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(FLAG_ACTIVITY_NEW_TASK)` then
    `appContext.startActivity(intent)`. No `setPackage(...)`, no `resolveActivity` check, no
    component targeting.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:319-331` —
    `val proof = identity.signProof(ProofOp.Install, merchantId)` … `InstallLinks.deepLink(scheme
    = settings.env.walletScheme, merchantId, anonymousId, installProof = proof)` … `if
    (launcher.open(deepLink)) return OpenAppResult.OpenedApp`.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/InstallLinks.kt:22-25` —
    `"$scheme://install?m=…&a=…"` + `"&p=${PercentEncoding.encode(installProof)}"`.
  - The package id is already available and already visible: `settings.env.walletPackageId`
    (`FrakEnvironment.kt:12,19`) and `<queries><package android:name="id.frak.wallet"/>`
    (`sdk/android/frak-sdk/src/main/AndroidManifest.xml:16-19`).
  - The comment at `DefaultFrakClient.kt:321` — "Attempted rather than gated on isInstalled" —
    is exactly what makes it exploitable: the hijacker's activity handles the intent, so
    `startActivity` succeeds and the store fallback never runs.
  - Impact confirmed backend-side: `services/backend/src/api/user/identity/ensure.ts:104-119`
    accepts a `frak-install-v1` proof as a credential for `anonymousId`, valid for 30 days
    (`services/backend/src/domain/identity/services/IdentityProofService.ts:24`), and the file's
    own comment says "its leak surface (URL fragment, Play referrer) starts to matter"
    (`ensure.ts:101-103`).
  - iOS is the same shape and cannot be fixed the same way:
    `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:355-368` → `UIApplication.shared.open(url)`
    (`AppLink/AppLauncher.swift:22-26`); iOS gives no way to target a custom-scheme open at a
    bundle id, and duplicate-scheme resolution is undefined.
- **What actually happens**: a malicious app declares `<intent-filter>` for scheme `frakwallet`
  host `install`. The user taps "open Frak" in the merchant app; the malicious app receives
  `m`, `a` and `p`. It can now POST `/user/identity/ensure` with the victim's `anonymousId` and a
  valid proof for 30 days, associating that identity — and every reward attributed to it — with a
  wallet the attacker controls. No root, no permissions, no user prompt beyond installing the app.
- **Fix sketch**: `intent.setPackage(walletPackageId)` before `startActivity`, and fall back to the
  store on `ActivityNotFoundException`. On iOS, move the handoff to a Universal Link on
  `wallet.frak.id` (with the fallback web page already at `/install`) instead of `frakwallet://`.
- **Register status**: NEW. §4 closed "the WebView starting arbitrary activities (3.1)" — this is
  the *SDK core* launching one, unrelated, and no row covers it.

### F2. Inbound `?fmt=` merge is auto-executed with no origin check: identity capture by link

- **Severity**: high
- **Axis**: security
- **Complexity to fix**: medium (few days) — needs a backend policy change too
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:261-268` — any URL
    reaching `handleReferralLink` is parsed with `IdentityMerge.parseToken(url)` and, if present,
    `mergeInboundIdentity(mergeToken)` runs *before* the self/foreign-referral guard.
  - `.../identity/IdentityMerge.kt:29` — `parseToken` accepts `fmt` from any URL, any host.
  - `.../applink/DeepLinkObserver.kt:23-29` — in `DeepLinkHandling.Automatic` (the default path
    wired at `Frak.kt:178-195`) *every* activity's `intent.data` is consumed on create **and**
    resume, so any app that can start an exported activity of the merchant app with an
    `ACTION_VIEW` URI feeds this.
  - The only gates are consent and identity presence (`DefaultFrakClient.kt:298-302`); the SDK
    then signs a `frak-merge-v1` proof automatically
    (`.../tracking/MergeSender.kt:39-43`).
  - Backend: `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:216-240`
    merges the *target* (this device's anonymous id) into the token's `sourceGroupId`; the token's
    only binding is the merchant (`AnonymousMergeService.ts:76-80`). The target-side proof is
    latch-gated and the SDK always supplies it, so it authenticates the device — not the user's
    intent.
  - iOS identical: `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:311-320,344-360`.
- **What actually happens**: an attacker calls `/user/identity/merge/initiate` for their own
  identity, gets a 60-minute token, and delivers `https://merchant.example/?fmt=<token>` to a
  victim (a phishing link, an ad, a QR code, or — on Android — an intent from any locally
  installed app, with no user tap at all). The victim's app absorbs it silently; the victim's
  anonymous identity group is folded into the attacker's. Every subsequent purchase the victim
  makes at that merchant attributes to the attacker's wallet. The wallet-conflict guard only saves
  a victim who has already linked a wallet — precisely not the native SDK's user, who is anonymous
  by design.
- **Fix sketch**: bind the merge token to the target (e.g. mint it against a nonce the target
  device supplies, or require the token to arrive on a link whose `fCtx` merchant *and* referrer
  match), and require a user-visible confirmation for any merge that changes the owning group.
  Short term: only accept `fmt` from a URL that also carries a valid `fCtx` for this merchant.
- **Register status**: NEW. §3.1 covers foreign-merchant *arrivals* (3.2, closed); nothing covers
  the merge path, which is the one that moves identity ownership.

### F3. Anonymous ids are free and unlimited, and `/track/*` authenticates nothing — say so

- **Severity**: high
- **Axis**: security / docs-accuracy
- **Complexity to fix**: structural (mitigation), trivial (documenting it)
- **Evidence**:
  - Identity is a locally generated P-256 key with **no attestation challenge, no StrongBox
    request, no Play Integrity/DeviceCheck/App Attest**:
    `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/identity/AndroidKeystoreDeviceKeyStore.kt:52-64`
    (`KeyGenParameterSpec.Builder(alias, PURPOSE_SIGN).setAlgorithmParameterSpec(...).setDigests(...)`
    and nothing else); iOS falls back to a pure-software key when no enclave is present
    (`sdk/ios/Sources/FrakSDK/Identity/DeviceKey.swift:92-96`).
  - `/user/track/interaction` and `/user/track/purchase` accept a bare `x-frak-client-id` header
    with no signature: `services/backend/src/api/user/track/sdkIdentity.ts:103-121` builds an
    `anonymous_fingerprint` node straight from the header; `interaction.ts:14-45` never verifies a
    proof. The only defence is a per-`(merchantId, clientId)` rate limit of 120/min, in-memory
    per pod (`services/backend/src/api/user/track/index.ts:20,44`).
  - `resetAnonymousId()` is public on both platforms
    (`sdk/android/.../FrakClient.kt:46`, `sdk/ios/Sources/FrakSDK/FrakClient.swift:44`) and mints a
    brand-new id; so does a reinstall (`AnonymousIdStore.kt:22-26` comment, `DeviceKey.swift:34-39`
    — Keychain deliberately avoided so the id dies with the install).
  - Self-referral guard is client-side only in the SDK (`applink/ReferralArrival.kt:25`) and
    group-identity-based server-side (`services/backend/src/domain/attribution/services/ReferralService.ts:27-32`)
    — both defeated by a reinstall, which produces a different key, id and group.
  - The one thing that *is* solid: purchase amounts are **not** client-supplied.
    `TrackingApi.purchase(customerId, orderId, token)` (`sdk/android/.../TrackingApi.kt:20-24`) and
    `services/backend/src/api/user/track/purchase.ts:10-15` carry no amount; the money comes from
    the merchant's own webhook, and this route only claims an identity link
    (`purchase.ts:57-69`, `merge: false`).
- **What actually happens**: a farmer with one rooted phone (or a modified APK, or an emulator
  farm, or Android work profiles) mints a fresh identity per loop, opens their own share link, and
  banks a referral each time — the self-referral guard only ever sees two different ids. A merchant
  who reads "self-authenticating" in the docs will assume more than the system delivers.
- **Fix sketch**: require a signed proof on `/track/interaction` for arrivals (the SDK can already
  mint one), and gate reward *payout* on a Play Integrity / App Attest verdict at the wallet, not
  at the SDK. Whatever is chosen, write the trust boundary down in `PRIVACY.md` and
  `02-sdk-design.md`: the proof proves key possession, never device or human uniqueness.
- **Register status**: NEW (the register has no sybil/abuse row at all).

### F4. ATT: the manifest answers a question the plan says is still open — App Store rejection risk

- **Severity**: high
- **Axis**: build-release / merchant-setup
- **Complexity to fix**: small (<1d) to document; the decision itself is legal, not technical
- **Evidence**:
  - `docs/plans/native-sdk/02-sdk-design.md:381-385`: "**ATT — needs a legal decision before iOS
    ships.** Apple's FAQ says third-party deep-linking tools that 'create a shared identity of the
    user between applications from different companies' require the prompt… Getting it wrong is
    rejection risk under 5.1.1(iv) for every merchant."
  - `sdk/ios/Sources/FrakSDK/PrivacyInfo.xcprivacy:29-31` ships `<key>NSPrivacyTracking</key>
    <false/>` and an empty `NSPrivacyTrackingDomains`; the same in
    `sdk/ios/Sources/FrakSDKUI/PrivacyInfo.xcprivacy`. `sdk/ios/README.md:138-141` presents it as
    settled.
  - The SDK *does* create the shared identity the FAQ describes: `openFrakApp()` exists solely to
    hand this app's anonymous id to a different company's app (the Frak wallet) —
    `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:355-368` — and the backend folds the two into
    one identity group (`AnonymousMergeOrchestrator.ts:216-240`). Sharing links carry the id from a
    merchant app to arbitrary web properties (`sharing/SharingLinkBuilder.kt:26-36`).
  - Nothing in either SDK references `ATTrackingManager`, `AppTrackingTransparency` or
    `NSUserTrackingUsageDescription` (grep across `sdk/`, `example/`: zero hits), and no
    merchant-facing doc tells an integrator to consider it.
- **What actually happens**: verdict — **this needs a documented legal sign-off before the first
  merchant submits, and today it has none.** The manifest's own defence ("the affiliate integration
  lives in the Frak wallet app, not in this SDK") is the exact structure Apple's deep-link-provider
  FAQ names: the SDK is the collection point, the linkage happens elsewhere in the same vendor's
  system. Referral attribution with merchant-funded campaigns is defensible as "advertising
  measurement". Consequence of getting it wrong is not a Frak rejection — it is *the merchant's*
  binary rejected under 5.1.1(iv), or a post-hoc removal, for every integrator at once.
  Realistically: `NSPrivacyTracking=false` is *arguable* while the user is anonymous and no wallet
  handoff has happened, and much weaker the moment `openFrakApp()` succeeds — which the manifest
  comment itself concedes for the "Linked" flag (`PrivacyInfo.xcprivacy:49-51`) and then does not
  carry through to the tracking flag.
- **Fix sketch**: get the legal call recorded in `05-build-and-release.md` before the first
  submission; ship an iOS-facing privacy doc telling merchants what they must answer on the
  nutrition label and whether their own app needs an ATT prompt given how they call
  `openFrakApp()`; if the answer is "prompt", expose a documented hook so the merchant can gate the
  handoff on ATT status.
- **Register status**: NEW as a finding (the plan lists it as an open question; the register does
  not track it at all, and the code has already answered it).

### F5. The anonymous id travels in a query string and reaches the analytics endpoint verbatim

- **Severity**: medium (high for the docs half)
- **Axis**: security / docs-accuracy
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingPageUrl.kt:43-44` —
    `append("&merchantId=")…append("&clientId=")`; same in `warm()` at `:75-76`; iOS twin
    `sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift:45-46,74-75`. `/install` puts the id in
    `a=` too (`applink/InstallLinks.kt:61-65`), proof correctly in the fragment.
  - That URL is loaded in the sheet's web view, and the wallet's standalone bootstrap starts
    OpenPanel: `apps/wallet/app/entry/shared/bootstrap.tsx:134` (`initAnalytics()`),
    `packages/wallet-shared/src/common/analytics/openpanel.ts:32-37`
    (`new OpenPanel({ apiUrl, clientId, trackScreenViews: true, … })`).
  - OpenPanel's auto screen view sends the **full href**, query string included:
    `@openpanel/web@1.4.1/dist/index.js` — `screenView(t,e){…(n=window.location.href,r=t),this.lastPath!==n&&(…super.track("screen_view",{…__path:n…}`.
  - Destination is Frak-operated (`infra/gcp/secrets.ts:153` → `https://op-api.gcp.frak.id/`), so
    this is a first-party processor, not a broker — but it is a domain and a datastore that
    **`sdk/android/PRIVACY.md` does not list**: "Three things leave the device, and only three",
    with a "Where it goes" table of five backend endpoints and nothing else.
  - S11's claim that consent gating rests on "one point of failure" is **wrong for the session
    path**: `SharingSessionBuilder.resolve` calls `dependencies.buildSharingLink` first
    (`SharingSessionBuilder.kt:60`), which throws `TrackingDisabled`
    (`DefaultFrakClient.kt:199,408-410`). It is **right for the warm path**:
    `SharingWarmup.kt:21-30` relies only on `anonymousId()` returning null.
- **What actually happens**: every sheet open writes the user's anonymous id into wallet-origin
  access logs, into the WebView's on-disk HTTP cache (Android runs `LOAD_DEFAULT`,
  `SharingWebView.kt:199`), into the WebView's back/forward list, and into an analytics event
  store. A merchant who writes their privacy notice from `PRIVACY.md` will have omitted a
  processor and a data flow. (Referrer leakage to third parties is *not* an issue — no page sets a
  loose `Referrer-Policy`, so modern engines send origin-only cross-origin.)
- **Fix sketch**: move `clientId` out of the query into the fragment (same trick already used for
  the install proof) or POST it via `postMessage`/document-start injection; and either filter
  `__path` in the OpenPanel `filter` hook (one already exists, `openpanel.ts:39-59`) or strip the
  query there. Update `PRIVACY.md`'s two tables.
- **Register status**: confirms S11 on the substance; **overstated in S11** on "one point of
  failure, no second guard" (true only for warm-up); extends it with the analytics leg, which S11
  does not mention.

### F6. Nothing clears the web view's wallet-origin data on consent withdrawal or id reset

- **Severity**: medium
- **Axis**: security / correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `setTrackingEnabled(false)` purges only the event queue:
    `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:128-131`;
    `resetAnonymousId()` likewise (`:115-122`). iOS twin at
    `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift` (`resetAnonymousId`/`setTrackingEnabled`).
  - Grep for `removeData|WKWebsiteDataStore|clearCache|removeAllCookies|clearHistory` across
    `sdk/ios/Sources` and `sdk/android/frak-sdk-ui/src/main`: the only hit is
    `SharingWebView.kt:210` `CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)`.
  - iOS deliberately uses the **persistent** store:
    `sdk/ios/Sources/FrakSDKUI/SharingWebView.swift:123-124` — "Persistent: the hosted page's own
    HTTP cache is what tier 2 falls back on" — `configuration.websiteDataStore = .default()`.
  - The cached documents are the URLs from F5, i.e. they contain the *old* `clientId`.
- **What actually happens**: a user withdraws consent, or the merchant rotates the id; the wallet
  origin's cookies, `localStorage` and cached URLs (carrying the previous anonymous id) survive in
  the merchant app's WebView container indefinitely, so the next sheet the user opens can be
  correlated to the identity they just discarded. On Android the data store is process-global,
  so it also outlives `Frak.shutdown()`.
- **Fix sketch**: on `setTrackingEnabled(false)` and `resetAnonymousId()`, clear the wallet
  origin's data (`WKWebsiteDataStore.default().removeData(ofTypes:modifiedSince:)` filtered by
  host; `CookieManager`/`WebStorage`/`WebView.clearCache` on Android) and destroy the warm pool.
- **Register status**: NEW.

### F7. The Play Store handoff puts the anonymous id and proof in the install referrer — and PRIVACY.md denies it

- **Severity**: medium
- **Axis**: docs-accuracy / security
- **Complexity to fix**: trivial (<1h) for the doc; small for the design
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/InstallLinks.kt:32-45` —
    `referrer = "merchantId=…&anonymousId=…&proof=…"`, appended to
    `https://play.google.com/store/apps/details?id=…&referrer=…`, opened via the same unguarded
    implicit intent as F1 (`DefaultFrakClient.kt:333-334`).
  - `sdk/android/PRIVACY.md` ("What the SDK collects"): "**Not** declared, because the SDK does not
    touch them: advertising ID, `ANDROID_ID`, **Install Referrer**, location, contacts, device or
    other IDs."
- **What actually happens**: the anonymous id and a 30-day bearer proof are handed to Google Play
  as a referrer string on every store fallback — a third-party transfer that appears in no table in
  `PRIVACY.md` and is explicitly disclaimed. A Data Safety form written from this document is
  wrong. (Read-back is limited to the installed wallet, so the exploitable surface is small; the
  disclosure failure is the finding.)
- **Fix sketch**: correct the "does not touch" line to "does not *read* the install referrer; it
  writes one carrying the anonymous id and install proof when handing off to the store", and add
  Google Play to "Where it goes". Consider a short-lived opaque handoff ticket instead of the raw
  id + proof.
- **Register status**: NEW.

### F8. iOS merchants get no privacy/consent/deletion document at all

- **Severity**: medium
- **Axis**: merchant-setup / docs-accuracy
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/android/PRIVACY.md` exists and is thorough (consent wiring, backup, the
  `https://frak.id/account-deletion` DSR route, what is stored where). `find sdk/ios -name
  'PRIVACY*'` → nothing. `sdk/ios/README.md` mentions the word "consent" **zero** times
  (`grep -n "consent\|deletion\|GDPR" sdk/ios/README.md` returns only three `PrivacyInfo.xcprivacy`
  lines: `:125,129,158`). `FrakClient.setTrackingEnabled` exists on iOS
  (`sdk/ios/Sources/FrakSDK/FrakClient.swift`) but is documented nowhere a merchant will look.
- **What actually happens**: an iOS integrator building an App Store nutrition label and a GDPR
  notice has only the comments inside a `.xcprivacy` file to work from — no statement of what
  leaves the device, no instruction to drive `setTrackingEnabled` from their CMP, and no deletion
  URL. On the platform with the stricter review this is backwards.
- **Fix sketch**: port `PRIVACY.md` to `sdk/ios/`, keyed to Apple's nutrition-label categories,
  and add the ATT paragraph from F4.
- **Register status**: NEW.

### F9. The SDK phones home on every launch even with tracking disabled

- **Severity**: medium
- **Axis**: security / merchant-setup (GDPR)
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:149-156` — an
    unconditional `scope.launch { resolveConfig() }` in `init`, with the comment "Ungated on
    consent, like resolveConfig itself: carries no user identifier".
  - iOS twin: `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:88-97`.
  - `sdk/android/PRIVACY.md` grants this ("No — carries no identifier") but also states, in the
    same section, "the backend sees the device's public IP".
- **What actually happens**: a merchant who ships `FrakConfig.Builder(...).trackingEnabled(false)`
  as a hard floor, expecting "no Frak traffic until the user consents", still emits a request to
  `backend.frak.id` on every cold start carrying the app's package id, platform, language and the
  device's IP. In the EU that is a third-party disclosure of an online identifier made before
  consent; it is also the kind of thing that shows up in a merchant's own network audit and burns
  trust.
- **Fix sketch**: defer the eager resolve until either consent is granted or a merchant-visible
  API (`config.resolve()`, `rewards.best()`) is actually called; or add an explicit
  `FrakConfig.resolveConfigWithoutConsent(false)` and document the default.
- **Register status**: partially CONTRADICTS the S9 closure note ("`trackingEnabled` no longer
  gates config/rewards reads, which carry no identifier") — an IP address plus a package id is an
  identifier for GDPR purposes even if it is not *the* anonymous id.

### F10. Consent withdrawal is written with `apply()`, and the code comment misstates the cost

- **Severity**: medium
- **Axis**: correctness / security
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/config/KeyValueStore.kt:33-39` —
    `preferences.edit().putString(key, value).apply()` with the comment "// apply, not commit: a
    write lost to a process kill just costs one extra network call."
  - The same store holds the consent decision: `Frak.kt:75-83` hands `identityStore` to
    `TrackingConsent`; `core/TrackingConsent.kt:69-81` writes through `store.putString`.
  - Confirmed by `PRIVACY.md` §1, which already names S10.
- **What actually happens**: a withdrawal lost to a crash or a `kill -9` silently reverts to
  enabled on the next launch, and the in-source comment tells the next maintainer this is harmless.
  For the consent key it is not "one extra network call", it is processing personal data after the
  user said stop.
- **Fix sketch**: use `commit()` on the consent key (or `commit()` on any write to the identity
  store — two keys, both cold-path), and fix the comment.
- **Register status**: confirms S10; adds the misleading comment.

### F11. Android keystore usage is minimal, and a sign-time key invalidation is unrecoverable

- **Severity**: medium
- **Axis**: security / correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/identity/AndroidKeystoreDeviceKeyStore.kt:52-64`
    — no `setIsStrongBoxBacked` (not even opportunistically with a `StrongBoxUnavailableException`
    fallback), no `setAttestationChallenge`, no `setUnlockedDeviceRequired`; only
    `setUserAuthenticationRequired` is deliberately absent, and correctly so (`:59`).
  - `load()` catches only `GeneralSecurityException` (`:47`). `create()`'s `generateKeyPair()` can
    throw `ProviderException` (a `RuntimeException`) on several OEM stacks — it is caught, but only
    one level up, by `AnonymousIdStore.load`'s broad `catch (failure: Exception)`
    (`identity/AnonymousIdStore.kt:202-206`), which yields "tracking will be inert" rather than a
    retry with a different alias.
  - The signing path has **no** invalidation recovery: `AnonymousIdStore.signProof` catches and
    logs (`:85-91`) but the `Identity` is memoised in `generation`, so a
    `KeyPermanentlyInvalidatedException` (or any keystore-blob corruption) makes every subsequent
    proof null for the life of the process while `anonymousId()` keeps returning the stale id.
  - Register accuracy: S3's closure claim — key material is non-exportable, absent from Auto Backup
    and device transfer — is correct; `AndroidManifest.xml:24-42` and `PRIVACY.md` §2 match the
    code.
- **What actually happens**: on a device where the keystore entry is invalidated (lock-screen
  change on some OEM builds, keystore corruption, restore edge cases) the install keeps tracking
  under an id it can no longer prove, so the install handoff and every merge silently stop working
  until the app is killed — with only a `warn` line to show for it.
- **Fix sketch**: request StrongBox opportunistically; catch `KeyPermanentlyInvalidatedException`
  (and `UnrecoverableKeyException`) at the sign site, delete the alias and drop the memoised
  generation so the next call mints a replacement.
- **Register status**: NEW (S3 covers backup only; 8.5 notes this class is untested, not that it
  is thin).

### F12. iOS software-key fallback and the config cache: raw scalar on disk, cache in a backed-up suite

- **Severity**: low
- **Axis**: security
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDK/Identity/DeviceKey.swift:92-96` — no enclave ⇒ `P256.Signing.PrivateKey()`
    persisted as `key.rawRepresentation`; `PersistedDeviceKeyStore.loadOrCreate:71` base64url-encodes
    the blob into `FileKeyValueStore`, i.e. plaintext JSON at
    `Application Support/id.frak.sdk/identity.json` (`Config/FileKeyValueStore.swift:7,117`).
  - Protections that make this acceptable are real and verified: backup exclusion on the directory
    (`Core/FrakStorage.swift:24-26`) and `.completeUntilFirstUserAuthentication` reapplied after
    every write (`FileKeyValueStore.swift:127-137`) — but that `#if canImport(UIKit)` guard means
    **no protection class on macOS/Catalyst**, which is exactly where `SecureEnclave.isAvailable`
    is most likely to be false.
  - S4 confirmed as still open: `Config/KeyValueStore.swift:21` — the resolved-config cache stays
    in a `UserDefaults` suite with no backup exclusion; the consent suite (`:25`) is deliberately
    backed up, which is correct.
- **What actually happens**: on a Mac (Catalyst) or a pre-T2 host the anonymous identity's private
  key sits in a readable file with no data protection; the register's justification for not gating
  the fallback to the simulator ("once the store is excluded from backup the raw scalar never
  leaves the device") does not hold on the one platform where the fallback actually fires.
- **Fix sketch**: on non-UIKit hosts, either refuse the software path or store the scalar in the
  Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (the uninstall-survival
  objection does not apply on macOS in the same way). Decide S4 and delete the row.
- **Register status**: confirms S4; narrows/qualifies the 3.3 closure argument.

### F13. The SDK logs outside the merchant's configured logger

- **Severity**: low
- **Axis**: UX/DX / privacy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHostStyle.kt:41-45,54`
  writes `Log.w(TAG, …)` directly — including the merchant-supplied wallet origin — bypassing
  `FrakLogger`'s level gate and `FrakLogSink` (`core/FrakLogger.kt:27-49`). iOS:
  `sdk/ios/Sources/FrakSDKUI/SharingTrace.swift:10,19` builds its own `os.Logger` and marks the
  event name `privacy: .public`, likewise outside `FrakConfig.logLevel`.
- **What actually happens**: a merchant who sets `logLevel = NONE` for a production build still
  gets Frak lines in logcat / the unified log. Harmless content today; the mechanism is the
  problem, since the next line someone adds there will not have been reviewed against the log
  policy that S1/S2 established.
- **Fix sketch**: thread the `FrakLogger` into `frak-sdk-ui` (it already depends on `frak-sdk`) and
  route both through it.
- **Register status**: NEW.

### F14. The sharing link's scheme is never validated

- **Severity**: low
- **Axis**: security
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/UrlQuery.kt:63-64` — `parse`
  accepts anything containing `"://"`, so `javascript://x`, `file://`, `intent://` all pass;
  `sharing/SharingLinkBuilder.kt:22-36` builds on it, and the base URL is merchant- or
  backend-supplied (`DefaultFrakClient.kt:213-218`: `request.link ?: product?.link ?:
  resolved?.sdkConfig?.homepageLink ?: settings.metadata.homepageLink`). The resulting string is
  copied to the clipboard (`ui/NativeShare.kt:32-35`), handed to `ACTION_SEND` (`:18-26`), passed to
  `UIActivityViewController` as a `URL` (`FrakSDKUI/NativeShare.swift:109`) and injected into the
  page URL as `&link=` (`SharingPageUrl.kt:55`). The *external open* path is correctly restricted
  to http/https on both platforms (`SharingSheetState.kt:437-439`,
  `FrakSDKUI/SharingSheetLogic.swift:117-118`) — this one is not.
- **What actually happens**: a misconfigured (or hostile) merchant config yields a `file://` link
  that the iOS share sheet will treat as a file attachment, or a `javascript:` link rendered by the
  wallet page. Requires a bad merchant config, so impact is bounded — but it is the same check the
  codebase already makes three lines away.
- **Fix sketch**: reject non-http(s) base URLs in `SharingLinkBuilder.build` and return null.
- **Register status**: NEW.

### F15. `DeepLinkObserver` consumes every activity's intent data

- **Severity**: low
- **Axis**: security
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:23-29`
  — reads `activity.intent.data` on create and resume for *any* activity, marking the `Intent` with
  a boolean extra. `Interaction.arrival` carries no idempotency key by design
  (`tracking/Interaction.kt:31-35`).
- **What actually happens**: any locally installed app can start an exported activity of the
  merchant app with a crafted `fCtx` URI and force an arrival for a referrer of its choosing; the
  handled-marker is per-`Intent` object, so re-sending is free. Backend impact is bounded — a
  referrer/referee pair registers once (`ReferralService.ts:41-51`) — so this is mostly a
  data-quality and F2-delivery vector rather than direct theft.
- **Fix sketch**: only consume intents whose URI actually carries `fCtx`/`fmt` (already parsed
  downstream — move the check up), and log at debug when one is ignored.
- **Register status**: NEW (related to 3.2, which covers the merchant check, not the delivery path).

---

## Verified-OK (coverage)

- **Proof format & verification**: `ProofCodec` is domain-separated, fixed-width, UUIDs as raw
  bytes (`identity/ProofCodec.kt:19-107`); the backend derives the id from the embedded key before
  verifying, so an arbitrary `pk` cannot be submitted for someone else's id
  (`IdentityProofService.ts:76-84`), with per-op windows (`:21-28`) and a 60s future-skew clamp.
- **Purchase amounts are not client-supplied** — `TrackingApi.purchase` and the backend route carry
  `customerId`/`orderId`/`token` only (`TrackingApi.kt:20-24`, `track/purchase.ts:10-15`).
- **Custom-environment allowlist** is closed and identical on both platforms: https, or http to
  loopback/RFC1918/`*.local`/`10.0.2.2`, anything else swapped for an unreachable placeholder
  (`core/FrakEnvironment.kt:76-134`, `Core/FrakEnvironment.swift:76-123`). No `usesCleartextTraffic`,
  no ATS exception demanded of merchants (grep: zero `NSAllowsArbitraryLoads` in `sdk/`/`example/`).
- **Redirects declined** on both transports (`net/HttpClient.kt:165`,
  `Net/HTTPClient.swift:3-14`); response bodies capped at 1 MiB; iOS uses an ephemeral session with
  `urlCache = nil` (`HTTPClient.swift:63-68`).
- **Log hygiene**: no log line in either SDK interpolates an anonymous id, a URL with `fCtx`, or a
  proof; the HTTP logger prints host+path only, never the query string
  (`net/HttpClient.kt:127-138`, `Net/HTTPClient.swift:223`); iOS redacts with `privacy: .private`
  (`Core/FrakLogger.swift:56-73`).
- **Web-view origin checks are component-wise**, not prefix — the `wallet.frak.id.attacker.example`
  case is explicitly handled (`SharingWebView.kt:316-326`, `SharingWebView.swift:429-436`), and the
  return-scheme channel is `sid`-guarded (`SharingWebView.kt:303-314`, `.swift:384-397`).
- **Android WebView settings actually set**: `allowFileAccess=false`, `allowContentAccess=false`,
  `MIXED_CONTENT_NEVER_ALLOW`, `setSupportMultipleWindows(false)`,
  `javaScriptCanOpenWindowsAutomatically=false`, `setGeolocationEnabled(false)`, third-party
  cookies off (`SharingWebView.kt:191-210`). No JS bridge (`addJavascriptInterface` appears
  nowhere), no `setWebContentsDebuggingEnabled`, `onRenderProcessGone` returns `true`
  (`:468-484`). Dangerous defaults left on are limited to `domStorageEnabled` (needed) and the
  absence of a `DownloadListener`/`WebChromeClient` (both fail closed).
- **External navigation** restricted to http/https on both platforms (F14 notes the one gap).
- **Return scheme** is sanitised to `frak-[a-z0-9._-]{1,60}` on both sides
  (`SharingPageUrl.kt:16-23`, wallet's `sanitizeReturnScheme.ts`), so the page cannot make the host
  launch `some-banking-app://`.
- **Install proof rides in the URL fragment** for the hosted `/install` page, so it does not reach
  the server (`applink/InstallLinks.kt:66`, `AppLink/InstallLinks.swift:48`).
- **Clipboard**: install code marked `EXTRA_IS_SENSITIVE` on API 33+ and `localOnly` +
  `expirationDate` on iOS (`ui/NativeShare.kt:50-55`, `FrakSDKUI/NativeShare.swift:64-68`); iOS only
  *writes* the pasteboard, so no system paste banner is triggered (`NativeShare.swift:52-56`).
- **Permissions**: `INTERNET` only, `<queries>` for two package ids, never `QUERY_ALL_PACKAGES`
  (`frak-sdk/src/main/AndroidManifest.xml:16-22`).
- **Consent gating of the identified paths**: `track`, `trackPurchase`, `buildSharingLink`,
  `installPageUrl`, the queue drain and the merge are all gated
  (`DefaultFrakClient.kt:199,298,342,382,408`; `DefaultFrakClient.swift:73,250,347,389,417`), and
  the queue is purged on withdrawal. I found no path that sends an identifier after withdrawal
  (F9 is about a non-identifier call; F6 is about residue, not new sends).
- **Backup posture**: Android event queue in `noBackupFilesDir` (`Frak.kt:88-94`), consent
  deliberately in Auto Backup, keypair non-exportable; iOS queue + identity in a backup-excluded
  directory (`Core/FrakStorage.swift:24-26`). S3 verified genuinely closed.
- **Privacy manifests** exist for both targets and are `.copy`-declared in `Package.swift`;
  `NSPrivacyAccessedAPITypes` correctly declares `UserDefaults`/CA92.1 and nothing else is a
  required-reason API in the SDK path (no `modificationDate`/`creationDate`/disk-space reads
  outside tests).

## Could not verify

- Whether the OpenPanel deployment strips or retains `__path` query strings server-side (only the
  client emit is visible in this repo) — severity of F5's analytics leg depends on it.
- Whether Android WebView passkey/WebAuthn availability makes a wallet login inside the merchant's
  WebView reachable in practice; the standalone `/sharing` page never navigates there in the
  embedded case (`SharingView.tsx:120-152` returns to the host first), but same-origin navigation
  is unrestricted so nothing structurally prevents it.
- Real device behaviour of `KeyPermanentlyInvalidatedException`/`ProviderException` (F11) — no
  emulator, no device, and `AndroidKeystoreDeviceKeyStore` has zero executed coverage (register
  8.5, confirmed: no test file references it).
- Whether Apple would in fact require ATT here (F4) — this is a legal/policy call, not a code
  question; I can only show that the SDK builds the cross-company shared identity Apple's FAQ
  describes and that no decision is recorded.
- CDN/proxy topology in front of `wallet.frak.id` (who else sees the `clientId` query string in
  access logs) — not in this repo.
- Whether `id.frak.wallet` actually validates the *source* of a `frakwallet://install` intent; the
  wallet's native (Tauri) side was out of scope for this pass, so F1's exploitability assumes only
  the SDK side.
