# Native SDK — the wire contract

Reference, not history. This is the one spec that spans `apps/wallet`, `services/backend` and both
native SDKs, and that no single codebase states. Change any table here and something on another
platform breaks silently.

`apps/listener` requires no changes and is not used by native — the iframe exists to solve browser
origin isolation, which a native app does not have.

## 1. `/sharing` — the hosted page

`apps/wallet/app/routes/sharing.tsx`. Standalone, URL-driven, already consumed by the Tauri wallet.
Native adds six additive params; absent, the page renders exactly as before.

### 1.1 Inbound params

| Param | Native | Note |
|---|---|---|
| `merchantId` | required | |
| `clientId` | required | trap 1 |
| `products` | required for product shares | array of `SharingPageProduct` |
| `link` | required | the URL being shared |
| `appName`, `logoUrl` | recommended | |
| `attribution` | optional | JSON object, or discrete `utm_*`/`ref`/`via` params — trap 2 |
| `native=1` | required | chromeless: the page hides its header, the native sheet owns dismissal. Footer CTAs stay and reach the host as `share`/`copy` |
| `returnScheme`, `sid` | required | the result channel — §1.2 |
| `confirmed=1` | on reload only | shows `PostShareConfirmation` — §1.3 |
| `r=` | optional | seeded reward, display-only, validated by `sanitizeSeededReward` |
| `sdkv=` | recommended | SDK version, logged only — drives nothing, see §5 |
| `preload=1` | pool only | fires `sharing_page_preloaded` instead of `sharing_page_viewed` |
| `checkoutToken` | never sent by native | Shopify-only fallback |
| `redirectUrl` | unused in native mode | |

Unknown params are dropped, not rejected, and a test pins it — an older page tolerates a newer SDK.

**Trap 1 — `clientId` is mandatory under `native=1`.** Absent, the page falls back to the wallet's
own `clientIdStore`, which inside a merchant web view may hold an unrelated id and would link the
wrong identity at `/install`. `beforeLoad` fires `action=error` rather than falling back.

**Trap 2 — `attribution=null` is not the same as omitting it.** A literal `null` disables the
backend's attribution defaults; omitted still applies them. A native SDK holding an all-nil
attribution object must **omit** the param.

**Trap 3 — the page does not track shares.** `sharing.tsx` wires only `onSuccess`, and `handleCopy`
fires analytics only. The route never emits `create_referral_link`. The native SDK owns 100 % of
share tracking, and nothing in the page enforces that.

### 1.2 The return channel

The page navigates to `<returnScheme>://result?action=…&sid=…`; the SDK intercepts and cancels the
navigation. `returnScheme` is validated against `^frak-[a-z0-9._-]{1,60}$`. `sid` is echoed back for
correlation.

| Action | Meaning |
|---|---|
| `ready` | the page's own JS reports a rendered document |
| `share` | SDK raises the OS chooser, then reloads with `confirmed=1` |
| `copy` | SDK writes the clipboard and records the interaction; **no reload** |
| `install` | SDK owns everything after — §3 |
| `code` | carries the install code: `&value=<code>&exp=<epochSeconds>` |
| `shareAgain` | reload without `confirmed=1` |
| `dismiss` | close |
| `error` | terminal; fired by the route guard before render |

Rules:

- Navigate only on a user gesture.
- **Never put a capability value on the return URL** except `action=code`. That exemption is tied to
  the no-bridge transport decision; if the transport changes, the exemption goes with it.
- `exp` is epoch seconds parsed as a 64-bit integer on both platforms, never a `Double` — a `Double`
  silently accepts `NaN`.
- A malformed `returnScheme` leaves no channel to report on, and the sheet is stuck on the wallet's
  error page.

### 1.3 `confirmed=1`

The page shows `PostShareConfirmation` only when its own share/copy handlers fire, and those are
hidden under `native=1`. The SDK drives that state by reloading with `confirmed=1` — after a real
share only, never after a copy.

### 1.4 The install CTA

`handleInstall` calls `returnToHost("install")` first and only navigates in-page if `returnScheme`
is absent. Under native the SDK owns the whole install step; the page has no signing key.

## 2. `/install` and deep links

- `frakwallet://install?m=<merchantId>&a=<anonymousId>` routes through `deepLink.ts` to `/install`,
  which queues an `ensure` under the wallet's own session.
- `extractSearchParams` forwards `p`; the proof resolves fragment first, then search param.
- `/install` accepts `returnScheme` and `sid` through the same sanitiser as `/sharing`, so the
  install code can come back over the return channel.
- The install-code field is autofocused. **One-tap paste does not exist on any shipping iOS
  release** — the QuickType suggestion is the real mechanism.
- **The SDK must never read the pasteboard.** Reading raises a banner and, since iOS 16, a
  permission prompt. Writing raises nothing.

## 3. Backend endpoints

| Method / path | Purpose |
|---|---|
| `GET /user/merchant/resolve?merchantId=&lang=` or `?packageId=&platform=` | config, placements, copy |
| `GET /user/merchant/estimated-rewards?merchantId=&formatted=1&currency=&targetInteraction=&audience=&products=` | rewards, pre-formatted |
| `GET /user/merchant/referral-status?merchantId=` | referral status |
| `POST /user/track/interaction` | interactions |
| `POST /user/track/purchase` | purchases |

- `?formatted=1` returns `best.formatted` from the same `selectBestReward` the web uses — one money
  source of truth.
- `lang` is accepted by `resolve` but **not** by `estimated-rewards`; there, locale is
  currency-driven: `eur→fr-FR`, `usd→en-US`, `gbp→en-GB`.
- **Rate limits.** `resolve` is 60/min. `estimated-rewards` declares 90/min but is charged to the
  same 60/min bucket registered ahead of it, so the effective budget is 60/min per IP for both
  together, pinned by `index.test.ts`. The limiter is in-memory per pod, so the real ceiling is
  N × replicas.
- **Idempotency.** `sharing` interactions carry `idempotencyKey` (stamped at enqueue, not per
  attempt) plus `sharingTimestamp`. `arrival` needs none — it is naturally idempotent through the
  upstream `referralLinkId`.
- **Merchant identity by package id.** `allowedPackageIds text[]` with a GIN index, entries stored
  as lowercased `platform:packageId`, resolved through `normalizePackageId`. Native SDKs never
  compute `productId` themselves. Auto-verification via Digital Asset Links / AASA is **not
  implemented** — launch is manual admin entry.
- `services/backend/user-openapi.json` is a valid OpenAPI 3.1.0 document and generates both Kotlin
  and Swift models from one source. The `wallet/*` surface is not used by native.

### Deliberate backend residuals — do not "fix"

- `ArrivalHandler.ts:151` looks up an unverified raw-hex `referrer.wallet` through
  `findGroupByIdentity`. Read-only: it creates no node and performs no merge.
- `install-code/generate` stays permissive — the wallet's own sharing page calls it with a
  `clientId` it cannot sign for. Protection is the opaque ticket at `resolve` plus an atomic attempt
  cap. **Do not harden `generate`.**

## 4. Golden fixtures

Committed language-agnostic JSON vectors that TypeScript, Kotlin and Swift must reproduce byte for
byte. The vectors are the contract; the implementation is not. This exists because iOS and Android
emit different output for identical locale/currency input (`"CHF 10.00"` vs `"CHF10.00"`) and ICU
skew diverges even within one platform family, so "just use the platform formatter" is not
available.

| Concern | File (under `sdk/core/src/`) | Generator | Entries |
|---|---|---|---|
| Identity — signed byte layout | `identity/fixtures/golden-proofs.json` | `scripts/generate-golden-proofs.ts` | 6 |
| FrakContext v2 codec | `context/fixtures/golden-context.json` | `scripts/generate-golden-context.ts` | 32 (11 encode, 21 reject) |
| Reward selection + currency formatting | `rewards/fixtures/golden-rewards.json` | `scripts/generate-golden-rewards.ts` | 67 across 6 kinds |

Identity is `op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)`, fixed width, UUIDs as raw
16 bytes, from the crypto-free `identity/canonical.ts` so signer and verifier build on one artifact.
Codec entries normalise on decode rather than rejecting: UUIDs are case-insensitive on input and
decode always emits lowercase canonical.

### 4.1 Envelope

```json
{ "formatVersion": 1, "fixtures": [ { "name": "…", "description": "…", "kind": "…" } ] }
```

`formatVersion` is identical across all three files and bumps only when the envelope *shape*
changes, never when a payload gains a field. Everything inside an entry is opaque to both loaders.

```bash
bun run --cwd sdk/core fixtures:generate           # identity
bun run --cwd sdk/core fixtures:generate:context   # codec
bun run --cwd sdk/core fixtures:generate:rewards   # rewards
```

### 4.2 Rules

- Generated only, never hand-edited. A wrong-looking fixture means the generator or the frozen
  module is wrong, not the JSON.
- Byte-deterministic: regenerating with no semantic change produces a zero diff. No timestamps, no
  paths, no randomness, no locale-dependent host state.
- No round-trip tests — `encode(decode(x)) == x` proves internal consistency, not conformance.
- Fail loudly, never skip. Both loaders throw on an absent or invalid file, a wrong `formatVersion`,
  or an empty `fixtures` array, naming the missing path, the resolved repo root and the regeneration
  command. Both platforms test that failure path.

Adding a group: freeze the module first, add the generator and its package export, match the
envelope, prove determinism twice, escape non-ASCII (§4.3), add a loader constant and conformance
suite next to the code it covers — then **break one byte on one platform and confirm the test
fails**. A fixture nobody has seen fail is a fixture that proves nothing.

### 4.3 The invisible-character hazard

Currency output carries codepoints that are invisible in a diff: `U+00A0`/`U+202F` (fr-FR thousands
separators), `U+2212` (minus, not ASCII `-`), `U+200E`/`U+200F` (directional marks).

- The corpus file is pure ASCII — every codepoint above `U+007F` is escaped as `\uXXXX`.
- Every expected string is recorded **twice**: as an escaped literal, and as an explicit codepoint
  array under the same name with a `Codepoints` suffix.
- **Assert the codepoint array first.** A `U+202F`→`U+00A0` substitution is invisible in a
  literal-only diff and obvious against codepoints.
- 9 of the 43 pairs are nested, so the corpus walker pairing `X` with `XCodepoints` must recurse.
- Generated under ICU 74.2 / CLDR 44. Android below roughly API 28 ships pre-ICU-63 CLDR and emits
  `U+00A0` where the corpus has `U+202F` — an environment difference, not a defect. Exactly 6
  entries carry a `U+202F`; a mismatch anywhere else is a real finding, and the report should name
  the runtime ICU/CLDR version.
- Covered locales are `fr-FR`, `en-US`, `en-GB`, all LTR. No negative amounts and no RTL locales,
  both deliberately.

### 4.4 Loading

The corpus lives in `sdk/core`, outside both native projects. Both loaders walk up to the repo root,
identified by `sdk/core` **and** a repo marker (`.git` or `package.json`) together.

| | Android | iOS |
|---|---|---|
| Loader | `frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/GoldenFixtures.kt` | `Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift` |
| Parser | `org.json` (test scope) | `JSONSerialization` |
| Framework | JUnit 4 | Swift Testing |

`JSONSerialization`/`org.json` over `Codable`/kotlinx-serialization deliberately: a typed payload
would make every payload change a loader change too. `org.json` needs a real `testImplementation`
dependency (the stubbed test `android.jar` throws on every call) but, being test-scoped, never
reaches the published POM.

### 4.5 Coverage

| | State |
|---|---|
| Envelope | locked across all three files |
| Loaders | green both platforms, with a deliberate failure-path test |
| Identity conformance | asserted both platforms |
| Codec conformance | asserted both platforms |
| **Rewards conformance** | **absent** — `GoldenFixtures.REWARDS`/`.rewards` is loaded by nobody; reward decoding is asserted against hand-written literals instead. 67 entries, the largest file, currently asserting nothing |
| Has the corpus ever caught a divergence? | No. The deliberate-injection test has never been run |

## 5. Open on the contract itself

| Item | State |
|---|---|
| **The kill switch** | `?sdkv=` and `x-frak-sdk-version` are accepted and logged but drive nothing — no merchant column, no admin UI, no env var. The shape is also wrong: `MerchantResolveResponse.sdkConfig` is per-merchant, but a bad release is fleet-wide and version-scoped. Needs to be a version-keyed, global, top-level field. **Needs an owner** |
| **`native=1` footer ownership** | The marker's meaning changed from "the page hides its footer" to "the page draws it, the native sheet performs it". An old SDK against a new page double-renders the footer and `sendHostResult` lies; a new SDK against an old page has no footer and a dead funnel. Now that `1.0.0-beta.1` is published, this is live risk, not theoretical — it needs a capability param or a return-channel ack. `sdkv` is already carried and could gate it |
| **`frakwallet://install` device pass** | Code-verified only, in an identity-critical path |
| **`/sharing` ↔ `/install` param asymmetry** | Needs a wallet-side agreement on the canonical set before either side moves |
| **`--frak-host-*` CSS vars** | Hand-mirrored string literals in Kotlin and TypeScript, each asserting the other's spelling in its own test, with no compiler link. A rename passes both builds and fails at runtime |
