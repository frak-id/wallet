# Native SDK — the sharing sheet and the install handoff

The one surface that needs a web view, the channel between it and native code, and what
happens after a share. Implemented on both platforms; the design and its traps are here
because none of it has run on a device.

## 1. The flow

```
merchant surface (product page / post-purchase / event)
 → "Share and earn {REWARD}"          ← copy + reward from the SDK, {REWARD} pre-substituted
 → sheet opens
    ┌──────────────────────────────┐
    │             ▂▂▂              │  ← NATIVE: a drag handle, over the page
    │  hosted /sharing?native=1    │  ← reward card, products, how-it-works, FAQ
    │  [ Share ]        [ Copy ]   │  ← the PAGE's own footer, performed natively
    └──────────────────────────────┘
 → user shares → page navigates `<scheme>://result?action=share`
 → SDK raises the real OS chooser, then fires Interaction.Sharing (after it, see §4)
 → SDK reloads the page with &confirmed=1                    ← load-bearing, see below
 → page shows PostShareConfirmation: "create your wallet to get your rewards"
 → Install CTA → <scheme>://result?action=install → back to native
      ├─ Frak app installed → frakwallet://install?m=&a= → linked, no code, no store
      └─ not installed      → /install in the SAME web view (§4)
```

Two non-obvious requirements, each of which silently kills the funnel:

1. **`&confirmed=1` is load-bearing for a share, and must NOT be sent for a copy.** The page
   renders `PostShareConfirmation` off its own handlers, which now do fire under `native=1` —
   but only the SDK learns whether an OS chooser actually came up, so a share still needs the
   inbound signal or the user shares and the page just sits there. A copy is the opposite: the
   page has already toasted and moved itself on by the time the SDK is told, and reloading
   would tear the document down mid-toast, leaving the copy with no feedback at all. The
   sheet has none of its own to fall back on any more.
2. **The SDK owns 100 % of sharing tracking.** `apps/wallet/app/routes/sharing.tsx` wires
   only `onSuccess`, never `onShared`, so the route never emits `create_referral_link` —
   not even for the existing Tauri consumer. An implementer who assumes otherwise ships
   silently untracked shares.

### Why the page is hosted

`packages/wallet-shared/…/SharingPage` already has three consumers; two native forks make
five, of which two cannot share code. Behind it sit ~45 i18n keys across en/fr with
`_tiered`/`_min`/`_lockup` context variants, legal copy, a 6-item FAQ and non-trivial tier
math in `RewardBreakdown` — every change would become a three-implementation edit gated on
merchant app-store release cycles. And this is Frak's primary conversion surface, where
iteration speed matters most.

**This is a v2 decision, not permanent.** The public API returns a `SharingResult` and never
leaks the web view, so going native later is a non-breaking internal change.

### Lifecycle contract

| Situation | Behaviour |
|---|---|
| Re-entrancy | second call while one is active → `alreadyPresenting`. Never queue, never silently cancel |
| Terminal result | a session can be shared *then* install-clicked *then* dismissed. Result is the **most significant** event (install > shared/copied > dismissed) |
| Dismiss mid-load | cancel the load, return dismissed. Queued interactions unaffected |
| Web view fails to load | tier-3 fallback: fire the native share sheet with the locally-built link. Never show a broken sheet |
| Rotation | Android: state survives via `SavedStateHandle`; never re-create the web view |
| Process death | the continuation is **gone**. Android can kill the host while the OS chooser is up. Tracking is best-effort by design |

## 2. The web view ↔ native channel

**Inbound is query parameters delivered by a full page load.** `SharingPageURL.build`
assembles `/sharing?native=1&…` with `merchantId`, `clientId`, `returnScheme`, `sid`, the
SDK version and the optional `appName`, `logoUrl`, `link`, `products`, `r`. Every
subsequent state change is a fresh `loadUrl` of a rebuilt URL: `confirm()` reloads with
`&confirmed=1`, `shareAgain` reloads without it. `copy` deliberately reloads nothing (§1),
and so does a failed *install* page, which reloads `&confirmed=1` instead — its own controls
are the only ones left once the sharing page's footer is off screen.

**Outbound is an intercepted navigation.** The page calls
`window.location.assign("<returnScheme>://result?action=…&sid=…")`; the SDK catches it in
the navigation policy and stops it — `decisionHandler(.cancel)` on iOS, `return true` from
`shouldOverrideUrlLoading` on Android. Actions: `install`, `dismiss`, `shareAgain`, `code`,
`error`, `share`, `copy`. The last two are asks rather than reports: the page draws both
buttons, and the host performs them because `navigator.share` does not exist in an Android
WebView and the interaction a share earns has to be signed by the SDK keypair. Unlike every
other action they are repeatable within one page load, so `sendHostResult` exempts them from
its dedupe.

**There is no JavaScript bridge on either platform**, deliberately.

### What the channel gets right

- **Frame-scoped, guard first.** The sub-frame check sits *above* the `returnScheme` branch
  on both platforms, so an embedded iframe navigating to `frak-x://result?action=install`
  never reaches the dispatch. Pinned on Android by `SharingWebViewClientTest`.
- **No OS registration.** No `CFBundleURLSchemes`, no intent filter, no exported
  redirect-catcher Activity. Interception is in-process, ahead of any OS routing — which
  removes the hijack surface entirely for the in-app path.
- **Zero callable surface.** A fixed enum of five actions plus a session token, not an API
  the page can enumerate.
- **Degrades cleanly.** `sendHostResult` returns `false` with no scheme and the route falls
  through to its browser behaviour, so one code path serves both audiences.
- **Symmetric.** The two navigation policies are near line-for-line equivalents, which is
  much harder to hold with two different bridge APIs.

### What is actually wrong with it

- **The inbound reload is the real defect.** `confirmed=1` discards React state, re-runs the
  route loaders, re-fetches merchant config and the reward, and repaints — at the exact
  moment the user is waiting for a confirmation. **If one thing here gets fixed, this is
  it:** push the state in with `evaluateJavaScript` into an already-origin-pinned page,
  feature-detected, falling back to the reload. That is a push into content the SDK already
  vetted, not an API accepted out of it, so it needs none of the origin machinery a
  bidirectional bridge does.
- Outbound is fire-and-forget: no acknowledgement, no reply.
- `sentActions` — a module-global `Set` in `buildHostResultUrl.ts` — exists because
  navigations are not idempotent and carry no correlation; it is a symptom, not a feature.
  It is keyed by `action + value`, because a regenerated code must still reach the host.
- Cancelled navigations surface as `NSURLErrorCancelled` / WebKit error 102, so the SDK
  carries an `isCancellation()` filter to stop a reported result being read as a failed
  load. Real complexity caused entirely by using navigation as a signal.

### Do not add a bridge yet

`WebViewCompat.addWebMessageListener` is the right Android mechanism if it ever happens
(origin-allowlisted, OWASP-recommended) but it lives in `androidx.webkit` — the first
non-Compose runtime dependency in a zero-dependency module — depends on the *WebView
provider* version rather than the API level, so it needs a runtime feature check and a
fallback, which keeps the navigation channel alive anyway. On iOS,
`WKScriptMessageHandler` is **not** origin-scoped: you re-derive `isMainFrame` and
`securityOrigin` by hand — exactly the "adding a bridge later means re-deriving the origin
checks" warning, which turned out correct. Never `addJavascriptInterface` (it is exposed to
every frame including iframes, with no origin control). If it is ever migrated,
`addWebMessageListener` must be registered **before** `loadUrl`, with
`allowedOriginRules` pinned to the wallet origin.

**Tripwire — migrate when either becomes true:** the outbound channel needs to carry more
than one value beyond `action`/`sid`, or the page needs a *reply*. One value is a query
string; three is a bridge wearing a query string.

### Hardening rules

- Pin navigation to the wallet origin; open external links in the system browser, and only
  `http(s)` — this is what stops a return-scheme URL with an unexpected host reaching the OS.
- Disable file access and universal access from file URLs; block mixed content.
- No `WKUIDelegate` / `WebChromeClient`, so `window.open` cannot escape either.
- **Known contradiction:** the rule says use a non-persistent data store; iOS sets
  `websiteDataStore = .default()` on purpose, because tier-2 offline is a cache-only retry
  and an ephemeral store has no cache to retry from. Android has no per-WebView store at
  all and disables third-party cookies instead. One of the two should change.

`action=code` carrying a capability value is safe **only** because the navigation is
provably intra-web-view: the return-scheme branch ends in cancel on every reachable path
including sub-frames (iOS cancels it explicitly rather than relying on WebKit declining to
launch an unregistered scheme), the sub-frame guard runs above the dispatch,
`openExternally` is http(s)-only, and there is no `window.open` escape. If any of those four
is relaxed, `action=code` has to go with it. Two further conditions carry it: the page hands
the code over **from a gesture, never from an effect** (an effect keyed on a refetched code
would retrigger on the blur/refocus of the OS "open in app?" sheet in a real browser), and
`sentActions` is keyed by `action + value`.

The accepted residual, so it is not re-opened: a crafted `/install?returnScheme=frak-com.evil`
opened in a real browser yields a code bound to the `m`/`a` the attacker supplied
themselves, from an endpoint that is unauthenticated anyway — no victim secret is disclosed.
What it buys is a gesture-gated launch into the `frak-*` namespace, which is unclaimed
because the SDK registers no OS scheme. Worth knowing, not worth blocking on.

## 3. Performance

The architecture hides most latency structurally: the sheet is native, so it animates in
instantly with the real header, buttons and a skeleton while the web view loads *during*
the ~300 ms presentation.

| # | Lever | Effect |
|---|---|---|
| 1 | Seeded initial state (`?r=`) | removes a round-trip from the critical path — the page otherwise mounts, *then* fetches the reward, *then* renders the headline |
| 2 | Warm `WebView`/`WKWebView` | offscreen instance loaded ahead of the tap. ~30–60 MB resident on iOS, so gated behind `preloadSharing` (default off) |
| 3 | Preconnect | shipped, emitted into `<head>` at build time |
| 4 | Service worker | **dropped** — Android-only, second-visit-only, and the HTML shell is `no-store` by design (`01` §5) |

| | Target |
|---|---|
| p75 | < 400 ms to content |
| p95 | < 1 s |
| fallback | > 1.5 s → skip the page, fire the native share sheet directly |

> These targets were set assuming Chrome Custom Tabs with `mayLaunchUrl()` pre-rendering.
> **They must be re-measured on the `WebView` path, on a low-end Android device, before
> being treated as commitments** — and that measurement is the trigger for going native on
> the sharing screen, so it gates an architectural decision, not just a number.

**Custom Tabs cannot implement this design at all**: a separate browser Activity cannot be
embedded in a bottom sheet, cannot lose the browser toolbar, breaks the `confirmed=1`
reload, gives only coarse navigation callbacks and cannot do origin-pinned interception —
which is also what would catch the page's own `share`/`copy`, so the OS chooser would be out
of reach too. **Partial Custom Tabs** (`setInitialActivityHeightPx`) are the next thing
proposed and are also rejected: a sheet-*shaped* browser, still with Chrome chrome. The same
note is why `CustomTabsClient.mayLaunchUrl()` is unavailable to us as a warm-up lever.

**Offline** has three tiers, and the key property is that `buildLink()` is 100 % local
computation — `merchantId` + `clientId` + `now/1000` through the codec, no network. So
offline sharing *works*: native share sheet, correct link, interaction queued and flushed on
reconnect, attribution preserved. Only the reward pitch and FAQ are lost, which is the
correct thing to lose.

## 4. The install handoff

The whole design serves one sequence: the user shares, is invited to install the wallet, and
the wallet knows which merchant and which anonymous id they came from. Step 3 should cost
the user as little as possible, which means **staying inside the merchant app for as long as
the platform allows**.

The anonymous id is derived from a key in the Secure Enclave / AndroidKeyStore, so it cannot
be re-derived by a different app. It has to be *carried* across the install boundary:

| Platform | Mechanism | Determinism |
|---|---|---|
| Android | Play Store URL carrying an install referrer with `m`, `a` and the proof | **deterministic** — the referrer survives the store round trip exactly |
| iOS | install code + pasteboard + `SKOverlay` | user-mediated, deterministic when used |

Apple has never shipped an install referrer. The industry answers and why not: probabilistic
fingerprinting (Adjust/AppsFlyer/Branch) decays from ~0.85 confidence under an hour to ~0.40
by 72 hours, is eroded by iCloud Private Relay, needs a server-side click record for every
user, and is exactly the cross-context correlation we do not want to do; IDFV is
vendor-scoped so it only helps re-engagement. Frak has an advantage the generic case does
not — the user is in a session with a merchant we already resolved and the SDK holds a
signing key — so a user-mediated deterministic handoff is possible with no fingerprinting,
no ATT prompt and no IP correlation. It costs one interaction. Good trade.

### Target flow

```
returnToHost("install")
  ├─ HOST mints the proof NOW            signProof(.install, merchantId)
  ├─ HOST loads <wallet>/install?m=&a=#p=<proof> in the SAME web view
  │    └─ InstallCodeView: reward, code, download button
  │         ├─ on Copy or Download (a gesture, never an effect) the page hands the code
  │         │    back: returnToHost("code", value, exp) → HOST writes the pasteboard
  │         └─ download
  │              ├─ iOS: HOST intercepts → SKOverlay → installs in place
  │              └─ Android: Play URL with referrer (leaves the app; nothing is lost)
  └─ the sheet STAYS OPEN throughout
```

`returnToHost` stays because **the page has no signing key** — it cannot build an install URL
carrying a proof. It reports intent; the host decides.

**The sheet reaches a proof through one member**, `installPageUrl` / `installPageURL(returnScheme:sessionId:)`,
returning the whole URL. Proof minting, `ProofOp`, `ProofCodec` and URL construction all stay
`internal`, the UI module gains one call instead of three, and no signing oracle appears on
the public surface.

**Mint at the install tap**, not at sheet preparation: most sheets never reach the install
step; a Secure Enclave signature can fail and must not be able to block a sharing sheet; and
the proof's `ts` is what the backend's 30-day window measures from.

### iOS specifics

- **`SKOverlay`, not a store URL.** Presented on the sheet's `UIWindowScene`, it renders
  Install / Open / Update by itself and installs in place. That means it also *replaces*
  `isFrakAppInstalled()` for this flow — the state it renders **is** the answer, from
  StoreKit rather than a probe the merchant has to opt into via `LSApplicationQueriesSchemes`.
  (`isFrakAppInstalled()` stays public; the install flow must not depend on it.) The
  alternative, `SKStoreProductViewController`, has a **known field failure in exactly this
  design**: presenting it while a `UISheetPresentationController` is already up gives
  blank/black content or never fires `productViewControllerDidFinish`, and our sheet *is*
  one. Anyone revisiting the open question below has to dismiss the sheet first, present
  from the top-most view controller in the completion block, and add a load timeout falling
  back to the plain App Store URL.
- **The Copy/Share footer is the page's own, and it hides itself on the install page.** Both
  act on the product link and reload `/sharing`, which would discard the install page *and
  the proof minted for it* — the install page simply does not render them. A native
  re-implementation of the same two buttons is what this replaced: two type scales, two
  button shapes and two surfaces stacked in one sheet, and a `showingInstallPage` flag on
  both platforms to keep them in step with a page that already knew.
- **Never read the pasteboard.** Reading raises the "pasted from…" banner and, since iOS 16,
  a permission alert. **Writing triggers nothing**, including with `expirationDate`.
- **The pasteboard carries the code, not a URL.** The wallet's install screen is a
  six-character field, and a short code in the pasteboard is offered in the QuickType bar —
  the user tapping the suggestion *is* the consent, with no prompt. Putting the whole
  `…/install?m=&a=#p=` URL there instead (Branch NativeLink style) has no field to land in,
  so the wallet would have to read the pasteboard programmatically on launch, which is
  precisely the prompt we are avoiding. Rejected.
- The write sets `.expirationDate` (tracking the backend's 72 h `expiresAt`) and
  `.localOnly` — without the latter, Universal Clipboard syncs the install code to the
  user's Mac and iPad. Not optional.
- The QuickType suggestion is **best-effort, not an API contract**: undocumented freshness
  window, suppressed by third-party keyboards or disabled predictive text. Manual entry of
  the visible code is the real floor; auto-paste is the optimisation on top.
- The code is generated by the *page* (`useGenerateInstallCode`), displayed, and handed back.
  The SDK's only job is the pasteboard write. The SDK calling `install-code/generate` itself
  was rejected: two callers would mint two codes for one `(merchantId, anonymousId)` pair and
  duplicate the page's analytics.
- **`staleTime: Infinity` on the code query.** `useGenerateInstallCode` mints a new row per
  fetch — there is no upsert — so a refetch would leave the page showing one code while the
  pasteboard held another.

### Android specifics

Structurally mirrored, with two justified divergences: there is **no `SKOverlay` equivalent**
— Play always foregrounds the Play app, which does not matter because the referrer carries
everything deterministically — and the clipboard write is a fallback rather than
load-bearing. Note the referrer is *emitted* only; there is no
`com.android.installreferrer` read-back dependency in the SDK.

### The proof path through `apps/wallet`

`extractSearchParams` forwards `p`, `routeResolvers.install` forwards it into the route, and
`/install` resolves the proof **fragment first, then search param**. Fragment-first keeps
every existing link byte-identical, and if both are present the carrier that could not have
leaked through a redirect or an access log wins.

Rule: **accept both; emit the fragment wherever the URL could be copied, shared or logged,
and the query param only for SDK-to-app handoffs that provably cannot carry a fragment** (an
in-app router navigation drops the fragment; a Play referrer string has none). After rollout
3 the proof becomes a sufficient credential, so this stops being hygiene and starts being a
leak surface.

### Tracking is recorded on success, not on intent

The reference implementation splits two concerns native had collapsed into one:
`sharing_link_started` is an **analytics** event fired before the chooser to capture intent,
while `sharing_link_shared` / `onShared` — wired to the reward-bearing backend interaction —
fire only after a successful share. Native has only the reward-bearing one, and it used to
fire on intent, so open-chooser-then-cancel counted as a share.

| Entry point | Correct behaviour |
|---|---|
| `share()` | **after the chooser, gated on the result** |
| tier-3 `fallBack()` | **after, gated on the result** |
| `copy()` | before — unchanged. A copy has no completion to wait for |

**Android caveat, with precedent.** `NativeShare.share` returns whether the chooser
*launched*, not whether the user completed a share; telling them apart needs
`ActivityResultLauncher`, which needs `ComponentActivity` and is a public API change. The
wallet's own Tauri plugin already documents exactly this asymmetry. Gate on the returned flag
on both platforms and accept that Android's is optimistic; it becomes correct for free if
`ActivityResultLauncher` ever lands.

## 5. Status

Landed on both platforms: the probe gate deleted from `openFrakApp` (attempt-and-fall-back,
so a merchant's missing `LSApplicationQueriesSchemes` no longer turns into a dead feature);
the tracking correction above; the router's `p` forwarding and fragment-first resolution; the
in-sheet `/install` navigation with `SKOverlay` on iOS and the referrer URL on Android; and
the `code` action with the pasteboard write.

**None of it has run on a device**, and only the web half has executed test coverage. Two
known open defects live in this code path — the uncancelled load deadline raising a second
chooser, and iOS `release()` not cancelling the prepare task (whose obvious fix is wrong,
because `.onDisappear` also fires when `UIActivityViewController` covers the sheet). Both are
in [`06-open-findings.md`](./06-open-findings.md).

Open questions:

1. **`SKOverlay` vs `SKStoreProductViewController`.** SKOverlay is lighter, installs in
   place and reports state for free, but is a bottom bar with no styling control. This
   design assumes SKOverlay.
2. **Should `installStarted` become a tracked interaction** rather than only a merchant
   callback? Today it notifies and records nothing.
3. **Ordering against `ROLLOUT-STEP-3`.** iOS emitted no proof until this landed, so the
   enforcement flip must not ship before a store binary carrying it. Needs an owner.
