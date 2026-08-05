# Native SDK — the sharing sheet and the install handoff

The one surface that needs a web view, the channel between it and native code, and what
happens after a share. Implemented on both platforms; none of it has run on a device yet.

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
 → SDK raises the real OS chooser, then fires Interaction.Sharing (after it, see §3)
 → SDK reloads the page with &confirmed=1                    ← load-bearing, see below
 → page shows PostShareConfirmation: "create your wallet to get your rewards"
 → Install CTA → <scheme>://result?action=install → back to native
      ├─ Frak app installed → frakwallet://install?m=&a= → linked, no code, no store
      └─ not installed      → /install in the SAME web view (§3)
```

Two things silently kill the funnel:

1. `&confirmed=1` must fire for a share and must NOT be sent for a copy. Only the SDK knows
   whether an OS chooser came up, so `PostShareConfirmation` needs the reload to render; a
   copy has already toasted and moved on, and reloading would tear that down mid-toast.
2. The SDK owns all sharing tracking. `apps/wallet/app/routes/sharing.tsx` wires only
   `onSuccess`, never `onShared` — the route itself never emits `create_referral_link`.

The sharing page is hosted, not re-implemented natively, to stay in sync with the other
web/Tauri consumers. The public API returns a `SharingResult` and never leaks the web view,
so going native later is a non-breaking internal change.

### Lifecycle contract

| Situation | Behaviour |
|---|---|
| Re-entrancy | second call while one is active → `alreadyPresenting`. Never queue, never silently cancel |
| Terminal result | shared *then* install-clicked *then* dismissed → most significant event wins (install > shared/copied > dismissed) |
| Dismiss mid-load | cancel the load, return dismissed. Queued interactions unaffected |
| Web view fails to load | tier-3 fallback: native share sheet with the locally-built link. Never show a broken sheet |
| Rotation | Android: state survives via `SavedStateHandle`; never re-create the web view |
| Process death | the continuation is gone. Android can kill the host while the OS chooser is up; tracking is best-effort |

## 2. The web view ↔ native channel

Inbound is query parameters delivered by a full page load. `SharingPageURL.build` assembles
`/sharing?native=1&…` with `merchantId`, `clientId`, `returnScheme`, `sid`, the SDK version
and optional context (`appName`, `logoUrl`, `link`, `products`, `r`). Every state change
after that is a fresh `loadUrl` of a rebuilt URL: `confirm()` reloads with `&confirmed=1`,
`shareAgain` reloads without it, `copy` reloads nothing, and a failed install page reloads
`&confirmed=1` instead.

Outbound is an intercepted navigation: the page calls
`window.location.assign("<returnScheme>://result?action=…&sid=…")` and the SDK catches it in
the navigation policy and stops it — `decisionHandler(.cancel)` on iOS, `return true` from
`shouldOverrideUrlLoading` on Android. Actions: `install`, `dismiss`, `shareAgain`, `code`,
`error`, `share`, `copy`. `share`/`copy` are asks, not reports — the page draws both buttons
and the host performs them, since `navigator.share` does not exist in an Android WebView and
a share's interaction has to be signed by the SDK keypair; both are repeatable within one
page load, so `sendHostResult` exempts them from its dedupe.

There is no JavaScript bridge on either platform, deliberately.

Known issues:

- The inbound reload (`confirmed=1`) discards React state, re-runs route loaders and
  re-fetches merchant config and the reward, right as the user is waiting for confirmation.
  Fix: push state in with `evaluateJavaScript`, feature-detected, falling back to the reload.
- `sentActions`, a module-global `Set` in `buildHostResultUrl.ts`, exists because outbound
  navigations are fire-and-forget and carry no correlation; keyed by `action + value` so a
  regenerated code still reaches the host. Cancelled navigations surface as
  `NSURLErrorCancelled` / WebKit error 102, so the SDK carries an `isCancellation()` filter
  to avoid reading those as a failed load.

Do not add a bridge yet — `addWebMessageListener` (Android) and `WKScriptMessageHandler`
(iOS) both need hand-rolled origin checks; never `addJavascriptInterface` (no origin
control). Migrate when the outbound channel needs more than one value beyond `action`/`sid`,
or the page needs a reply.

### Hardening rules

- Frame-scoped: the sub-frame check runs above the `returnScheme` branch on both platforms,
  pinned by `SharingWebViewClientTest`. No OS scheme/intent registration — interception is
  in-process, ahead of any OS routing.
- Pin navigation to the wallet origin; open external links in the system browser, `http(s)` only.
- Disable file access and universal access from file URLs; block mixed content.
- No `WKUIDelegate` / `WebChromeClient`, so `window.open` cannot escape either.
- Known contradiction: iOS sets `websiteDataStore = .default()` for tier-2 offline retry;
  Android disables third-party cookies and has no per-WebView store. One of the two should change.

`action=code` carrying a capability value is safe only because the return-scheme branch
always cancels (including sub-frames), the sub-frame guard runs above the dispatch, and
`openExternally` is http(s)-only — relax any of those and `action=code` has to go with it.
The code is handed over from a gesture, never an effect. Accepted residual: a crafted
`/install?returnScheme=frak-com.evil` in a real browser yields a code bound to attacker-
supplied `m`/`a`, from an endpoint that is unauthenticated anyway — no victim secret leaks.

## 3. The install handoff

The anonymous id is derived from a key in the Secure Enclave / AndroidKeyStore and cannot be
re-derived by a different app, so it has to be carried across the install boundary.

| Platform | Mechanism | Determinism |
|---|---|---|
| Android | Play Store URL carrying an install referrer with `m`, `a` and the proof | deterministic — survives the store round trip exactly |
| iOS | install code + pasteboard + `SKOverlay` | user-mediated, deterministic when used |

iOS has no install referrer and fingerprinting-based alternatives were rejected, so the
handoff is user-mediated instead — no fingerprinting, no ATT prompt, one interaction.

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

`returnToHost` stays because the page has no signing key — it reports intent, the host
decides. The sheet reaches a proof through one member, `installPageUrl` /
`installPageURL(returnScheme:sessionId:)`; proof minting stays `internal`. Minted at the
install tap, not at sheet preparation: most sheets never reach the install step, a Secure
Enclave signature can fail and must not block a sharing sheet, and the proof's `ts` is what
the backend's 30-day window measures from.

### iOS specifics

- `SKOverlay`, presented on the sheet's `UIWindowScene`, installs in place and replaces
  `isFrakAppInstalled()` for this flow (which stays public for other callers).
  `SKStoreProductViewController` is rejected: it fails presenting alongside an already-up
  `UISheetPresentationController`.
- Never read the pasteboard (raises an OS banner/permission alert since iOS 16); writing
  triggers nothing. It carries the code, not a URL — the code surfaces in the QuickType bar
  and tapping the suggestion is the consent with no prompt. The write sets `.expirationDate`
  and `.localOnly` (the latter blocks Universal Clipboard sync). QuickType is best-effort,
  not a contract — manual entry of the visible code is the real floor.
- The code is generated by the page (`useGenerateInstallCode`) and handed back; the SDK's only
  job is the pasteboard write. `staleTime: Infinity` on the code query — a refetch has no
  upsert and would leave the page showing one code while the pasteboard holds another.

### Android specifics

No `SKOverlay` equivalent — Play always foregrounds the Play app, which does not matter
because the referrer carries `m`/`a`/proof deterministically. The clipboard write is a
fallback, not load-bearing; the SDK emits the referrer only, with no read-back.

### The proof path through `apps/wallet`

`/install` resolves the proof fragment first, then search param, so existing links stay
byte-identical. Rule: emit the fragment wherever the URL could be copied, shared or logged;
the query param only for handoffs that provably cannot carry one.

### Tracking is recorded on success, not on intent

| Entry point | Correct behaviour |
|---|---|
| `share()` | after the chooser, gated on the result |
| tier-3 `fallBack()` | after, gated on the result |
| `copy()` | before — unchanged, a copy has no completion to wait for |

Android caveat: `NativeShare.share` returns whether the chooser launched, not whether the
share completed — telling them apart needs `ActivityResultLauncher`, a public API change.
Gate on the returned flag on both platforms; Android's is optimistic until that lands.

## 4. Status

Landed on both platforms: the probe gate deleted from `openFrakApp`; the tracking correction
above; the router's `p` forwarding and fragment-first resolution; the in-sheet `/install`
navigation with `SKOverlay` on iOS and the referrer URL on Android; the `code` action with
the pasteboard write.

None of it has run on a device, and only the web half has test coverage. Two known defects —
the uncancelled load deadline raising a second chooser, and iOS `release()` not cancelling the
prepare task — are tracked in [`06-open-findings.md`](./06-open-findings.md).

Open questions:

1. `SKOverlay` vs `SKStoreProductViewController` — SKOverlay is lighter and installs in place
   but has no styling control. Current design assumes SKOverlay.
2. Should `installStarted` become a tracked interaction rather than only a merchant callback?
   Today it notifies and records nothing.
3. Ordering against the identity-proof rollout: iOS emitted no proof until this landed, so the
   enforcement flip must not ship before a store binary carrying it. Needs an owner.
4. Sharing performance targets (p75 < 400 ms, p95 < 1 s, fallback to native share > 1.5 s)
   were set for Chrome Custom Tabs and have not been re-measured on the WebView path; that
   measurement gates whether the sharing screen goes native.
