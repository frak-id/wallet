# Native SDK — WebView ↔ native transport

How state gets into the sharing sheet's web view and how outcomes get back out, why it is
shaped the way it is, and what would have to be true to change it.

Written because the current channel *looks* like a hack. It is one. The question this doc
answers is whether it is the right one, and the answer is mostly yes — with one part that is
genuinely wrong and worth fixing.

---

## 1. What exists today

### Inbound: query parameters, delivered by a full page load

`SharingPageURL.build` / `SharingPageUrl.build` assemble a `/sharing?native=1&…` URL carrying
`merchantId`, `clientId`, `returnScheme`, `sid`, the SDK version, and the optional
`appName`, `logoUrl`, `link`, `products`, `r`.

There is **no other inbound channel**. Every subsequent state change is a fresh
`webView.load(...)` / `loadUrl(...)` of a rebuilt URL:

- `confirm()` reloads with `&confirmed=1` after a share or copy;
- the `shareAgain` action reloads without it.

### Outbound: an intercepted navigation

The page calls `window.location.assign("<returnScheme>://result?action=…&sid=…")`. The SDK
catches it in the navigation policy and stops it:

- iOS `SharingWebView.swift` — `decisionHandler(.cancel)`
- Android `SharingWebView.kt` — `return true` from `shouldOverrideUrlLoading`

Actions are `install`, `dismiss`, `shareAgain`, `error`. `shared` and `copied` are absent by
design: the native footer owns those buttons and already knows.

**There is no JavaScript bridge on either platform.** The only two matches for
`addJavascriptInterface` / `WKScriptMessageHandler` / `evaluateJavaScript` in either SDK's
*source* are both comments saying there isn't one. (Gitignored `build/` output contains the
annotation, from AGP's own default ProGuard files — not SDK code.)

---

## 2. What it gets right

Worth stating plainly, because "hacky" and "wrong" are different claims and this design is
the first without being the second.

**It is frame-scoped, and the guard runs first.** On both platforms the sub-frame check sits
*above* the `returnScheme` branch, so an embedded iframe navigating to
`frak-x://result?action=install` never reaches the dispatch. This is the property that
usually goes wrong with scheme-based signalling, and there is a test pinning it on Android
(`SharingWebViewClientTest`, `mainFrame = false` → no action).

**It needs no OS registration on either platform.** No `CFBundleURLSchemes`, no intent
filter, no exported redirect-catcher Activity. The interception is in-process, ahead of any
OS routing. That removes both integration work and — for the in-app path — the hijack
surface entirely.

**It exposes zero callable surface.** A bridge is an API the page can enumerate and call.
This is a fixed enum of four values plus a session token. There is nothing to abuse beyond
sending an action the host already handles.

**It degrades cleanly for the web.** `sendHostResult` returns `false` when there is no
scheme, and `sharing.tsx` falls through to its browser behaviour. The same route serves both
audiences from one code path.

**It is genuinely symmetric.** The iOS and Android navigation policies are near
line-for-line equivalents, which is the house rule for this SDK and is much harder to hold
with two different bridge APIs.

---

## 3. What is actually wrong with it

Not the direction people expect.

### 3.1 The inbound channel is a full page reload — this is the real defect

`confirmed=1` is delivered by reloading the entire document. That discards React state,
re-runs the route's loaders, re-fetches merchant config and the estimated reward, and
repaints — every time the user shares or copies.

It is the most expensive operation in the sheet, it happens at the exact moment the user is
waiting to see a confirmation, and it is invisible in the framing of "the custom scheme is
hacky". **If only one thing here gets fixed, it should be this one.**

### 3.2 Outbound is fire-and-forget

No return value, no acknowledgement. The page cannot know the host acted, and the host
cannot answer a question. Every outcome is a one-way notification.

### 3.3 `sentActions` is a symptom

`buildHostResultUrl.ts` keeps a module-global `Set<HostResultAction>` so no action fires
twice, because route guards re-run whenever the router resolves the location again and
`validateSearch` rewrites the URL on load. A navigation is not idempotent and carries no
correlation, so a global set compensates. That is a workaround for the channel's shape, not
a feature.

### 3.4 Cancelled navigations pollute failure detection

A `.cancel` decision surfaces as `NSURLErrorCancelled` or
`WebKitErrorFrameLoadInterruptedByPolicyChange` (domain `WebKitErrorDomain`, code 102). The
SDK carries an `isCancellation()` filter specifically so that a page reporting a result is
not read as a failed load, which would fire the tier-3 fallback every time. Real complexity,
caused entirely by using navigation as a signal.

### 3.5 Payloads are query strings

Fine for `action`. Adequate for one more value. Not a structured channel.

---

## 4. The alternatives, and what they actually cost

| Mechanism | Android | iOS |
|---|---|---|
| **Origin-scoped messaging** | `WebViewCompat.addWebMessageListener` — Google's own comparison marks it *Recommended: Yes, Security: Highest (allowlist-based)*; OWASP MASTG-BEST-0035 says prefer it | `WKScriptMessageHandlerWithReply` (iOS 14+), bidirectional with promises |
| **Legacy bridge** | `addJavascriptInterface` — exposed to *every frame including iframes*, no origin control. Avoid. | — |
| **Request/response** | `shouldInterceptRequest` | `WKURLSchemeHandler` (custom schemes only — WebKit forbids registering `https`) |
| **Push only** | `evaluateJavascript` | `evaluateJavaScript` |

Four things make a bridge migration more expensive than it looks here:

1. **iOS message handlers are not origin-scoped.** `WKScriptMessageHandler` fires for any
   frame; you must check `message.frameInfo.securityOrigin` and `isMainFrame` yourself —
   re-deriving the guard that already exists in the navigation policy.
   `02-native-sdk-overview.md` §7 predicted precisely this: *"Adding a bridge later means
   re-deriving the origin checks the `apps/listener` postMessage layer needed."* That
   warning was correct.
2. **`addWebMessageListener` is not a platform API.** It lives in `androidx.webkit`, which
   `frak-sdk-ui` does not currently depend on (verified: zero references anywhere in the
   Android SDK), and its availability depends on the **WebView provider version**, not the
   API level — so it needs `WebViewFeature.isFeatureSupported` at runtime *and* a fallback.
   The navigation channel would have to stay anyway.
3. **A new dependency on a zero-dependency module.** `frak-sdk-ui` currently pulls only
   Compose. `androidx.webkit` would be the first non-Compose runtime dependency, in a
   library that merges into merchant apps.
4. **The page is shared with the web.** Any mechanism must be feature-detected and optional,
   because the same route serves browsers. Not a blocker — `window.webkit?.messageHandlers`
   is as detectable as `if (!scheme)` — but it means the web path can never *rely* on it.

---

## 5. Recommendation

**Fix inbound. Leave outbound alone. Do not add a bridge yet.**

### 5.1 Replace the `confirmed=1` reload with a push

`evaluateJavaScript` / `evaluateJavascript` into an already-origin-pinned page. This is a
push *into* content the SDK has already vetted, not an API surface accepted *out* of it, so
it does not need the origin machinery a bidirectional bridge does — the navigation policy
already guarantees what is loaded.

It deletes the reload, which is the one defect users can feel. It needs a small addition on
the page (a global the SDK can call, feature-detected so the web path is unaffected), and it
should fall back to the reload when the call fails.

### 5.2 Keep the outbound navigation channel

It is frame-guarded, symmetric, OS-registration-free, degrades cleanly, and exposes nothing
callable. A bridge buys structured payloads and return values, and costs a new Android
dependency, a runtime feature check, a fallback path that keeps the current channel alive
anyway, and hand-rolled origin checks on iOS.

### 5.3 The tripwire

Migrate when **either** of these becomes true:

- the outbound channel needs to carry more than one value beyond `action` and `sid`; or
- the page needs a *reply* — anything where it must know what the host decided.

One value is a query string. Three is a bridge wearing a query string.

### 5.4 If it is ever migrated

- Android: `addWebMessageListener` with a strict `allowedOriginRules` set to the wallet
  origin, registered **before** `loadUrl`, plus `WebViewFeature.isFeatureSupported` and the
  navigation channel retained as fallback.
- iOS: `WKScriptMessageHandlerWithReply`, checking `frameInfo.isMainFrame` and
  `frameInfo.securityOrigin` on every message.
- Never `addJavascriptInterface`.

---

## 6. Conflicts with the existing design docs

Recorded rather than silently resolved.

### 6.1 `01-platform-changes.md` §1.2 was amended for `action=code`

§1.2 used to read "never put a capability value on the return URL. No install code, no
anonymous id, no token." It now permits one **when the navigation is provably
intra-web-view** — cancelled by the SDK's own navigation policy and never handed to the OS.

That condition is a property of this transport, which is why it is recorded here too: the
outbound channel's safety argument now carries a capability value, so anything that changes
how the navigation policy handles the return scheme changes a security boundary, not just a
signalling convention. Specifically it rests on all four of:

- the return-scheme branch ending in `.cancel` / `return true` on every reachable path,
  including from a sub-frame (iOS cancels it explicitly rather than relying on WebKit
  declining to launch an unregistered scheme);
- the sub-frame guard running *above* the dispatch on both platforms;
- `openExternally` being http(s)-only, which is what stops a return-scheme URL with an
  unexpected host from reaching the OS;
- no `WKUIDelegate` / `WebChromeClient`, so `window.open` cannot escape either.

If any of those is relaxed, §1.2's condition stops holding and `action=code` has to go with
it. See `08-install-flow.md` §6.1 for the rest, including why a gesture is required.

### 6.2 The iOS data store contradicts the hardening rules

§7 of `02-native-sdk-overview.md` says *"Use a non-persistent data store so the sheet does
not accumulate cookies in the host app's container."* `SharingWebView.swift` sets
`configuration.websiteDataStore = .default()` — persistent — with the comment *"Persistent,
so the hosted page's own HTTP cache is what tier 2 falls back on."*

The implementation choice is defensible: tier 2 is a cache-only retry, and an ephemeral
store has no cache to retry from. But the rule and the code disagree, and one of them should
change. Android has no per-WebView store at all, so it cannot comply either way; it disables
third-party cookies instead.

### 6.3 `action=error` is not in the §1.2 table

It ships, and it fires from a route guard rather than a user gesture — knowingly breaking
§1.2's *"navigate only in response to a user gesture"*. Already documented in
`01-platform-changes.md` §6; noted here so the action list in one place matches the other.

---

## 7. Corrections to earlier claims

- `05-audit-findings.md:901` says `frak-sdk-ui/consumer-rules.pro` *"plans a
  `@JavascriptInterface` bridge that `02` §7 explicitly forbids"*. Verified: the file
  contains **no rules at all**. The `@JavascriptInterface` text is inside a comment
  explaining that an earlier draft anticipated such a keep and that it was deliberately not
  added. The finding describes the file's text accurately but reads as though live config
  contradicts the design. It does not.
