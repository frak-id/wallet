# Platform contract — wallet, backend, listener

What the native SDKs depend on in the existing web codebase. Shipped, except the two
items in §5. `apps/listener` requires no changes and is not used by native — the iframe
exists to solve browser origin isolation, which a native app does not have.

## 1. `/sharing` — the hosted page

`apps/wallet/app/routes/sharing.tsx`. Standalone, URL-driven, already consumed by the
Tauri wallet. Native added six additive params; absent, the page renders exactly as
before.

### 1.1 Inbound params

| Param | Native | Note |
|---|---|---|
| `merchantId` | required | |
| `clientId` | required | trap 1 |
| `products` | required for product shares | array of `SharingPageProduct` |
| `link` | required | the URL being shared |
| `appName`, `logoUrl` | recommended | |
| `attribution` | optional | JSON object or discrete `utm_*`/`ref`/`via` params — trap 2 |
| `native=1` | required | chromeless: the page hides its header, the native sheet owns dismissal. Footer CTAs stay and reach the host as `share`/`copy` |
| `returnScheme`, `sid` | required | the result channel, §1.2 |
| `confirmed=1` | on reload | shows `PostShareConfirmation`, §1.3 |
| `r=` | optional | seeded reward, display-only, validated by `sanitizeSeededReward` |
| `sdkv=` | recommended | SDK version, logged |
| `checkoutToken` | never from native | Shopify-only fallback |
| `redirectUrl` | unused in native mode | |

Unknown params are dropped rather than rejected (pinned by test), so an older page
tolerates a newer SDK.

**Open, before-first-publish: footer ownership is ambiguous on the wire.** `native=1`
used to mean "the page hides its footer"; it now means "the page draws it, the sheet
performs it." An old SDK against the new page double-renders footers and
`sendHostResult` lies (`true` whenever `returnScheme` is present); a new SDK against the
old page gets no footer, a dead funnel. Neither is live — no publish path exists — but
this needs a capability param or a return-channel ack before the first publish. `sdkv`
is carried and would be enough to gate on but drives nothing today.

**Trap 1 — `clientId` is mandatory under `native=1`.** Absent, the page falls back to the
wallet's `clientIdStore`, which inside a merchant web view may hold an unrelated id and
would link the wrong identity at `/install`. `beforeLoad` fires `action=error` instead.

**Trap 2 — `attribution=null` is not the same as omitting it.** Literal `null` disables
backend attribution defaults; `undefined` still applies them. A native empty attribution — every
field nil — must therefore map to omitted, not `null`. On Android that is now `AttributionParams { }`,
the Kotlin sugar over its `Builder`; Swift still writes `AttributionParams()`.

**Trap 3 — the page does not track shares.** `sharing.tsx` wires only `onSuccess`;
`handleCopy` only fires analytics. The route never emits `create_referral_link` — the
native SDK owns 100% of sharing tracking, unenforced.

### 1.2 The outbound result channel

The page navigates to `<returnScheme>://result?action=…&sid=…`, which the SDK intercepts
and cancels. `returnScheme` is validated against `^frak-[a-z0-9._-]{1,60}$`; `sid` is
echoed back for correlation.

| Action | Meaning |
|---|---|
| `install` | user tapped the install CTA — the SDK owns everything after this |
| `dismiss` | close |
| `shareAgain` | reload without `confirmed=1` |
| `share` | SDK raises the OS chooser, then reloads with `confirmed=1` |
| `copy` | SDK writes the clipboard and records the interaction, does not reload |
| `code` | carries the install code: `&value=<code>&exp=<epochSeconds>` |
| `error` | not in the original spec, see below |

Navigate only on a user gesture; never put a capability value on the return URL except
`action=code` (justified in `03-sharing-and-install.md` §2 — if that transport contract
is relaxed, the exemption goes with it). `exp` is epoch seconds, parsed as a 64-bit
integer on both platforms, not a `Double` (would accept `NaN`).

`action=error` fires from the route guard, before render, on a rejected native launch
(`native=1` with no `clientId`). The SDK must treat it as terminal. A malformed
`returnScheme` leaves no channel to report on — the sheet is left on the wallet's error
page.

### 1.3 `confirmed=1`

The page shows `PostShareConfirmation` only when its own share/copy handlers fire, which
`native=1` hides. The SDK drives it by reloading with `confirmed=1`.

### 1.4 Install CTA

`handleInstall` calls `returnToHost("install")` first and only navigates in-page absent a
`returnScheme`. Under native the SDK owns the install step end to end — the page has no
signing key.

## 2. `/install` and deep links

- `frakwallet://install?m=<merchantId>&a=<anonymousId>` routes through `deepLink.ts` to
  `/install`, which queues an `ensure` under the wallet's own session. Code-verified
  only, never run on a device. `extractSearchParams` forwards `p`; the proof resolves
  fragment first, then search param.
- `/install` accepts `returnScheme` and `sid` (same sanitiser as `/sharing`) to hand the
  install code back over the return channel.
- The install-code field is autofocused; the one-tap paste it was meant to enable does
  not exist on any shipping iOS release — QuickType suggestion is the real, best-effort
  mechanism. The SDK must never read the pasteboard: reading raises a banner and, since
  iOS 16, a permission prompt. Writing raises nothing.

## 3. `services/backend`

| Arm | Used for |
|---|---|
| `GET /user/merchant/resolve?merchantId=&lang=` or `?packageId=&platform=` | config, placements, copy |
| `GET /user/merchant/estimated-rewards?merchantId=&formatted=1&currency=&targetInteraction=&audience=&products=` | rewards, pre-formatted |
| `GET /user/merchant/referral-status?merchantId=` | referral status |
| `POST /user/track/interaction` | interactions |
| `POST /user/track/purchase` | purchases |

Every RPC method the MVP needs has a direct HTTPS twin, `merchantId`-keyed, no
server-side origin check. Only the sharing page needs a web view.

- Pre-formatted rewards (`?formatted=1`) return `best.formatted` from the same
  `selectBestReward` the web uses — one source of truth for money. `lang` is accepted by
  `resolve` but not by `estimated-rewards`: locale is currency-driven (`eur→fr-FR`,
  `usd→en-US`, `gbp→en-GB`).
- Rate limits: 60/min on `merchant/resolve`. `estimated-rewards` declares 90/min but is also
  charged to the 60 bucket registered ahead of it, so its effective budget is 60/min per IP,
  shared with `resolve` — pinned by `index.test.ts`. In-memory per
  pod (effective limit is N× replicas).
- Idempotency: `sharing` interactions carry `idempotencyKey` (stamped at enqueue, never
  per attempt) plus `sharingTimestamp`. `arrival` doesn't need one — it's naturally
  idempotent through the upstream `referralLinkId`.
- Merchant identity by package id: `allowedPackageIds text[]` (GIN index), entries stored
  as `platform:packageId` lowercased, resolved through `normalizePackageId`. Native SDKs
  never compute `productId`. Auto-verification (Digital Asset Links / AASA) is not
  implemented — launch is a manual admin entry.
- `services/backend/user-openapi.json` is a valid 3.1.0 doc, generating Kotlin and Swift
  models from one source. The `wallet/*` surface no native SDK consumes remains
  imperfect.
- Identity security is owned by
  [`../identity-proof-of-possession/`](../identity-proof-of-possession/): `track/*` is
  resolve-only, the install code resolves to an opaque ticket, `WALLET_CONFLICT` is
  handled on `ensure`, proofs are verified. Enforcement (mandatory `merge/execute`) is
  `ROLLOUT-STEP-3`, gated on a live store binary; until then `?fmt=` merge is unsupported
  and `ensure` is the MVP mechanism.

Two deliberate residuals:

- `ArrivalHandler.ts:151` looks up an unverified raw-hex `referrer.wallet` via
  `findGroupByIdentity` — read-only, creates no node, performs no merge.
- `install-code/generate` stays permissive: the wallet's own sharing page reaches it with
  a `clientId` it cannot sign for. Protection is the opaque ticket at `resolve` plus the
  atomic attempt cap — do not harden `generate`.

## 4. Offline

`buildLink()` is 100% local computation, so offline sharing works and only the reward
pitch and FAQ are lost. Detail in `03-sharing-and-install.md` §3.

## 5. Still open

- **The kill switch.** `?sdkv=` and `x-frak-sdk-version` are accepted and logged but drive
  nothing — no write path exists (no merchant column, no admin UI, no env var), and the
  shape is wrong: `MerchantResolveResponse.sdkConfig` is per-merchant while a bad release
  is fleet-wide and version-scoped. Should land version-keyed and global, top-level on
  `MerchantResolveResponse`. Needs an owner.
- **The `frakwallet://install` device pass.** Code-verified only, in an identity-critical
  path.

Considered and dropped, not to be re-opened: a service worker cache for `/sharing` (HTML
shell is `no-store` by design, offline render dies on two per-merchant queries anyway,
`?r=` seeding covers the real case); and enforcing Trap 3 in the page (§1.1), which stays
an ownership assumption.
