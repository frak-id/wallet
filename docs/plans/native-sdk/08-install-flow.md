# Native SDK — the install flow, end to end

The step after a share: how a user who just shared a product gets the Frak wallet
installed, and how their anonymous id survives the trip.

This is a design doc, not an audit. It supersedes what `openFrakApp()` does today on
both platforms, changes the hosted-page contract, and touches `apps/wallet`'s deep-link
router. Nothing here is implemented yet.

**Why it is urgent.** `frak-install-v1` proofs are verified but not required today
(`verifyProofUnenforced`, marked `ROLLOUT-STEP-3` in `services/backend/src/api/user/identity/ensure.ts`).
When that rollout step lands and the bare-`anonymousId` arm is deleted, a link without a
proof stops working. **iOS emits no proof anywhere today**, so iOS is not "missing an
optimisation" — it stops functioning at rollout 3. Android emits one, in the Play
referrer only.

---

## 1. The user journey

The whole design serves one sequence:

1. The user buys something in the merchant app.
2. The sharing sheet appears. They share the product to a friend.
3. They are invited to install the Frak wallet to collect the reward.
4. They install it, open it, and the wallet knows which merchant and which anonymous id
   they came from — so the reward lands.

Step 4 is the hard one. Step 3 should cost the user as little as possible, which means
**staying inside the merchant app for as long as the platform allows**.

---

## 2. Where the identity actually goes

The anonymous id is derived from a P-256 key held in the Secure Enclave / AndroidKeyStore.
It cannot be re-derived on a fresh install of a *different* app. So the id has to be
carried across the install boundary, and each platform gives a different amount of help.

| Platform | Mechanism | Determinism |
|---|---|---|
| Android | Play Install Referrer | **Deterministic.** The referrer string survives the store round trip exactly. |
| iOS | *nothing* | Apple has never shipped an install referrer. |

This is not a Frak limitation, it is the shape of the problem the whole deferred-deep-link
industry works around. The standard iOS answers, and why we are not using them:

- **Probabilistic fingerprinting** (Adjust, AppsFlyer, Branch): match IP + user agent +
  screen + OS + language captured at click time against first launch. Vendor-published
  confidence decays roughly 0.85 under an hour to 0.40 by 72 hours, and iCloud Private
  Relay erodes the IP signal outright. It is a heuristic, it needs a server-side click
  record for every user, and it is exactly the kind of cross-context correlation we do not
  want to be doing.
- **IDFV**: deterministic, but vendor-scoped — it only helps for *re-engagement*, never a
  genuine first install. Useless here.
- **Clipboard** (Branch NativeLink): copy the link, go to the App Store, read the
  pasteboard on first launch. This is the closest to what we want, and it is what we are
  doing — with a visible code as well, see §5.

Frak has an advantage the generic case does not: the user is in a session with a merchant
we already resolved, and the SDK holds a signing key. That makes a **user-mediated,
deterministic handoff** possible — the install code — with no fingerprinting, no ATT
prompt, and no IP correlation. It costs the user one interaction. That is the trade, and
it is a good one.

---

## 3. What is wrong today

### W1 — iOS gates the deep link on a probe it documents as unreliable

`sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:208`:

```swift
// Attempted rather than gated on the probe: `canOpenURL` answers false when the
// merchant forgot `LSApplicationQueriesSchemes`, and `open(_:)` is not gated by it.
// Trusting the probe would turn a plist omission into a dead feature.
if await isFrakAppInstalled(), await launcher.open(deepLink) {
```

The comment says the opposite of what the code does. So does `AppLauncher.swift:12`, and
so does the design in `02-native-sdk-overview.md:755`, which is emphatic: *"openFrakApp
must ATTEMPT the open and fall back on failure rather than trusting isFrakAppInstalled."*

`canOpenURL` returns false unless the **merchant** lists `frakwallet` in
`LSApplicationQueriesSchemes`, and the SDK cannot inject that — iOS has no manifest
merger. So for any merchant who missed that line of documentation, the wallet is installed
and never opens; every user is bounced to the App Store instead.

Android does not have the *bug*: `<queries>` ships in `frak-sdk/src/main/AndroidManifest.xml`
and the manifest merger folds it into the host app, so its probe is reliable. The gate was
removed there anyway, so the two platforms read alike and `startActivity`'s own answer is
what decides. That is a real behaviour change on Android: a device whose probe says absent
but whose scheme resolves now reports `OpenedApp` instead of `OpenedStore`.

§6 removes the probe entirely, which closes this as a side effect.

### W2 — native never reaches `/install`, so iOS loses attribution outright

`apps/wallet/app/routes/install.tsx` renders `InstallCodeView` for web visitors who are not
logged in: merchant name, estimated reward, a generated install code, and a
platform-appropriate download URL. It is built, translated, and instrumented.

Native never gets there. `handleInstall` in `sharing.tsx:424` hands control back to the SDK
(`returnToHost("install")`), and the SDK opens the store directly. On Android that is
survivable, because `InstallLinks.playStore()` carries `merchantId`, `anonymousId` and the
proof in the referrer. On iOS `InstallLinks.appStore()` returns a bare constant URL:

```swift
private static let appStoreURL = "https://apps.apple.com/app/id6740261164"
```

So an iOS user who shares and then installs arrives in a wallet that has never heard of the
merchant or of them. **The attribution is simply gone**, and the one mechanism that could
recover it is unreachable.

### W3 — a proof cannot survive the deep-link path

`apps/wallet/app/utils/deepLink.ts:extractSearchParams` reads a fixed list of search params
and `routeResolvers.install` forwards only `m` and `a`. The fragment is dropped before
`navigate` is called, and `/install` reads its proof from `window.location.hash`, which is
empty after an in-app navigation.

Consequence: a proof on a deep link works **only when the app is absent** and a browser
loads the URL directly. Fixing this is a prerequisite for any native proof work, not a
follow-up.

### W4 — a custom scheme where a universal link would do the work for free

The SDK opens `frakwallet://install`. But the infrastructure for HTTPS app links is already
deployed: `services/backend/src/api/common/wellKnown.ts` serves both an
`apple-app-site-association` with `paths: ["/*"]` and an `assetlinks.json`, and the Tauri
config registers `https://wallet.frak.id/.*` alongside the `frakwallet` scheme, with
per-variant routing enforced by signing fingerprint.

So `https://wallet.frak.id/install?...` already resolves correctly by itself: the OS opens
the app when it is installed, and a browser otherwise. That is app-detection done by the
platform, with no probe, no `LSApplicationQueriesSchemes`, and no `<queries>`.

### W5 — the sharing interaction is recorded on intent, not on success

Not an install-flow bug, but it is in this code path and it is the most consequential thing
found while writing this doc.

`SharingSheetModel.share()` calls `await trackSharing()` **before** opening the OS chooser,
justified by durability: iOS can suspend the host app while the share sheet is up, so an
event recorded on the callback can be lost.

The reference implementation splits two concerns that native has collapsed into one.
`packages/wallet-shared/src/sharing/hooks/useShareLink.ts` fires:

- `sharing_link_started` — an **analytics** event, before the chooser, explicitly "so we
  capture intent even when the user dismisses the chooser without completing";
- `sharing_link_shared` **and** `onShared()` — only after a successful share.

And `apps/listener/app/module/sharing/component/SharingPage/index.tsx` wires
`onShared: () => trackSharing()`, where `trackSharing` is the **reward-bearing backend
interaction**.

Native has no analytics/interaction split. It has only `client.track(.sharing())` — the
reward-bearing one — and fires it on intent. Open the chooser, cancel, repeat: every
cancellation counts as a share. The durability argument is real but it is an argument for
an analytics event, not for the interaction that pays out.

Note that **copy is different and is already correct**. The listener fires `trackSharing()`
immediately in `handleCopy`, because a copy has no completion to wait for. This is not a
blanket "move the call later".

| Entry point | Today | Correct |
|---|---|---|
| `share()` | before the chooser | **after, gated on the result** |
| `copy()` | before | before — unchanged |
| `fallBack()` (tier 3) | before the chooser | **after, gated on the result** |

**Android caveat, with a precedent.** `NativeShare.share` returns whether the chooser
launched, not whether the user completed a share; telling the difference needs
`ActivityResultLauncher`, which needs `ComponentActivity` and is a public API change. The
wallet's own Tauri plugin already lives with exactly this and says so: *"iOS returns the
real `completed` flag; Android resolves as soon as the chooser is presented (always
true)."* Match that. Gate on the returned flag on both platforms, accept that Android's is
optimistic today, and it becomes correct for free if `ActivityResultLauncher` ever lands.

---

## 4. What stays: `returnToHost`

An earlier draft of this design had the page navigate itself to `/install`. That is wrong,
and the reason is worth recording because it is not obvious from the call graph.

The split is:

- the **native footer** owns Share and Copy — `share()` / `copy()` in `SharingSheetModel`;
- the **page** owns the post-share confirmation screen, which the host reloads with
  `?confirmed=1` from `confirm()`. Its Install and Share-again buttons are the only things
  that fire `returnToHost`.

So `returnToHost("install")` is not the page overreaching. It is the page reporting intent
and the host deciding — and the host *must* decide, because **the page has no signing key**.
It cannot build an install URL carrying a proof. This is the same reason `sharing.tsx:301`
builds its own install link without one, with the comment "this page's install link has no
keypair to sign with".

`returnToHost` stays. What changes is what the host does in response.

---

## 5. Target flow

```
merchant app
  └─ sharing sheet opens, web view loads /sharing?native=1&…
     ├─ native footer: Share
     │    ├─ OS chooser
     │    ├─ on success → track(.sharing())          ← W5: after, not before
     │    └─ confirm(.shared) → reload /sharing?confirmed=1
     └─ page confirmation screen: "Install the app"
          └─ returnToHost("install")
               ├─ HOST mints the proof NOW  signProof(.install, merchantId)
               ├─ HOST loads <wallet>/install?m=&a=#p=<proof> in the SAME web view
               │    └─ InstallCodeView: reward, code, download button
               │         ├─ on Copy or Download (a gesture, never an effect) the page
               │         │    hands the code back: returnToHost("code", value, exp),
               │         │    HOST writes it to the pasteboard (expiring, local-only)
               │         └─ download button
               │              ├─ iOS: HOST intercepts → SKOverlay → installs in place
               │              └─ Android: Play URL with referrer (leaves the app; the
               │                 referrer carries m, a and the proof, so nothing is lost)
               └─ sheet STAYS OPEN throughout
```

The user does not leave the merchant app on iOS at any point before the wallet itself
opens.

### How the sheet reaches a proof

An earlier draft of this section called for a `signInstallProof` member on `FrakClient` plus
`merchantId`/`clientId` fields on `SharingSession`. That is not what landed, and the
substitute is better: a single `installPageURL()` / `installPageUrl()` returning the whole
URL. Proof minting, `ProofOp`, `ProofCodec` and URL construction all stay `internal` to the
core module, the UI module gains one call instead of three, and no signing oracle appears on
the public surface.

It carries a **default body** (`= null`, and a protocol-extension `nil` on iOS) so it does
not repeat the mistake `06-abi-decisions.md` records: `preloadSharing` was reverted off this
same interface because an abstract member is an unconditional compile-time break for every
merchant fake. Both hand-written `FakeFrakClient`s deliberately leave it unimplemented, which
is what pins the default in place. See `06` for the rest, including the fact that this is a
third instance of its open Q2.

### Why mint the proof at the install tap

Three reasons, and freshness is the least of them:

1. Most sheets never reach the install step, so the signature is skipped entirely.
2. A Secure Enclave signature can fail. Minting it during sheet preparation would let an
   identity failure block a sharing sheet that has nothing to do with identity.
3. The proof's `ts` is what the backend's 30-day `frak-install-v1` window is measured from,
   so a proof minted at the moment it is used has the longest possible useful life.

### `SKOverlay`, on iOS

`SKOverlay.AppConfiguration(appIdentifier:position:)` presented on the sheet's
`UIWindowScene`. It renders **Install**, **Open** or **Update** by itself according to the
device's actual state, and installs in place without leaving the app.

That means it also **replaces `isFrakAppInstalled()`** for this flow: the state it renders
*is* the answer, obtained from StoreKit rather than from a probe the merchant has to
opt into via `Info.plist`. W1 stops existing rather than being fixed.

`isFrakAppInstalled()` stays on the public API — merchants may reasonably ask — but the
install flow must not depend on it.

### The pasteboard entry, and why it carries the code and not a URL

The wallet already reads the pasteboard, and the shape of that read is what constrains this
whole design. The wallet's install screen is a **six-character field** with an auto-paste
suggestion. The code is 6 characters from a 31-symbol alphabet with the ambiguous ones
(`0/O`, `1/I/L`) removed — `services/backend/src/utils/sixDigitCode.ts` — with a **72-hour**
TTL.

That field is the point. When the pasteboard holds a short code, iOS offers it in the
QuickType bar above the keyboard, and the user tapping that suggestion **is** the consent
— no permission prompt appears. It is a one-tap, promptless path.

A tempting alternative was considered and is wrong: putting the whole install URL
(`…/install?m=&a=#p=`) on the pasteboard instead, Branch-NativeLink style, so the SDK never
has to learn the code. It removes a contract change and the SDK already holds every piece
of that URL. But there is no field for a URL to land in, so the wallet would have to read
the pasteboard **programmatically on launch** — which is precisely the iOS 16 prompt
(*"Frak Wallet pasted from …"*) that we are trying not to show. It trades a promptless
flow for a prompted one to save a contract change. Rejected.

So the SDK writes the code, and it writes it rather than the page because the page cannot
set the two options that matter:

- **`.expirationDate`** — tracking the backend's own `expiresAt` (72h) so the entry does not
  outlive the code it holds.
- **`.localOnly`** — without it, Universal Clipboard syncs the install code to the user's
  Mac and iPad. Not optional.

Writing to the pasteboard needs no prompt and no user gesture, so the SDK does it as soon
as the code arrives — before the user can reach the download button.

The visible code remains the contract; auto-paste is the optimisation on top. A user who
ignores or misses the suggestion types six characters instead of hitting a dead end.

### Install code ownership

The page generates it (`useGenerateInstallCode`), displays it, and hands it back to the
host over the existing return channel. The SDK's only job is the pasteboard write.

The alternative — the SDK calling `install-code/generate` itself — was rejected: it would
give two callers minting two different codes for the same `(merchantId, anonymousId)` pair,
and it would duplicate the page's analytics (`install_code_displayed`,
`install_code_generation_failed`) in native code.

---

## 6. Changes required

### 6.1 Hosted-page contract

`apps/wallet/app/module/common/utils/buildHostResultUrl.ts` currently declares:

```ts
export type HostResultAction = "install" | "dismiss" | "shareAgain" | "error";
```

This design adds one action carrying a **value**, which no existing action does:

```
<returnScheme>://result?action=code&value=<installCode>&exp=<epochSeconds>&sid=<sid>
```

**RESOLVED — option 1 was taken: `01-platform-changes.md` §1.2 was amended.**

The rule used to read "never put a capability value on the return URL". It now permits one
**when the navigation is provably intra-web-view** — cancelled by the SDK's own navigation
policy and therefore never handed to the OS — and states that condition as the thing to
re-check rather than a blanket allowance. `action=code` is the only user, and the amendment
says so.

Why that condition holds: both platforms stop the navigation dead (`decisionHandler(.cancel)`
on iOS, `return true` from `shouldOverrideUrlLoading` on Android), external URLs leave only
through the SDK's own `openExternally`, which is http(s)-only, and the sub-frame guard runs
*above* the return-scheme branch on both — so an embedded iframe never reaches the dispatch.
iOS now cancels the return scheme from a sub-frame explicitly rather than relying on WebKit
declining to launch an unregistered scheme, so the invariant is the code's to keep.

Two things the amendment does **not** make safe, and which are handled here instead:

- **A gesture is required.** §1.2 already said "navigate only in response to a user gesture",
  and an effect firing on query settle would have broken it for the one action carrying a
  capability. The page hands the code over from the Copy button and from the Download
  button — the two moments it matters — and never from an effect. That also removes a
  browser-only failure mode: `assign()` to a custom scheme raises the OS "open in app?"
  sheet, whose blur/refocus would retrigger an effect keyed on a refetched code.
- **One code per visit.** `useGenerateInstallCode` mints a *new* row on every fetch — there
  is no upsert on `(merchantId, anonymousId)` — so a refetch would leave the page showing one
  code while the pasteboard held another. It is now `staleTime: Infinity`.

What a crafted `/install?returnScheme=frak-com.evil` URL opened in a real browser gets:
a code bound to the `m`/`a` the attacker put in the URL themselves, from an endpoint that is
unauthenticated anyway. No victim secret is disclosed. What it does buy is a gesture-gated
`frak-*` app launch from a wallet-origin page; `frak-*` is an unclaimed namespace because the
SDK registers no OS scheme. Worth knowing, not worth blocking on.

Mechanically:

- `HostResultAction` gains `"code"`; `buildHostResultUrl` serialises `value`/`exp` **only**
  for that action, so no other outcome can carry a capability by accident.
- `sentActions` is keyed by `action + value`, not action alone: a regenerated code must reach
  the host or the pasteboard keeps one the page is no longer showing.
- `exp` travels as epoch seconds. The backend returns ISO-8601, so the page converts, and
  both platforms parse it as a 64-bit integer — iOS deliberately not as a `Double`, which
  would accept `NaN` where Kotlin's `toLongOrNull` does not.
- `/install` gained `returnScheme` and `sid`. `returnScheme` goes through the same
  `sanitizeReturnScheme` the sharing route uses.


### 6.2 `apps/wallet` deep-link router

- `extractSearchParams` (`deepLink.ts`) forwards `p`.
- `routeResolvers.install` forwards `p` into the route's search.
- `/install` reads the proof from **the fragment first, then the search param**
  (`resolveInstallProof`). Fragment-first rather than search-first keeps every existing link
  byte-identical in behaviour, and if a URL ever carries both, the carrier that could not
  have leaked through a redirect or an access log wins.

On accepting both: the fragment is better — never sent to the server, never in a `Referer`,
never in an access log, which is exactly why `install.tsx` reads it there today. But the
fragment cannot survive the in-app navigation the router performs, and the Play referrer is
a referrer string rather than a URL, so it has no fragment to use at all.

Rule: **accept both; emit the fragment wherever the URL could be copied, shared or logged,
and the query param only for SDK-to-app handoffs that provably cannot carry a fragment.**
After rollout 3 the proof becomes a sufficient credential, so this distinction stops being
hygiene and starts being a leak surface — `ensure.ts:97` already flags it.

### 6.3 iOS SDK

- `onPageAction(.install)`: load `/install` in the existing web view, and **do not**
  `close()` the sheet. The proof is minted by `installPageURL()` inside the core module, not
  here — see "How the sheet reaches a proof" in §5.
- Hide the Copy/Share footer once the install page is showing. Both act on the product link
  and reload `/sharing`, which would discard the install page and the proof minted for it.
- Intercept the App Store URL in the navigation policy and present `SKOverlay` instead of
  `UIApplication.open`. The interception point already exists — `openExternally` and the
  scheme allowlist.
- Handle the new `code` action: pasteboard write with `expirationDate` + `localOnly`.
- Move `track(.sharing())` after the chooser in `share()` and `fallBack()`, gated on the
  result. Leave `copy()` alone.
- Delete the `isFrakAppInstalled()` gate from `openFrakApp()` regardless (W1) — it is a
  one-line fix and should not wait for the rest of this.

### 6.4 Android SDK

Structurally mirrored, with two justified divergences:

- **No `SKOverlay` equivalent exists.** The Play Store always foregrounds the Play app.
  This is unavoidable, and it does not matter: the referrer carries `merchantId`,
  `anonymousId` and the proof deterministically.
- The install code is still worth writing to the clipboard as a fallback, but it is not
  load-bearing on Android.

Everything else — navigating to `/install`, minting the proof at the moment of the tap
rather than when the sheet opens, the tracking correction — is identical.

### 6.5 Not in scope

- `ActivityResultLauncher` on Android, which would make the share result honest. Public API
  change; recorded in `07-audit-round-2.md`.
- Any change to how the anonymous id itself is derived or stored.
- `frak-sso-v1`, which no native path emits and no native path needs yet.

---

## 7. Open questions

1. ~~Does `action=code` get to exist at all?~~ **Settled**: §1.2 was amended to permit a
   capability value on a provably intra-web-view channel, and `action=code` ships. See §6.1.
2. **`SKOverlay` vs `SKStoreProductViewController`.** SKOverlay is lighter, does the
   install in place, and reports installed/not-installed for free; it is a bottom bar with
   no styling control. `SKStoreProductViewController` is a full modal store page. This doc
   assumes SKOverlay.
3. **Should `installStarted` become a tracked interaction** rather than only a merchant
   callback? Today `report(.installStarted)` notifies the merchant and records nothing.
4. **Ordering against rollout 3.** iOS emits no proof today, so rollout 3 cannot ship
   before §6.2 and §6.3 land. Someone needs to own that sequencing.

---

## 8. Status

All five items have **landed**.

1. **W1** — probe gate deleted, on both platforms rather than just iOS. **Landed.**
2. **W5** — the tracking correction, both platforms. **Landed.**
3. **§6.2** — the router forwards `p`, `/install` resolves fragment-first. **Landed**, and it
   is the only part of this with executed test coverage.
4. **§6.3 + §6.4** — the flow itself, mirrored. **Landed.**
5. **§6.1** — the `code` action and the pasteboard write. **Blocked** on open question 1.
   Everything above ships without it; the user reads the code off the screen instead.

**What "landed" does and does not mean.** The web half (item 3) was executed: `bun`/`vitest`
run in this environment and those tests pass. The native half was **not compiled and not
run** — no Swift, Kotlin, Gradle or Xcode toolchain exists where this was written, so every
claim about the iOS and Android code is static reading. That includes the assertion that the
two `FakeFrakClient`s prove the defaulted member: it is a compile-time property, and nothing
here compiled it. `bun run --cwd sdk/ios test` and `bun run --cwd sdk/android check` are the
real gate.
