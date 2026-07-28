# Identity proof-of-possession

Bind every anonymous identity to a device-held P-256 keypair, so that only the device
that owns an anonymous id can act on it.

**Status:** planned, not started. **Blocks:** native SDK work
([`../native-sdk/`](../native-sdk/)).

**Constraints this plan is optimised against**, in order:

1. This is a **side quest** for the native SDK. It must not become a platform rewrite.
2. **Minimal blast radius.** It touches SDK, listener, wallet and backend by necessity —
   the goal is the smallest coherent change in each, not the most elegant one.
3. **No meaningful SDK/listener performance regression.** Some cost is unavoidable; it
   stays off the critical path.
4. **The wallet binary cannot be changed quickly.** Store review is 10–15 business days.
   Every wallet-facing change ships behind a retro-compatible arm. See §6.

---

## 1. Why this, why now

### The vulnerability

`POST /user/identity/merge/execute` has **no session auth of any kind**
(`services/backend/src/api/user/identity/merge.ts:53-85`) — it is gated purely on
possession of a `mergeToken` JWT. And `merge/initiate` mints that token for any
`sourceAnonymousId` a caller names, with no proof the caller owns it
(`merge.ts:11-51`, `AnonymousMergeOrchestrator.ts:30-71`). The token's `sourceGroupId`
claim is the only value that drives behaviour on execute
(`AnonymousMergeService.ts:22-50`).

The anonymous id is not secret. **Every share link publishes it in clear.**
`buildSharingLink` embeds `clientId` as field `c` of the FrakContext, which is
base64url-encoded into `?fCtx=`
(`packages/wallet-shared/src/sharing/buildSharingLink.ts:49-58`). Anyone who receives,
screenshots, or finds a reposted referral link can decode the sharer's `clientId` and the
`merchantId` — both inputs the attack needs.

Two unauthenticated endpoints compound this by handing out `anonymousId` directly:

- `POST /identity/install-code/resolve` — returns `anonymousId` for any valid 6-char code
  (`installCode.ts:34-88`), rate-limited 10/min
- `GET /identity/order-client?merchantId&checkoutToken` — returns the raw `clientId`
  for a purchase (`orderClient.ts:14-60`), rate-limited 30/min, no auth

Attack:

1. `POST /merge/initiate {sourceAnonymousId: <victim's, from their link>, merchantId}`
   — no session required → attacker receives a valid `mergeToken` for the victim's group.
2. Attacker attaches their own wallet to their own anonymous id (legitimate flow), so
   their group has `hasWallet = true`.
3. `POST /merge/execute {mergeToken, targetAnonymousId: <attacker's>, merchantId}` — no
   session. Wallet-priority anchoring (`IdentityWeightService.checkWalletPriority`, called
   from `determineAnchor:145`) selects the attacker's group as anchor, because the
   victim's pre-install group has no wallet.
4. Rewards are attached to an **identity group**, not to a wallet
   (`asset_logs.identityGroupId` is `notNull`; `recipientWallet` is nullable), and the
   wallet is resolved at settlement (`BatchRewardOrchestrator.ts:196`,
   `SettlementOrchestrator.ts:269`). Lockup windows run up to 30 days. Because the
   victim's anonymous id now points at the attacker's group, rewards the victim
   **already earned** but that have not settled pay out to the attacker.

### Late wallet binding is a feature — do not "fix" it

It is tempting to conclude that the wallet should be snapshotted at accrual. **That would
break the product.** The whole point of decoupling the anonymous id from the wallet is
that a user — an influencer especially — can share a link, earn rewards, and create their
wallet *later*, with the merchant site reminding them that rewards are pending. At
accrual there is frequently no wallet to snapshot; forcing one would either drop the
reward or block accrual on wallet creation, destroying the share-first / install-later
flow.

The defect is not *when* the wallet is resolved. It is that **group membership can be
changed by an unauthenticated attacker**:

```
reward           → identityGroupId      ✅ deliberate, keep
identityGroupId  → wallet (late)        ✅ deliberate, keep
anonymousId      → identityGroupId      ❌ anyone can repoint this
```

Late binding is safe **iff** the binding target is stable. Authenticate the merge and
the existing settlement model is correct as-is. Everything in this document targets that
third arrow and nothing else.

> Note this interacts with the planned "pending rewards" reminder on merchant sites.
> That feature is *easier* under the current model (rewards on a wallet-less group are
> exactly the queryable state it needs) — but it also raises the stakes: it tells a user
> a concrete pending amount, and a hijacked user would then install and hit the lockout
> below with that number in mind. Fix this first.

### The consequence that is worse than theft

Trace what happens when the victim eventually installs the wallet:

```
attacker merged victim's anon id into attacker's group (wallet: attacker)
  ↓ IdentityMergeService.mergeGroups reassigns identity_nodes.groupId to the
    anchor and DELETES the losing group row — the victim's anonymous_fingerprint
    node now permanently resolves to the attacker's group
  ↓ victim installs, wallet calls POST /identity/ensure
  ↓ ensure builds [wallet, anonymous_fingerprint] → resolveAndAssociate
  ↓ the two nodes resolve to two different groups
  ↓ determineAnchorFromMultiple → uniqueWallets.size > 1
  → WALLET_CONFLICT   (IdentityWeightService.ts:181-186)
```

**The victim can never link their wallet for that merchant.** `ensure.ts` has no
`try`/`catch`, so the 409 propagates straight to the caller, and there is **no
WALLET_CONFLICT handling, retry, or dispute-resolution path anywhere in the backend**.
The exception that protects post-install users permanently bricks pre-install victims.
A cheap, remote, unauthenticated denial-of-service against exactly the users we are
trying to onboard — silent until they hit an error nobody can resolve.

Worse on the wallet side: the ensure call is fire-and-forget with retry-on-failure
(`useExecutePendingActions.ts:62-91`) and the action is only removed from the store on
**success**. A permanently-409ing ensure retries on every app launch for the full 7-day
TTL, then silently expires.

> **Traced and confirmed**, not inferred. Note this is a *different* throw site from the
> one on the `/merge/execute` path: `associate()` guards that one at
> `IdentityOrchestrator.ts:83-90`, but `/identity/ensure` never calls `associate()` — it
> goes through `resolveAndAssociate` → `determineAnchorFromMultiple`. Both need
> regression tests; they are separate code paths.

### Why the vulnerable window is structural, not an edge case

The product flow is: share → *then* get prompted to create a wallet → *then* install.
**Every user's first share happens before they install, by design.** The link they
publish carries that pre-install `clientId`, publicly, forever.

Influencers do eventually install — but their *referees*, the whole audience a referral
is meant to convert, are pre-install by definition.

### Why now

**We currently have almost no shares and no active users** — under 100 users and fewer
than 10 published share links. No large creators have joined. This is the cheapest this
change will ever be:

- few published links carry a pre-install `clientId`
- the legacy-id population that cannot be retrofitted is nearly empty
- no influencer has meaningful unsettled rewards to redirect
- no migration pressure, no support burden

This matters more than it looks. **Ids already published can never be secured** — not by
this design, not by any alternative (§2.6). The permanently-exposed set is frozen at
whatever exists on ship day. Today that set is small enough to repair by hand; every week
of growth enlarges it irreversibly.

**This ships before any native SDK work.**

---

## 2. Design

### 2.0 Where the key lives, and how proofs travel

This is the constraint that shapes everything else, and it is easy to get wrong.

The `clientId` exists in **two separate copies on two separate origins**:

| | Storage | Origin | Written by |
|---|---|---|---|
| SDK copy — **authoritative** | `localStorage["frak-client-id"]` | **merchant page** | `sdk/core/src/config/clientId.ts:28` |
| Listener copy — cache | `clientIdStore`, key `frak_client_id_store` | **`wallet.frak.id`** | seeded from the `?clientId=` iframe param (`resolvingContextStore.ts:14-23`) |

`wallet.frak.id` serves both the wallet app and `/listener` via ingress path routing
(`infra/gcp/wallet.ts:289-308`), so the listener shares an origin with the wallet app.

The listener copy is **not a second identity**: it is overwritten from the SDK-supplied
URL param on every load, including after persist rehydration
(`resolvingContextStore.ts:20-25`). Even on a browser without per-top-level-site storage
partitioning, visiting a different merchant simply overwrites the slot. It is a cache of
the SDK value, always.

> One exception worth tracking: `useInstallReferrer.ts:77` writes `clientId` into that
> same store from the Play referrer, in the **wallet app** (top-level `wallet.frak.id`),
> and `sharing.tsx:118` reads it back. That path is not SDK-seeded.

**The key lives on the merchant origin, in `sdk/core`, next to the id it derives.**
That is the correct trust boundary — the merchant page is where the id is born, used, and
published.

**This also settles key scoping for free.** `localStorage` is origin-scoped, so the SDK's
key is *inherently* per-merchant: one merchant origin → one keypair → one derived id.
There is no shared key, no cross-merchant id, and therefore no cross-merchant correlation
to engineer around. Per-merchant derivation variants (`SHA-256(pubkey ‖ merchantId)` and
similar) are unnecessary — the browser already enforces the property.

**All RPC stays SDK → listener.** `packages/rpc` has a full correlated request/response
mechanism, but it is strictly **SDK-initiated** — the SDK asks, the listener answers.
There is no listener-**initiated** request channel: `packages/rpc/src/listener.ts`
exposes only `lifecycleHandlers` on that side, with no listener-side `request`. We are
not building one. Instead, the SDK **pushes proofs down** as additional
parameters on calls it already makes, and the listener **passes them through** to the
backend without interpreting them:

| Backend call | Issued by | Proof arrives via |
|---|---|---|
| `/identity/merge/initiate` | listener (`useOnGetMergeToken.ts:24`) | new optional param on `frak_getMergeToken` (currently `Parameters?: undefined`, `rpc.ts:194-198` — purely additive) |
| `/identity/merge/execute` | listener (`lifecycleHandler.ts:266`) | new `sdkIdentity` field on the `resolved-config` lifecycle payload (`lifecycle/client.ts:47-71`) |
| `/install?m=&a=` URL | listener builds it (`SharingPage/index.tsx:69`) | same `sdkIdentity` from `resolved-config`, carried into the URL |
| `/identity/ensure` (SDK arm) | SDK directly (`ensureIdentity.ts:51`) | signed in place — no transport work |
| `/identity/ensure` (wallet arm) | wallet (`useExecutePendingActions.ts:125`) | proof/ticket carried through `pendingActionsStore` — see §5 |

No new RPC methods. Two additive parameter changes. That is the whole transport story.

### 2.1 The anonymous id is derived from the keypair

```
keypair  = P-256 (ECDSA, SHA-256)
clientId = uuid_from(SHA-256(pubkey_raw_uncompressed)[0..16])
```

with RFC-4122 version (`0x40`) and variant (`0x80`) bits set on bytes 6 and 8 so the
result is a syntactically valid UUID, and lowercase hex.

This makes identity **self-authenticating**: given a public key, anyone recomputes the id
and checks it matches. **No key table, no registry, no bind endpoint, no
trust-on-first-use window for new clients.** Verification is fully stateless.

**Truncating SHA-256 to 128 bits is comfortable here.** The property that matters is
second-preimage resistance: an attacker must find a keypair whose public key hashes to a
*specific* existing id, which is ~2¹²⁸ work. The birthday bound (~2⁶⁴) only yields *some*
colliding pair of freshly-generated keypairs, which buys an attacker nothing — they need
to hit a victim's existing id, not any two ids.

**Why derive rather than use the pubkey directly as the id.** The FrakContext v2 codec
allocates exactly 16 bytes for the client id and parses it as a UUID
(`frakContextV2Codec.ts:17`, `uuidToBytes:55`). A P-256 public key is 33 bytes compressed
/ 65 uncompressed. Using it directly means a v3 wire format — and since v1/v2
disambiguate **purely on total payload length** (`frakContextV2Codec.ts:26`), that breaks
every published link and every cross-language golden fixture. Deriving keeps the id at 16
bytes and changes nothing on the wire.

#### Why not a `(anonymousId, merchantId) → pubkey` table instead

A registry that binds a key to the *existing* random id looks cheaper — no derivation
spec, no async, no migration. It was considered and rejected, for one decisive reason:
**it has a TOFU race for brand-new clients that derivation does not.**

The bind would have to happen on the first proof-carrying call. But proofs only ride on
calls that fire *late*: `ensureIdentity` (only once a wallet is connected,
`ensureIdentity.ts:29`), `merge/initiate` (in-app-browser escape only), and
`install-code/generate`. None of them fire for a new user who lands on a merchant site
and shares immediately — so their id is published in the `fCtx` link **before anything
binds it**, leaving it claimable by whoever harvests the link first. That is precisely
the pre-install sharer this plan exists to protect.

Closing that race requires a dedicated bind call at init — a new endpoint *and* a network
round-trip on the critical path, violating constraint 3. Derivation needs neither: the id
**is** the proof, from the instant it exists.

Secondary benefits: no table, no cache-invalidation story, no conflicting-bind alarm to
build and monitor, and native/web share one algorithm with no registry lookup.

#### The async cost is smaller than it looks

`getClientId()` is synchronous (`clientId.ts:28`), called from 9 sites, and is **exported
public API** (`sdk/core/src/index.ts:8`). It does **not** need to become async:

- `createIframe` is *already* `async` and is already `await`ed in `setupClient.ts:29`
  before anything else touches the id. Derive there, before `iframe.src` is set
  (`iframeHelper.ts:60`), and cache in module state.
- `getClientId()` then keeps its synchronous signature and reads the cache. Verified safe
  for the two call sites that cannot await — `createIFrameFrakClient.ts:148,165`
  (OpenPanel `filter` and `setGlobalProperties`) — because both run *after*
  `await createIframe`.
- Only the **first visit ever** pays keygen (~1–3 ms; 10–30 ms low-end; 30–80 ms on the
  `@noble` fallback). Every subsequent visit is a `localStorage` read — no keygen.

> **Edge case to specify:** an SDK consumer importing a standalone action (e.g.
> `trackPurchaseStatus`) without calling `setupClient` would hit `getClientId()` with a
> cold cache. Keep the current synchronous behaviour there — mint a random, *unprovable*
> id — and treat it as a legacy id per §2.6. Do not throw, and do not silently block.

### 2.2 Timestamped signatures, no challenge round-trip

Sensitive operations carry a self-contained signature. No nonce endpoint, no extra
request, **fully stateless verification** — no key lookup, because the id *is* the key
fingerprint.

```
msg = "frak-<op>-v1" ‖ len(merchantId) ‖ merchantId ‖ len(anonymousId) ‖ anonymousId
                     ‖ <op-specific binding> ‖ ts
sig = ECDSA_P256_SHA256(privKey, msg)

wire: base64url({ v: 1, pk, ts, sig })   // single opaque blob, see §2.3
```

Verification, in order — step 1 is the one that makes the registry unnecessary:

```
1. derive id from pk        →  must equal the claimed anonymousId
2. verify sig over the recomposed message
3. check ts against the op's window (§ table below)
```

Rules:

| Rule | Why |
|---|---|
| **Domain-separate** with an op-specific prefix (`frak-merge-v1`, `frak-ensure-v1`, `frak-install-v1`) | a merge proof must never be replayable as an ensure proof |
| **Bind every security-relevant param**, not just `ts` | otherwise an observed signature is reused with a swapped `targetAnonymousId` |
| **Length-prefix every field** | naive concatenation is ambiguous and forgeable |
| Reject `ts` in the future beyond a small skew allowance | clock-skew abuse |

**Validity windows are per-operation, and deliberately not uniform.** A blanket ±2 min
would break the product.

| Op | Window | Reasoning |
|---|---|---|
| `frak-merge-v1` (`/merge/execute`) | **±2 min**, *and* the message binds `SHA-256(mergeToken)` | The proof asserts ownership of `targetAnonymousId`, which is a free-form body param on an unauthenticated route. A leaked target-side proof lets an attacker merge *their* group into the victim's — direct theft. Binding to the specific `mergeToken` makes a stolen proof useless without that exact token, which is itself 60-min-lived. **This removes the need for a replay cache on this path.** The flow is machine-speed (resolved-config → immediate execute), so the tight window costs nothing. |
| `frak-ensure-v1` (`/identity/ensure`) | **uncapped** (or ≥ 90 days) | Share → click install → Play Store → install → forget → reopen a week later → register. Today this flow has **no cap at all** and correctly links whenever the user returns. A cap would silently drop attribution for exactly the users we want. The timestamp here is a diagnostic, not a security control. See the limitation below. |
| `frak-install-v1` (`/install-code/generate`) | ±5 min | Interactive; the code is minted while the user is on the sharing page. |

> **Accepted limitation — the long-lived ensure proof is bearer material.** Whoever holds
> it can link that anonymous id to *their* wallet: pre-install, the victim's group has no
> wallet, so `checkWalletPriority` returns `null` (`IdentityWeightService.ts:258`), no
> conflict fires, and the merge proceeds by weight. This is **not a regression** — today
> the raw `anonymousId` grants exactly the same power with no proof at all. But it means:
>
> - the **install-code ticket** (§5) is the real fix for that path, because it is
>   short-lived and — **from Phase 5 onward** — minted only for a code whose `generate`
>   was proven;
> - the direct `/install?m=&a=` URL and the Play referrer string remain bearer-y. They
>   must be documented as **semi-private** — surfaced to the sharer for their own
>   install, never as publishable content. Unlike the `fCtx` share link, they are not
>   designed to be reposted.

### 2.2.1 Do we still need a replay cache?

Mostly no. Working through each path:

- **`/identity/ensure`** — the merge target is `walletSession.address` under a
  **mandatory** auth macro (`ensure.ts:45-49,77`). A replay by the same wallet resolves
  to one group → `merged: false`, a genuine no-op. A replay by a *different* wallet hits
  two distinct wallets → `WALLET_CONFLICT` (`IdentityWeightService.ts:181-186`). The
  group cannot move. **No burn-set.** A burn-set here would actively hurt: the wallet
  retries ensure until success (`useExecutePendingActions.ts:88-97`), so a burned
  credential retries for the full 7-day TTL and then silently expires.
  **Idempotency beats single-use on this path.**
- **`/merge/execute`** — replay *is* dangerous, for the reason in the table above.
  Handled by binding the proof to `SHA-256(mergeToken)` rather than by a cache.
- **`/install-code/generate`** — replay just re-mints a code for an id the caller has
  already proven it owns. Harmless.

Net: **no Redis/KV replay cache anywhere.** One less piece of infrastructure, and one
less way for a retrying wallet to deadlock itself.

### 2.3 Storage: extractable key + JWK in `localStorage`

The key is generated `extractable: true` and stored as JWK in `localStorage`, next to
the client id, **on the merchant origin**.

**Why not IndexedDB + non-extractable.** A non-extractable `CryptoKey` cannot be
exfiltrated even by XSS, which is strictly stronger — but it can only be persisted via
IndexedDB structured clone, and IndexedDB is precisely what gets evicted in embedded
in-app browsers, private mode, and under ITP. That would silently orphan identities.

The threat model here is **remote attackers acting on publicly-guessable ids**, not XSS
on merchant pages. An attacker with XSS on the merchant page can already read the client
id, forge interactions in the user's session, and manipulate the DOM. The key adds
little for them and a lot against the remote attacker.

`localStorage` also gives the key the **same lifetime as the id it derives**, which is
the property that actually prevents bugs.

> **Store and clear key and id atomically.** A surviving key with a lost id — or the
> reverse — produces a derivation mismatch that fails verification silently. Treat a
> missing half as "regenerate both". This is the same trap as the iOS Keychain surviving
> app uninstall while `UserDefaults` does not.

```
localStorage["frak-client-id"]  = "<uuid>"          // unchanged key name; now derived
localStorage["frak-client-key"] = "<JWK JSON>"      // new
```

**Wire format.** Proofs cross an RPC boundary, a URL query param, and a Play referrer
string. Serialise as a **single base64url blob** so every hop treats it as one opaque
value:

```
proof = base64url(JSON({ v: 1, pk, ts, sig }))
```

Length budget: pubkey 65 B + sig 64 B + ts → ~200 bytes base64url. The Play referrer cap
is ~1024 chars total and currently carries ~90 (`install.tsx:230`), so this fits with
room to spare — but it is now the binding constraint on that field, and any future
addition must be measured against it.

### 2.4 Pure-JS fallback is required, not optional

`crypto.subtle` is **absent entirely on non-secure contexts** (plain HTTP), and this
already bites us today: `clientId.ts:11-23` falls back to `Math.random()` when
`crypto.randomUUID` is missing, and `randomUUID` carries the same secure-context
requirement. So merchants on HTTP already take a degraded path.

**Decision: do not degrade to an unverifiable identity.** A dual-tier system where some
ids are provable and some are not preserves the exact hole we are closing, forever, and
gives attackers an obvious downgrade target. The extra bundle weight is worth it.

Fallback: `@noble/curves` P-256 — well audited, and already a real dependency in
`apps/wallet` (`package.json:93`), though only used by test helpers today. Treat it as a
**new production dependency for `sdk/core`**, whose current runtime deps are just
`@frak-labs/frame-connector` and `@openpanel/web`. Import it **lazily and only on
failure**, so the common path never pays for it:

```ts
async function getSigner(): Promise<Signer> {
    if (await webCryptoAvailable()) return webCryptoSigner();
    const { p256 } = await import("@noble/curves/nist");   // lazy chunk
    return nobleSigner(p256);
}
```

Feature-detect by **attempting a real `generateKey`**, not by checking
`typeof crypto.subtle` — some embedded browsers expose the object but throw on use.
Cache the result.

**Why the fallback is sufficient**, and why there is no third tier. Three APIs, and only
some are gated on a secure context:

| API | Secure context required | Used by |
|---|---|---|
| `crypto.randomUUID` | **yes** | today's id (`clientId.ts:13`) |
| `crypto.subtle` | **yes** | WebCrypto keygen / sign |
| `crypto.getRandomValues` | **no** | `@noble/curves` keygen |

On an HTTP merchant site both `randomUUID` and `subtle` are undefined — which is why
`clientId.ts:17-21` already falls through to `Math.random()` today. But
`getRandomValues` is **not** secure-context gated and has shipped in every browser since
IE11, so the `@noble` path works there. **HTTP merchants get a real, provable, derived
id.** That is a strict improvement on today's `Math.random()` id.

**If key generation is impossible anyway** — no `subtle`, no `getRandomValues`, which in
practice means an environment that can barely run the SDK — then:

```
mint a random, UNPROVABLE id (today's Math.random path) and treat it as a legacy id
```

Never block, never throw, never invent entropy and pretend it is a key. Such an id
behaves exactly like a legacy id under enforcement (§2.6): usable as a merge **target**,
never as a merge **source**. This reuses the legacy arm that must exist regardless — no
extra code path, no telemetry gate, no separate decision to make later.

Note: `@noble/curves` adds roughly 10–14 KB gzipped to a **lazy** chunk, not the main
bundle.

### 2.5 Performance

WebCrypto P-256 is native code (BoringSSL / CoreCrypto), not JS.

| Op | Modern device | Old / low-end mobile |
|---|---|---|
| `generateKey` P-256 | ~1–3 ms | ~10–30 ms |
| `sign` | <1 ms | ~5–15 ms |
| `@noble` fallback keygen | ~5–15 ms | ~30–80 ms |

> Order-of-magnitude estimates. **Benchmark on a real low-end Android before
> committing.**

Context: a single mobile network round-trip is 200–800 ms. The crypto is one to two
orders of magnitude below one request the SDK already makes.

Rules that keep it invisible:

- **keygen happens once, ever**, per browser/app install — inside the already-`async`
  `createIframe` (§2.1), before `iframe.src` is set. Every later visit is a
  `localStorage` read.
- `getClientId()` **keeps its synchronous signature**. No public API break. It reads the
  module cache populated during `createIframe`.
- signing only on merge / ensure / install-code — **never** on `track/*`,
  `sendInteraction`, or config resolution
- the proof is **always optional in the payload**. If it cannot be produced, the call goes
  out exactly as it does today. Enforcement (Phase 4) is what makes it required.

> **The one real cost, stated honestly.** Under derived ids, first-ever-visit keygen sits
> on the path to `iframe.src` — it *cannot* be deferred to `requestIdleCallback`, because
> the id does not exist until the key does. That is ~1–3 ms typical, 10–30 ms low-end,
> 30–80 ms on the `@noble` fallback, **once per browser**, against a handshake that
> already costs a 200–800 ms round-trip. Returning visits pay nothing.
>
> **Benchmark this on a real low-end Android before committing** — it is the single
> measurement that could justify revisiting §2.1's registry alternative.

The `resolved-config` proof is produced during handshake from the already-resident key
(sign is <1 ms). If it cannot be produced, omit `sdkIdentity` and let the legacy arm run.

### 2.6 Migrating existing clients — and why legacy ids stay broken forever

Existing ids are random UUIDs and cannot satisfy the derivation. On next visit the SDK
generates a keypair, derives `newId`, and migrates the legacy id into it:

```
if frak-client-id exists but frak-client-key does not:
  1. generate keypair → derive newId          (inside createIframe, §2.1)
  2. write both atomically; keep legacyId in frak-client-id-legacy
  3. POST /merge/initiate  { sourceAnonymousId: newId, merchantId, proof }
  4. POST /merge/execute   { mergeToken, targetAnonymousId: legacyId, merchantId }
  5. on success: frak-client-id = newId, applied on NEXT page load
  6. on failure: retry next session; never block, never throw
```

This reuses the existing merge pair rather than adding an unauthenticated merge endpoint
— it hardens the surface instead of widening it.

Three things this must get right:

- **Flip the id only on the next page load.** `getClientId()` is synchronous and the
  merge is async. Flipping mid-session desynchronises the SDK from the listener's
  `clientIdStore` (seeded from the iframe URL at load), and from any share link already
  rendered on the page.
- **One merge per origin, not a fan-out.** Because the key and id are origin-scoped
  (§2.0), each merchant origin has exactly one legacy id and one `newId`, so the migration
  is a single merge on that merchant — not a loop over merchants. `anonymous_fingerprint`
  nodes are scoped `(value, merchantId)` (`identity/db/schema.ts:83-85`), which lines up
  with this one-to-one.
- **Never delete the legacy id.** `mergeGroups` repoints `identity_nodes.groupId` and
  deletes the *losing group row*, not the node (`IdentityMergeService.ts:198-201,341-343`)
  — which is correct and must stay. The legacy id is embedded in already-published `fCtx`
  links; deleting it orphans every one of them.

#### The migration is itself the attack, and this is unavoidable

Step 3 proves ownership of `newId`. It proves **nothing** about `legacyId` — and cannot,
since no key ever existed for it. So an attacker runs the identical, fully-valid
migration naming *any harvested* `legacyId` as the target. They hold a wallet, the victim
(pre-install) does not, so `checkWalletPriority` anchors on the attacker
(`IdentityWeightService.ts:253-258`) and the victim's unsettled rewards move.

**Proof on the source side alone changes nothing.** Closing it requires proof on *both*
sides of a merge — which legacy ids can never provide, which is exactly what the
migration needs them to do. The requirement is self-contradictory.

So, stated plainly: **an already-published legacy id cannot be secured, under any design
in this document.** Registry-binding has the identical hole. The migration is inherently
first-come-first-served, and the window runs until each affected user next visits — days
or weeks.

#### Decision: accept the risk, ship now

**Accepted, explicitly.** At the time of writing the exposed population is **under 100
users and fewer than 10 published share links**, none belonging to a creator with
meaningful unsettled rewards. The realistic worst case is a handful of manually
repairable identity groups.

This is not a risk we are tolerating reluctantly — it is the entire reason the work is
scheduled now. The unfixable set is *exactly* the ids published before this ships, it is
near-empty today, and it grows every week. Waiting makes it strictly worse and never
better; there is no future point at which legacy ids become fixable.

Two things follow, and neither is optional:

1. **§3 is what actually protects the legacy population**, because cryptography cannot.
   Rate limiting and closing the `anonymousId` oracles are the real mitigation.
2. **Treat a conflicting migration as an alarm.** Two different `newId`s attempting to
   claim the same `legacyId` for the same merchant is the detection signal for active
   harvesting. Reject the second, alert on it — do not silently accept or silently drop.
   At this population size an alert is genuinely actionable: it means investigating a
   specific user, not triaging noise.

---

## 3. Backend fixes that ship regardless

Proof-of-possession raises the floor for new clients. It does not retire the existing
surface. These are independent and must land:

| # | Fix | Why |
|---|---|---|
| 3.1 | **Authenticate `merge/execute`** — see the caveat below | it currently has no session macro at all |
| 3.2 | Replace `anonymousId` with an opaque ticket in the install-code flow (§5) | closes the harvesting oracle. **Coordinated backend + wallet change**, phased in §5 |
| 3.3 | Per-code attempt limiting on `install-code/resolve`, independent of source IP | 31⁶ keyspace with IP-only limiting is harvestable at botnet scale |
| 3.4 | Same treatment for `GET /identity/order-client` (`orderClient.ts:14`) | second unauthenticated `anonymousId` oracle, 30/min, missed in the original draft. Requires a valid `checkoutToken`, so it is narrower — but it is the same class |
| 3.5 | Alert when a merge would move a group holding **unsettled** `asset_logs` under a different wallet | the high-value case. Monitoring, plus a candidate for requiring proof on **both** sides of the merge |
| 3.6 | Rate limit tracking endpoints keyed by `(merchantId, clientId)`, not IP alone | CGNAT makes IP-only limiting both too harsh and too weak |
| 3.7 | Remove the raw-hex-address bypass in `sdkIdentity.ts:39-48` | any address string is currently accepted as proof of wallet identity |
| 3.8 | **Handle `WALLET_CONFLICT` on `/identity/ensure`** | `ensure.ts` has no `try`/`catch`; the 409 is not even in the route's declared response schema (`merge.ts:75-81` likewise). Catch it, log it as a security event, and return a non-retryable status so the wallet drops the pending action instead of retrying for 7 days |

None of these change *when* the payout wallet is resolved. Settlement-time resolution is
correct and deliberate (see §1); the fix is to make group membership unforgeable.

> ### ⚠️ 3.1 is not a free "no client changes" win
>
> The original draft placed "require a session on `merge/execute`" in a
> no-client-risk phase. **It is not.** The only caller of `/merge/execute` is
> `lifecycleHandler.ts:266`, on the in-app-browser escape path: `InAppBrowserToast`
> → `getMergeToken()` → `?fmt=` → redirect to the system browser → listener replays
> the token. Those users are **anonymous by construction** — the whole point is
> preserving identity for someone who does not yet have a wallet. Requiring a wallet
> session there kills in-app-browser attribution outright.
>
> The correct fix is **proof-of-possession on `targetAnonymousId`** (§2.2), not a
> session. Until the SDK ships proofs, `merge/execute` must accept the unproven arm.
> This is why §3.1 lands in Phase 3, not Phase 1.

---

## 4. What the SDK signs, and how each proof travels

Concretely, per call site. Everything below is additive; every field is optional.

### 4.1 `/identity/ensure` — SDK arm

`sdk/core/src/actions/ensureIdentity.ts:51`. The SDK owns the key and makes the call
directly. Add the proof to the body:

```ts
body: JSON.stringify({ merchantId, proof })   // proof optional
```

Backend: if `proof` present → recompute the id from `pk` and check it equals the claimed
`anonymousId`, then verify the signature. If absent → current behaviour. **No transport
work, no listener involvement, no retro-compat concern** (the SDK is CDN-delivered and
updates automatically — see §6.3).

### 4.2 `/merge/initiate` — via `frak_getMergeToken`

`frak_getMergeToken` currently declares `Parameters?: undefined` (`rpc.ts:194-198`).
Add one optional parameter:

```ts
{
    Method: "frak_getMergeToken";
    Parameters?: [proof?: string];
    ReturnType: string | null;
}
```

`useOnGetMergeToken.ts:20-29` forwards it verbatim to `/merge/initiate`. The listener
never parses it. Old SDKs send nothing and the param arrives `undefined` — structurally
safe in both directions.

Backend: proof binds `sourceAnonymousId`. This is the endpoint that mints merge tokens
for arbitrary ids, so it is the highest-value place to enforce first.

### 4.3 `/merge/execute` — via `resolved-config`

Extend the `resolved-config` lifecycle payload (`lifecycle/client.ts:47-71`), right next
to the existing `sdkAnonymousId`:

```ts
/**
 * Proof of possession for `sdkAnonymousId`, produced on the merchant origin.
 * Opaque to the listener — forwarded verbatim to the backend.
 */
sdkIdentity?: {
    anonymousId: string;
    proof: string;      // base64url({ v, pk, ts, sig })
};
```

`lifecycleHandler.ts:266-270` passes it straight through to `/merge/execute` alongside
`targetAnonymousId`. The message binds `SHA-256(mergeToken)`, so the SDK must sign
*after* it has the token — which it does, since `pendingMergeToken` is read from the URL
(`createIFrameFrakClient.ts:308-309`) before `resolved-config` is emitted.

> Note the listener currently prefers `iframeClientId ?? clientIdStore` for
> `targetAnonymousId` (`lifecycleHandler.ts:264`). When `sdkIdentity` is present, use
> `sdkIdentity.anonymousId` — it is the value the proof actually covers. Mismatch must
> fail closed rather than fall back.

### 4.4 The `/install` URL — via the same `resolved-config` proof

The install URL is built in the listener from `clientIdStore`
(`SharingPage/index.tsx:69`) and in the wallet from its own store (`sharing.tsx:183`).
Neither has the key. Both can carry the `sdkIdentity` proof received at
`resolved-config` and append it as a new search param.

This is the trickiest arm because it crosses into the **store-gated wallet binary**. It
is fully specified in §5.

### 4.5 What is *not* signed

Deliberately, to protect constraint 3:

- `track/*`, `sendInteraction`, config resolution — high frequency, low value. §3.6
  rate limiting covers these.
- `buildSharingLink` — pure client-side URL construction, no backend call, nothing to
  authenticate. The published `fCtx` remains a plain id by design; making it unforgeable
  would require a v3 wire format and break every published link for no gain, since the
  link is *meant* to be public.

---

## 5. The install flow — the store-gated path

### Why `resolve` returns `anonymousId` today

`resolve` returning `anonymousId` is **load-bearing**, not an oversight. The wallet feeds
it into a deferred action that survives authentication
(`useResolveInstallCode.ts:52-57`):

```
user pastes code            ← NOT yet authenticated
  → resolve → {merchantId, anonymousId, merchant, hasWallet}
  → pendingActionsStore.addAction({type:"ensure", merchantId, anonymousId, merchant})
  → localStorage, deduped on `ensure:${merchantId}:${anonymousId}`
  → user completes registration / login
  → useExecutePendingActions drains → POST /identity/ensure {merchantId, anonymousId}
```

The binding constraint: **resolution happens before the user has a wallet session**, so
there is no session to scope the identity to server-side at that moment. The id must
cross the unauthenticated → authenticated boundary, and survive app download plus
onboarding — `DEFAULT_ENSURE_TTL_MS` is **one week** (`pendingActionsStore.ts:9`; the doc
comment above it saying 24h is stale).

Three paths converge on the same pending action:

| Path | Entry | Carries |
|---|---|---|
| Install code | `useResolveInstallCode.ts:34` | resolved from a 6-char code |
| Direct link | `/install?m=&a=` (`install.tsx:35-38,95`) | raw params, user-editable |
| Play referrer | `useInstallReferrer.ts:44-49` | `merchantId=…&anonymousId=…` |

### Where the signature goes — `generate`, not `resolve`

The natural assumption is that the wallet signs at `resolve`. **It cannot: the private key
is on the sharer's merchant-page origin, and the wallet is a different app** — frequently
a different device entirely (share on desktop, install on phone).

Note also that `/install?m=&a=` is a **web page**: both `InstallProcessing`
(`install.tsx:95`) and `InstallCodeView` (`install.tsx:174`) read `{m, a}` straight from
the URL, and the latter calls `generate` with that `anonymousId`. Anyone can edit those
params. So proof must be established when the code is minted:

```
generate  ← proof required   (originates from the sharer's SDK, via §4.4)
resolve   ← no proof needed  (possession of the code implies a verified generate)
```

— with the caveat that "proof required" only becomes true at **step 2**; see the rollout
below, and the oracle-window note attached to it.

### Ticket design

A **signed JWT** — no new table, no schema change, stateless verification. It slots into
the existing `JwtContext` namespace (`infrastructure/external/jwt.ts:18`) as a sibling of
`anonymousMerge`:

```jsonc
{ "sub": "<anonymousId>", "mid": "<merchantId>", "jti": "<uuid>",
  "iat": …, "exp": …, "aud": "install-ticket" }
```

| Rule | Why |
|---|---|
| **TTL ≥ pending-action TTL (one week)** | a shorter ticket means the wallet drains a dead one. Tie both to a single shared constant, exported from one place and imported by `pendingActionsStore.ts:9` |
| Audience-scoped (`aud`) | must not be replayable as any other token type |
| **Not single-use** | per §2.2.1: the ensure target is the authenticated wallet, so replay cannot move the group, and a burn-set would deadlock the wallet's retry loop. Idempotency is the correct property here |
| Dedupe key becomes `ensure:${merchantId}:${ticket}` | tickets are per-resolve, not per-identity |
| URL-safe, ≤ ~600 chars | it transits `?a=`/`?t=` and the ~1024-char Play referrer |

### The two-step rollout

**This is the only part of the plan that is gated on store review.** It is structured so
that step 1 is invisible to every already-shipped binary, and step 2 is a pure deletion.

#### Step 1 — additive everywhere, breaks nothing

Backend:
- `install-code/generate` accepts an **optional** `proof`. When present, verify it and
  record the outcome as telemetry. **It gates nothing yet.**
- `install-code/resolve` returns `{ merchantId, anonymousId, merchant, hasWallet }`
  **unchanged**, plus a new `ticket` field — minted unconditionally from the
  `anonymousId` already on the row (`schema.ts:148`). Old binaries ignore the extra
  field; new binaries prefer it.
- `/identity/ensure` accepts `{ merchantId, anonymousId?, ticket?, proof? }`. Resolution
  order: `ticket` → `proof`+`anonymousId` → bare `anonymousId` (legacy).

> **Why `resolve` mints the ticket unconditionally, with no `verified` flag.**
> `generate` and `resolve` are separated by the user typing a code on a *different
> device*, so the only things that cross that gap are the `install_codes` row and the
> code itself. Gating ticket issuance on "was this code's `generate` proven?" would
> therefore need a persisted `verified` column — a schema migration.
>
> It is not worth it. Emitting **both** `anonymousId` and `ticket` for the whole of
> Phase 3–4 keeps the change to zero DB migrations, and the flag would be redundant the
> moment step 2 makes `proof` mandatory on `generate` — at which point every code is
> verified by construction and the column would be dropped again.
>
> **The cost, stated plainly: the harvesting oracle stays open until step 2.** An
> attacker brute-forcing codes still reads a durable `anonymousId`, because the field is
> still there. Two things follow:
> - **§3.3 (per-code attempt limiting) is the real mitigation in the interim**, not
>   supporting work. It ships in Phase 1, ahead of this.
> - **The security win lands at Phase 5, not Phase 3.** A dual-arm response that never
>   gets cleaned up *is* the hole this document exists to close.

Listener / SDK:
- `resolved-config` carries `sdkIdentity` (§4.3).
- The listener appends the proof to the install URL as a new param, alongside the
  existing `m` / `a`, which stay untouched:
  `` `/install?m=${merchantId}&a=${clientId}&p=${proof}` ``

Wallet (new binary):
- `install.tsx` `validateSearch` reads a new optional `p`.
- `InstallProcessing` / `InstallCodeView` forward `p` to `generate`.
- `useResolveInstallCode` stores `ticket` in the pending action when present, keeping
  `anonymousId` populated so the store stays readable by a rolled-back build.
- `useExecutePendingActions` sends `ticket` when present, else `anonymousId`.
- `install.tsx:230` referrer string gains `&proof=…`; `useInstallReferrer.ts:44-49`
  reads it if present. Existing keys unchanged.
- **`pendingActionsStore` gains `version: 1` and an identity `migrate`** — it currently
  has neither (`pendingActionsStore.ts:92-99`), so there is no hook available when one is
  eventually needed. Add it now, while the migration is a no-op.

> Deliberately **not** doing the "return the ticket inside the existing `anonymousId`
> field" trick. It would work — the wallet treats that value as fully opaque on every
> path except `useInstallReferrer.ts:77`, which writes it into `clientIdStore` — and it
> would close the oracle with zero wallet release. It is rejected because it makes the
> field mean two different things depending on the caller, poisons `clientIdStore` on the
> Android referrer path, and leaves no clean deletion point. The explicit two-step is
> slower but leaves the codebase in a state we can actually reason about.

#### Step 2 — after the new binary has been live 5–6 days, bump `minVersion`, then delete

`GET /common/version` → `minVersion.{ios,android}` (`services/backend/src/api/common/version.ts:19-22`)
is the hard gate. The wallet polls it on boot and on window focus, 5-minute stale time
(`useVersionGate.ts:36-46,130-144`), and enters `hard_update` below the floor. It is an **env
var captured at module load**, so bumping it requires a backend deploy/restart.

Once the floor excludes every pre-ticket binary, delete — **all of these must be tagged
in code with a single searchable marker at implementation time**, e.g.
`TODO(install-ticket-step2)`:

- [ ] `anonymousId` from the `install-code/resolve` response
- [ ] the bare-`anonymousId` arm of `/identity/ensure`
- [ ] the unverified arm of `install-code/generate` (proof becomes required)
- [ ] `anonymousId` from `PendingEnsureAction` (`types.ts:8`) — bump the store to
      `version: 2` with a real migration that drops it
- [ ] the `a` param on `/install` and `anonymousId=` in the referrer string
- [ ] the `?a=` construction sites: `SharingPage/index.tsx:69`, `sharing.tsx:183`
- [ ] the unproven arm of `/merge/execute` and `/merge/initiate`

Until every box is ticked, the oracle is still open. Step 2 is not optional cleanup — it
is where the fix actually lands.

---

## 6. Wallet compatibility contract

The wallet frontend is compiled into the native binary — `tauri.conf.json:7-9` sets
`frontendDist: "../dist"`. `tauri-plugin-frak-updater` only *prompts* users toward the
store; **there is no OTA or JS hot-patch mechanism anywhere in the repo.** Every
already-installed binary keeps its compiled-in Eden client and its assumptions forever.

### 6.1 Frozen until `minVersion` excludes all old binaries

| Surface | Contract | Consumer |
|---|---|---|
| `install-code/resolve` response | `merchantId`, `anonymousId`, `merchant.name`, `merchant.domain` must stay present and non-optional | `useResolveInstallCode.ts:52-57` — pushed straight into `pendingActionsStore`, later POSTed to `ensure` |
| `/identity/ensure` request | must keep accepting `{ merchantId, anonymousId }` and returning 2xx | `useExecutePendingActions.ts:123-131` |
| `/install` search params | `m`, `a` — **renaming fails silently**, both become `undefined`, no ensure fires, no error | `install.tsx:35-38` |
| Play referrer keys | `merchantId=`, `anonymousId=`, ~1024-char cap | `install.tsx:230` produces, `useInstallReferrer.ts:44-49` consumes. Note the producer is the *live web page* and the consumer is *whatever binary eventually installs* — these can be many releases apart in either direction |
| `pendingActionsStore` shape | no field renames/removals; no `version`/`migrate` exists today | `pendingActionsStore.ts:92-99` |
| `install-code/generate` response | `code: string` | `useGenerateInstallCode.ts:25` |

### 6.2 Safe to change now

- `install-code/resolve` → `hasWallet` — analytics only (`useResolveInstallCode.ts:46`)
- `install-code/generate` → `expiresAt` — fetched, never read
- `/identity/ensure` → `status` — never destructured; the wallet checks only `error`
- **Any additive field** — structural typing means extra fields are ignored by old
  builds, which is what makes §5 step 1 safe

### 6.3 The SDK has none of these constraints

`@frak-labs/components` is loaded from jsDelivr at `@latest` by every plugin
(WordPress `class-frak-frontend.php:111`, Magento `SdkLoader.php:47`, PrestaShop
`FrakUrls.php:47-49`, Shopify `listener.liquid:2`), and CI purges the CDN cache on
release (`.github/workflows/release.yml:96-104`). **Merchants get SDK updates
automatically.** The listener is server-deployed at `wallet.frak.id/listener`. So
SDK-side and listener-side work ships at normal speed; only the wallet binary is gated.

This is why §4.1 (SDK-arm ensure) and §4.2/§4.3 (listener pass-through) can land well
before §5.

---

## 7. Phasing

Ordered so each step is independently shippable and useful, and so the store-gated work
starts as early as possible — it has the longest lead time.

### Phase 1 — backend hardening (no client changes, genuinely)
§3.3, §3.4, §3.6, §3.7, §3.8. Protects the existing installed base immediately. **No SDK
release, no version skew, no waiting on anyone.**

§3.1 is explicitly **not** here — see the warning in §3. §3.2 is not here either; it is
§5.

§3.8 matters more than it looks: it is the difference between a hijacked victim getting a
clean error and a wallet retrying a doomed call for seven days.

### Phase 2 — SDK key material + backend accept-but-don't-enforce
Runs in parallel with Phase 3; no dependency between them.

- P-256 keygen inside `createIframe`, JWK persistence, atomic with the client id
- derived ids for new clients; migration merge for existing ones (§2.6), including the
  conflicting-migration alarm
- `@noble/curves` lazy fallback
- proof attached to `/identity/ensure` (SDK arm, §4.1) and `frak_getMergeToken` (§4.2)
- backend **verifies when present, never requires** — derivation check + signature only,
  no table, no lookup
- telemetry: % of calls carrying a valid proof, split derived / legacy / keygen-failed;
  plus first-visit keygen timing from real devices (the §2.5 benchmark)

### Phase 3 — install ticket, step 1 (starts as early as possible)
The store-gated work from §5. Everything additive, in one wallet release:
backend ticket issuance, `sdkIdentity` on `resolved-config`, `p` param on `/install`,
referrer `proof=`, `pendingActionsStore` `version: 1`.

Submit to the stores the moment it is testable. The 10–15 business day review is the
critical path for the whole plan.

### Phase 4 — enforcement
Once telemetry shows coverage is high enough:
- require proof on `/merge/initiate` and `/merge/execute` (this is where §3.1's intent
  actually lands, via proof rather than session)
- **a legacy id may be a merge *target* but never a merge *source*.** This asymmetry is
  the enforceable rule: legacy ids stay resolvable forever, because they are embedded in
  published `fCtx` links, but they stop being usable to *claim* anything.
- accept that the migration path (§2.6) keeps legacy ids claimable-as-target by whoever
  moves first. There is no fix; there is only shipping early and §3.

### Phase 5 — install ticket, step 2 — **this is where the fix lands**
Bump `minVersion`, work the §5 deletion checklist.

Phases 1–4 raise the floor and build the machinery, but the `anonymousId` harvesting
oracle stays open for the whole of Phase 3–4 by design (see the note in §5 step 1) — the
`resolve` response carries both arms so that no already-shipped binary breaks. **Deleting
the legacy arm is the fix, not the cleanup.** A dual-arm response left in place
indefinitely reproduces the exact vulnerability this document opens with.

Budget it as real work with an owner and a date, not as follow-up.

### Phase 6 — native SDK
Ships derivation and signing from day one. There are no legacy native ids, so native is
cryptographic-only — no migration path, no legacy arm. Retrofitting a released binary is
impossible, so this must be in v0.1 even if enforcement lands later. See
[`../native-sdk/02-native-sdk-overview.md`](../native-sdk/02-native-sdk-overview.md) §4.

---

## 8. Cross-platform contract

One message format, one signature encoding, three implementations. This is exactly the
class of thing that drifts silently, so it needs golden fixtures like the FrakContext
codec.

Two algorithms must match exactly across platforms: **id derivation** and **signing**.
Derivation is the higher-risk of the two, because a mismatch there produces a wrong id
rather than a failed verification — it fails at account level, not at request level.

| | Web | Android | iOS |
|---|---|---|---|
| Keygen | WebCrypto → `@noble/curves` | `KeyPairGenerator("EC")` | CryptoKit `P256.Signing` |
| Storage | `localStorage` (JWK) | `SharedPreferences` / Keystore | `UserDefaults` |
| Hash | `crypto.subtle.digest` | `MessageDigest` | `SHA256` |

Traps, all of which produce silent failure:

- **Public key format.** Derivation must hash a fixed representation — specify
  **uncompressed (65 bytes, `0x04` prefix)** and never mix. Hashing a compressed key
  yields a different id.
- **Lowercase UUIDs.** Swift's `UUID.uuidString` is uppercase; the FrakContext codec
  parses hex naively and produces wrong bytes for uppercase input
  (`frakContextV2Codec.ts:55`). Normalise to lowercase at the derivation boundary.
- **RFC-4122 bit twiddling.** Version (`0x40` on byte 6) and variant (`0x80` on byte 8)
  must be applied identically, *after* truncation, on all three platforms.
- **Signature encoding.** WebCrypto produces raw `r‖s` (64 bytes); most other stacks
  default to DER. Pick **raw `r‖s`**, convert at the boundaries, and test both directions.
- **Low-S normalisation.** Some verifiers reject high-S signatures. Normalise on sign.
- **Message concatenation.** Length-prefix every field (§2.2). Naive concatenation is
  ambiguous and forgeable.

Commit golden fixtures — `{privkey, pubkey_uncompressed, derived id, msg fields,
canonical msg bytes, sig}` — as shared JSON and assert against them in all three test
suites. Round-trip tests alone are
insufficient: two identically-wrong implementations round-trip perfectly.

---

## 9. Open questions

Only one remains open, and it is implementation work rather than a design decision.

1. **Regression tests for both WALLET_CONFLICT paths** — `/merge/execute` via
   `associate()` (`IdentityOrchestrator.ts:83-90`) and `/identity/ensure` via
   `determineAnchorFromMultiple` (`IdentityWeightService.ts:181-186`). Separate code
   paths, both currently unguarded against hostile merges. Neither 409 appears in the
   routes' declared response schemas. Covered by §3.8.

### Settled — do not reopen

This plan is deliberately scoped for speed and minimal diff. The following were
considered and closed; reopening any of them expands scope without changing the security
outcome.

- **Key scoping.** One key per merchant, automatically. The SDK runs in the *merchant
  page's own origin*, so `localStorage["frak-client-key"]` (`clientId.ts:28`) is already
  origin-isolated. There is no cross-merchant key, no cross-merchant id, and no
  correlation vector — nothing to derive per-merchant and no `SHA-256(pubkey ‖ merchantId)`
  variant needed. (A merchant with several registered domains in `allowedDomains` gets one
  id per domain, exactly as it does today. Unchanged, not a regression.)
- **Wallet-side identity.** Out of scope. The wallet is the *authenticated* side and the
  source of truth — every signature already requires a WebAuthn user action. It does not
  need, and must not get, a second P-256 identity key. Nothing in this plan touches wallet
  credentials.
- **Legacy ids are claimable-as-target by whoever moves first.** Accepted, see §2.6.
- **Recovery tooling for locked-out users.** Skipped. At <100 users the realistic victim
  count is zero, and shipping fast is the better mitigation than building an unmerge path
  for a population that does not exist. If a victim appears, repair is a manual DB
  operation against the `mergedGroups` audit jsonb (`IdentityMergeService.ts:335-339`).
- **Binding `merge/execute`'s target at `initiate` time.** Skipped. Binding the proof to
  `SHA-256(mergeToken)` (§2.2) already removes the replay risk statelessly; binding the
  token itself would require reshaping the in-app-browser flow to know its target at mint
  time, for marginal gain.
- **Key rotation.** No rotation story, deliberately. Since the id derives from the key,
  rotating *is* "new anonymous user" plus a §2.6 migration merge — the mechanism already
  exists and needs no separate design. Lost-key handling collapses to the same thing.
- **`crypto.getRandomValues` unavailable.** Resolved in §2.4: fall back to an unprovable
  random id and treat it as legacy. No measurement needed — `getRandomValues` is not
  secure-context gated, so the `@noble` path covers HTTP merchants, and the residual case
  reuses the legacy arm.
