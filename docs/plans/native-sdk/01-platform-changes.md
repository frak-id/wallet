# Platform contract — wallet, backend, listener

What the native SDKs depend on in the existing web codebase. **Everything here has shipped**
except the two items in §5; this document is now the contract, not a work list.

`apps/listener` requires **no changes** and is not used by native — the iframe exists to
solve browser origin isolation, which a native app does not have.

## 1. `/sharing` — the hosted page

`apps/wallet/app/routes/sharing.tsx`. Standalone, URL-driven, already consumed by the Tauri
wallet. Native added six additive params; with them absent the page renders exactly as
before.

### 1.1 Inbound params

| Param | Native | Note |
|---|---|---|
| `merchantId` | **required** | |
| `clientId` | **required** | trap 1 |
| `products` | required for product shares | array of `SharingPageProduct` |
| `link` | required | the URL being shared |
| `appName`, `logoUrl` | recommended | |
| `attribution` | optional | JSON object **or** discrete `utm_*`/`ref`/`via` params — trap 2 |
| `native=1` | required | chromeless: the page hides its own header and footer CTAs, because the native sheet provides them |
| `returnScheme`, `sid` | required | the result channel, §1.2 |
| `confirmed=1` | on reload | shows `PostShareConfirmation` — §1.3 |
| `r=` | optional | seeded reward, display-only, validated by `sanitizeSeededReward`. Removes a round-trip from the critical path |
| `sdkv=` | recommended | SDK version, logged |
| `checkoutToken` | **never from native** | Shopify-only fallback |
| `redirectUrl` | unused in native mode | |

Unknown params are dropped rather than rejected (pinned by test), so an older page tolerates
a newer SDK.

**Trap 1 — `clientId` is mandatory under `native=1`.** Absent, the page would fall back to
the wallet's *own* `clientIdStore`, which inside a merchant web view may hold an unrelated
id — so `/install?m=&a=` would carry an identity that is not the SDK's and `ensure` would
link the **wrong** id. `beforeLoad` now fires `action=error` on the return channel and
returns — the page still renders, and only `throw`s when there is no `returnScheme` to
report on. The host is expected to close its sheet on that action.

**Trap 2 — `attribution=null` is not the same as omitting it.** Literal `null` *disables*
backend attribution defaults; `undefined` still applies them. A native `AttributionParams()`
with all-nil fields must map to **omitted**; expressing `null` needs an explicit
`disabled` sentinel.

**Trap 3 — the page does not track shares.** `sharing.tsx` wires only `onSuccess`, never
`onShared`, and `handleCopy` fires only an analytics event. The route therefore **never emits
`create_referral_link`** — not even for Tauri. The contrast is deliberate:
`apps/listener/…/SharingPage/index.tsx:167,186` wires both. **The native SDK owns 100 % of
sharing tracking.** Nothing enforces this; the failure is silent, and it rests on the SDK
author knowing he owns it.

### 1.2 The outbound result channel

The page navigates to `<returnScheme>://result?action=…&sid=…`, which the SDK intercepts and
cancels. `returnScheme` is validated against `^frak-[a-z0-9._-]{1,60}$` (`sanitizeReturnScheme`);
`sid` is echoed back for correlation.

| Action | Meaning |
|---|---|
| `install` | the user tapped the install CTA — the SDK owns everything after this |
| `dismiss` | close |
| `shareAgain` | reload without `confirmed=1` |
| `code` | carries the install code: `&value=<code>&exp=<epochSeconds>` |
| `error` | **not in the original spec** — see below |

Rules: navigate **only in response to a user gesture**, and never put a capability value on
the return URL — **except** `action=code`, which is permitted because the navigation is
provably intra-web-view (the SDK cancels it on every reachable path and never hands it to
the OS). That exemption rests on four properties of the transport, listed in
[`03-sharing-and-install.md`](./03-sharing-and-install.md) §2; if any is relaxed,
`action=code` goes with it. `exp` travels as epoch seconds (the backend returns ISO-8601, the
page converts) and both platforms parse it as a 64-bit integer — iOS deliberately not as a
`Double`, which would accept `NaN` where Kotlin's `toLongOrNull` does not.

**`action=error` is a knowing deviation.** It fires from the route guard, before render and
before any gesture, when a native launch is rejected (`native=1` with no `clientId`). The
alternative is worse: a host that gets no callback cannot distinguish a rejected launch from
a slow one. **The SDK must treat `error` as a terminal outcome.** One dead end remains
accepted rather than guessed at: a host that sends a *malformed* `returnScheme` has the
scheme stripped, so there is no channel left to report on and the sheet is left on the
wallet's error page.

### 1.3 `confirmed=1`

The page shows `PostShareConfirmation` only when its own share/copy handlers fire, and
`native=1` hides those. Without this reload the user shares and the page just sits there —
no confirmation, no install CTA, no wallet, no error anywhere. It seeds the confirmation
state on mount, so the SDK drives it by reloading.

### 1.4 Install CTA

`handleInstall` calls `returnToHost("install")` first and only navigates in-page when there
is no `returnScheme`. So under native the SDK owns the install step end to end — which it
must, because the page has no signing key and cannot mint a proof.

## 2. `/install` and deep links

- `frakwallet://install?m=<merchantId>&a=<anonymousId>` routes through `deepLink.ts`
  (`publicActions` + `routeResolvers`) to `/install`, which queues an `ensure` under the
  wallet's own session. **Verified by reading the code; never run on a device.**
- `extractSearchParams` forwards `p`, and `/install` resolves the proof **fragment first,
  then search param** — rationale in `03` §4.
- `/install` accepts `returnScheme` and `sid` (same sanitiser as `/sharing`) so it can hand
  the install code back over the return channel.
- The install-code field is autofocused on first launch. **The one-tap paste it was meant to
  enable does not exist on any shipping iOS release** — the QuickType suggestion is the real
  mechanism and it is best-effort (`03` §4).
- The SDK must **never read the pasteboard**: reading raises a banner and, since iOS 16, a
  permission prompt. Writing raises nothing.

## 3. `services/backend`

| Arm | Used for |
|---|---|
| `GET /user/merchant/resolve?merchantId=&lang=` or `?packageId=&platform=` | config, placements, copy |
| `GET /user/merchant/estimated-rewards?merchantId=&formatted=1&currency=&targetInteraction=&audience=&products=` | rewards, pre-formatted |
| `GET /user/merchant/referral-status?merchantId=` | referral status |
| `POST /user/track/interaction` | interactions |
| `POST /user/track/purchase` | purchases |

Every RPC method the MVP needs has a direct HTTPS twin, already `merchantId`-keyed and
performing no server-side origin check. Only the sharing page needs a web view.

**Pre-formatted rewards (`?formatted=1`)** return `best.formatted` computed by the same
`selectBestReward` the web uses — this is what makes `02` §1's "one source of truth for
money" real, and it is the single largest drift risk removed. Note `lang` is accepted by
`resolve` but **not** by `estimated-rewards`: the formatter's locale is currency-driven
(`eur→fr-FR`, `usd→en-US`, `gbp→en-GB`), so this is an interface difference, not a gap.

**Rate limits** on the two native-specific config endpoints: 60/min on `merchant/resolve`,
90/min on `estimated-rewards`. Caveat: the limiter is in-memory per pod, so with N replicas
the effective limit is N×.

**Idempotency.** `sharing` interactions accept `idempotencyKey` (stamped at enqueue by the
SDK, never per attempt) plus `sharingTimestamp`. `arrival` deliberately does **not** — it is
naturally idempotent through the upstream `referralLinkId`, which is what
`buildExternalEventId` keys on. Without this, offline queue retries would create duplicate
`create_referral_link` rows.

**Merchant identity by package id.** `allowedPackageIds text[]` with a GIN index, entries
stored as `platform:packageId` lowercased, resolved through
`normalizePackageId(packageId, platform)`. Native SDKs never compute `productId` —
`computeLegacyProductId` was removed from the JS SDK for exactly this reason, and `productId`
itself is a legacy nullable field with one remaining consumer and no on-chain use.
Auto-verification (Digital Asset Links / AASA) is **not implemented**; the launch path is a
manual admin entry through the business CRUD API.

**OpenAPI.** `services/backend/user-openapi.json` (`scripts/generate-openapi.ts`) is a valid
3.1.0 document with root envelope, servers and response schemas on all six MVP routes — this
is what generates Kotlin and Swift models from one source instead of hand-writing the wire
format twice. Getting it *generated* was cheap; getting it *correct* was not: four defects
were fixed, from a missing document envelope to three of six MVP routes declaring no response
schema at all. Two lessons: Elysia **strips undeclared response properties**, so an
incomplete `response` schema is a wire-format bug and not merely a docs gap; and
`@elysiajs/openapi` hardcodes `3.0.3` in its own source while emitting 3.1 constructs, so the
library's self-report is not evidence. What remains imperfect is on the `wallet/*` surface no
native SDK consumes.

**Identity security is owned by [`../identity-proof-of-possession/`](../identity-proof-of-possession/)**
and has shipped: `track/*` is resolve-only, the raw-address identity bypass is closed, the
install code resolves to an opaque ticket instead of an `anonymousId`, `WALLET_CONFLICT` is
handled on `ensure`, and proofs are verified. What remains is **enforcement** —
`merge/execute` is latch-gated rather than mandatory, tracked as `ROLLOUT-STEP-3` and gated
on a store binary being live with `minVersion` excluding older builds. Until then the
`?fmt=` merge flow is not shippable; `ensure` is the MVP mechanism.

Two deliberate residuals, so they are not re-discovered as bugs:

- `ArrivalHandler.ts:151` still looks up an **unverified raw-hex `referrer.wallet`** straight
  from the request body via `findGroupByIdentity`. It is a read-only lookup — it creates no
  node and performs no merge — which is why it survived the bypass removal.
- **`install-code/generate` stays permissive on purpose.** The wallet's own sharing page
  reaches it with a `clientId` it cannot sign for, so requiring a proof there would break
  the arm rather than secure it. The protection is the opaque ticket at `resolve` plus the
  atomically-enforced attempt cap — do not "harden" `generate`.

## 4. Offline

Three tiers behind one property: `buildLink()` is 100 % local computation, so offline sharing
works and only the reward pitch and FAQ are lost. Detail in `03` §3.

## 5. Still open

- **The kill switch.** `?sdkv=` and `x-frak-sdk-version` are accepted and logged, and they
  drive nothing — **deliberately**. There is no write path: no merchant column, no admin UI,
  no env var. And the shape was wrong: the field it was specified against
  (`MerchantResolveResponse.sdkConfig`) is per-merchant, while a bad SDK release is a
  fleet-wide, version-scoped event, so flipping it merchant by merchant during an incident is
  the wrong lever. It also cannot be sized until the header above yields a real version
  distribution. When it lands it should be **version-keyed and global** (env var or a small
  ops-owned table) and returned **top-level** on `MerchantResolveResponse`, not inside the
  merchant-owned optional `sdkConfig` — a binary whose merchant has no `sdkConfig` would
  otherwise never see it. **Needs an owner.**
- **The `frakwallet://install` device pass.** Code-verified only, in an identity-critical
  path.

Two things were considered and **dropped**, recorded so they are not re-opened: the service
worker cache for `/sharing` (the HTML shell is `no-store` by design, the SW is registered
only as a side effect of the notification adapter which `/sharing` never imports, the offline
render dies on two per-merchant queries anyway, and the win would be Android-only and
second-visit-only — the `?r=` seeding covers the real case); and enforcing Trap 3 in the page
(§1.1), which stays an ownership assumption.
