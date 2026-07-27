# Identity proof-of-possession

Bind every anonymous identity to a device-held P-256 keypair, so that only the device
that owns an anonymous id can act on it.

**Status:** planned, not started. **Blocks:** native SDK work
([`../native-sdk/`](../native-sdk/)).

---

## 1. Why this, why now

### The vulnerability

`POST /user/identity/merge/execute` has **no authentication of any kind**
(`services/backend/src/api/user/identity/merge.ts:53-85`), and `merge/initiate` mints a
merge token for any `sourceAnonymousId` a caller names, with no proof the caller owns it
(`merge.ts:6-51`, `AnonymousMergeOrchestrator.ts:29-70`).

The anonymous id is not secret. **Every share link publishes it in clear.**
`buildSharingLink` embeds `clientId` as field `c` of the FrakContext, which is
base64url-encoded into `?fCtx=` (`buildSharingLink.ts:50-58`). Anyone who receives,
screenshots, or finds a reposted referral link can decode the sharer's `clientId` and
the `merchantId` — both inputs the attack needs. `install-code/resolve` compounds this by
returning `anonymousId` to unauthenticated callers
(`installCode.ts:36-90`).

Attack:

1. `POST /merge/initiate {sourceAnonymousId: <victim's, from their link>, merchantId}`
   — no session → attacker receives a valid `mergeToken` for the victim's group.
2. Attacker attaches their own wallet to their own anonymous id (legitimate flow), so
   their group has `hasWallet = true`.
3. `POST /merge/execute {mergeToken, targetAnonymousId: <attacker's>, merchantId}` — no
   auth. Wallet-priority anchoring (`IdentityWeightService.checkWalletPriority`, called
   from `determineAnchor:150`) selects the attacker's group as anchor, because the
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
  → WALLET_CONFLICT   (IdentityWeightService.ts:184-188)
```

**The victim can never link their wallet for that merchant.** `ensure.ts` has no
`try`/`catch`, so the 409 propagates straight to the caller, and there is **no
WALLET_CONFLICT handling, retry, or dispute-resolution path anywhere in the backend**.
The exception that protects post-install users permanently bricks pre-install victims.
A cheap, remote, unauthenticated denial-of-service against exactly the users we are
trying to onboard — silent until they hit an error nobody can resolve.

> **Traced and confirmed**, not inferred. Note this is a *different* throw site from the
> one on the `/merge/execute` path: `associate()` guards that one at
> `IdentityOrchestrator.ts:88-91`, but `/identity/ensure` never calls `associate()` — it
> goes through `resolveAndAssociate` → `determineAnchorFromMultiple`. Both need
> regression tests; they are separate code paths.

### Why the vulnerable window is structural, not an edge case

The product flow is: share → *then* get prompted to create a wallet → *then* install.
**Every user's first share happens before they install, by design.** The link they
publish carries that pre-install `clientId`, publicly, forever.

Influencers do eventually install — but their *referees*, the whole audience a referral
is meant to convert, are pre-install by definition.

### Why now

**We currently have almost no shares and no active users.** No large creators have
joined. This is the cheapest this change will ever be:

- few published links carry a pre-install `clientId`
- the legacy-id population that cannot be retrofitted is nearly empty
- no influencer has meaningful unsettled rewards to redirect
- no migration pressure, no support burden

Every week of growth makes it more expensive. **This ships before any native SDK work.**

---

## 2. Design

### 2.1 The anonymous id is derived from the keypair

```
keypair  = P-256 (ECDSA, SHA-256)
clientId = uuid_from(SHA-256(pubkey_raw_uncompressed)[0..16])
```

with RFC-4122 version (`0x40`) and variant (`0x80`) bits set on bytes 6 and 8 so the
result is a syntactically valid UUID.

This makes identity **self-authenticating**: given a public key, anyone can recompute the
id and check it matches. No key registry, no registration step, no trust-on-first-use
window for new clients.

**Why derive rather than use the pubkey directly as the id.** The FrakContext v2 codec
allocates exactly 16 bytes for the client id and parses it as a UUID
(`frakContextV2Codec.ts:17` and `uuidToBytes:55`). A P-256 public key is 33 bytes
compressed / 65 uncompressed. Using it directly means a v3 wire format — and since v1/v2
disambiguate **purely on total payload length** (`frakContextV2Codec.ts:26`), that
breaks every published link and every cross-language golden fixture. Deriving keeps the
id at 16 bytes and changes nothing on the wire.

Truncating SHA-256 to 128 bits gives ~2⁶⁴ collision resistance (birthday) and ~2¹²⁸
second-preimage resistance. Second-preimage is the property that matters here — an
attacker would need to find a keypair hashing to a *specific* existing id — so the
truncation is comfortable.

### 2.2 Timestamped signatures, no challenge round-trip

Sensitive operations carry a self-contained signature. No nonce endpoint, no extra
request, stateless verification.

```
msg = "frak-<op>-v1" ‖ merchantId ‖ sourceAnonymousId ‖ targetAnonymousId ‖ ts
sig = ECDSA_P256_SHA256(privKey, msg)

body: { ..., ts, sig, pubkey }
```

Rules:

| Rule | Why |
|---|---|
| **Domain-separate** the message with an op-specific prefix (`frak-merge-v1`, `frak-ensure-v1`) | a merge signature must never be replayable as an ensure signature |
| **Bind every security-relevant param**, not just `ts` | otherwise an observed signature can be reused with a swapped `targetAnonymousId` |
| **±2 minutes**, not ±10 | merge/ensure are interactive and never offline-queued; devices are NTP-synced. Smaller window, smaller replay surface |
| **Cache `SHA-256(sig)` for the window and reject repeats** | a signature is bearer material for its lifetime; this makes it single-use |
| Reject `ts` in the future beyond a small skew allowance | clock-skew abuse |

Verification is fully stateless:

```
1. derive id from pubkey  →  must equal claimed sourceAnonymousId
2. verify sig over the recomposed message
3. check |now - ts| <= 120s
4. check SHA-256(sig) not seen in the replay cache
```

No key storage. No registry. No first-use race.

### 2.3 Storage: extractable key + JWK in `localStorage`

The key is generated `extractable: true` and stored as JWK in `localStorage`, next to
the client id.

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
localStorage["frak-client-id"]  = "<uuid>"          // unchanged key name
localStorage["frak-client-key"] = "<JWK JSON>"      // new
```

### 2.4 Pure-JS fallback is required, not optional

`crypto.subtle` is **absent entirely on non-secure contexts** (plain HTTP), and this
already bites us today: `clientId.ts:13` falls back to `Math.random()` when
`crypto.randomUUID` is missing, and `randomUUID` carries the same secure-context
requirement. So merchants on HTTP already take a degraded path.

**Decision: do not degrade to an unverifiable identity.** A dual-tier system where some
ids are provable and some are not preserves the exact hole we are closing, forever, and
gives attackers an obvious downgrade target. The extra bundle weight is worth it.

Fallback: `@noble/curves` P-256 — well audited, and already present in `apps/wallet`
(though only in **test helpers** today, not shipped runtime code, so treat it as a new
production dependency for `sdk/core`, whose current runtime deps are just
`@frak-labs/frame-connector` and `@openpanel/web`). Import it **lazily and only on
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

Notes:
- `@noble/curves` needs `crypto.getRandomValues` for key generation, which is far more
  widely available than `crypto.subtle`. If *that* is missing too, there is no safe
  path: fail closed and emit a diagnostic rather than inventing entropy from
  `Math.random()`.
- Adds roughly 10–14 KB gzipped to a **lazy** chunk, not the main bundle.

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
- keygen happens **once, ever**, per browser/app install
- run it in `requestIdleCallback` (with `setTimeout` fallback) — never during init,
  never blocking first paint, never blocking a share
- signing only on merge/ensure — **never** on `track/*` or config resolution
- the id itself is available immediately; only *proof* waits on the key

### 2.6 Migration for existing web clients

Existing ids are random UUIDs and cannot satisfy the derivation. On next visit, the SDK
generates a keypair and **binds** it to the existing id (trust-on-first-use).

Be precise about what this does and does not buy:

| | Binding | Race |
|---|---|---|
| **Derived ids** (new) | cryptographic | none — self-authenticating |
| **Bound ids** (legacy) | asserted | **yes** |

For an id **already published in a share link**, TOFU is first-come-first-served: an
attacker who harvested it can bind their own key before the legitimate user returns. The
window is "until that user next visits" — days or weeks.

So: **TOFU closes the window for future abuse; it cannot retroactively secure an
already-published id.** Two cheap hardening measures:

- bind on a request the id is already making (an interaction), not on any bare request
- treat a **second, conflicting bind attempt** for the same id as an alarm, not a silent
  accept or reject — it is the detection signal for active harvesting

This is exactly why §3 must ship regardless.

---

## 3. Backend fixes that ship regardless

Proof-of-possession raises the floor for new clients. It does not retire the existing
surface. These are independent and must land:

| # | Fix | Why |
|---|---|---|
| 3.1 | **Require a session on `merge/execute`** | it currently has no auth macro at all — the single most direct hole |
| 3.2 | Replace `anonymousId` with an opaque ticket in the install-code flow (§3a) | closes the harvesting oracle. **Coordinated backend + wallet change**, not a one-line response edit |
| 3.3 | Per-code attempt limiting on `install-code/resolve`, independent of source IP | 31⁶ keyspace with IP-only limiting is harvestable at botnet scale |
| 3.4 | Alert when a merge would move a group holding **unsettled** `asset_logs` under a different wallet | the high-value case. Monitoring + a candidate for requiring proof on **both** sides of the merge, not just the source |
| 3.5 | Rate limit tracking endpoints keyed by `(merchantId, clientId)`, not IP alone | CGNAT makes IP-only limiting both too harsh and too weak |
| 3.6 | Remove the raw-hex-address bypass in `sdkIdentity.ts:39-48` | any address string is currently accepted as proof of wallet identity |

None of these change *when* the payout wallet is resolved. Settlement-time resolution is
correct and deliberate (see §1); the fix is to make group membership unforgeable.

3.1 is the most direct, but it is not sufficient on its own — `merge/initiate` still
names an arbitrary `sourceAnonymousId`, which is what §2 closes.

---

## 3a. The install-code flow — why `anonymousId` is returned, and how to replace it

### Why it exists today

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
there is no session to scope the identity to server-side at that moment. The id has to
be carried across the unauthenticated → authenticated boundary, and it must survive app
download plus onboarding — `DEFAULT_ENSURE_TTL_MS` is **one week**
(`pendingActionsStore.ts:9`; the doc comment above it saying 24h is stale).

It is also used for the dedupe key, and the response's `merchant` / `hasWallet` fields
drive the confirmation card and branching.

### Where the signature goes — `generate`, not `resolve`

The natural assumption is that the wallet signs at `resolve`. **It cannot: the private
key is on the sharer's device, and the wallet is a different app** — frequently a
different device entirely (share on desktop, install on phone).

Note also that `/install?m=&a=` is a **web page** today — both `InstallProcessing`
(`install.tsx:95`) and `InstallCodeView` (`install.tsx:174`) read `{m, a}` straight from
the URL, and the latter calls `generate` with that `anonymousId`. Anyone can edit those
params. So proof must be established when the code is minted:

```
generate  ← signature proves ownership   (sharer's device holds the key)
resolve   ← no signature needed          (possession of the code implies a verified generate)
```

### The flow

```
1. SDK / install page signs:
      msg = "frak-install-v1" ‖ merchantId ‖ anonymousId ‖ ts
   POST /install-code/generate { merchantId, anonymousId, pubkey, ts, sig }
   → backend verifies: derived id == anonymousId, sig valid, |now-ts| <= window
   → code is bound to a VERIFIED identity

2. Wallet: POST /install-code/resolve { code }        ← no signature
   → { ticket, merchantId, merchant, hasWallet }     ← no anonymousId

3. Wallet: pendingActionsStore.addAction({type:"ensure", merchantId, ticket, merchant})
   → post-auth drain → POST /identity/ensure { merchantId, ticket }
   → backend resolves ticket → anonymousId, burns it, links
```

The Android arm is the same substitution: the install page puts the **ticket** in the
Play referrer string instead of the raw `anonymousId` (`install.tsx:230`).

### Ticket design

A **signed JWT** — no new table, stateless verification:

```jsonc
{ "sub": "<anonymousId>", "mid": "<merchantId>", "jti": "<uuid>",
  "iat": …, "exp": …, "aud": "install-ticket" }
```

Requirements:

| Rule | Why |
|---|---|
| **TTL ≥ pending-action TTL (one week)** | a shorter ticket means the wallet drains a dead one. Tie both to a single shared constant |
| **Single-use** | a stateless JWT cannot enforce this alone — needs a small burn-set on `jti` (Redis/KV, still no schema change) |
| Audience-scoped (`aud`) | must not be replayable as any other token type |
| Dedupe key becomes `ensure:${merchantId}:${ticket}` | tickets are per-resolve, not per-identity, so add a server-side idempotency guard on burn — `ensure` is already idempotent |

### What this actually buys

An attacker brute-forcing install codes no longer harvests a durable `anonymousId`
usable against `merge/initiate`. They get a ticket that is single-use, expiring, and
only usable to link to **their own authenticated wallet** — a merge they could already
attempt directly. The oracle closes without changing a single user-visible step.

---

## 4. Phasing

Ordered so each step is independently shippable and useful.

### Phase 1 — backend hardening (no client changes)
§3.1, §3.3, §3.4, §3.5, §3.6. Protects the existing installed base immediately. **No SDK
release, no version skew, no waiting on anyone.**

§3.2 (the install ticket) is deliberately **not** here — it needs a coordinated wallet
release, so it lands in Phase 3.

### Phase 2 — web SDK key material
- P-256 keygen + JWK persistence, atomic with the client id
- derived ids for new clients; TOFU bind for existing ones
- `@noble/curves` lazy fallback
- signature attached to merge/ensure calls, **accepted but not enforced** server-side
- telemetry: how many clients are derived vs bound vs failed

### Phase 3 — backend verification + install ticket
- verify signature, derivation, timestamp window, replay cache
- enforce for derived ids; accept bound ids with the signature as a secondary signal
- alarm on conflicting bind attempts
- **§3.2 install ticket**: `generate` accepts and verifies a signature; `resolve` returns
  a ticket instead of `anonymousId`; `ensure` accepts `{merchantId, ticket}`. Ships
  **with** the wallet change that stores and drains the ticket — keep the `anonymousId`
  arm on `ensure` until the old wallet build has aged out

### Phase 4 — enforcement
Once telemetry shows coverage is high enough, require proof on merge/ensure for all ids
that have a bound key.

### Phase 5 — native SDK
Ships derivation and signing from day one — there are no legacy native ids, so native is
cryptographic-only, no TOFU path. Retrofitting a released binary is impossible, so this
must be in v0.1 even if enforcement lands later. See
[`../native-sdk/02-native-sdk-overview.md`](../native-sdk/02-native-sdk-overview.md) §4.

---

## 5. Cross-platform contract

One derivation, one message format, three implementations. This is exactly the class of
thing that drifts silently, so it needs golden fixtures like the FrakContext codec.

| | Web | Android | iOS |
|---|---|---|---|
| Keygen | WebCrypto → `@noble/curves` | `KeyPairGenerator("EC")` | CryptoKit `P256.Signing` |
| Storage | `localStorage` (JWK) | `SharedPreferences` / Keystore | `UserDefaults` |
| Hash | `crypto.subtle.digest` | `MessageDigest` | `SHA256` |

Traps, all of which produce silent verification failure:

- **Signature encoding.** WebCrypto produces raw `r‖s` (64 bytes); most other stacks
  default to DER. Pick **raw `r‖s`**, convert at the boundaries, and test both directions.
- **Low-S normalisation.** Some verifiers reject high-S signatures. Normalise on sign.
- **Public key format.** Derivation must hash a fixed representation — specify
  **uncompressed (65 bytes, `0x04` prefix)** and never mix.
- **Lowercase UUIDs.** Swift's `UUID.uuidString` is uppercase; the FrakContext codec
  parses hex naively and produces wrong bytes for uppercase input.
- **Message concatenation.** Use explicit length-prefixing or fixed-width fields — naive
  string concatenation is ambiguous and forgeable.

Commit golden fixtures — `{privkey, pubkey, derived id, msg, sig}` — as shared JSON and
assert against them in all three test suites. Round-trip tests alone are insufficient:
two identically-wrong implementations round-trip perfectly.

---

## 6. Open questions

1. **Regression tests for both WALLET_CONFLICT paths** — `/merge/execute` via
   `associate()` and `/identity/ensure` via `determineAnchorFromMultiple`. Separate code
   paths, both currently unguarded against hostile merges.
2. **Recovery for already-locked-out users.** If any victim exists by the time this
   ships, there is no unmerge path and no admin tooling. Probably needs a manual
   split-group operation.
3. **Wallet-side identity.** The wallet app has a WebAuthn credential already — should
   it sign with that rather than a separate P-256 key, or keep the two paths separate?
   Note WebAuthn assertions are DER-encoded (`apps/wallet/tests/helpers/webauthn/signature.ts`
   uses `format: "der"`) while this design specifies raw `r‖s` — do not mix them.
4. **Key rotation.** No rotation story today. Since the id derives from the key, rotating
   changes the identity — probably acceptable (it equals "new anonymous user"), but it
   should be a deliberate decision.
5. **`crypto.getRandomValues` unavailable.** Currently specified as fail-closed. Confirm
   how common this is in practice before shipping a hard failure.
