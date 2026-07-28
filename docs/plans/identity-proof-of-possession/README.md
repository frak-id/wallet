# Identity proof-of-possession

Bind every anonymous identity to a device-held P-256 keypair, so that only the device
that owns an anonymous id can act on it.

**Status:** planned, not started. **Blocks:** native SDK work
([`../native-sdk/`](../native-sdk/)).

> **Start here.** §3.9 and Phase 0 should begin immediately — the first closes the widest
> hole with a backend-only change, the second freezes the wire format before the native
> SDKs hardcode it into unpatchable binaries. Everything else can follow. See §7.

**Contents:** §1 why · §2 design ([2.0](#20-where-the-key-lives-and-how-proofs-travel)
key location · [2.1](#21-the-anonymous-id-is-derived-from-the-keypair) derivation ·
[2.2](#22-timestamped-signatures-no-challenge-round-trip) signatures + windows ·
[2.3](#23-storage-extractable-key--jwk-in-localstorage) storage + **byte layout** ·
[2.4](#24-pure-js-fallback-is-required-not-optional) fallback ·
[2.5](#25-performance) perf · [2.6](#26-migrating-existing-clients--and-why-legacy-ids-stay-broken-forever)
migration) · §3 backend fixes (incl. **3.9 `track/*`**) · §4 what the SDK signs (incl.
**4.6 `proofSeen` latch**) · §5 install flow · §6 wallet compatibility · §7 phasing ·
§8 cross-platform · §9 open questions

**Constraints this plan is optimised against**, in order:

1. This is a **side quest** for the native SDK. It must not become a platform rewrite.
2. **Minimal blast radius.** It touches SDK, listener, wallet and backend by necessity —
   the goal is the smallest coherent change in each, not the most elegant one.
3. **No SDK/listener performance regression.** Some cost is unavoidable; it stays off
   the critical path.
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

The anonymous id is not secret. Every share link publishes it in clear.
`buildSharingLink` embeds `clientId` as field `c` of the FrakContext
(`packages/wallet-shared/src/sharing/buildSharingLink.ts:49-58`), which
`FrakContextManager.update` (`sdk/core/src/context/frakContext.ts`) base64url-encodes into
`?fCtx=`. Anyone who receives, screenshots, or finds a reposted referral link can decode
the sharer's `clientId` and the `merchantId` — both inputs the attack needs.

Two unauthenticated endpoints compound this by handing out `anonymousId` directly:

- `POST /identity/install-code/resolve` — returns `anonymousId` for any valid 6-char code
  (`installCode.ts:35-96`), rate-limited 10/min
- `GET /identity/order-client?merchantId&checkoutToken` — returns the raw `clientId`
  for a purchase (`orderClient.ts:14-60`), rate-limited 30/min, no auth

Attack:

1. `POST /merge/initiate {sourceAnonymousId: <victim's, from their link>, merchantId}`
   — no session required → attacker receives a valid `mergeToken` for the victim's group.
2. Attacker attaches their own wallet to their own anonymous id (legitimate flow), so
   their group has `hasWallet = true`.
3. `POST /merge/execute {mergeToken, targetAnonymousId: <attacker's>, merchantId}` — no
   session. Wallet-priority anchoring (`IdentityWeightService.checkWalletPriority`, called
   from `determineAnchor:150`) selects the attacker's group as anchor, because the
   victim's pre-install group has no wallet.
4. Rewards are attached to an **identity group**, not to a wallet
   (`asset_logs.identityGroupId` is `notNull`; `recipientWallet` is nullable), and the
   wallet is resolved at settlement (`BatchRewardOrchestrator.ts:196`,
   `SettlementOrchestrator.ts:269`). Lockup windows run up to **150 days**
   (`REWARD_LOCKUP.MAX_DAYS`, `packages/app-essentials/src/constants/rewards.ts:9`).
   Because the victim's anonymous id now points at the attacker's group, rewards the
   victim **already earned** but that have not settled pay out to the attacker.

### The same attack, in one request, via `track/*`

The merge endpoints are not the only way to reach the merge machinery. `POST
/user/track/interaction` reaches it with no authentication, no merge token, and — today
— no rate limit at all.

```
interaction.ts:13  → resolveSdkIdentity({ headers, merchantId })
sdkIdentity.ts:95  → buildIdentityNodes({ walletAddress, clientId, merchantId })
sdkIdentity.ts:116 → identity.resolveAndAssociate(identityNodes)   ← merges groups
```

`resolveAndAssociate` (`IdentityOrchestrator.ts:111-153`) resolves every node, and when
they land in different groups it calls `mergeGroups` — the same irreversible reassignment
as `/merge/execute`. So:

```http
POST /user/track/interaction
x-frak-client-id: <victim's clientId, decoded from any fCtx share link>
x-wallet-sdk-auth: <attacker's own wallet JWT — legitimately obtained>
{ "type": "arrival", "merchantId": "…" }
```

Nodes become `[wallet=attacker, anonymous_fingerprint=victim]` → two groups →
`checkWalletPriority` anchors on the attacker (the victim is pre-install, no wallet) →
the victim's group is merged away. Steps 1–3 above collapse into a single unauthenticated
request.

`trackApi` applies no `rateLimitMiddleware` whatsoever (`api/user/track/index.ts:5-7`),
unlike every sibling identity route. `POST /user/track/purchase` has the same shape
(`purchase.ts:37-50`); `GET /user/merchant/referral-status` reaches
`resolveSdkIdentity` too, but only leaks status.

Three consequences, all of which shape the plan:

- **§3.7 does not fix this.** Removing the raw-hex bypass in `sdkIdentity.ts:39-48` only
  forces the attacker to present a real JWT *for their own wallet* — which they have. The
  bypass is a separate bug; the vulnerability here is that an unauthenticated
  `x-frak-client-id` header can trigger a cross-group merge.
- **Rate limiting cannot mitigate it.** One request suffices. §3.6 is about abuse volume,
  not this.
- **Proof-of-possession would not have covered it either.** §4.5 deliberately excludes
  `track/*` from signing. That exclusion is correct — but only once merging is removed
  from this path. See §3.9.

### Late wallet binding is a feature — do not "fix" it

It is tempting to conclude that the wallet should be snapshotted at accrual. That would
break the product. The whole point of decoupling the anonymous id from the wallet is that
a user — an influencer especially — can share a link, earn rewards, and create their
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
  → WALLET_CONFLICT   (IdentityWeightService.ts:185-189)
```

The victim can never link their wallet for that merchant. `ensure.ts` has no
`try`/`catch`, so the 409 propagates straight to the caller, and there is no
WALLET_CONFLICT handling, retry, or dispute-resolution path anywhere in the backend.
The exception that protects post-install users permanently bricks pre-install victims: a
cheap, remote, unauthenticated denial-of-service against exactly the users we are trying
to onboard, silent until they hit an error nobody can resolve.

Worse on the wallet side: the ensure call is fire-and-forget with retry-on-failure
(`useExecutePendingActions.ts:75-97`) and the action is only removed from the store on
**success**. A permanently-409ing ensure retries on every app launch for the full 7-day
TTL, then silently expires.

> Traced and confirmed, not inferred. This is a *different* throw site from the one on
> the `/merge/execute` path: `associate()` throws at `IdentityOrchestrator.ts:83-90`, but
> `/identity/ensure` never calls `associate()` — it goes through `resolveAndAssociate` →
> `determineAnchorFromMultiple`, which throws independently at
> `IdentityWeightService.ts:185-189`.
>
> Both paths are guarded against merging two different wallets. The guard *is* the
> brick — it correctly refuses the merge, and that refusal is exactly what locks the
> victim out. The defect is not a missing check; it is that a hostile merge put the
> victim into that state, and that nothing catches the resulting 409 (§3.8). Both throw
> sites need regression tests.

### Why the vulnerable window is structural, not an edge case

The product flow is: share → *then* get prompted to create a wallet → *then* install.
**Every user's first share happens before they install, by design.** The link they
publish carries that pre-install `clientId`, publicly, forever.

Influencers do eventually install — but their *referees*, the whole audience a referral
is meant to convert, are pre-install by definition.

### Why now

The exposed surface is at its smallest today, and grows from here. This is the cheapest
this change will ever be:

- few published links carry a pre-install `clientId`
- the legacy-id population that cannot be retrofitted is small
- no creator has meaningful unsettled rewards to redirect
- no migration pressure, no support burden

Ids already published can never be secured, not by this design and not by any
alternative (§2.6). The permanently-exposed set is frozen at whatever exists on ship day.
Today that set is small enough to repair by hand; every week of growth enlarges it
irreversibly.

This ships before any native SDK work.

---

## 2. Design

### 2.0 Where the key lives, and how proofs travel

This is the constraint that shapes everything else, and it is easy to get wrong.

The `clientId` exists in **two separate copies on two separate origins**:

| | Storage | Origin | Written by |
|---|---|---|---|
| SDK copy — **authoritative** | `localStorage["frak-client-id"]` | **merchant page** | `sdk/core/src/config/clientId.ts:28` |
| Listener copy — cache | `clientIdStore` (defined in `packages/wallet-shared/src/stores/clientIdStore.ts`), key `frak_client_id_store` | **`wallet.frak.id`** | seeded from the `?clientId=` iframe param (`resolvingContextStore.ts:14`) |

`wallet.frak.id` serves both the wallet app and `/listener` via ingress path routing
(`infra/gcp/wallet.ts:290-311`), so the listener shares an origin with the wallet app.

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

This also settles key scoping for free: `localStorage` is origin-scoped, so the SDK's
key is *inherently* per-merchant. One merchant origin, one keypair, one derived id.
There is no shared key, no cross-merchant id, and therefore no cross-merchant correlation
to engineer around. Per-merchant derivation variants (`SHA-256(pubkey ‖ merchantId)` and
similar) are unnecessary — the browser already enforces the property.

**All RPC stays SDK → listener.** `packages/rpc` has a full correlated request/response
mechanism, but it is strictly SDK-initiated — the SDK asks, the listener answers.
There is no listener-initiated request channel: `packages/rpc/src/listener.ts` exposes
only `lifecycleHandlers` on that side, with no listener-side `request`. We are not
building one. Instead the SDK pushes proofs down as additional parameters on calls it
already makes, and the listener passes them through to the backend without interpreting
them:

| Backend call | Issued by | Proof arrives via |
|---|---|---|
| `/identity/merge/initiate` (anon arm) | listener (`useOnGetMergeToken.ts:24`) | new optional param on `frak_getMergeToken` (currently `Parameters?: undefined`, `sdk/core/src/types/rpc.ts:193-197` — purely additive) |
| `/identity/merge/initiate` (wallet arm) | **wallet app** (`ExplorerDetail/index.tsx:106`) | **nothing needed** — already authenticated by the wallet session (§4.2) |
| `/identity/merge/execute` | listener (`lifecycleHandler.ts:266`) | `sdkIdentity.proofs.merge` on the `resolved-config` payload (`sdk/core/src/types/lifecycle/client.ts:47-71`) |
| `/install` URL | listener builds it (`SharingPage/index.tsx:69`) | `sdkIdentity.proofs.install` — a **different** proof, carried as a `#p=` fragment (§2.2, §4.4) |
| `/identity/ensure` (SDK arm) | SDK directly (`ensureIdentity.ts:51`) | signed in place — no transport work |
| `/identity/ensure` (wallet arm) | wallet (`useExecutePendingActions.ts:123`) | proof/ticket carried through `pendingActionsStore` — see §5 |
| `track/*` | SDK / Shopify pixel | **nothing — deliberately unsigned** (§3.9, §4.5) |

No new RPC methods. Two additive parameter changes. That is the whole transport story.

### 2.1 The anonymous id is derived from the keypair

```
keypair  = P-256 (ECDSA, SHA-256)
clientId = uuid_from(SHA-256(pubkey_raw_uncompressed)[0..16])
```

with RFC-4122 version (`0x40`) and variant (`0x80`) bits set on bytes 6 and 8 so the
result is a syntactically valid UUID, and lowercase hex.

This makes identity self-authenticating: given a public key, anyone recomputes the id and
checks it matches. No key table, no registry, no bind endpoint, no trust-on-first-use
window for new clients. Verification is fully stateless.

Truncating SHA-256 to 128 bits is comfortable here. The property that matters is
second-preimage resistance: an attacker must find a keypair whose public key hashes to a
*specific* existing id. The RFC-4122 version and variant bits are overwritten with
constants on every derived id, so 6 of the 128 bits carry no hash output — the real work
factor is **~2¹²²**, not 2¹²⁸.

The birthday bound (~2⁶¹ after the same adjustment) only yields *some* colliding pair of
freshly-generated keypairs, which buys an attacker nothing — they need to hit a victim's
existing id, not any two ids.

**Why derive rather than use the pubkey directly as the id.** The FrakContext v2 codec
allocates exactly 16 bytes for the client id and parses it as a UUID
(`frakContextV2Codec.ts:17`, `uuidToBytes:55`). A P-256 public key is 33 bytes compressed
or 65 uncompressed. Using it directly means a v3 wire format — and since v1/v2
disambiguate purely on total payload length (`frakContextV2Codec.ts:26`), that breaks
every published link, and would invalidate the cross-language golden fixtures before
Phase 0 has even created them (§8). Deriving keeps the id at 16 bytes and changes nothing
on the wire.

#### Why not a `(anonymousId, merchantId) → pubkey` table instead

A registry that binds a key to the *existing* random id looks cheaper — no derivation
spec, no async, no migration. It was considered and rejected for one decisive reason: it
has a TOFU race for brand-new clients that derivation does not.

The bind would have to happen on the first proof-carrying call. But proofs only ride on
calls that fire *late*: `ensureIdentity` (only once a wallet is connected — the gate is in
the caller, `watchWalletStatus.ts:84-89`, which fires only when a status carries an
`interactionToken`), `merge/initiate` (in-app-browser escape only), and
`install-code/generate`. None of them fire for a new user who lands on a merchant site
and shares immediately — so their id is published in the `fCtx` link **before anything
binds it**, leaving it claimable by whoever harvests the link first. That is precisely
the pre-install sharer this plan exists to protect.

Closing that race requires a dedicated bind call at init — a new endpoint *and* a network
round-trip on the critical path, violating constraint 3. Derivation needs neither: the id
**is** the proof, from the instant it exists.

Secondary benefits: no table, no cache-invalidation story, no conflicting-bind alarm to
build and monitor, and native and web share one algorithm with no registry lookup.

#### The async cost

`getClientId()` is synchronous (`clientId.ts:28`), called from 10 production sites, and
is exported public API (`sdk/core/src/index.ts:8`). It does not need to become async.

`getClientId()` is called *inside* `createIframe` (`iframeHelper.ts:60`) to build
`iframe.src` — this is the critical-path call site, not any of the later ones.
`createIframe` is already `async` and already `await`ed in `setupClient.ts:29`, so the
derivation goes at the top of `createIframe`, before `iframe.src` is assigned, and caches
into module state. `getClientId()` then keeps its synchronous signature and reads the
cache. Every other production call site runs after `await createIframe` resolves —
including the two that cannot await, `createIFrameFrakClient.ts:156,165` (OpenPanel
`filter` and `setGlobalProperties`).

Only the first visit ever pays keygen (~1–3 ms; 10–30 ms low-end; 30–80 ms on the
`@noble` fallback). Every subsequent visit is a `localStorage` read, no keygen.

> **Edge case:** an SDK consumer importing a standalone action (e.g.
> `trackPurchaseStatus`) without calling `setupClient` hits `getClientId()` with a cold
> cache. Keep the current synchronous behaviour there — mint a random, unprovable id —
> and treat it as a legacy id per §2.6. Do not throw, and do not silently block.

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
| Domain-separate with an op-specific prefix (`frak-merge-v1`, `frak-ensure-v1`, `frak-install-v1`) | a merge proof must never be replayable as an ensure proof |
| Bind every security-relevant param, not just `ts` | otherwise an observed signature is reused with a swapped `targetAnonymousId` |
| Length-prefix every field | naive concatenation is ambiguous and forgeable |
| Reject `ts` in the future beyond a small skew allowance | clock-skew abuse |

Validity windows are per-operation, and deliberately not uniform. A blanket ±2 min window
would break the product.

| Op | Window | Reasoning |
|---|---|---|
| `frak-merge-v1` (`/merge/execute`) | ±2 min, and the message binds `SHA-256(mergeToken)` | The proof asserts ownership of `targetAnonymousId`, a free-form body param on an unauthenticated route. A leaked target-side proof lets an attacker merge *their* group into the victim's — direct theft. Binding to the specific `mergeToken` makes a stolen proof useless without that exact token, itself 60-min-lived. This removes the need for a replay cache on this path. The flow is machine-speed (resolved-config → immediate execute), so the tight window costs nothing. |
| `frak-ensure-v1` (`/identity/ensure`) | 90 days | Share → click install → Play Store → install → forget → reopen a week later → register. Today this flow has no cap at all. A tight cap would silently drop attribution for exactly the users we want, but uncapped means a single leaked proof is a permanent liability with no revocation story (§9). 90 days is far beyond the real funnel and still self-heals. |
| `frak-install-v1` (`/install-code/generate`) | 30 days | Not ±5 min — see below. |

#### `frak-install-v1` needs a long window, not a short one

A ±5 min window fits "interactive; the code is minted while the user is on the sharing
page" — true of the install-code path, where the sharer clicks generate, reads a 6-char
code off their own screen, and hands it over immediately.

It is false for the two other paths that §4.4/§5 route through the *same* proof and the
*same* `generate` call:

- **Direct link** (`/install?m=&a=#p=`): minted on the **sharer's** device at share time,
  then embedded in a URL that someone else opens whenever they get to it — hours or days
  later, on a **different device**. `InstallCodeView` forwards it straight into
  `generate`.
- **Play referrer**: same shape. Captured at share time, consumed after a store install.

These are the opposite of "interactive, same session" — they are the exact flow §2.2 uses
*two rows above* to justify a long ensure window ("install → forget → reopen a week
later"). A ±5 min window would reject the proof for the majority of real direct-link and
referrer installs. **Not an edge case — it would break the mainline feature.**

**Decision: 30 days, not uncapped.** The intuition that a leaky channel calls for a
shorter window is backwards here: `frak-install-v1` is the leakiest proof in the system,
not the safest, so it needs a tighter bound than the others, not a looser one. Compare
channels:

| Proof | Channel | Leak surface |
|---|---|---|
| `frak-ensure-v1` | HTTP header, SDK → backend | low |
| `frak-merge-v1` | RPC payload, then `?fmt=` on a user-visible URL | medium |
| `frak-install-v1` | **URL + Play referrer** | **high** — browser history, `Referer` headers, analytics SDK auto-capture, link previews, screenshots, proxy logs |

And per Phase 5 it authorises `generate` → code → ticket → `ensure` → group takeover. It
is as powerful as the ensure proof through a much leakier pipe, so it needs a *tighter*
bound, not a looser one.

30 days is chosen because the share → click → store → install → open funnel has a p99 of
days. Nobody installs three months after clicking and expects attribution. Every extra day
is pure bearer-window with no product value — and with no revocation story (§9), uncapped
means a single leaked install URL is a *permanently* compromised id. A bound makes the
exposure self-heal.

Carry it as a URL fragment rather than a search param — `#p=` instead of `?p=`.
Fragments are never sent to the server, which removes it from access logs, `Referer`
headers, and most analytics auto-capture. This does not help against browser history,
screenshots, or link forwarding, so it lowers leak probability without removing the need
for the time bound. Do both.

> Two implementation notes. The fragment does not survive the Play referrer — that is a
> separate string, so `proof=` stays a normal key there. And `install.tsx`'s
> `validateSearch` validates *search* params only; reading `p` from the fragment is a
> different code path from the `m`/`a` params beside it. Verify the fragment survives the
> full redirect chain — some interstitials drop it.
>
> The same argument applies to `?fmt=` on the explorer link (§4.3), which puts a
> 60-minute merge token in a user-visible URL. Move it to a fragment too.

> **Accepted limitation — long-lived proofs are bearer material.** Whoever holds one can
> link that anonymous id to *their* wallet: pre-install, the victim's group has no wallet,
> so `checkWalletPriority` returns `null` (`IdentityWeightService.ts:247`), no conflict
> fires, and the merge proceeds by weight.
>
> This is not a regression today — the raw `anonymousId` grants the same power with no
> proof at all. But from Phase 4a the raw id stops being sufficient everywhere *except*
> here, where a harvested proof still works. That is why both windows are bounded (90 /
> 30 days) rather than uncapped — it converts a permanent hole into a self-healing one.
> It follows that:
>
> - the install-code ticket (§5) is the real fix for that path, because it is short-lived
>   and, from Phase 5 onward, minted only for a code whose `generate` was proven;
> - the direct `/install?m=&a=` URL and the Play referrer string remain bearer-y. They
>   must be documented as semi-private — surfaced to the sharer for their own install,
>   never as publishable content. Unlike the `fCtx` share link, they are not designed to
>   be reposted.

### 2.2.1 Do we still need a replay cache?

Mostly no. Working through each path:

- **`/identity/ensure`** — the merge target is `walletSession.address` under a mandatory
  auth macro (`ensure.ts:45-49,77`). A replay by the same wallet resolves to one group →
  `merged: false`, a genuine no-op. A replay by a *different* wallet hits two distinct
  wallets → `WALLET_CONFLICT` (`IdentityWeightService.ts:185-189`). The group cannot
  move, so no burn-set is needed. A burn-set here would actively hurt: the wallet retries
  ensure until success (`useExecutePendingActions.ts:79-89`), so a burned credential
  retries for the full 7-day TTL and then silently expires. Idempotency beats single-use
  on this path.
- **`/merge/execute`** — replay *is* dangerous, for the reason in the table above.
  Handled by binding the proof to `SHA-256(mergeToken)` rather than by a cache.
- **`/install-code/generate`** — the direct effect of a replay is harmless: it re-mints a
  code for an id the caller already proved it owns. But the artifact it produces is not.
  A successful `generate` yields a code that resolves into a ticket valid for a week and
  explicitly not single-use (§5). So anyone who merely observes a valid `frak-install-v1`
  proof, without ever holding the private key, can replay it to launder a bounded proof
  into a week-long bearer ticket.

  With the window at 30 days (§2.2) rather than ±5 min, the proof and the ticket it mints
  are the same order of magnitude, so the laundering step buys an attacker very little —
  which is the point. The mitigation is the ticket TTL staying tied to the pending-action
  TTL, not a replay cache. Do not let the ticket outlive the proof by orders of
  magnitude, or this reopens.

Net: no Redis/KV replay cache anywhere. One less piece of infrastructure, and one less
way for a retrying wallet to deadlock itself.

### 2.3 Storage: extractable key + JWK in `localStorage`

The key is generated `extractable: true` and stored as JWK in `localStorage`, next to
the client id, **on the merchant origin**.

**Why not IndexedDB + non-extractable.** A non-extractable `CryptoKey` cannot be
exfiltrated even by XSS, which is strictly stronger — but it can only be persisted via
IndexedDB structured clone, and IndexedDB is precisely what gets evicted in embedded
in-app browsers, private mode, and under ITP. That would silently orphan identities.

The threat model here is remote attackers acting on publicly-guessable ids, not XSS on
merchant pages. An attacker with XSS on the merchant page can already read the client id,
forge interactions in the user's session, and manipulate the DOM. The key adds little for
them and a lot against the remote attacker.

`localStorage` also gives the key the same lifetime as the id it derives, which is the
property that prevents bugs.

> **Store and clear key and id atomically.** A surviving key with a lost id, or the
> reverse, produces a derivation mismatch that fails verification silently. Treat a
> missing half as "regenerate both". This is the same trap as the iOS Keychain surviving
> app uninstall while `UserDefaults` does not.
>
> Also handle both present but mismatched. `localStorage` gives no cross-key
> transactionality, so a crash or a multi-tab race between the two `setItem` calls (§2.6
> step 2) can leave a stale id beside a fresh key. On load, re-derive the id from the key
> and compare; on mismatch the key is authoritative, so overwrite the stored id. Never
> leave the pair inconsistent, or every later signature fails verification with no
> diagnosis path. This matters more once §4.6's `proofSeen` latch exists: a latched id
> whose key was lost is unusable as a merge source.

```
localStorage["frak-client-id"]  = "<uuid>"          // unchanged key name; now derived
localStorage["frak-client-key"] = "<JWK JSON>"      // new
```

**Wire format.** Proofs cross an RPC boundary, a URL fragment, and a Play referrer
string. Serialise as a single base64url blob so every hop treats it as one opaque value:

```
proof = base64url(JSON({ v: 1, pk, ts, sig }))
```

with `pk` and `sig` themselves base64url strings inside the JSON (JSON cannot hold raw
bytes), and `ts` a JSON number: integer Unix seconds.

Length budget: pubkey 65 B and sig 64 B are base64url'd (→ 88 + 86 chars), wrapped in
JSON, then base64url'd again — roughly ~300 bytes, since the encoding is applied twice.
The Play referrer cap is ~1024 chars total and currently carries ~96 (`install.tsx:230`),
so ~300 still fits, but it is now the binding constraint on that field, and any future
addition must be measured against it.

#### The exact signed byte layout — freeze this before native branches

§8 warns that derivation and signing drift silently across platforms. That warning is
useless unless the bytes are pinned here. They are:

```
msg := prefix ‖ field(merchantId) ‖ field(anonymousId) ‖ field(binding) ‖ uint64be(ts)

prefix       := ASCII bytes of the op string, no length prefix, no separator
                ("frak-merge-v1" | "frak-ensure-v1" | "frak-install-v1")
field(x)     := uint16be(byteLength(x)) ‖ x
uint16be     := 2-byte unsigned, big-endian
uint64be(ts) := 8-byte unsigned, big-endian, Unix SECONDS (not ms), fixed width
                — NOT length-prefixed, because its width is already fixed
```

- `merchantId` and `anonymousId` are the **UTF-8 bytes of the lowercase, hyphenated,
  36-character UUID string** — not the 16 raw bytes. Lowercase is mandatory (Swift's
  `UUID.uuidString` is uppercase; normalise before signing).
- `binding` is op-specific and **always present**, zero-length where unused:
  - `frak-merge-v1` → the 32 raw bytes of `SHA-256(mergeToken)`
  - `frak-ensure-v1` → empty (`uint16be(0)`, no payload)
  - `frak-install-v1` → empty (`uint16be(0)`, no payload)

  Keeping a zero-length field rather than omitting it means the field *count* never varies
  by op, which is what stops a parser divergence between platforms.
- `sig` is raw `r‖s`, 64 bytes, **low-S normalised**. Convert to/from DER at platform
  boundaries.
- `pk` is the **uncompressed** public key: 65 bytes, `0x04` prefix.

This layout, plus the derivation in §2.1, is what the golden fixtures in §8 must lock
down. It must be frozen before the native SDKs branch, because it cannot be changed
afterwards. See §7 Phase 0.

### 2.4 Pure-JS fallback is required, not optional

`crypto.subtle` is absent entirely on non-secure contexts (plain HTTP), and this already
bites us today: `clientId.ts:11-23` falls back to `Math.random()` when
`crypto.randomUUID` is missing, and `randomUUID` carries the same secure-context
requirement. Merchants on HTTP already take a degraded path.

**Decision: do not degrade to an unverifiable identity.** A dual-tier system where some
ids are provable and some are not preserves the exact hole we are closing, forever, and
gives attackers an obvious downgrade target. The extra bundle weight is worth it.

Fallback: `@noble/curves` P-256, well audited, already present in `apps/wallet` as a
devDependency (`package.json:93`), used only by test helpers today
(`tests/helpers/webauthn/signature.ts`, `tests/helpers/mockedWebauthn.helper.ts`). Treat
it as a new production dependency for `sdk/core`, whose current runtime deps are just
`@frak-labs/frame-connector` and `@openpanel/web`. Import it lazily and only on failure,
so the common path never pays for it:

```ts
async function getSigner(): Promise<Signer> {
    if (await webCryptoAvailable()) return webCryptoSigner();
    const { p256 } = await import("@noble/curves/nist.js");   // lazy chunk
    return nobleSigner(p256);
}
```

Feature-detect by **attempting a real `generateKey`**, not by checking
`typeof crypto.subtle` — some embedded browsers expose the object but throw on use.
Cache the result.

Why the fallback is sufficient, and why there is no third tier: three APIs are relevant,
and only some are gated on a secure context:

| API | Secure context required | Used by |
|---|---|---|
| `crypto.randomUUID` | **yes** | today's id (`clientId.ts:13`) |
| `crypto.subtle` | **yes** | WebCrypto keygen / sign |
| `crypto.getRandomValues` | **no** | `@noble/curves` keygen |

On an HTTP merchant site both `randomUUID` and `subtle` are undefined, which is why
`clientId.ts:17-21` already falls through to `Math.random()` today. But `getRandomValues`
is not secure-context gated and has shipped in every browser since IE11, so the `@noble`
path works there. HTTP merchants get a real, provable, derived id — a strict improvement
over today's `Math.random()` id.

If key generation is impossible anyway — no `subtle`, no `getRandomValues`, which in
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

> Order-of-magnitude estimates — see the benchmark note below.

Context: a single mobile network round-trip is 200–800 ms. The crypto is one to two
orders of magnitude below one request the SDK already makes.

Rules that keep it invisible:

- keygen happens once, ever, per browser/app install, inside the already-`async`
  `createIframe` (§2.1), before `iframe.src` is set. Every later visit is a
  `localStorage` read.
- `getClientId()` keeps its synchronous signature. No public API break. It reads the
  module cache populated during `createIframe`.
- signing only on merge / ensure / install-code, never on `track/*`, `sendInteraction`,
  or config resolution
- the proof is always optional in the payload. If it cannot be produced, the call goes
  out exactly as it does today. Enforcement (Phase 4a, then 4b) is what makes it required.

> First-ever-visit keygen sits on the path to `iframe.src` and cannot be deferred to
> `requestIdleCallback`, because the id does not exist until the key does: ~1–3 ms
> typical, 10–30 ms low-end, 30–80 ms on the `@noble` fallback, once per browser, against
> a handshake that already costs a 200–800 ms round-trip. Returning visits pay nothing.
>
> **Benchmark on a real low-end Android before committing** — the one measurement that
> could justify revisiting §2.1's registry alternative. Downgraded from blocking to
> informational after tracing what the iframe actually does: it is created hidden
> (`baseIframeProps.style` is 0×0 at `top: -1000px`, and `createIframe` calls
> `changeIframeVisibility({ isVisible: false })` before setting `src`,
> `iframeHelper.ts:11-23,47`), and `initFrakSdk` is never awaited by merchant page
> rendering (`sdk/components/src/bootstrap/initFrakSdk.ts:22-52`, fire-and-forget with a
> `.catch()`). So keygen delays the handshake, not paint — even the 80 ms fallback case is
> not user-perceptible. Measure it for the record; it does not gate the phase.

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
  is a single merge on that merchant, not a loop over merchants. `anonymous_fingerprint`
  nodes are scoped `(value, merchantId)` (`identity/db/schema.ts:83-85`), which lines up
  with this one-to-one.
- **Never delete the legacy id.** `mergeGroups` repoints `identity_nodes.groupId` and
  deletes the *losing group row*, not the node (`IdentityMergeService.ts:198-201,341-343`),
  which is correct and must stay. The legacy id is embedded in already-published `fCtx`
  links; deleting it orphans every one of them.

#### The migration is itself the attack, and this is unavoidable

Step 3 proves ownership of `newId`. It proves nothing about `legacyId`, and cannot, since
no key ever existed for it. So an attacker runs the identical, fully-valid migration
naming any harvested `legacyId` as the target. They hold a wallet, the victim
(pre-install) does not, so `checkWalletPriority` anchors on the attacker
(`IdentityWeightService.ts:216-247`) and the victim's unsettled rewards move.

Proof on the source side alone changes nothing. Closing it requires proof on both sides
of a merge, which legacy ids can never provide, which is exactly what the migration needs
them to do. The requirement is self-contradictory.

An already-published legacy id cannot be secured, under any design in this document.
Registry-binding has the identical hole. The migration is inherently first-come,
first-served, and the window runs until each affected user next visits — days or weeks.

#### Decision: accept the risk, ship now

**Accepted, explicitly.** At the time of writing the exposed set is small, and none of it
belongs to a creator with meaningful unsettled rewards. The realistic worst case is a
handful of manually repairable identity groups.

> Confirm the current numbers before relying on this (§7 Phase 1). The decision below is
> only valid while the exposed set stays small.

This is not a risk we are tolerating reluctantly — it is the entire reason the work is
scheduled now. The unfixable set is exactly the ids published before this ships, and it
grows every week. Waiting makes it strictly worse and never better; there is no future
point at which legacy ids become fixable.

Two things follow, and neither is optional:

1. **§3 is what actually protects the legacy population**, because cryptography cannot.
   Rate limiting and closing the `anonymousId` oracles are the real mitigation.
2. **Treat a conflicting migration as an alarm.** Two different `newId`s attempting to
   claim the same `legacyId` for the same merchant is the detection signal for active
   harvesting. Reject the second, alert on it; do not silently accept or drop it. At
   current volumes an alert is genuinely actionable — it means investigating a specific
   user, not triaging noise.

---

## 3. Backend fixes that ship regardless

Proof-of-possession raises the floor for new clients. It does not retire the existing
surface. These are independent and must land:

| # | Fix | Why |
|---|---|---|
| 3.1 | **Authenticate `merge/execute`** — see the caveat below | it currently has no session macro at all |
| 3.2 | Replace `anonymousId` with an opaque ticket in the install-code flow (§5) | closes the harvesting oracle. **Coordinated backend + wallet change**, phased in §5 |
| 3.3 | Per-code attempt limiting on `install-code/resolve`, independent of source IP | 31⁶ keyspace with IP-only limiting is harvestable at botnet scale. **Note the limiter is in-memory per-pod** (`rateLimiter.ts:33-35`, "swap the Map for Redis") — with N replicas the effective limit is N× the configured value. Per-code limiting needs shared state to mean anything |
| 3.4 | Same treatment for `GET /identity/order-client` (`orderClient.ts:14`) | second unauthenticated `anonymousId` oracle, 30/min. Requires a valid `checkoutToken`, so it is narrower, but the same class |
| 3.5 | Alert when a merge would move a group holding **unsettled** `asset_logs` under a different wallet | the high-value case. **No alerting exists today** — `prom-client` metrics and Grafana dashboards yes, but zero `PrometheusRule`/Alertmanager anywhere in `infra/`. This item includes building the first one, and naming who receives it |
| 3.6 | Rate limit tracking endpoints keyed by `(merchantId, clientId)`, not IP alone | CGNAT makes IP-only limiting both too harsh and too weak. **`trackApi` has no rate limit at all today** (`api/user/track/index.ts:5-7`), unlike every sibling identity route — that is the first gap to close |
| 3.7 | Remove the raw-hex-address bypass in `sdkIdentity.ts:39-48` | any address string is currently accepted as proof of wallet identity. Reachable from `/track/purchase`, `/track/interaction`, `/merchant/referral-status`. **Note this does not fix §3.9** — see below |
| 3.8 | **Handle `WALLET_CONFLICT` on `/identity/ensure`, backend *and* client** | `ensure.ts` has no `try`/`catch`; the 409 is not in the route's declared response schema (`ensure.ts:94-103` declares only 200/400/401). Catch it, log it as a security event, return a non-retryable status — **and surface it in the wallet**, see below |
| 3.9 | **Make `track/*` resolve-only — never merge** | the one-request variant of the headline attack (§1). Highest severity, lowest cost, no client dependency. Detailed below |

None of these change *when* the payout wallet is resolved. Settlement-time resolution is
correct and deliberate (see §1); the fix is to make group membership unforgeable.

> ### 3.9 — `track/*` must not merge identity groups
>
> Ship this first. It is backend-only, needs no SDK release, no version skew, and no
> coordination with anyone, and it closes the widest hole in the system (§1).
>
> `track/*` does not need to merge at all. `/identity/ensure` is the purpose-built
> endpoint for wallet↔anon linking, and it already fires reliably whenever a wallet
> connects: `watchWalletStatus.ts:84-89` calls `ensureIdentity` on every status change
> carrying an `interactionToken`, deduped once per merchant per session
> (`ensureIdentity.ts:44-47`). The merge inside `resolveSdkIdentity`
> (`sdkIdentity.ts:116`) is redundant with it.
>
> So: resolve each node, attribute the interaction to the authenticated group (the
> wallet's, when a valid session is present), and never call `mergeGroups` from this path.
> Add the missing rate limiter while there.
>
> No proof header on `track/*`. Once merging is gone, a forged `x-frak-client-id` can
> only write activity into someone else's group. It cannot move the group, and therefore
> cannot redirect rewards, because the group→wallet edge is resolved at settlement and is
> unreachable from here. A proof would buy almost nothing.
>
> This also settles the web-pixel constraint by construction. `/track/purchase` is called
> from the Shopify checkout pixel
> (`apps/shopify/extensions/checkout-web-pixel/src/index.ts`), which runs in a sandboxed
> worker on the payment page with no key material, no merchant origin, no ability to sign.
> Under a proof requirement it would have needed a permanent exemption, exactly the kind
> of dual-arm carve-out §5 warns becomes load-bearing forever. No proof means no exemption
> to maintain.
>
> `track/*` stays unsigned (§4.5), but not for the reason "rate limiting covers these" —
> rate limiting cannot cover a single-request attack. The exclusion is correct only
> because merging is removed here.
>
> **Accepted residual:** attribution integrity on `track/*` becomes a data-quality
> property, not a security one. An attacker can inject `arrival` / `sharing` interactions
> under another user's `clientId`, polluting referral chains and analytics. Acceptable
> while campaign payouts derive from settlement rather than raw interaction counts —
> revisit the moment a campaign pays out on interaction volume.
>
> **Phase 5 implication:** there is nothing to delete here. The bare `x-frak-client-id`
> arm on `track/*` is permanent and correct, and deliberately not on the §5 checklist.

> ### ⚠️ 3.1 is not a free "no client changes" win
>
> "Require a session on `merge/execute`" looks like a no-client-risk fix. It is not. The
> only caller of `/merge/execute` is `lifecycleHandler.ts:266`, on the in-app-browser
> escape path: `InAppBrowserToast` → `getMergeToken()` → `?fmt=` → redirect to the system
> browser → listener replays the token. Those users are anonymous by construction — the
> whole point is preserving identity for someone who does not yet have a wallet.
> Requiring a wallet session there kills in-app-browser attribution outright.
>
> The correct fix is proof-of-possession on `targetAnonymousId` (§2.2), not a session.
> Until the SDK ships proofs, `merge/execute` must accept the unproven arm. This is why
> §3.1 lands in Phase 4a, not Phase 1.

> ### §3.8 is half a fix without the client half
>
> The backend change alone returns a clean non-retryable status into a UI that says
> nothing. Traced end to end today:
>
> - `useExecutePendingActions.ts:75-97` handles rejection with `trackEvent` +
>   `recordError` only; neither renders anything.
> - `InstallProcessing` navigates to `/wallet` after ~500 ms regardless of outcome
>   (`install.tsx:95-140`); it never awaits the ensure call.
> - `store.removeAction` is called only on success (`:82-88`), so a permanently-409ing
>   ensure retries on every app launch for the full 7-day TTL.
> - In the install-code flow the success modal fires at resolve time, before the deferred
>   ensure ever runs, so the user is told "done" and then silently isn't.
>
> A working `Toast` exists and is used elsewhere in the app
> (`apps/wallet/app/module/common/component/Toast/index.tsx`). This is an omission, not a
> technical limitation. §3.8 must drop the pending action on a non-retryable status and
> show the user something. Scope of loss is narrow — only that merchant's attribution;
> wallet, auth, balances and other merchants are unaffected — so the message can be
> specific and calm.
>
> This is the highest value-per-line item in the plan: the difference between a hijacked
> victim getting a clean, reportable error and a silent seven-day retry loop nobody can
> diagnose.

---

## 4. What the SDK signs, and how each proof travels

Concretely, per call site. Everything below is additive; every field is optional.

### 4.1 `/identity/ensure` — SDK arm

`sdk/core/src/actions/ensureIdentity.ts:51`, which POSTs to `/user/identity/ensure`. The
SDK owns the key and makes the call directly. Add the proof to the body:

```ts
body: JSON.stringify({ merchantId, proof })   // proof optional
```

Backend: if `proof` present, recompute the id from `pk` and check it equals the claimed
`anonymousId`, then verify the signature. If absent, current behaviour. No transport
work, no listener involvement, no retro-compat concern — the SDK is CDN-delivered and
updates automatically (§6.3).

### 4.2 `/merge/initiate` — via `frak_getMergeToken`

`frak_getMergeToken` currently declares `Parameters?: undefined`
(`sdk/core/src/types/rpc.ts:193-197`). Add one optional parameter:

```ts
{
    Method: "frak_getMergeToken";
    Parameters?: [proof?: string];
    ReturnType: string | null;
}
```

`useOnGetMergeToken.ts:24` calls `/merge/initiate`. Note the handler ignores its RPC
`_params` today and builds the body from listener context (`:19-26`) — so wiring the proof
through is a small deliberate change, not a pass-through that already exists. Old SDKs
send nothing and the param arrives `undefined` — structurally safe in both directions.

Backend: proof binds `sourceAnonymousId`. This is the endpoint that mints merge tokens
for arbitrary ids, so it is the highest-value place to enforce first.

#### Enforcement here is per-arm, not per-endpoint

`/merge/initiate` has **two callers**, and only one of them is a problem
(`merge.ts:15-20` branches on exactly this):

| Caller | Source identity | Authenticated by |
|---|---|---|
| Wallet app explorer — `ExplorerDetail/index.tsx:106-117` via `mergeTokenQueryOptions` with no `sourceAnonymousId`, gated on `!!walletAddress` | `walletSession.address`, derived server-side | a real `x-wallet-auth` JWT |
| Listener — in-app-browser escape, `useOnGetMergeToken.ts:24` | `sourceAnonymousId` from the request body | nothing — this is the hole |

The wallet arm never names an id it does not own; the backend resolves it from the
session. It is already authenticated, needs no proof, and is not store-gated for
enforcement. The rule is therefore:

> On `/merge/initiate`: if `sourceAnonymousId` is supplied it must carry a proof (or be a
> legacy id, §2.6). If it is absent, the wallet session is the proof.

This matters for phasing: it is why merge enforcement lands in Phase 4a without waiting
on a store release (§7).

> The explorer flow is also the reverse direction of the one §3's warning box describes:
> wallet app → SDK, minting a token for an authenticated wallet and handing it to the
> merchant site via `?fmt=`. The `frak-merge-v1` binding to `SHA-256(mergeToken)` does real
> work on exactly this path — it stops a leaked `?fmt=` URL being redeemed against a
> *different* anonymous id. Since that URL is user-visible and shareable, it is the
> highest-leak merge surface in the system: move `fmt` to a fragment (§2.2).

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
    proofs: {
        merge?: string;    // frak-merge-v1   — binds SHA-256(mergeToken)
        install?: string;  // frak-install-v1 — binds merchantId only
    };
};
```

**Two named, domain-separated proofs, not one blob.** Reusing a single `proof` field for
both merge and install would be incompatible with §2.2: it requires a `frak-install-v1`
prefix with no merge binding, so a merge-bound blob would fail verification at the
install endpoint and silently break the flow. Naming both fields removes the
ambiguity — without it, the three platform implementations would each guess differently.

Do not generalise to "any message signed by the key." It is tempting, since it would
collapse a field, but it is also the one change that would undo every other mitigation
here: domain separation is exactly what stops a proof harvested from a leaky `#p=`
install URL (§2.2) from being replayed against `/merge/execute` for direct theft.
Collapsing the ops would promote the leakiest artifact in the system into a universal
credential for every operation. The cost of keeping them separate is one extra ECDSA
sign, <1 ms, off the critical path.

Both are signed during the handshake. `merge` is present only when there is a pending
token — the SDK must sign *after* it has the token, which it does, since
`pendingMergeToken` is read from the URL (`createIFrameFrakClient.ts:307-308`) before
`resolved-config` is emitted. `lifecycleHandler.ts:266-271` forwards `proofs.merge` to
`/merge/execute` alongside `targetAnonymousId`; the listener interprets neither.

> The listener currently prefers `iframeClientId ?? clientIdStore` for `targetAnonymousId`
> (`lifecycleHandler.ts:255-256`). When `sdkIdentity` is present, use
> `sdkIdentity.anonymousId` instead — it is the value the proofs actually cover. A
> mismatch must fail closed rather than fall back.

### 4.4 The `/install` URL — via the same `resolved-config` proof

The install URL is built in the listener from `clientIdStore`
(`SharingPage/index.tsx:69`) and in the wallet from its own store (`sharing.tsx:183`).
Neither has the key. Both carry `sdkIdentity.proofs.install` — the `frak-install-v1`
proof from `resolved-config`, not the merge proof — and append it as a URL fragment
(`#p=`, §2.2), not a search param.

This is the trickiest arm because it crosses into the store-gated wallet binary. It is
fully specified in §5.

### 4.5 What is *not* signed

Deliberately, to protect constraint 3:

- **`track/*`, `sendInteraction`** — high frequency, and structurally unsignable on one
  arm: `/track/purchase` is called from the Shopify checkout pixel, a sandboxed worker
  with no key access (§3.9). These stay unsigned, but only because §3.9 removes group
  merging from this path — rate limiting alone would not cover it, since the attack needs
  exactly one request. The exclusion is safe only once §3.9 ships. Do not exclude
  `track/*` before then.
- config resolution — high frequency, nothing security-relevant to bind.
- `buildSharingLink` — pure client-side URL construction, no backend call, nothing to
  authenticate. The published `fCtx` remains a plain id by design; making it unforgeable
  would require a v3 wire format and break every published link for no gain, since the
  link is meant to be public.

### 4.6 The `proofSeen` latch — how enforcement becomes per-identity

Enforcement has an ordering problem: a derived id and a legacy id are both just UUIDs, so
the backend cannot tell them apart by inspection. "Require a proof" can only be a global
flag day, gated on a coverage threshold §7 never defines, and until it flips, every new
derived id is as claimable as a legacy one.

Fix it with one boolean column on `identity_nodes`: `proofSeen`. Set it the first time
that node presents a valid proof. Once latched, that id always requires a proof, in
either merge role, forever.

This is not the registry §2.1 rejects. That was an id→pubkey mapping that had to exist
before first use, with a trust-on-first-use race for brand-new clients. This is a
one-bit ratchet that only ever increases strictness, set from a self-authenticating
proof, with no race: an attacker cannot set it without the key, and cannot clear it at
all.

What it buys:

- a `newId` is protected from its first proof onward, so §2.6's migration never doubles a
  user's exposed surface. Only the `legacyId` stays claimable, exactly as today, not
  worse.
- enforcement becomes continuous and per-identity rather than a flag day gated on an
  undefined "coverage is high enough" threshold, which was Phase 4a's go/no-go blocker.
- legacy ids keep working forever with no special-casing; they simply never latch.

A user who clears `localStorage` regenerates key and id together and gets a fresh,
unlatched id, which §9 already defines as the rotation story. The case to handle is
§2.3's atomicity trap: an id that survives without its key is latched and now unusable as
a merge source, which is why "missing or mismatched half ⇒ regenerate both" must be
enforced strictly.

Cost: one migration, one column, one write on first valid proof.

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
| Direct link | `/install?m=&a=` (`install.tsx:40-43,95`) | raw params, user-editable |
| Play referrer | `useInstallReferrer.ts:46-48` | `merchantId=…&anonymousId=…` |

### Where the signature goes — `generate`, not `resolve`

The natural assumption is that the wallet signs at `resolve`. It cannot: the private key
is on the sharer's merchant-page origin, and the wallet is a different app, frequently on
a different device entirely (share on desktop, install on phone).

`/install?m=&a=` is also a web page: both `InstallProcessing` (`install.tsx:95`) and
`InstallCodeView` (`install.tsx:174`) read `{m, a}` straight from the URL, and the latter
calls `generate` with that `anonymousId`. Anyone can edit those params. So proof must be
established when the code is minted:

```
generate  ← proof required   (originates from the sharer's SDK, via §4.4)
resolve   ← no proof needed  (possession of the code implies a verified generate)
```

— with the caveat that "proof required" only becomes true at **step 2**; see the rollout
below, and the oracle-window note attached to it.

### Ticket design

A signed JWT: no new table, no schema change, stateless verification. It slots into the
existing `JwtContext` namespace (`infrastructure/external/jwt.ts:18`) as a sibling of
`anonymousMerge`:

```jsonc
{ "sub": "<anonymousId>", "mid": "<merchantId>", "jti": "<uuid>",
  "iat": …, "exp": …, "aud": "install-ticket" }
```

| Rule | Why |
|---|---|
| TTL == pending-action TTL (one week) | a shorter ticket means the wallet drains a dead one; a longer one is bearer material outliving its purpose. Tie both to a single shared constant, exported from one place and imported by `pendingActionsStore.ts:9`. Do not let it drift upward (§2.2.1) |
| Audience-scoped (`aud`) | must not be replayable as any other token type |
| Not single-use | per §2.2.1: the ensure target is the authenticated wallet, so replay cannot move the group, and a burn-set would deadlock the wallet's retry loop. Idempotency is the correct property here |
| Dedupe key becomes `ensure:${merchantId}:${ticket}` | tickets are per-resolve, not per-identity |
| URL-safe, ≤ ~600 chars | defensive — the ticket travels in the `resolve` JSON response and then through `pendingActionsStore` into the `ensure` POST body, never in a URL or the Play referrer. Keep it URL-safe anyway so that stays true by construction |

> **The ticket is bearer material too, same caveat as §2.2.** It is signed,
> audience-scoped and TTL-bound, which makes it look like a proper credential. It is not
> a proof of possession: anyone holding it can link that anonymous id to their wallet for
> a week, exactly as a stolen `frak-ensure-v1` proof or a stolen raw id could. The
> audience scoping stops cross-type replay; it does not stop use by whoever holds it.
> Accepted for the same reason and under the same bound as §2.2, noted here so the caveat
> is not lost to section boundaries.

### The two-step rollout

This is the only part of the plan gated on store review. It is structured so that step 1
is invisible to every already-shipped binary, and step 2 is a pure deletion.

#### Step 1 — additive everywhere, breaks nothing

Backend:
- `install-code/generate` accepts an optional `proof`. When present, verify it and
  record the outcome as telemetry. It gates nothing yet.
- `install-code/resolve` returns `{ merchantId, anonymousId, merchant, hasWallet }`
  unchanged, plus a new `ticket` field, minted unconditionally from the `anonymousId`
  already on the row (`schema.ts:149`). Old binaries ignore the extra field; new
  binaries prefer it.
- `/identity/ensure` accepts `{ merchantId, anonymousId?, ticket?, proof? }`. Resolution
  order: `ticket` → `proof`+`anonymousId` → bare `anonymousId` (legacy).

> **Why `resolve` mints the ticket unconditionally, with no `verified` flag.**
> `generate` and `resolve` are separated by the user typing a code on a different device,
> so the only things that cross that gap are the `install_codes` row and the code itself.
> Gating ticket issuance on "was this code's `generate` proven?" would need a persisted
> `verified` column, a schema migration.
>
> Not worth it. Emitting both `anonymousId` and `ticket` for the whole of Phase 3–4 keeps
> the change to zero DB migrations, and the flag would be redundant the moment step 2
> makes `proof` mandatory on `generate` — at which point every code is verified by
> construction and the column would be dropped again.
>
> The cost: the harvesting oracle stays open until step 2. An attacker brute-forcing
> codes still reads a durable `anonymousId`, because the field is still there. Two things
> follow:
> - §3.3 (per-code attempt limiting) is the real mitigation in the interim, not
>   supporting work. It ships in Phase 1, ahead of this.
> - the security win lands at Phase 5, not Phase 3. A dual-arm response that never gets
>   cleaned up is the hole this document exists to close.

Listener / SDK:
- `resolved-config` carries `sdkIdentity` with **both** named proofs (§4.3).
- The listener appends `proofs.install` to the install URL as a **fragment**, leaving the
  existing `m` / `a` search params untouched:
  `` `/install?m=${merchantId}&a=${clientId}#p=${installProof}` ``

Wallet (new binary):
- `install.tsx` reads a new optional `p` from the URL fragment. This is not
  `validateSearch` — TanStack Router validates search params only, so the fragment is a
  separate read path from the `m`/`a` params beside it. Verify the fragment survives the
  full redirect chain before relying on it.
- `ExplorerDetail/index.tsx:116` moves `fmt` from a search param to a fragment (§2.2,
  §4.2). This rides along here because it is the same store-gated binary and the same
  class of change. It is not a compatibility break: the consumer is the merchant-side SDK
  reading `?fmt=` (`createIFrameFrakClient.ts:307-308`), which ships continuously, so the
  SDK must accept both forms before this wallet release goes out. SDK first, wallet
  second.
- `InstallProcessing` / `InstallCodeView` forward `p` to `generate`.
- `useResolveInstallCode` stores `ticket` in the pending action when present, keeping
  `anonymousId` populated so the store stays readable by a rolled-back build.
- `useExecutePendingActions` sends `ticket` when present, else `anonymousId`.
- `install.tsx:230` referrer string gains `&proof=…`; `useInstallReferrer.ts:46-48`
  reads it if present. Existing keys unchanged.
- `pendingActionsStore` gains `version: 1` and an identity `migrate`. It currently has
  neither (`pendingActionsStore.ts:115-120`), so there is no hook available when one is
  eventually needed. Add it now, while the migration is a no-op.

> Deliberately not doing the "return the ticket inside the existing `anonymousId` field"
> trick. It would work — the wallet treats that value as fully opaque on every path
> except `useInstallReferrer.ts:77`, which writes it into `clientIdStore` — and it would
> close the oracle with zero wallet release. It is rejected because it makes the field
> mean two different things depending on the caller, poisons `clientIdStore` on the
> Android referrer path, and leaves no clean deletion point. The explicit two-step is
> slower but leaves the codebase in a state we can actually reason about.

#### Step 2 — after the new binary has been live 5–6 days, bump `minVersion`, then delete

`GET /common/version` → `minVersion.{ios,android}` (`services/backend/src/api/common/version.ts:19-22`)
is the hard gate. The wallet polls it on boot and on window focus, 5-minute stale time
(`useVersionGate.ts:36-45,135-146`), and enters `hard_update` below the floor. It is an **env
var captured at module load**, so bumping it requires a backend deploy/restart.

Once the floor excludes every pre-ticket binary, delete. Tag all of these in code with a
single searchable marker at implementation time, e.g. `TODO(install-ticket-step2)`:

- [ ] `anonymousId` from the `install-code/resolve` response
- [ ] the bare-`anonymousId` arm of `/identity/ensure`
- [ ] the unverified arm of `install-code/generate` (proof becomes required)
- [ ] `anonymousId` from `PendingEnsureAction` (`types.ts:8`) — bump the store to
      `version: 2` with a real migration that drops it
- [ ] the `a` param on `/install` and `anonymousId=` in the referrer string
- [ ] the `?a=` construction sites: `SharingPage/index.tsx:69`, `sharing.tsx:183`
- [ ] the unproven arm of `/merge/execute` and of `/merge/initiate`'s `sourceAnonymousId`
      branch only — the wallet-session branch never had an unproven arm to remove (§4.2)
- [ ] the SDK's `?fmt=` search-param read (`createIFrameFrakClient.ts:307-308`), once no
      pre-fragment wallet binary remains — fragment-only from then on

Not on this list, deliberately: the bare `x-frak-client-id` arm on `track/*`. Once §3.9
makes that path resolve-only it is permanent and correct — the Shopify checkout pixel
cannot sign, and does not need to. Do not tag it with the marker.

Until every box is ticked, the install-code oracle is still open. Step 2 is not optional
cleanup — it is where **that** fix lands. (The headline §1 vulnerability is closed earlier,
by §3.9 in Phase 1 and enforcement in Phase 4a — see §7 Phase 5's scope correction.)

---

## 6. Wallet compatibility contract

The wallet frontend is compiled into the native binary — `tauri.conf.json:7-9` sets
`frontendDist: "../dist"`. `tauri-plugin-frak-updater` only prompts users toward the
store; there is no OTA or JS hot-patch mechanism anywhere in the repo. Every
already-installed binary keeps its compiled-in Eden client and its assumptions forever.

### 6.1 Frozen until `minVersion` excludes all old binaries

| Surface | Contract | Consumer |
|---|---|---|
| `install-code/resolve` response | `merchantId`, `anonymousId`, `merchant.name`, `merchant.domain` must stay present and non-optional | `useResolveInstallCode.ts:52-57` — pushed straight into `pendingActionsStore`, later POSTed to `ensure` |
| `/identity/ensure` request | must keep accepting `{ merchantId, anonymousId }` and returning 2xx | `useExecutePendingActions.ts:123-131` |
| `/install` search params | `m`, `a` — **renaming fails silently**, both become `undefined`, no ensure fires, no error | `install.tsx:40-43` |
| Play referrer keys | `merchantId=`, `anonymousId=`, ~1024-char cap (currently ~96) | `install.tsx:230` produces, `useInstallReferrer.ts:46-48` consumes. Note the producer is the *live web page* and the consumer is *whatever binary eventually installs* — these can be many releases apart in either direction |
| `pendingActionsStore` shape | no field renames/removals; no `version`/`migrate` exists today | `pendingActionsStore.ts:115-120`. **Also used by `navigation` actions** (`_protected.tsx:15-19`, `deepLink.ts:173`, `PairingInProgress`, `register.tsx:130`) with a separate 10-min TTL — any migration must not break those |
| `install-code/generate` response | `code: string` | `useGenerateInstallCode.ts:25` |
| `?fmt=` on the outbound explorer link | the **SDK** must keep reading `?fmt=` until every pre-fragment wallet binary is gone | produced by `ExplorerDetail/index.tsx:116` (store-gated), consumed by `createIFrameFrakClient.ts:307-308` (ships continuously). Moving it to a fragment means **SDK accepts both first, wallet switches second** — never the reverse |

### 6.2 Safe to change now

- `install-code/resolve` → `hasWallet` — analytics only (`useResolveInstallCode.ts:46`)
- `install-code/generate` → `expiresAt` — fetched, never read
- `/identity/ensure` → `status` — never destructured; the wallet checks only `error`
- any additive field — structural typing means extra fields are ignored by old builds,
  which is what makes §5 step 1 safe

### 6.3 The SDK has none of these constraints

`@frak-labs/components` is loaded from jsDelivr unpinned by every plugin — WordPress
(`class-frak-frontend.php:111`, no version tag), Magento (`SdkLoader.php:47`, `@latest`),
PrestaShop (`FrakUrls.php:47,50`, no version tag), Shopify
(`apps/shopify/extensions/theme-components/blocks/listener.liquid:2`, `@latest`, overridable
via a shop metafield). None pin a version. CI purges the CDN cache on release
(`.github/workflows/release.yml:96-104`, conditional on an actual publish). Merchants get
SDK updates automatically. The listener is server-deployed at `wallet.frak.id/listener`
(`infra/gcp/wallet.ts:290-311`, ingress path routing). SDK-side and listener-side work
ships at normal speed; only the wallet binary is gated.

This is why §4.1 (SDK-arm ensure) and §4.2/§4.3 (listener pass-through) can land well
before §5, and why Phase 4a enforcement needs no store release at all (§7).

> The flip side: unpinned `@latest` means there is no staged rollout and no rollback
> short of republishing. See the kill-switch note in §7 Phase 2.

---

## 7. Phasing

Ordered so each step is independently shippable and useful, and so the two long-lead items
— the frozen wire format and the store review — start as early as possible.

> ### The real deadline is the native SDK, not the enforcement rollout
>
> A major client onboards within roughly a month, and the native SDKs
> ([`../native-sdk/`](../native-sdk/)) hardcode derivation and signing into binaries that
> cannot be patched afterwards. That gives the plan a genuine external forcing function,
> and it lands on a different item than expected:
>
> - Phases 4a/4b and 5 can slip past the native branch date. The cost is security debt,
>   measured against the exposed surface at that time, which is small today and growing.
> - The wire format cannot slip at all. Once native v0.1 ships, §2.3's byte layout and
>   §2.1's derivation are frozen in binaries in the field. Getting them wrong is not a
>   rollout delay, it is a permanent cross-platform incompatibility.
>
> "Freeze the format before native branches" is therefore a hard constraint with a real
> date, and takes priority over "budget Phase 5 with an owner". Phase 0 exists because of
> it.

### Phase 0 — freeze the wire format (blocking, starts now, cheap)

No product behaviour, no deploy. Pure specification work, and it gates Phase 6
irreversibly:

- pin the signed byte layout (§2.3) and the derivation (§2.1) — both are now written down;
  this phase is to review and ratify them, not to invent them
- commit golden fixtures. No golden fixtures exist anywhere in this repo today; they must
  be created here, not assumed.
- ratify the §4.3 two-proof shape so three platforms cannot each guess differently

**Acceptance:** a shared fixture file of `{privkey, pubkey_uncompressed, derived id, msg
fields, canonical msg bytes, sig}` exists, and the web implementation asserts against it
in CI. Android and iOS assert against the same file when they land.

### Phase 1 — backend hardening (no client changes at all)

§3.9 first, and ship it on its own: it closes the widest hole (§1), is backend-only, and
blocks on nothing. Then §3.3, §3.4, §3.6, §3.7, §3.8.

No SDK release, no version skew, no waiting on anyone.

§3.1 is explicitly not here, see the warning in §3. §3.2 is not here either; it is §5.

§3.8 is small but decisive: it is the difference between a hijacked victim getting a
clean error and a wallet retrying a doomed call for seven days. It has a client half —
the backend status alone changes nothing the user can see.

**Also in Phase 1, non-code: measure the exposed set.** §2.6 accepts a permanent,
unfixable risk for already-published legacy ids on the premise that the set is small.
That premise is currently asserted rather than measured. Count the distinct
pre-derivation `anonymous_fingerprint` values and the published share links carrying one,
record the number and the date, and re-check it before Phase 2 ships. If it is materially
larger than assumed, §2.6's accept-the-risk decision has to be revisited, not carried
forward.

**Acceptance:** all of §3.3/3.4/3.6/3.7/3.8/3.9 in production; regression tests for both
WALLET_CONFLICT paths (§9) merged; a synthetic request trips the new `track/*` rate limit
and receives 429; a `track/interaction` carrying a foreign `x-frak-client-id` provably
does not merge groups; the exposed-set measurement is recorded.

### Phase 2 — SDK key material + backend accept-but-don't-enforce
Needs Phase 0's frozen format. Runs in parallel with Phase 3 — but note the dependency is
real, not absent: Phase 3's `p` / `proof=` fields carry data that only Phase 2 can
produce. Because the SDK and listener ship continuously (§6.3), this is a code-level
dependency rather than a scheduling one.

- P-256 keygen inside `createIframe`, JWK persistence, atomic with the client id
- derived ids for new clients; migration merge for existing ones (§2.6), including the
  conflicting-migration alarm
- `@noble/curves` lazy fallback
- proof attached to `/identity/ensure` (SDK arm, §4.1) and `frak_getMergeToken` (§4.2)
- backend verifies when present, never requires: derivation check and signature only, no
  table, no lookup
- the `proofSeen` latch (§4.6): one column, written on first valid proof. Ship it with
  Phase 2, not later — it is what stops the migration from doubling each existing user's
  exposed surface during the Phase 2→4 window.
- telemetry: % of calls carrying a valid proof, split derived / legacy / keygen-failed;
  plus first-visit keygen timing from real devices (the §2.5 benchmark, informational)

> No kill switch exists for this. The SDK is CDN-delivered at `@latest` to every merchant
> (§6.3), so a bad Phase 2 release is live for 100% of traffic immediately, with no
> staged rollout and no `minVersion`-style ops gate. Before shipping, add a config-driven
> off switch for keygen/signing that does not require a republish — the wallet has
> `minVersion` for exactly this reason; the SDK has nothing.

**Acceptance:** derived ids issued to new clients; migration merge succeeds for existing
ones; `proofSeen` latches; ≥ one week of telemetry with the derived/legacy/failed split
visible; kill switch tested.

### Phase 3 — install ticket, step 1 (starts as early as possible)
The store-gated work from §5. Everything additive, in one wallet release:
backend ticket issuance, `sdkIdentity` on `resolved-config`, `#p=` fragment on `/install`,
referrer `proof=`, `pendingActionsStore` `version: 1`, and the `fmt`
search-param→fragment move on the explorer link.

**Sequencing constraint:** the SDK must accept `fmt` from both the search param and the
fragment before this wallet build ships, since old SDKs in the wild only read the search
param. SDK first, wallet second.

Submit to the stores the moment it is testable. The 10–15 business day review is the
longest lead time in the plan, though not the critical path, which is Phase 0 (see the
deadline note above).

**If review is rejected:** the backend and listener halves of Phase 3 are already live
and harmless on their own (old binaries ignore the extra fields), so a rejection delays
only Phase 5. Resubmit; do not unwind the server-side work. Budget for at least one
round-trip rather than assuming a single clean approval.

**Acceptance:** a pre-ticket binary and a post-ticket binary both complete the full
install flow against the dual-arm backend with no regression; store approval on both
platforms; an unversioned `pendingActionsStore` from an older build rehydrates cleanly on
a real device, with `navigation` actions intact.

### Phase 4a — enforcement that is *not* store-gated (run in parallel with Phase 3)

Every merge-endpoint proof travels via the SDK and the listener, both of which ship
continuously; neither is store-gated:

| Enforce on | Proof travels via | Store-gated? |
|---|---|---|
| `/merge/initiate` (`sourceAnonymousId` branch) | `frak_getMergeToken` param | **no** |
| `/merge/execute` | `resolved-config` | **no** |
| `/identity/ensure` (SDK arm) | SDK direct | **no** |

So the vulnerability this document opens with can be closed **days after Phase 2**,
without waiting on store review:

- require proof on `/merge/initiate`'s `sourceAnonymousId` branch and on `/merge/execute`
  (this is where §3.1's intent actually lands, via proof rather than session). The
  wallet-session branch of `initiate` needs nothing — §4.2.
- **a legacy id may be a merge *target* but never a merge *source*.** Legacy ids stay
  resolvable forever, because they are embedded in published `fCtx` links, but they stop
  being usable to *claim* anything.
- with §4.6's latch in place, enforcement is per-identity and immediate: any id that has
  ever presented a proof must always present one. No global coverage threshold, no flag
  day, no undefined go/no-go.
- accept that the migration path (§2.6) keeps legacy ids claimable-as-target by whoever
  moves first. There is no fix; there is only shipping early and §3.

**Acceptance:** a merge naming a latched id without a valid proof is rejected; legacy ids
still work as targets; in-app-browser escape attribution still works end to end.

### Phase 4b — enforcement on the wallet arm (store-gated)
Requiring `ticket` on the wallet's `/identity/ensure` call. This one actually waits for
`minVersion`, and it is folded into Phase 5's checklist rather than standing alone.

### Phase 5 — install ticket, step 2 — **where the install-oracle fix lands**
Bump `minVersion`, work the §5 deletion checklist.

Phases 1–4 raise the floor and build the machinery, but the `anonymousId` harvesting
oracle stays open for the whole of Phase 3–4 by design (see the note in §5 step 1): the
`resolve` response carries both arms so that no already-shipped binary breaks. Deleting
the legacy arm is the fix, not the cleanup. A dual-arm response left in place
indefinitely reproduces the exact vulnerability this document opens with.

> **Scope note:** with §3.9 in Phase 1 and merge enforcement in Phase 4a, the headline
> vulnerability is already closed before this phase. What remains here is specifically
> the install-code `anonymousId` oracle and the bearer arms around it. Still real, still
> must ship, but no longer the only thing standing between the product and the §1 attack.

A searchable TODO is not a forcing function on its own. This needs a tracked ticket with
a date derived from the Phase 3 ship date plus the `minVersion` soak, opened when Phase 3
is submitted, not after it lands. The native SDK deadline does not cover this phase, so
nothing else will force it.

### Phase 6 — native SDK
Ships derivation and signing from day one. There are no legacy native ids, so native is
cryptographic-only — no migration path, no legacy arm. Retrofitting a released binary is
impossible, so this must be in v0.1 even if enforcement lands later. See
[`../native-sdk/02-native-sdk-overview.md`](../native-sdk/02-native-sdk-overview.md) §4.

---

## 8. Cross-platform contract

One message format, one signature encoding, three implementations. This is exactly the
class of thing that drifts silently, so it needs golden fixtures.

> **There are none today.** The FrakContext codec has unit tests
> (`frakContextV2Codec.test.ts`) but no cross-language golden fixtures exist anywhere in
> this repo, and no native implementation exists yet to compare against. Creating them is
> net-new work: it is Phase 0, and it blocks the native branch.

Two algorithms must match exactly across platforms: id derivation and signing.
Derivation is the higher-risk of the two, because a mismatch there produces a wrong id
rather than a failed verification — it fails at account level, not at request level.

| | Web | Android | iOS |
|---|---|---|---|
| Keygen | WebCrypto → `@noble/curves` | `KeyPairGenerator("EC")` | CryptoKit `P256.Signing` |
| Storage | `localStorage` (JWK) | `SharedPreferences` / Keystore | `UserDefaults` |
| Hash | `crypto.subtle.digest` | `MessageDigest` | `SHA256` |

Traps, all of which produce silent failure:

- **Public key format.** Derivation must hash a fixed representation: uncompressed (65
  bytes, `0x04` prefix), never mixed. Hashing a compressed key yields a different id.
- **Lowercase UUIDs.** Swift's `UUID.uuidString` is uppercase. Normalise to lowercase at
  the derivation boundary and before signing (§2.3), since the signed message covers the
  UUID string — an uppercase variant produces a different signature over the same
  logical id. `frakContextV2Codec.ts:55` already handles uppercase input correctly
  (`Number.parseInt(x, 16)` accepts it, and `UUID_RE` carries the `/i` flag), so this is
  not a codec bug to chase; normalise anyway, for cross-platform determinism.
- **RFC-4122 bit twiddling.** Version (`0x40` on byte 6) and variant (`0x80` on byte 8)
  must be applied identically, after truncation, on all three platforms.
- **Signature encoding.** WebCrypto produces raw `r‖s` (64 bytes); most other stacks
  default to DER. Pick raw `r‖s`, convert at the boundaries, and test both directions.
- **Low-S normalisation.** Some verifiers reject high-S signatures. Normalise on sign.
- **Message concatenation.** Use the exact layout in §2.3: `uint16be` length prefixes,
  `uint64be` seconds for `ts`, zero-length binding where unused. "Length-prefix every
  field" as a principle is not implementable on its own; three teams would pick three
  widths.

Commit golden fixtures — `{privkey, pubkey_uncompressed, derived id, msg fields,
canonical msg bytes, sig}` — as shared JSON and assert against them in all three test
suites, failing CI on divergence. Round-trip tests alone are insufficient: two
identically-wrong implementations round-trip perfectly.

Both backend and SDK test suites run on vitest (`vitest run`), so these assertions have
an existing home on the web side.

---

## 9. Open questions

1. **Regression tests for both WALLET_CONFLICT paths** — `/merge/execute` via
   `associate()` (`IdentityOrchestrator.ts:83-90`) and `/identity/ensure` via
   `determineAnchorFromMultiple` (`IdentityWeightService.ts:185-189`). Separate code
   paths with separate throw sites; both are guarded, but neither 409 appears in the
   routes' declared response schemas and neither is covered by a test asserting the
   hostile-merge case. Covered by §3.8.
2. **Who owns Phase 5, and by when.** The native SDK deadline forces Phase 0 but not this.
   Needs a named owner and a date derived from the Phase 3 ship date (§7).
3. **Where §3.5 and §2.6's alarms route.** No `PrometheusRule` or Alertmanager config
   exists in `infra/` today, so "alert on it" currently has no destination. Needs a
   channel and a response owner, or it is decoration.
4. **Does the `#p=` fragment survive the full install redirect chain** on both platforms?
   §2.2 assumes it does; some interstitials strip fragments. Verify before Phase 3
   submission — a silent drop here fails closed and kills direct-link attribution.

> The keygen benchmark is not among these — §2.5 downgrades it to informational, since the
> iframe is hidden and never blocks merchant rendering. The Phase 4a coverage threshold is
> also resolved, by §4.6's per-identity latch.

### Settled — do not reopen

This plan is deliberately scoped for speed and minimal diff. The following were
considered and closed; reopening any of them expands scope without changing the security
outcome.

- **Key scoping.** One key per merchant, automatically. The SDK runs in the merchant
  page's own origin, so `localStorage["frak-client-key"]` (`clientId.ts:28`) is already
  origin-isolated. There is no cross-merchant key, no cross-merchant id, and no
  correlation vector — nothing to derive per-merchant and no `SHA-256(pubkey ‖ merchantId)`
  variant needed. A merchant with several registered domains in `allowedDomains` gets one
  id per domain, exactly as it does today; unchanged, not a regression.
- **Wallet-side identity.** Out of scope. The wallet is the authenticated side and the
  source of truth — every signature already requires a WebAuthn user action. It does not
  need, and must not get, a second P-256 identity key. Nothing in this plan touches wallet
  credentials.
- **Legacy ids are claimable-as-target by whoever moves first.** Accepted, see §2.6, where
  the impossibility of a cryptographic fix is proven and is not worth reopening.

  > The accurate claim is "no mitigation closes the race entirely," not "no cheaper
  > mitigation exists." The chosen approach is first-wins, then-detect: the alarm can
  > only fire once a second claim arrives, by which point the first has already
  > committed. A short hold-and-compare delay on the migration commit (§2.6 steps 3–4 are
  > already async and the id flip already waits for the next page load, so a few hours
  > costs the user nothing) would convert contested races from "attacker wins silently,
  > alarm fires too late" into "both claims frozen, human resolves before either takes
  > effect". It does not help against an uncontested attacker, but is worth the small
  > implementation cost given §2.6 already argues such an alert is genuinely actionable
  > at current volumes.
- **Recovery tooling for locked-out users.** Skipped as a self-service feature. The
  realistic victim count today is zero, and shipping fast is the better mitigation than
  building an unmerge path for a population that does not yet exist. If a victim appears,
  repair is a manual DB operation against the `mergedGroups` audit jsonb
  (`IdentityMergeService.ts:335-339`). Write the runbook regardless — §3.8 adds an alert
  for exactly this condition, and an alert with no documented response is half a
  mitigation. One paragraph, not a project.
- **Binding `merge/execute`'s target at `initiate` time.** Skipped. Binding the proof to
  `SHA-256(mergeToken)` (§2.2) already removes the replay risk statelessly; binding the
  token itself would require reshaping the in-app-browser flow to know its target at mint
  time, for marginal gain.
- **Key rotation.** No rotation story, deliberately. Since the id derives from the key,
  rotating is "new anonymous user" plus a §2.6 migration merge — the mechanism already
  exists and needs no separate design. Lost-key handling collapses to the same thing.

  > This does not cover revocation: rotation creates a clean identity, but does not
  > revoke the old one. The old id stays claimable-as-target forever, and the old key
  > keeps working for whoever holds it. Combined with an extractable key in
  > `localStorage` (§2.3), one moment of physical access on a shared or public computer is
  > a permanent compromise with no self-service remedy — a third threat category that
  > §2.3's threat model does not address, neither "remote attacker" nor "XSS". Accepted,
  > since it is no worse than today's raw id, which is equally readable and equally
  > permanent, but it is a known gap rather than a non-issue.
- **`crypto.getRandomValues` unavailable.** Resolved in §2.4: fall back to an unprovable
  random id and treat it as legacy. No measurement needed — `getRandomValues` is not
  secure-context gated, so the `@noble` path covers HTTP merchants, and the residual case
  reuses the legacy arm.
