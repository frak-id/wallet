# Identity proof-of-possession

Bind every anonymous identity to a device-held P-256 keypair, so only the device that owns
an anonymous id can act on it.

**Status:** shipped and permissive. The remaining work is making the wallet arms mandatory
once the store binary is live — see [`ROLLOUT.md`](./ROLLOUT.md).

**Blocks:** native SDK work ([`../native-sdk/`](../native-sdk/)).

---

## 1. Why

`anonymousId` (the `clientId`) is **not secret**. Every share link publishes it: it rides
as field `c` of the FrakContext, base64url-encoded into `?fCtx=`. Two unauthenticated
endpoints also hand it out directly (`install-code/resolve`, `order-client`).

Yet the merge machinery treated naming an id as proof of owning it, on routes with no
session auth. One request was enough:

```http
POST /user/track/interaction
x-frak-client-id: <victim's clientId, decoded from any share link>
x-wallet-sdk-auth: <attacker's own wallet JWT — legitimately obtained>
{ "type": "arrival", "merchantId": "…" }
```

Nodes resolve to `[wallet=attacker, anonymous_fingerprint=victim]` → two groups → wallet
priority anchors on the attacker (a pre-install victim has no wallet) → the victim's group
is merged away.

Rewards attach to an **identity group**, not a wallet, and the wallet is resolved at
settlement, with lockups up to 150 days. So rewards the victim already earned but that had
not settled paid out to the attacker. `/merge/initiate` + `/merge/execute` reached the same
place with equally little authentication.

The fix has to work for a user who lands on a merchant site and shares immediately, before
any wallet exists — that pre-install sharer is exactly who was exposed.

## 2. How

### The id is derived from the keypair

```
keypair  = P-256 (ECDSA, SHA-256)
clientId = uuid_from(SHA-256(pubkey_raw_uncompressed)[0..16])
```

RFC-4122 version and variant bits are set on bytes 6 and 8, so the result is a valid UUID
and the FrakContext v2 codec's 16-byte field is unchanged — no new wire format, no broken
published links.

Identity is therefore self-authenticating: recompute the id from the public key and check
it matches. No key table, no bind endpoint, no trust-on-first-use race. Verification is
stateless.

A registry mapping `anonymousId → pubkey` was considered and rejected: the bind would have
to happen on the first proof-carrying call, but those all fire late, so a brand-new user's
id is published in a share link before anything binds it — claimable by whoever harvests
the link first. Derivation has no such window; the id *is* the proof from the instant it
exists.

Truncating to 128 bits is fine here. What matters is second-preimage resistance — hitting
a *specific* existing id — at a work factor of ~2¹²² after the 6 constant bits.

### Where the key lives

`sdk/core`, on the **merchant origin**, next to the id it derives — the id is born, used
and published there. `localStorage` is origin-scoped, so the key is inherently
per-merchant: one merchant, one keypair, one id, no cross-merchant correlation to engineer
around.

The listener's `clientIdStore` is a **cache**, overwritten from the SDK-supplied
`?clientId=` param on every load. It is never a second identity.

### Timestamped signatures, no round-trip

```
msg  = "frak-<op>-v1" ‖ merchantId ‖ anonymousId ‖ <op binding> ‖ ts
sig  = ECDSA_P256_SHA256(privKey, msg)
wire = base64url({ v: 1, pk, ts, sig })
```

Verify: derive the id from `pk` and check it matches the claim, verify `sig` over the
recomposed message, check `ts` against the op's window.

Every field is fixed width with no length prefixes, so the layout is unambiguous by
construction and a native port is byte copies at constant offsets rather than a parser.
Ops are domain-separated so a merge proof can never be replayed as an ensure proof, and
every security-relevant parameter is bound, not just `ts`.

The frozen layout lives in `sdk/core/src/identity/canonical.ts`, with golden fixtures under
`sdk/core/src/identity/fixtures/` that the backend verifier tests against — that is the
contract for any future native implementation.

### Validity windows are per-op

| Op | Window | Why |
|---|---|---|
| `frak-merge-v1` | ±2 min, binds `SHA-256(mergeToken)` | Asserts ownership of a free-form body param on an unauthenticated route, so a leak is direct theft. Binding the token makes a stolen proof useless without it, and removes the need for a replay cache. The flow is machine-speed. |
| `frak-ensure-v1` | 90 days | Share → install → forget → reopen next week → register. A tight cap would silently drop attribution for exactly the users this protects. |
| `frak-install-v1` | 30 days | Travels in a URL fragment and the Play referrer, so it is minted on the sharer's device and consumed days later on another one. Capped rather than uncapped because it is the leakiest proof in the system. |

### Two signing backends

WebCrypto when usable, `@noble/curves` pure JS otherwise, both over the same raw 32-byte
secret. The pure-JS path is required, not a nicety: WebCrypto is unavailable in
non-secure contexts. Both agree byte-for-byte on the message.

Key and id are stored together and the **key is authoritative**: a missing or mismatched
id is rewritten from the key, and an unusable key regenerates both. An id that outlives
its key would be latched and unusable.

### The `proof_seen_at` latch

A derived id and a legacy id are both just UUIDs, so the backend cannot tell them apart by
inspection. "Require a proof" would have to be a global flag day, and until it flipped
every new derived id stayed as claimable as a legacy one.

One nullable timestamp on `identity_nodes` fixes it. Set it the first time a node presents
a valid proof; once latched, that id requires a proof in either merge role, forever.

It is a one-bit ratchet that only increases strictness, set from a self-authenticating
proof: an attacker cannot set it without the key and cannot clear it at all. Enforcement
becomes continuous and per-identity instead of a flag day, and legacy ids keep working
with no special-casing — they simply never latch.

**The latch is only ever written after a proof actually verified.** Latching an id that was
merely allowed through on the fail-open path would lock it out permanently the moment it
tried to sign, and the latch never clears. Every call site has a regression test for this.

### Legacy ids stay broken, deliberately

Ids minted before derivation have no key and can never sign. They are baked into published
`fCtx` links, so they stay resolvable indefinitely and remain usable as merge *targets*.
There is no fix beyond shipping derivation early so the population stops growing; a
client's next visit migrates it, folding the old id into the derived one.

## 3. What shipped

- **Derivation + signing** in `sdk/core/src/identity/` — `canonical.ts` (frozen layout),
  `sign.ts` (key lifecycle, both backends), `derive.ts`, golden fixtures.
- **Verification** in `services/backend/src/domain/identity/services/IdentityProofService.ts`,
  with the shared latch policy in `orchestration/identity/latchedProof.ts` — one function
  for all three merge/ensure arms rather than three hand-written checks.
- **Proof transport with no new RPC methods.** The SDK pushes proofs as additive parameters
  on calls it already makes; the listener forwards them without interpreting them. The
  install proof travels as a `#p=` URL fragment (never a search param — fragments are not
  sent to servers, keeping it out of access logs and `Referer` headers) and as a Play
  referrer key.
- **Closed merge surfaces.** The unauthenticated pairing `originNode` merge was deleted
  outright; webhook purchase attribution became first-writer-wins; the SSO merge was kept
  but proof-gated with a new `frak-sso-v1` op, since it carries a real capability —
  linking a referee's anonymous reward history to the wallet they create via SSO.
- **`track/*` rate limiting** — previously none at all, on the route that made the
  one-request attack possible.
- **Install flow** — 6-char codes with an attempt cap enforced atomically, exchanged for a
  short-lived install ticket.
- **Migration** for pre-derivation clients, running on each client's next visit.

Schema: `identity_nodes.proof_seen_at`, `install_codes.attempts`
(`drizzle/local/0035`, `drizzle/dev/0040`). `device_pairing.origin_node` dropped
(`local/0036`, folded into `dev/0040`). **`prod` still needs its generated migration.**

## 4. What remains

Making the wallet arms mandatory, gated on the store binary being live and `minVersion`
excluding older builds. See [`ROLLOUT.md`](./ROLLOUT.md).
