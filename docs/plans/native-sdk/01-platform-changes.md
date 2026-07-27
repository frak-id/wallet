# Platform changes required — backend, wallet app, listener

Changes needed in the existing web/backend codebase to support native SDKs.
Ordered by whether they block native work.

Legend: **[BLOCKING]** native MVP cannot ship without it · **[SECURITY]** must land
before public release · **[ENHANCEMENT]** improves native UX/perf, not blocking.

---

## 1. `apps/wallet` — the `/sharing` route

File: `apps/wallet/app/routes/sharing.tsx`

The route is already standalone and URL-driven, and is already consumed by the Tauri
wallet. It needs six additive changes. None affect existing consumers.

### 1.0 The existing param contract, plus one guard **[BLOCKING — small]**

Before the new params, the existing contract must be written down, because two of them
are load-bearing and easy to miss. `validateSearch` (`sharing.tsx:64-101`) consumes:

| Param | Native SDK | Note |
|---|---|---|
| `merchantId` | **required** | |
| `clientId` | **required** | see the trap below |
| `products` | required for product shares | array of `SharingPageProduct` |
| `link` | required | the URL being shared |
| `appName`, `logoUrl` | recommended | also seeded via §1.4 |
| `attribution` | optional | JSON object **or** discrete `utm_*`/`ref`/`via` params |
| `checkoutToken` | **never send from native** | Shopify-only fallback |
| `redirectUrl` | not used in native mode | |

**Trap 1 — `clientId` is mandatory in native mode.** When absent, the page falls back to
the wallet's *own* `clientIdStore` (`sharing.tsx:155`). Inside a merchant-app web view
that store may hold an unrelated or stale id, so the page would build `installUrl`
(`/install?m=&a=`) with an identity that differs from the SDK's `anonymousId` — and the
subsequent `ensure` would link the **wrong** id. Under `native=1` the route should
refuse to render (or hard-error) when `clientId` is missing, rather than silently
falling back. Without `clientId` **and** `checkoutToken`, `buildSharingLink` returns
`null` (`buildSharingLink.ts:41`) and share/copy are dead.

**Trap 2 — `attribution=null` is not the same as omitting it.** Literal `null` explicitly
*disables* backend attribution defaults; `undefined` still applies them
(`mergeAttribution.ts:36-42,50`). A native `AttributionParams()` with all-nil fields
must map to *omitted*, not `null`. The SDK needs an explicit
`AttributionParams.disabled` sentinel to express the `null` case.

**Trap 3 — the page does not track shares.** `sharing.tsx` wires only `onSuccess`, never
`onShared` (contrast `apps/listener/.../SharingPage/index.tsx:167`, which calls
`trackSharing()`). `handleCopy` doesn't track either. So the route the native SDK reuses
**never emits `create_referral_link`** — not even for the existing Tauri consumer. The
native SDK owns 100% of sharing tracking. This is a hard requirement, not a detail: an
implementer who assumes the hosted page tracks will ship silently untracked shares with
no error anywhere.

### 1.1 `?native=1` — chromeless mode **[BLOCKING]**

The native SDK presents the page inside a **native bottom sheet** that provides its own
header (merchant logo, close button) and its own footer (Share / Copy buttons wired to
`UIActivityViewController` / `Intent.ACTION_SEND`).

When `native=1`:
- hide the page header (`MerchantLogo` + Frak logo + dismiss)
- hide the sharing-screen footer CTAs (Share / Copy)
- keep everything else: reward credit card, product cards, how-it-works stepper, FAQ,
  legal links, and the full `PostShareConfirmation` screen
- transparent/neutral page background so the native sheet's own surface shows through

Rationale: the native layer owns the OS share sheet, so `navigator.share` is never
called. This sidesteps the fact that **Android `WebView` does not implement the Web
Share API at all**, and gives a genuinely native share experience on both platforms.

Suggested implementation: pass a `chromeless` prop down to the shared
`SharingPage` component (`packages/wallet-shared/src/sharing/component/SharingPage/index.tsx`)
so both the listener and wallet consumers keep their current behaviour by default.

### 1.2 `?returnScheme=` — native result channel **[BLOCKING]**

The route currently signals outcomes via React callbacks and in-page navigation
(`onInstall` → `navigate("/install")`, `onDismiss` → `window.location.assign(redirectUrl)`).
A native host cannot observe these, and the SDK deliberately ships **no JS bridge** —
see the web-view hardening rules in `02-native-sdk-overview.md` §7. A navigation the
native layer can intercept is the entire channel.

When `returnScheme=<scheme>` is present, the route navigates to:

```
<scheme>://result?action=<action>[&…]
```

| Action | When | Extra params |
|---|---|---|
| `install` | Install CTA on `PostShareConfirmation` | `sid` (correlation token) |
| `dismiss` | user dismisses from within the page | `sid` |
| `shareAgain` | "share again" link | `sid` |

`shared` and `copied` are **not** signalled this way — the native layer owns those
buttons and already knows. They are listed here only to make the boundary explicit.

The SDK intercepts the navigation in its own web view
(`WKNavigationDelegate.decidePolicyFor` / `WebViewClient.shouldOverrideUrlLoading`).

#### Scheme derivation and trust — read before implementing

**No OS-level scheme registration is needed on either platform.** Because the sharing
web view is an in-process `WebView` / `WKWebView` (not a Custom Tab), the SDK intercepts
the navigation directly — `shouldOverrideUrlLoading` on Android,
`decidePolicyFor` on iOS — before the OS ever routes it. No intent filter, no
`CFBundleURLSchemes`, no exported redirect-catcher Activity.

This matters for two reasons: it removes integration work from the merchant, and it
removes the hijack surface entirely for the in-app path.

Earlier drafts proposed `frak-<merchantId-prefix>` registered via intent filter. That
was doubly wrong: Android intent filters are static so a library cannot register a
runtime-configured scheme (it would have to be a manifest-merger placeholder on
`applicationId`), **and** an exported catcher Activity would let any installed app forge
the callback. Neither is needed now.

If a fallback path ever does route through the OS, the rules below become mandatory
rather than defensive.

**Everything arriving on this channel is untrusted.** Custom schemes carry no origin.
Any web page the device visits can navigate to `<scheme>://result?action=install`, and
if a redirect-catcher Activity is exported, any installed app can fire the same intent.
Therefore:

- **Never put a capability value on the return URL.** No install code, no anonymous id,
  no token. The URL carries only `action` plus `sid`, an opaque single-use correlation
  token the SDK mints *before* presenting the web view and passes in as `?sid=`. The SDK
  drops any callback whose `sid` doesn't match the active session.
- Act only when a sharing session is genuinely active; ignore otherwise.
- Treat unknown `action` values as no-ops (forward compatibility — see §1.5).
- Prefer intercepting in-web-view over relying on the OS to route the scheme.

#### `?returnScheme=` is an open redirect if unvalidated

The page will navigate to whatever scheme the URL carries, which turns a trusted
wallet-origin page into an arbitrary scheme launcher (`?returnScheme=some-banking-app`).
Validate server/route-side against a strict shape — `^frak-[a-z0-9._-]{1,60}$` — and
navigate only in response to a user gesture.

### 1.2b `?confirmed=1` — inbound native → web channel **[BLOCKING]**

The outbound channel above has a matching inbound gap that breaks the whole install
funnel if missed.

`PostShareConfirmation` renders only when the page's *own* handlers flip
`showConfirmation` (`sharing.tsx:236-259`, persisted by `saveConfirmation`). Under
`native=1` those buttons are hidden, so **nothing ever flips it** — the user shares via
the native sheet and the page just sits there. No confirmation, no Install CTA, no
wallet creation. The entire funnel the native SDK exists to reproduce dies silently.

Fix: accept `confirmed=1` as initial `showConfirmation` state. After a native share or
copy completes, the SDK reloads/navigates the web view to the same URL plus
`&confirmed=1`.

A query param is preferred over `evaluateJavascript`/JS-bridge injection because it is
transport-agnostic, testable in a plain browser, and keeps the no-bridge architecture
intact.

### 1.3 Install step — native handoff **[BLOCKING for iOS]**

On `native=1`, the Install CTA must **not** navigate in-page to `/install`. It emits
`<scheme>://result?action=install&sid=`, and **the SDK handles the whole install step
internally** — the merchant is notified, never asked to act. `SharingResult` reports
`.installStarted` as a notification; a merchant must not have to call `openFrakApp()`
to complete it. (An earlier draft's integration sketch implied otherwise; that would
let integrators skip iOS pasteboard seeding and silently lose the identity link on the
most conversion-critical step in the product.)

The SDK decides:

```
Frak app installed?
├─ yes → frakwallet://install?m=<merchantId>&a=<anonymousId>   (see §2.1)
└─ no  → Android: /install page (Play Install Referrer, unchanged)
         iOS:     native install-code flow (§2.2 + `02` §6)
```

Two steps in the iOS path **must** be native and cannot live in the web view:
- writing the install code to `UIPasteboard` with an `expirationDate` — the web
  clipboard API offers no expiry control
- presenting `SKStoreProductViewController` (in-app App Store) — impossible from JS

So the page hands back control; the SDK does the rest.

### 1.4 Seeded initial state **[ENHANCEMENT — high value]**

Optional params letting the SDK pass locally-cached values so the page paints real
content on first frame instead of a skeleton:

```
?r=<preformatted reward>&n=<appName>&l=<logoUrl>
```

The page renders these immediately, then revalidates via its normal
`useFormattedEstimatedReward` query and reconciles.

This is the single biggest perceived-performance win: it removes a full network
round-trip from the critical path (today the page mounts, *then* fetches the reward,
*then* renders the headline). It also enables useful **offline** behaviour — see §4.

Must be treated as untrusted display-only input. Do not let it influence the sharing
link, tracking, or any identity decision.

### 1.5 Version pinning **[BLOCKING — one-liners now, impossible to retrofit]**

A shipped binary is immortal; the hosted page ships continuously. Nothing currently
pins them together. Four cheap measures, all of which must exist **in v0.1** because
they cannot be added to binaries already in the field:

1. **`?sdkv=<version>` on every `/sharing` URL** — lets the page branch or degrade for
   old SDKs.
2. **`x-frak-sdk-version` header** on every API call — same, server-side.
3. **Forward-compatibility rule, documented in both directions:** the SDK ignores
   unknown `action` values on the result channel; the page ignores unknown params.
4. **A server-driven kill switch** in the `resolveConfig` response — e.g.
   `{ sharing: { nativeSheetEnabled: false } }` — so a broken SDK release can be
   remotely downgraded to the tier-3 native fallback (§4) without an app-store release
   cycle. This is the only lever that works against a binary in the wild.

---

## 2. `apps/wallet` — install & identity

### 2.1 Deep-link install already works — verify only **[NO CHANGE EXPECTED]**

`apps/wallet/app/utils/deepLink.ts` already routes `install` (it is in `publicActions`
and `routeResolvers`), and `/install` already queues
`{type: "ensure", merchantId, anonymousId}` into `pendingActionsStore`, drained by
`useExecutePendingActions` against `POST /user/identity/ensure` using the wallet's own
session.

So `frakwallet://install?m=<merchantId>&a=<anonymousId>` from a native merchant app
should already link the anonymous id to the wallet with **zero backend or wallet
changes**. This needs an end-to-end verification pass, not new code.

Alternative path when the wallet already holds a competing anonymous id: the SDK can
call `POST /user/identity/merge/initiate` **with no session at all** (the route is
`withOptionalWalletOrSdkAuthent` and accepts `{sourceAnonymousId, merchantId}`), then
pass `?fmt=<mergeToken>` on the deep link for the wallet to `merge/execute`. Same
mechanism as the existing web in-app-browser escape flow.

> ⚠️ **Do not ship this path yet.** That "no session at all" property is exactly the
> vulnerability described in §3.2 — it lets anyone mint a merge token for an anonymous
> id they do not own, and every share link publishes those ids in clear. The `ensure`
> path above is unaffected and is the MVP mechanism. Revisit once §3.2 lands.

### 2.2 iOS: focus the install-code field on first launch **[BLOCKING for iOS]**

File: `apps/wallet/app/routes/install.tsx` (and/or the first-launch/register path)

For the iOS install flow, the SDK writes the install code to the pasteboard before
sending the user to the App Store. On first launch, the wallet should **autofocus the
code input**.

Critically: **do not read the pasteboard programmatically.** Calling
`UIPasteboard.general.string` triggers the "pasted from…" banner and a permission
prompt. Focusing the field is enough — iOS surfaces clipboard content in the keyboard
suggestion bar automatically, with no read, no banner, no prompt. One tap for the user.

If presence detection is genuinely needed, use `UIPasteboard.detectPatterns(for:)`,
which checks without reading.

Concretely:
- autofocus the `CodeInput` when arriving at the install-code entry with no code in
  the URL
- ensure the input's `textContentType` / `inputMode` does not suppress the keyboard
  suggestion bar

### 2.3 Service worker caching for `/sharing` **[ENHANCEMENT — Android only]**

The wallet already builds a custom service worker (`apps/wallet/vite.config.ts`,
`mode === "sw"`). Caching the `/sharing` shell gives:
- near-instant repeat presentations
- a usable offline render when combined with §1.4 seeded params

> **This is Android-only.** Service workers do **not** run in `WKWebView` unless the
> host app has the browser entitlement or opts into `WKAppBoundDomains` — which would
> have to go in the **merchant's** `Info.plist`, caps them at 10 domains, and
> constrains *every* `WKWebView` in their app. That is an unacceptable integration ask.
> On iOS the equivalent levers are `URLCache` / `WKWebsiteDataStore` HTTP caching plus
> the §1.4 seeded params.

Also add a preconnect to the backend origin from `/sharing`, mirroring what the web
SDK already does for the listener iframe.

---

## 3. `services/backend`

### 3.1 Pre-formatted rewards **[ENHANCEMENT — high value]**

Today `GET /user/merchant/estimated-rewards` returns raw `EstimatedRewardItem[]`, and
every client re-implements selection + formatting:

- `sdk/core/src/rewards/select.ts` — `selectDisplayCampaign`, `selectBestReward`
- `sdk/core/src/rewards/format.ts` — `formatEstimatedReward`, `formatRewardOrHide`
- `sdk/core/src/utils/format/*` — `formatAmount`, currency→locale mapping

Duplicating this in Kotlin **and** Swift is the most dangerous drift in the whole
project: divergent tie-breaking or locale mapping means a user sees a **different
reward amount on iOS than on the merchant's website for the same campaign**. That is a
trust and support-ticket problem, not a cosmetic one.

Proposal — add an opt-in pre-formatted projection:

```
GET /user/merchant/estimated-rewards
      ?merchantId=<uuid>
      &formatted=1
      &currency=eur|usd|gbp
      &lang=en|fr
      &targetInteraction=<interactionTypeKey>
      &audience=referrer|referee
```

Additive response field:

```jsonc
{
  "rewards": [ /* unchanged raw items */ ],
  "best": {                          // present only when formatted=1
    "formatted": "12,00 €",
    "payoutType": "fixed",           // fixed | percentage | tiered
    "minPurchaseAmount": "50,00 €",  // preformatted, nullable
    "minPurchaseValue": 50,
    "lockupDurationDays": 30,
    "campaignId": "…",
    "referrerReward": { /* EstimatedReward */ },
    "refereeReward":  { /* EstimatedReward */ }
  }
}
```

Server-side reuse of the existing `sdk/core/src/rewards/*` logic keeps one
implementation of the ranking rules. Native SDKs then ship only a thin display
formatter (and can still fall back to local formatting when offline).

The formatting contract that must hold everywhere: **currency drives locale, not the
device locale** — `eur→fr-FR`, `usd→en-US`, `gbp→en-GB`, with
`minimumFractionDigits: 0`, `maximumFractionDigits: 2`.

### 3.2 Identity merge is unauthenticated — reward theft **[SECURITY — CRITICAL, fix before any native release]**

> Found during native-SDK security review. **This is a live vulnerability in production
> today**, independent of native — native only widens the supply of usable
> `merchantId`s and makes anonymous ids easier to harvest. It is the single most
> serious item in this document.
>
> ➤ **Now owned by its own plan, being executed first:**
> [`../identity-proof-of-possession/`](../identity-proof-of-possession/). That document
> covers the full attack chain, the permanent-lockout consequence, the P-256
> proof-of-possession design, and the backend fixes. Kept summarised here because it
> gates native work.

**`POST /user/identity/merge/execute` has no auth macro at all**
(`services/backend/src/api/user/identity/merge.ts:53-85`) — not even the optional one.
`/initiate` accepts a bare `{sourceAnonymousId, merchantId}` with no session
(`merge.ts:6-51`), and `AnonymousMergeOrchestrator.initiateMerge` will auto-create an
identity group for any `sourceAnonymousId` and mint a JWT bound to it, with **no proof
the caller controls that id** (`AnonymousMergeOrchestrator.ts:29-70`). The token carries
`sourceGroupId`, `sourceMerchantId`, `sourceAnonymousId` and `sourceWalletAddress`
(`AnonymousMergeService.ts:38-43`), but only `sourceGroupId` drives behaviour at execute
time — and **nothing in it identifies the requester**.

**The anonymous id is public by design.** FrakContext v2 carries the referrer's raw
client UUID in the clear at bytes 21..36 of every share link. Anyone who receives a
shared link — or screenshots it, or finds it reposted — has the referrer's
`sourceAnonymousId` for free. `install-code/resolve` also echoes `anonymousId` back to
an unauthenticated caller (§3.3), giving a second harvesting route.

Attack:

1. `POST /merge/initiate {sourceAnonymousId: <victim's, from their share link>, merchantId}`
   — no session → attacker gets a valid `mergeToken` for the victim's group.
2. Attacker links their own wallet to their own anonymous id via the legitimate flow,
   so their group has `hasWallet = true`.
3. `POST /merge/execute {mergeToken, targetAnonymousId: <attacker's own>, merchantId}`
   — no auth. Wallet-priority anchoring (`IdentityWeightService.checkWalletPriority`,
   invoked from `determineAnchor:150`) picks the **attacker's** group as anchor because
   the victim's pre-install group has no wallet, and merges the victim in.
4. Rewards attach to an **identity group**, not a wallet (`asset_logs.identityGroupId`
   is `notNull`, `recipientWallet` nullable), and the wallet is resolved at settlement
   (`BatchRewardOrchestrator.ts:196`, `SettlementOrchestrator.ts:269`). Lockup windows
   run up to 30 days. Since the victim's id now points at the attacker's group, rewards
   the victim **already earned** but that have not yet settled pay out to the attacker —
   along with all future activity under that anonymous id.

> **Late wallet binding is deliberate and must not be "fixed".** Decoupling the anonymous
> id from the wallet is what lets a user share, earn, and create their wallet *later*.
> The defect is not *when* the wallet resolves — it is that **group membership can be
> repointed by an unauthenticated attacker**. Authenticate the merge and the settlement
> model is correct as-is.

This lands precisely in the window the native SDK is designed to optimise: a user with
an active anonymous identity accruing rewards who has not yet installed the wallet.

Not vulnerable: if both groups already hold *different* wallets, `WALLET_CONFLICT` is
thrown (`IdentityOrchestrator.ts:88-91`) — post-install users are protected. The victims
are exactly the pre-install users this SDK is meant to convert.

A milder variant exists on `/identity/ensure`: it *requires* a wallet session, but takes
`anonymousId` from the request with no proof of ownership (`ensure.ts:29-45`), feeding
the same wallet-priority merge. Any authenticated wallet user can claim a scraped
anonymous id. The `frakwallet://install?m=&a=` deep link this plan reuses (§2.1) drives
exactly that call with `a` taken from an untrusted URL.

**Additional consequence — permanent lockout, worse than the theft.** The merge deletes
the victim's group and repoints their `anonymous_fingerprint` node at the attacker's.
When the victim later installs, `ensure` → `resolveAndAssociate` →
`determineAnchorFromMultiple` sees two different wallets and throws `WALLET_CONFLICT`
(`IdentityWeightService.ts:184-188`). `ensure.ts` has no `try`/`catch` and no recovery
path exists anywhere in the backend. **They can never link their wallet for that
merchant** — silently, until they hit an unresolvable error.

**Fixes** — full design in
[`../identity-proof-of-possession/`](../identity-proof-of-possession/):
- anonymous ids become **derived from a device-held P-256 keypair**
  (`clientId = uuid(SHA-256(pubkey)[0..16])`), so identity is self-authenticating
- merge/ensure carry a **timestamped signature** (±2 min window, replay-cached), no
  challenge round-trip
- `merge/execute` must require a session
- replace `anonymousId` with an opaque single-use ticket in the install-code flow
- alert when a merge would move a group holding unsettled `asset_logs` under a different
  wallet — and consider requiring proof on **both** sides of the merge, not just the
  source
- Rate limiting (20/min, IP-keyed) does not mitigate any of this.

**This blocks the §2.1 `?fmt=` merge path.** Until it is fixed, the native SDK must not
advertise merge as a supported flow.

### 3.3 `install-code/resolve` leaks `anonymousId` **[SECURITY]**

`services/backend/src/api/user/identity/installCode.ts:36-90` is fully unauthenticated
and returns `{merchantId, anonymousId, merchant:{name,domain}, hasWallet}`.

Entropy is adequate against a *targeted* attack: 31⁶ = 887,503,681 codes
(`sixDigitCode.ts:8-21`), 10/min per IP → targeting one victim's code is infeasible.

The real exposure is **harvesting**. The limit is IP-keyed only, so a modest proxy pool
(500–1000 IPs × 10/min sustained over the 72h TTL) reaches a meaningful fraction of the
keyspace, and expected hits scale linearly with the number of concurrently live codes.
Each hit yields a valid `anonymousId` — which is exactly the capability needed for the
§3.2 merge attack. It is a free anonymous-id oracle.

**Fixes:** replace `anonymousId` with an opaque, single-use, expiring **ticket**, and add
per-code attempt limiting / backoff independent of source IP.

> The id cannot simply be dropped — it is load-bearing. `resolve` happens **before** the
> user is authenticated, and the wallet carries the id in `pendingActionsStore` across
> registration to drain against `ensure` later (one-week TTL). And the signature must be
> verified at **`generate`**, not `resolve`: the private key belongs to the sharer's
> device, while the wallet is a different app on a possibly different device. Full design:
> [`../identity-proof-of-possession/`](../identity-proof-of-possession/) §3a.

### 3.4 Rate limiting on SDK-facing endpoints **[SECURITY — before public release]**

These four have **no** `rateLimitMiddleware` today (it is wired only on `explorer`,
`registration`, wallet-auth, `identity/ensure`, `identity/merge`, `identity/installCode`,
`identity/orderClient`):

| Endpoint | File |
|---|---|
| `POST /user/track/interaction` | `services/backend/src/api/user/track/interaction.ts` |
| `POST /user/track/purchase` | `services/backend/src/api/user/track/purchase.ts` |
| `GET /user/merchant/resolve` | `services/backend/src/api/user/merchant/index.ts:11` |
| `GET /user/merchant/estimated-rewards` | `services/backend/src/api/user/merchant/index.ts:44` |

A native binary is decompilable and the `merchantId` is a static compile-time constant
extractable from every APK/IPA, making these trivially enumerable and floodable. Native
also cannot be origin/Referer-checked at all. Add rate limiting before public release.

Three constraints on *how*:

- **Key by `(merchantId, clientId)`, not IP alone.** `x-frak-client-id` is a free-form
  caller-supplied string (`sdkIdentity.ts:9-13`), so an attacker mints unlimited fresh
  identities; but IP-only limiting is simultaneously too weak against that and too harsh
  against real users, because **carrier-grade NAT puts thousands of legitimate mobile
  users behind one IP**. An aggressive IP limit rate-limits an entire carrier. Use IP
  only as an outer circuit breaker.
- **Coordinate with the SDK's offline queue.** This document mandates a durable queue
  that burst-flushes on reconnect — straight into these new limits. The SDK must honour
  `Retry-After` and back off *without dropping* queued events or poisoning the queue
  head, and must **jitter** flush-on-reconnect so a regional connectivity blip doesn't
  synchronise a merchant-wide stampede.
- Return `429` with `Retry-After` rather than a generic error, so the SDK can comply.

### 3.5 Purchase and arrival claims are unverified **[SECURITY — pre-existing, worth fixing]**

Not native-specific, but native raises the stakes and the docs should not imply the
tracking endpoints are safe:

- **Purchase claims:** `/track/purchase` never validates the checkout `token`
  (`purchase.ts:1-84`). It is stored unconditionally via upsert and only later compared
  for string equality against the merchant webhook's report
  (`PurchaseLinkingOrchestrator.ts:87-98`, `PurchaseClaimRepository.ts:38-47`). Anyone
  who observes or guesses `{merchantId, orderId, token}` can claim a purchase they did
  not make, racing the real webhook. Fix: HMAC the token with a per-merchant secret
  rather than treating the raw order key as secret material.
- **Arrival claims:** `arrival` interactions accept attacker-chosen `referrerWallet` /
  `referrerClientId` with only shape validation, never provenance
  (`interactionSchemas.ts:5-11`, `validateArrivalReferrer:45-77`). Combined with
  free-form `x-frak-client-id` and no rate limit, this is straightforward Sybil referral
  farming. Fix: require referrer claims to be backed by something the backend itself
  issued when the link was built.

### 3.6 Raw hex address accepted as identity proof **[SECURITY — must fix]**

File: `services/backend/src/api/user/track/sdkIdentity.ts:39-48`

`resolveWalletAddress()` treats any string passing `isHex()` + `isAddress()` as a valid
`x-wallet-sdk-auth` identity for `/track/interaction` and `/track/purchase`. No
signature is verified.

An attacker sets `x-wallet-sdk-auth: <any address>` and posts interactions and purchase
claims **as any wallet**, polluting referral graphs and poisoning reward attribution.

To be precise about blast radius: **the exposure is already total today** for any HTTP
client — this is server-side and origin-blind, so `curl` suffices; native adds nothing
qualitatively new. What native adds is *scale and cover*: shipping `merchantId`s in
binaries supplies attackers with valid ids to pair with forged addresses, and native
traffic patterns remove the informal UA/Referer heuristics that make abuse noticeable
today.

Fix: drop the raw-address bypass entirely; require a verified `JwtContext.walletSdk`
token as every other caller already uses. Native SDKs do **not** send this header (they
use the anonymous `x-frak-client-id` path only), so this is not a native blocker.

### 3.7 `idempotencyKey` on `sharing` and `arrival` interactions **[BLOCKING]**

Only `custom` accepts an `idempotencyKey` today
(`services/backend/src/api/schemas/interactionSchemas.ts`). For `sharing`, the
server-side dedup key falls back to `Date.now()`:

```ts
// SharingHandler.ts:33-34
const key = input.purchaseId ?? Date.now();
return `create_referral_link:${context.identity.identityGroupId}:${input.merchantId}:${key}`;
```

`CustomHandler.ts:28` does the same with `input.idempotencyKey ?? Date.now()`.

On web this is harmless: `sendInteraction` is fire-and-forget with **no retry**
(`sdk/core/src/actions/sendInteraction.ts:47-56`), so the fallback key is computed once
per real attempt. **The native SDK breaks that assumption** — it adds a durable,
retrying, at-least-once queue. Any response lost to a timeout or process kill is
re-sent, computes a *fresh* `Date.now()` server-side, and creates a **duplicate
`create_referral_link` row**, inflating referral counts and distorting attribution.

Fix (additive, cheap — the plumbing already exists for `custom`): accept an optional
`idempotencyKey` on `sharing` and `arrival`. The SDK stamps a UUID **at enqueue time,
not per attempt**.

Related and equally important: queued events must carry **capture-time**
`sharingTimestamp` / `referralTimestamp`. If the server infers time at flush, an event
queued offline lands in the wrong attribution window — which silently invalidates the
tier-3 offline claim in §4 that "attribution is fully preserved".

### 3.8 Merchant identification by package id **[BLOCKING — MVP]**

Today every merchant lookup keys off a web domain. `merchants.domain` is
`text UNIQUE NOT NULL` (`services/backend/src/domain/merchant/db/schema.ts:27`); there
is no bundle/package column.

**This is required for MVP.** A native app has no domain, and requiring every integrator
to hand-copy a `merchantId` into their build config is exactly the kind of setup friction
that kills adoption. `merchantId` remains supported as an explicit override and as the
fallback when package resolution fails.

**Design rule: a merchant app is an additional identity _route_ to an existing
merchant, never a new merchant.** Apps map to the merchant their domain already
identifies.

#### `productId` is legacy — not a constraint here

Earlier drafts treated `productId` as on-chain-facing and therefore frozen. That is
**not accurate**. Verified state:

- `merchants.product_id` is `customHex(...).unique()` and **nullable**
  (`schema.ts:26`)
- exactly **one** live consumer: `MerchantRepository.findByProductId()`, called only
  from `WebhookResolverOrchestrator.resolveByProductId()`, reached only via
  `legacyRoutes.ts` when a legacy `/oracle/{productId}/hook` URL is hit. Its own log
  line reads `"Merchant not found for legacy productId"`.
- `MerchantResolveService:132-133` recomputes `keccak256(toHex(domain))` on the fly
  whenever the column is null, so it is not even authoritative
- no on-chain read or write anywhere in `services/backend/src`

So `productId` places **no constraint** on the app-identity design. Native apps never
compute or send it.

> Separately, `DnsCheckRepository.getNormalizedDomain` genuinely must not change its
> normalization — but for a different reason: **setup codes** are keccak'd from the same
> normalized domain, so changing it invalidates issued codes and orphans merchants.

#### Storage: a sibling column, not a new table

No new table. Extend `merchants`:

```sql
ALTER TABLE merchants
  ADD COLUMN allowed_package_ids text[] NOT NULL DEFAULT '{}';

CREATE INDEX merchants_allowed_package_ids_idx
  ON merchants USING GIN (allowed_package_ids);
```

Entries are **platform-prefixed**, so one column covers both platforms and iOS team
IDs fit without extra structure:

```
android:com.groupeseb.moulinex.food
ios:57DZ6Z2235.com.groupeseb.MyMoulinex
```

**Why a sibling column rather than reusing `allowedDomains`.** Same migration cost,
none of the blast radius. `allowedDomains` is returned to web clients as
`MerchantResolveResponse.allowedDomains` and is fed into the listener's origin trust
check (`apps/listener/app/module/handlers/lifecycleHandler.ts`), where entries are
compared against a parsed hostname. A package id landing there would be silently
compared against `location.host` — never matching, but muddying a security-relevant
code path. Keep the two lists separate.

`allowed_package_ids` is **not** returned by `/user/merchant/resolve`. It is a
server-side lookup key only; native clients have no use for the list.

#### Resolve change

`MerchantResolveService.resolve()`: add one `arrayContains` arm for
`?packageId=&platform=`, mirroring the existing `findByAllowedDomain` fallback. Extend
the LRU cache key and `invalidateForMerchant` to cover it.

```
GET /user/merchant/resolve?packageId=com.groupeseb.moulinex.food&platform=android
```

#### Ownership proof

Best-effort auto-verification at registration, with manual override. **Ship it as a
convenience, not a gate.**

1. **Android — genuinely verifiable.** Query Google's Digital Asset Links API rather
   than fetching the file yourself; it is the same verifier the OS uses and handles
   redirects, caching, and `include` chasing:
   ```
   GET https://digitalassetlinks.googleapis.com/v1/statements:list
         ?source.web.site=https://<domain>
         &relation=delegate_permission/common.handle_all_urls
   ```
   On a match, append `android:<package_name>` to `allowed_package_ids`.
2. **iOS — weaker by construction.** Fetch `/.well-known/apple-app-site-association`
   and read `applinks.details[].appID`. This proves only that the domain *claims* the
   bundle id — Apple exposes **no reverse-verification API**, so it can never prove the
   bundle id belongs to that app. Treat as a hint requiring review.
3. **Manual admin verification** — the day-1 mechanism at launch-partner volume.

#### Two traps found while testing this against a real merchant

Both were hit checking the first client (Moulinex, `com.groupeseb.moulinex.food`).
Neither is theoretical.

**Trap 1 — HTTP 200 is not proof of a file.** `moulinex.co.uk` returns **200** for both
`/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`, but the
body is an SPA HTML fallback (`<!doctype html>… Moulinex UK`). A control request for a
nonsense path under `/.well-known/` returns the byte-identical page. Any verifier that
checks status codes will report success on a site that has published nothing.

→ Always parse and structurally validate. For assetlinks: a JSON array containing a
`delegate_permission/common.handle_all_urls` statement whose `target.android_app` has a
matching `package_name` **and** non-empty `sha256_cert_fingerprints`. Reject any
response whose content type is not JSON.

**Trap 2 — apex→www redirects fail verification outright.** Every SEB apex domain 301s
to its `www` host. Google's API refuses to follow:

> `Error: unavailable: Redirect encountered while fetching statements from`
> `https://moulinex.fr./.well-known/assetlinks.json … redirects are disallowed for`
> `security reasons (NOT_FOLLOWED_MAX_FORWARDS)`

So **even a correctly published file at `www.moulinex.fr` would fail** if the merchant
registered the apex `moulinex.fr`.

→ Resolve redirects *before* verifying and verify against the final host. Surface the
resolved host in the dashboard so the merchant knows exactly where to publish. Note
this interacts with `getNormalizedDomain`, which strips `www.` — the normalized form is
the storage key, but the **verification target must be the real resolved host**.

#### First client status: Moulinex — manual verification required

Checked `moulinex.fr`, `www.moulinex.fr`, `moulinex.com`, `www.moulinex.com`,
`moulinex.co.uk`, `groupeseb.com`, `www.groupeseb.com`, `seb.com`, `tefal.fr`,
`krups.fr`, `rowenta.fr`, plus domains extracted from the Play Store listing.

| Result | Domains |
|---|---|
| 404 | `moulinex.fr`, `www.moulinex.fr`, `moulinex.com`, `www.moulinex.com`, `tefal.fr` |
| 403 (nginx) | all `groupeseb.com` / `seb.com` variants |
| soft-404 (trap 1) | `moulinex.co.uk` |
| Google DAL API | rejects every domain (trap 2) |

**No SEB domain publishes usable well-known files today.** Auto-verification cannot be
the launch path. For Moulinex, a platform admin sets `allowed_package_ids` after
confirming ownership out-of-band. Auto-verification is worth building for self-serve
later, and Moulinex is a good regression fixture precisely because it exercises both
traps.

### 3.9 OpenAPI / schema export **[ENHANCEMENT — cheap, high leverage]**

Every backend route already uses typed Elysia `t.*` schemas. Exporting an OpenAPI
artifact enables Kotlin/Swift model codegen and kills the entire wire-format
duplication class in one move. Low cost, disproportionate payoff — worth doing early.

---

## 4. Offline behaviour

The sharing page **cannot be fully offline in any architecture** — the headline reward
comes from the network. A fully native screen would show a skeleton or a stale number
too. The goal is useful degradation, in three tiers:

| Tier | Condition | Behaviour |
|---|---|---|
| 1 | online | hosted page as designed |
| 2 | warm cache | §1.4 seeded params + HTTP-cached shell (service worker on **Android only**, see §2.3) → real content on first paint, revalidate in background |
| 3 | offline / load exceeds ~1.5s | skip the page entirely, fire the **native OS share sheet** with the locally-built link |

Tier 3 works because `buildSharingLink()` is **100% local computation** —
`merchantId` + `clientId` + `Date.now()/1000` through the FrakContext v2 codec. No
network, ever. Combined with the SDK's durable offline event queue, the user shares
successfully, the `sharing` interaction is queued, and it flushes on reconnect.
Attribution is fully preserved; only the reward pitch and FAQ are lost — which is the
correct thing to lose.

Tier 3 also happens to be ~60% of the data layer a fully-native sharing screen would
need, so it doubles as the migration beachhead if we later go native (see
[`02-native-sdk-overview.md`](./02-native-sdk-overview.md) §7).

---

## 5. Summary — change checklist

### Must land before **any** native release (security)

| # | Change | Where |
|---|---|---|
| 3.2 | **Authenticate identity merge** — `merge/execute` has no auth; live reward-theft vector | `services/backend` |
| 3.3 | Install-code ticket instead of `anonymousId`; per-code attempt limiting | `services/backend` + `apps/wallet` |
| 3.4 | Rate limit the 4 SDK-facing endpoints, keyed by `(merchantId, clientId)` not IP | `services/backend` |
| 3.6 | Remove raw-address identity bypass | `services/backend` |

### Blocking for MVP

| # | Change | Where |
|---|---|---|
| 1.0 | Enforce `clientId` under `native=1`; document the param contract | `apps/wallet` `/sharing` |
| 1.1 | `?native=1` chromeless mode | `/sharing` + `wallet-shared/SharingPage` |
| 1.2 | `?returnScheme=` result channel + `sid` correlation token + scheme validation | `apps/wallet` `/sharing` |
| 1.2b | `?confirmed=1` inbound channel (without it, `PostShareConfirmation` never shows) | `apps/wallet` `/sharing` |
| 1.3 | Install CTA emits native handoff; SDK owns the whole install step | `apps/wallet` `/sharing` |
| 1.5 | `?sdkv=`, `x-frak-sdk-version`, unknown-value tolerance, kill switch | both |
| 2.2 | iOS: autofocus install-code field, never read pasteboard | `apps/wallet` `/install` |
| 3.7 | `idempotencyKey` on `sharing`/`arrival` interactions | `services/backend` |
| 3.8 | `allowed_package_ids` column + package-id resolve arm | `services/backend` |
| 2.1 | Verify `frakwallet://install?m=&a=` end to end | `apps/wallet` deep links |

### Enhancements

| # | Change | Where | Value |
|---|---|---|---|
| 3.1 | Pre-formatted rewards (`?formatted=1`) | `services/backend` | high — kills worst drift risk |
| 1.4 | Seeded initial state params | `apps/wallet` `/sharing` | high — biggest perf win |
| 3.9 | OpenAPI export | `services/backend` | high — cheap, kills wire duplication |
| 3.5 | Verify purchase/arrival claim provenance | `services/backend` | pre-existing fraud surface |
| 2.3 | Service worker cache + preconnect (**Android only**) | `apps/wallet` | medium |

`apps/listener` requires **no changes**. The native SDK does not use the listener at
all — the iframe exists to solve browser origin isolation, which does not apply to a
native app.
