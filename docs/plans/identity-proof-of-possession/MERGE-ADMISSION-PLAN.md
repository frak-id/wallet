# Merge admission — the plan

**Invariant:** an anonymous identity may only be admitted into a merge by a caller that can
demonstrate possession of that identity's key, or by a credential the backend derives itself from
state the caller cannot write. Naming an id is never sufficient, on any route, for any id.

**Companion:** [`MERGE-SURFACE-MAP.md`](./MERGE-SURFACE-MAP.md) is the reference — where identities
get merged (`M1`–`M20`), what attests each side, the gap list (`G1`–`G28`) and the two correctness
defects (`B1`, `B2`). It describes the surface. This document decides the shape and schedules the
work.

**Naming, so nothing is ambiguous.** `ROLLOUT-STEP-3` is the marker set in the tree and the step in
[`ROLLOUT.md`](./ROLLOUT.md); it is the only thing either document calls a "step". Work items keep
their `T1.x` / `T2.x` / `T3.x` ids and are grouped into four **buckets** (§6). Migrations are
`DB1`–`DB6`. Gaps (`G-*`), defects (`B-*`) and audit findings (`AID-*`) keep their ids and are owned
by the map.

Backend paths are relative to `services/backend/src/`. Everything else is repo-relative. Line
numbers were read at `1c02c67d3` (`audit/shipped-scopes-review`); symbols are the durable anchor.

---

## 1. The defect and the decision

### The defect

**The latch is trust-until-proven.** `identity_nodes.proof_seen_at` is set the first time a node
presents a valid proof, and only then. Until that moment the node is admitted without one. So the
latch is empty for exactly one population — identities that have never signed — and that population
is, by construction, the pre-install sharer and the pre-install buyer: the users with unclaimed value
and no wallet yet. The control is absent precisely where the value is.

`orchestration/identity/latchedProof.ts`, proof-absent branch:

```ts
const node = await identityRepository.findNodeByIdentity({
    type: "anonymous_fingerprint", value: anonymousId, merchantId,
});
if (node?.proofSeenAt) {
    throw HttpError.forbidden("PROOF_REQUIRED", "…");
}
// Unlatched — legacy id, or a derived id that has never proven itself
// yet. Fail-open, matching today's pre-proof behaviour.
return false;
```

That `return false` is an **allow**. Every route that accepts a caller-named `anonymousId` inherits
it, because they all route through this one function or through nothing at all.

**The worked example.** `AnonymousMergeOrchestrator.executeMerge` requires a proof to *create* a
target node and not to *claim* an existing one (`:231-241`):

```ts
const targetGroupId = proofPresented
    ? (await this.identityOrchestrator.resolve({ … })).groupId
    : (await this.identityRepository.findGroupByIdentity({ … }))?.id;
if (!targetGroupId) {
    throw HttpError.notFound(
        "TARGET_NOT_FOUND",
        "targetAnonymousId does not exist; a proof is required to create it"
    );
}
```

The proven arm gets get-or-create; the proofless arm gets lookup, and if the lookup succeeds the
merge proceeds. An id that does not exist is protected. An id that exists — that has been used, that
has accrued attribution, that has unsettled rewards attached — is not. The chain is two
unauthenticated calls: `POST /user/identity/merge/initiate` with a valid proof over the *attacker's
own* derived id, then `POST /user/identity/merge/execute` naming the victim as `targetAnonymousId`
with **no `proof` field**. It is byte-identical to `sdk/core/src/actions/migrateLegacyIdentity.ts:82-96`,
which posts `{mergeToken, targetAnonymousId, merchantId}` because no proof can exist for a legacy id,
so the backend has no signal that separates the attack from the legitimate migration.

**Why it is money.** Rewards attach to an identity group, never to a wallet, and the payout address
is resolved at settlement (`SettlementOrchestrator.enrichWithWalletAndInteraction` →
`IdentityRepository.getWalletForGroup`). Lockups run to 150 days, so the window between "value
accrued" and "wallet resolved" is months, and the whole capture surface sits inside it. The only
bound, `IdentityWeightService.checkWalletPriority`, throws `WALLET_CONFLICT` only when **two** groups
carry wallets — so capture succeeds exactly against wallet-less groups, the same population the latch
is empty for. The control and the bound fail on the same set.

**One bug, not eight.** Eleven routes accept a caller-named anonymous id and eight of them cause a
write, spanning three API groups, two credential families and two transports. The identity is a
caller-supplied string, reproduced eight times.

### The decision

**Proof becomes mandatory on the admission routes, and the id in the body becomes untrusted input
that must match the proof.**

The second half is already implemented and already enforced.
`domain/identity/services/IdentityProofService.ts:144-146`:

```ts
const derivedId = await deriveIdFromKey(envelope.pk);
if (derivedId !== params.anonymousId.toLowerCase()) {
    return { valid: false, reason: "id_mismatch" };
}
```

The id is derived from the proof's embedded public key and compared to the supplied `anonymousId`
before the signature is even checked. So requiring the proof buys **exactly what removing the body
field would buy** — and the field therefore stays. Removing it would be a breaking wire change for
the published native SDKs at `1.0.0-beta.2` and for any merchant-pinned web build, for no additional
security. **No route in this programme drops a request field.**

The consequence is the whole reason this is affordable: on `/merge/execute`, `/merge/initiate`'s
anon-source arm and `/identity/ensure`'s SDK arm the change is **only** `t.Optional(t.String())` →
`t.String()` on `proof`, and letting the existing verification do the binding. No wire change, no id
re-plumbing, no new derivation helper. The one place a server-side derivation is genuinely needed is
the Shopify `checkoutToken` arm of `install-code/generate`, where the id comes from the order rather
than from a proof (§3).

Once a proof is always present, "the caller named a foreign id" is not a case that can be expressed
on the wire. There is nothing left for the latch to decide, no fail-open branch to reason about, and
the case-normalisation hazard on the latch read (`G8`) stops being a silent defeat of enforcement —
because `IdentityProofService.ts:145` lowercases both sides and the caller must hold the key. It also
deletes the `proofPresented ? resolve : findGroupByIdentity` ternary and `TARGET_NOT_FOUND`: with a
proof always present the target is always get-or-create.

**The latch itself is retained this round.** `proof_seen_at` keeps working exactly as it does today.
Retiring it is a later round with a stated precondition (§4, DB6).

### Why not the alternatives

| | (a) Per-gate provenance | **(b) Mandatory proof** | (c) Inverted wallet→merchant consent | (d) Reversed-payload code |
|---|---|---|---|---|
| **Closes** | `install-code/generate` and the ticket downstream of it | the whole caller-named class wherever a key is reachable | the same set as (b), by the same mechanism | the code-carried journeys only |
| **Leaves open** | `/merge/*`, both `ensure` arms, `/track/*`, the webhooks | `ensure`'s bare wallet variant (deletion), `/track/*`, the webhooks, keyless surfaces | everything (b) leaves open, **plus** every journey with no wallet session at hand-off | everything (c) does, and it cannot be minted where it is needed |
| **UX cost** | none | none on screen; a bounded, measurable attribution write-off | **high** — a required return hop on an acquisition funnel | medium-high — moves the paste target to a merchant page |
| **Impl cost** | high: columns, indexes, union lookup, node materialisation, deferral, ticket claim | medium: prerequisites, one schema flip repeated 3×, one union body, telemetry, observation window | all of (b) **plus** a consent-capability table, a return-link builder, a merchant landing contract, a new wallet surface | high: the current `install_codes` shape contradicts a capability token in four ways |
| **Machinery it eventually deletes** | almost none | the latch, `enforceLatchedProof`, `verifyProofUnenforced`, `markProofSeen`, `proof_seen_at`, the `ROLLOUT-STEP-3` marker set, the `proofPresented ? …` ternary — **in a later round, not this one** | nothing (b) does not already delete; **adds** a surface | deletes the `(merchant_id, anonymous_id)` reuse key; adds everything else |

**(a) is mis-sized, not wrong.** Recording where a credential came from is a workaround for the
latch's fail-open, and it disappears if the fail-open does; a `generate` that requires a proof *is*
the provenance record. Its **Gate 2** — the order-derived credential — is the exception: it is the
only design anywhere for surfaces that structurally cannot sign, and it survives whole (§3).

**(c) is (b) plus a hop.** The control that stops the theft is the merchant-origin signature over the
SDK's own id, which is (b) verbatim; the wallet-issued consent token is a *source* binding that
`/merge/initiate`'s wallet-session arm already provides, authenticated by session. What (c) adds is
coverage of the journey where the key-holding browsing context is not reachable while the wallet
session exists — and it buys that with a required post-registration return hop to a shop the user has
just left. It also **cannot be minted where the install journey needs it**: `InstallCodeView` renders
only when `shouldShowCodeView = !IS_TAURI && !getSafeSession()?.token`
(`apps/wallet/app/module/install/component/InstallView.tsx:85`) — the minting user is logged out by
definition. So it covers fewer journeys than (b) and costs a conversion hop on an acquisition funnel.
It is kept as an **optional post-install recovery affordance** (T3.10), never on a critical path; its
implementation is ~90% present already (`mergeTokenQueryOptions`'s wallet arm mints the token,
`ExplorerDetail/index.tsx:116` builds `?fmt=` on a merchant URL, the listener's
`lifecycleHandler#resolveMergeTarget` redeems it).

**(d) is rejected outright.** It inherits (c)'s logged-out minting blocker in full and adds three
problems of its own: it moves the paste target from `wallet.frak.id` to a merchant origin, which is a
phishing-shaped habit the system does not have today; the current storage shape contradicts a
capability token four ways (`MAX_RESOLVE_ATTEMPTS = 20`, `CODE_TTL_HOURS = 72`, reuse keyed on
`(merchant_id, anonymous_id)`, a 7-day ticket documented "Not single-use"); and at 31⁶ ≈ 887M
keyspace with `resolve` unauthenticated at 10/min per IP it is a lottery ticket at scale. Every
journey it would serve already has a machine-readable carrier: `fmt` in a URL, the Play install
referrer, a package-pinned deep link, SSO `pf`.

---

## 2. What changes per route

**Three of these four routes change by exactly one schema field.** `proof` goes from
`t.Optional(t.String())` to `t.String()`. The body keeps `targetAnonymousId` / `sourceAnonymousId` /
`x-frak-client-id`; those become untrusted input that `IdentityProofService.check` must reconcile
against the proof's derived id, which it already does (`:144-146`, `id_mismatch`). Nothing is
re-plumbed and no published client's request shape becomes invalid.

| Route | Accepts today | Accepts after | Wire change? |
|---|---|---|---|
| `POST /user/identity/merge/execute` (`api/user/identity/merge.ts:63`) | `{mergeToken, targetAnonymousId, merchantId, proof?}` — proof verified when present, bound to `SHA-256(mergeToken)`; absent ⇒ latch-gated fail-open | the same body, `proof` **required**. `targetAnonymousId` stays and must match the proof's derived id | **No.** One field, optional → required. Callers that already send a proof are unaffected |
| `POST /user/identity/merge/initiate`, anon-source arm (`merge.ts:9`) | `{sourceAnonymousId?, merchantId, proof?}` — same latch-gated fail-open, empty binding | the same body, `proof` **required** whenever `sourceAnonymousId` is present. The wallet-session arm is untouched — the session *is* the attestation | **No.** One field, optional → required |
| `POST /user/identity/ensure`, SDK arm (`ensure.ts#resolveSdkEnsureAnonymousId:132`) | `x-frak-client-id` header + `proof?` (`frak-ensure-v1`, empty binding, 30-day window), latch-gated | the same shape, `proof` **required** | **No.** One field, optional → required |
| `POST /user/identity/install-code/generate` (`installCode.ts:10`) | `{merchantId, anonymousId, proof?}` — `verifyProofUnenforced` only, never required, no latch read | a **union**: `{merchantId, anonymousId, proof}` with `proof` required, **or** `{merchantId, checkoutToken}` with the id resolved from the order and a body `anonymousId` rejected 400, not ignored | **Yes** — and it is the only one. The token arm is the single place in the programme that derives an id server-side (§3) |

**Not one of the four, and it changes differently: `/identity/ensure`'s wallet arm.** That arm has
three shapes today and they are not equivalent. The ticket branch (`ensure.ts:46-76`) is a receipt
for a credential presented at `generate` and stays. The `frak-install-v1` branch (`:105-120`) verifies
a real proof and latches it — it is the landing site for Keystore- and Secure-Enclave-signed native
installs (`M20`) and for the Play install referrer, both of which reach `ensure` directly and never
touch `install-code/generate`; that branch is **kept and made mandatory**. Only the proofless bare-id
variant (`:78-88`) and the `x-frak-client-id` fallback (`:213-225`) are deleted. This is `T3.2`, it
is the one shape in the programme that breaks a deployed client on purpose, and its blocker is **not**
the store binary — see §7.

---

## 3. Gate 2: Shopify without a signature

The Shopify post-purchase and order-status surfaces hold an id and no key: they are a **UI
extension** (`purchase.thank-you.block.render`, `customer-account.order-status.block.render`), not a
classic `Checkout::PostPurchase::Render`, so there is no Shopify-signed input payload of any kind and
a merchant-origin signature is structurally impossible inside the sandbox. Gate 2 is the only design
for that population, and the population is permanent and self-renewing.

**This is the one bucket that can land immediately.** It depends on no flip, no SDK propagation and
no store binary.

### Attestation choice

Of the attestations available on that surface only two are verifiable by the Frak backend:

- **Shopify session token JWT** (`api.sessionToken.get()`, HS256, 5-minute TTL). The verifier already
  exists and is deployed: `infrastructure/external/shopifyJwt.ts#verifyShopifySessionToken`, jose
  HS256 against `SHOPIFY_API_SECRET`, `aud` against `SHOPIFY_CLIENT_ID`, `iss`/`dest` hostname
  equality. It proves shop + app; it binds to no buyer and no order.
- **`checkoutToken`**, verifiable only transitively, by resolving it to a purchase row.

**Both, in that order, with the session token as a second phase.**

**Phase A — `checkoutToken` only.** It already reaches `/sharing`
(`apps/shopify/extensions/checkout-post-purchase/src/PostPurchaseCard.tsx:78-79` sets it as a search
param; `SHARING_PARAMS` carries it as `transport: "query"` at
`apps/wallet/app/module/sharing/params/table.ts:63`), so Phase A needs **zero change to any shipped
Shopify extension**.

**Phase B — add the session token.** `extensions/checkout-post-purchase/shopify.extension.toml`
declares `api_access = true` only; `network_access` is a separate capability the post-purchase
extension does not have (the web pixel does). So the extension today cannot make a single outbound
HTTP call — it renders an `<s-button href=… target="_blank">`. Phase B therefore needs
`network_access = true` and a Shopify review cycle, which is exactly the dependency Phase A must not
inherit. Phase B also lets `merchantId` be derived from the verified token's `dest` instead of trusted
from the `frak.merchant_id` shop metafield, which is a client-side read a direct POST can forge.

The fallback if `network_access` is refused is a broker: a new `authenticate.public` route in
`apps/shopify` verifying the session token, then `unauthenticated.admin(shop)` (already exported at
`app/shopify.server.ts:36`, offline tokens persisted, `read_orders` already in scope) reading
`order.customAttributes._frak-client-id` directly. Genuinely webhook-independent, at the cost of a
public route and CORS in an app that has neither. Do not build it speculatively.

**What Gate 2 must not do:** keep passing `checkoutToken` into `/sharing` and mint from whatever
`useSharingIdentity` resolves. `useSharingIdentity.ts:29-31` prefers `paramClientId`, and that param
originates in the `_frak-client-id` cart attribute, which the theme listener writes from
`localStorage` via `cart/update.js` — buyer-writable. Laundering a caller-supplied id through one more
hop is not derivation.

### Webhook-timing analysis

The Shopify `ORDERS_UPDATED` webhook and the pixel's `/user/track/purchase` call race in an unknown
order, and the system deliberately lets whichever arrives last do final validation. Arbitration is in
SQL: `coalesce(identity_group_id, $new)` in `PurchaseRepository.upsertWithItems` and a
compare-and-swap in `updateIdentityGroup`. Gate 2 must not add a dependency that breaks when the
webhook is late — which is exactly what `orderClient.ts`'s current lookup does: it requires a
`purchases` row (webhook-only writer) with a non-null `identity_group_id`, plus an `identity_nodes`
row for `(groupId, 'anonymous_fingerprint', merchantId)`.

| State | `purchases` row | `identity_group_id` | anon node in group | `orderClient` today | Gate 2 |
|---|---|---|---|---|---|
| S1 webhook arrived with `_frak-client-id` note attribute | yes | set | created by `upsertWithCartAttributeIdentity` | 200 | resolved |
| S2 pixel claimed with clientId, webhook then arrived | yes | set | yes | 200 | resolved |
| S3/S4 pixel claimed with a wallet JWT (± clientId), webhook arrived | yes | set | **often no** — this is **B1**: `resolveForAttribution` anchors on the wallet node and resolves only it, so the anonymous node is never created (`IdentityOrchestrator.ts:176-186`, regression-tested at `IdentityOrchestrator.test.ts:86-93`) | 404 | resolved, by materialising the node |
| S5 pixel first, webhook not yet arrived | **no** | — | — | 404 | resolved from `purchase_claims`, **degraded and counted** |
| S6 webhook first, no claim, no cart attribute | yes | **NULL** | — | 404 | deferred |
| S7 webhook failed permanently (HMAC mismatch, subscription removed) | no | — | — | 404 forever | deferred, then unattributed |
| S8 pixel never fires (ad-blocker/JS off) and no cart attribute | yes (S6) | NULL forever | — | 404 forever | deferred, then unattributed |
| S9 token mismatch/absent (`purchase_token` is nullable, the lookup is an equality match) | maybe | — | — | 404 | deferred, then unattributed |
| S10 merchant has no `merchant_webhooks` row | — | — | — | 404 | rejected at generate |

Two structural notes. S3/S4 is not a race — waiting longer never fixes it, which is why it is a bug
(B1) and not a timing case. And the current `order-client` fallback is anti-correlated with the state
that works: `useSharingIdentity` only queries it when `!immediateClientId`, and `immediateClientId`
comes from the same `_frak-client-id` cart attribute that produces S1. The fallback fires precisely
where its best case cannot occur.

### Degradation ladder

Applied in order at `generate`. Constraint: a failed or delayed webhook must never fail install-code
generation for a legitimate buyer.

1. **Prefer a webhook-RESOLVED purchase.** `purchases` on `(webhook_id, purchase_token)` with a
   non-null `identity_group_id`. **This arm is tried first and wins outright when it hits.** A
   resolved purchase proves the order exists: the row is written only by the HMAC-verified
   server-to-server webhook path. Covers S1 and S2.
2. **Degrade to a pending `purchase_claims` row** on `(merchant_id, purchase_token)`, with a
   `log.warn` carrying `{merchantId, purchaseToken, claimAge}` **and a dedicated counter**
   `install_credential_claim_arm{merchant}`. Covers S5, the pixel-before-webhook case the union
   exists to serve. A claim row is written by the unauthenticated `/user/track/purchase`
   (`PurchaseLinkingOrchestrator.ts:118-131`, no existence check on `(orderId, token)`) and is
   therefore **forgeable** — G20. Resolved-first is what shrinks the attacker's usable window from
   "any time" to "the gap before the webhook lands". `PurchaseClaimRepository` has no
   `(merchantId, purchaseToken)` finder today — its only finder requires `orderId`, which `/sharing`
   does not carry — so one must be added, with an index. Shopify tokens pass
   `normalizePurchaseToken` untouched (the `wc_order_` suffix rule is WooCommerce-only), so the key
   matches on both sides.
   *Intent, recorded now so it is not re-litigated:* **close this arm** once the counter shows no
   legitimate traffic uses it. The ordering above is explicit and tested, never incidental: the
   webhook deletes the claim on reconcile (`PurchaseWebhookOrchestrator.ts:126`), so "exactly one of
   the two exists" holds in steady state — but nothing enforces it, and an attacker's row is exactly
   the case where it does not.
3. **Materialise the merchant-scoped anonymous node** when the resolved group has none (S3/S4 — B1).
   `IdentityRepository.addNode` with a **server-minted** id for
   `(group, 'anonymous_fingerprint', merchantId)`, minted only when the lookup returns none, in the
   same unit of work. The id is never caller-supplied and never published before it exists, so there
   is no window in which it is claimable. Done *in Gate 2* rather than by changing
   `resolveForAttribution`: that would write a caller-named unauthenticated node on every `track/*`
   request (a G17 regression) and breaks the write-discipline invariant at
   `IdentityOrchestrator.test.ts:86-93` — see OQ7 and T1.12.
4. **Defer resolution to `resolve` time** (S6–S9). Mint the code with `anonymous_id = NULL` and
   `checkout_token` set. The user gets a code; nothing fails. The code lives 72h against a webhook
   whose normal latency is seconds, and realistic time-to-redeem is a store download plus an app open,
   so this converts S6 from "always lost" to "essentially always won". It does nothing for S7/S8/S9,
   which are state failures and not timing failures — do not claim otherwise.
5. **Unattributed.** If `resolve` still cannot resolve the token it returns a terminal `UNRESOLVED`
   outcome. The app proceeds as a fresh identity: new wallet, no pre-install attribution. It must
   **never** fall back to a caller-named `anonymousId`, which would recreate the hole one hop later.

**What resolved-first does and does not close.** It closes the *real-order* class completely: once
the webhook has landed, a stale or forged claim on the same `(merchantId, token)` can never override
it. It does **not** close the *fabricated-order* class — a wholly invented `(merchantId, token)` has
no `purchases` row, so ordering has nothing to prefer and resolution falls through to step 2, which
is the attacker's own row. That residual is accepted this round (§10) and bounded by two facts: the
attacker must already know the victim's `anonymousId`, and anyone who knows it can go straight to
`install-code/generate`, which grants strictly more, unauthenticated and latch-free. **The claim-age
bound must land before T3.3 tightens `generate`** — the moment that route requires a credential, this
arm becomes the new weakest link.

The honest cost of (4): the failure in (5) surfaces *after* the user has installed the app and typed
a code, at maximum sunk cost. Acceptable only because deferral creates codes that do not exist today
— in S6–S9 the wallet sharing page currently resolves no `clientId` at all and renders no code.
Deferral never converts a working path into a failing one.

### Latching the server-minted id

An anonymous id resolved through the Shopify checkout-token path is latched — `proof_seen_at` written
at attribution — **but only when the id is the server-minted one from step 3.**

| | (a) latch the caller-supplied id that arrived alongside a checkout token | **(b) latch the server-minted id** |
|---|---|---|
| Write site | `PurchaseLinkingOrchestrator.ts:91-101` (pixel arm) or `PurchaseWebhookOrchestrator.ts:160-200` after `resolveAndAssociate` at `:172` (cart-attribute arm) | inside the step-3 materialisation, immediately after `addNode`, same unit of work |
| Reasoning offered | "a checkout token implies the latest SDK and therefore proof capability" | the id is server-minted, so **no key for it can exist anywhere**, so no legitimate client will ever need to present a proof for it |
| Holds? | **No.** The token is Shopify's, emitted by checkout regardless of which Frak SDK is present (`checkout-web-pixel/src/index.ts:29-35,:42`; `shopifyWebhook.ts:113`); the id in the same payload is read raw from `localStorage["frak-client-id"]` (`checkout-web-pixel/src/index.ts:12`), never from `getClientId()`; and there is no server-side shape discriminator between a derived and a legacy UUID | Yes, by construction — a derived id is a function of a keypair (`derive.ts:15-19` → `canonical.ts:166-186`), so a server-minted value can never equal `derive(pubkey)` for any key a client holds |
| Blast radius if wrong | **HIGH.** ~70% of ids traversing that path are unmigrated; each would take a permanent `403 PROOF_REQUIRED` from `enforceLatchedProof` (`latchedProof.ts:56-62`) on the ensure SDK arm and both merge admission paths | **LOW.** Install-code never reads the latch: `installCode.ts:20-45` verifies a proof only when present, `:69-137` mints unconditionally, and `ensure.ts:53-73` short-circuits on `ticket` **before any latch read** (M2). The id becomes non-absorbable on the merge paths and breaks nothing on the install path |

**(a) is refused. (b) is the item (T1.14).** The distinction matters because the reasoning as
originally stated, applied literally, points at (a).

**The risk that survives (b), and the mitigation.** `markProofSeen` (`IdentityRepository.ts:125-152`)
sets `proofSeenAt` and has **no clearing path anywhere in the repo** — every write is a set, none is a
reset, and three in-repo comments say so (`latchedProof.ts:16-18`, `IdentityOrchestrator.ts:250-253`,
`IdentityOrchestrator.test.ts:232`). A wrong assumption locks an id out permanently with no recovery
short of a manual `UPDATE`. So the write must be **findable and reversible without a schema change**:

- **A fixed value prefix on the minted id** (`frakmint_…`). `normalizeValue` is the identity function
  for `anonymous_fingerprint` (`IdentityRepository.ts:31-39`), so a prefix round-trips byte-exact
  through `findGroupByIdentity`, `findNodeByIdentity`, `markProofSeen` and `addNode`;
  `identity_value` is `text` with the unique key on `(identity_type, identity_value, merchant_id)`,
  so it cannot collide with a derived UUID or a legacy id. Find:
  `… WHERE identity_value LIKE 'frakmint_%' AND proof_seen_at IS NOT NULL`. Reverse:
  `UPDATE identity_nodes SET proof_seen_at = NULL WHERE identity_value LIKE 'frakmint_%'` — one
  statement, no migration, no downtime. It also survives the column's eventual retirement, which
  answers OQ9's option (ii) for free.
- **A distinct repository method** (`latchServerMintedProof`), not `markProofSeen`. `markProofSeen`
  has exactly six call sites — `ensure.ts:114`, `ensure.ts:151`, `installCode.ts:33`,
  `AnonymousMergeOrchestrator.ts:158`, `AnonymousMergeOrchestrator.ts:247`,
  `IdentityOrchestrator.ts:254` — and every one of them latches an id that just presented a **valid
  proof**. A seventh with policy semantics would break that property and invalidate the inventory the
  retirement round (DB6) depends on.
- **One structured log at the write** — `log.info({ merchantId, anonymousId, source: "shopify-checkout-token" }, …)`
  — so the population is countable from logs on day one, before anyone runs the SQL.

The in-code comment this implies is one line and states **why**, not what: that this id has no key by
construction, so latching it can never lock out a legitimate signer. Rejected as first choice: a
sentinel timestamp (overloads a timestamp's meaning and dies with the column) and reusing
`identity_nodes.validation_data` (typed for another flow; widening it touches unrelated readers).

### Schema and client work implied

Deferral is what forces the schema change (`DB2` in §4):

- `install_codes.anonymous_id` becomes nullable, `install_codes.checkout_token` is added, with
  `CHECK (anonymous_id IS NOT NULL OR checkout_token IS NOT NULL)` and an index on
  `(merchant_id, checkout_token)`.
- The reuse CTE in `InstallCodeRepository.create` (73 hand-written lines at `:24-96`), which keys on
  `(merchant_id, anonymous_id)`, gains a second arm keyed on `(merchant_id, checkout_token)`, so a
  buyer reloading the post-purchase card does not mint a second code.
- `purchase_claims` gains an index on `(merchant_id, purchase_token)`: the existing unique index is
  `(merchant_id, order_id, purchase_token)` and a btree on that cannot serve the probe.
- `IdentityRepository.findAnonymousFingerprint` (`:195-207`) gains `orderBy: asc(createdAt)` —
  mandatory, shipped with the materialisation, not after it (T1.12).
- `InstallCodeService.resolve` must learn to fail, and `mintTicket` must learn not to mint.
- `install-code/resolve`'s 200 body: `anonymousId` becomes optional, absent on an unresolved deferred
  row, plus the terminal `UNRESOLVED` outcome.
- The union lookup crosses identity → purchases, so it belongs in a **new**
  `orchestration/identity/InstallCredentialOrchestrator.ts`; root `AGENTS.md` forbids
  `service → service`.
- Client (the `/sharing` → `/install` hop, four edits): add an optional `checkoutToken` **search**
  param to `packages/wallet-shared/src/sharing/buildInstallUrl.ts` (search, not fragment — the backend
  must read it); stop dropping it at `SharingView.tsx:96-99` and `routes/sharing.tsx:56-57`; accept it
  in `module/install/params.ts` (`InstallSearch` + `parseInstallSearch`, one edit covers both the SPA
  route and the standalone entry); forward it from `useGenerateInstallCode.ts`, relaxing `enabled` so
  a token-only call with no `a` is allowed and adding it to the query key.

The ticket carries no provenance claim and needs none: under mandatory proof there are exactly two
admissible credential classes and both are decided synchronously at `generate`, so the ticket is
simply the receipt of whichever was presented.

**Open, and carried into §11:** whether `checkoutToken` is strong enough as the sole Gate 2 credential
and whether the web pixel's `localStorage` is sandbox-scoped, which together decide whether deferral
is load-bearing or a tail case (OQ8); and whether Gate 2 should admit an id that *does* have a key
(OQ2). OQ7 is answered: materialise in Gate 2, not in the attribution path.

---

## 4. Database impact

Conventions (`services/bootstrap/AGENTS.md`; `src/migrate-pg.ts:9-27`): three Postgres folders routed
at runtime by `POSTGRES_SCHEMA` / `STAGE` — `local`, `dev`, `prod`. Every schema change needs a
numbered `.sql` in **all three**, a `meta/NNNN_snapshot.json` and a `_journal.json` entry, and they are
human-written — never auto-generated. Next free numbers: `local/0039`, `dev/0043`, `prod/0021`. There
are **no down migrations anywhere**: `migrate-pg.ts` runs drizzle `migrate()` over up-only `.sql`, so
rollback means redeploying an older image against a forward-migrated database. A `dev`-only migration
passes staging and breaks production silently on the next deploy.

**This round ships one migration, DB2 — and DB3 only if T2.6 is taken.** Every destructive migration
is out of scope. Ids are kept so cross-references resolve.

| # | Owner | Table | What it changes | Additive / destructive | Status this round |
|---|---|---|---|---|---|
| **DB1** | — | `identity_nodes` | lowercase every `anonymous_fingerprint` `identity_value` | **destructive to colliding rows** | **DROPPED.** G8 is closed by mandatory proof instead: derived ids are lowercase by construction (`deriveClientIdFromHash` → `bytesToHex`), so mixed case only ever arrives from a caller, and the proof comparison lowercases both sides. `identity_nodes_unique_identity` is on the **raw** value (`domain/identity/db/schema.ts:80-82`, `nullsNotDistinct`), so a collision would be a node *merge*, not an `UPDATE`. Normalising on write remains available as a **no-backfill hygiene item** |
| **DB2** | T2.5 | `install_codes`, `purchase_claims` | `ALTER anonymous_id DROP NOT NULL`; `ADD checkout_token`; `CHECK (anonymous_id IS NOT NULL OR checkout_token IS NOT NULL)`; index `(merchant_id, checkout_token)`; index `purchase_claims (merchant_id, purchase_token)` | additive | **SHIPS.** Partially reversible — re-adding `NOT NULL` fails once one deferred row exists, and a rolled-back build whose Drizzle schema declares `anonymous_id` `notNull` reads `null` and 500s on the response schema |
| **DB3** | T2.6 | `install_codes` | single-resolve marker (`consumed_at`) | additive | **Conditional** on T2.6 being taken. Fully reversible |
| **DB4** | — | new `consumed_merge_tokens` (`jti`, `consumed_at`) | new table + index | additive | **DROPPED** with T1.4 — merge-token replay is an accepted risk this round (§10) |
| **DB5** | — | `asset_logs` | wallet address pinned at reward creation | additive | **DROPPED** — G15 is out of scope for this programme and filed separately (§9) |
| **DB6** | — | `identity_nodes` | `DROP COLUMN proof_seen_at` | **destructive** | **DEFERRED to a later round.** The latch is retained. Kept documented because the analysis does not change: `db.query.identityNodesTable.findFirst` selects the full column list, so after the drop **any** rolled-back image raises `42703` on `findGroupByIdentity` / `findEmailNode` — login, register and tracking, not just merges. **Precondition for scheduling it:** every admission route (T3.1, T3.2, T3.3) enforcing a mandatory proof in production for at least one full `frak-ensure-v1` lifetime (30 days) with the would-403 counters flat, no reader of `proof_seen_at` left outside `latchedProof.ts`, a durable replacement decided for T2.4's legacy marker (OQ9), and a written "no rollback past this point". It ships alone |

Every migration must be applied before the branch that names the new column is deployed to that
environment; against a database missing it Postgres raises `42703` and the route 500s. The only
ordering guarantee in the infra is `bootstrapJob` → backend (`infra/gcp/backend.ts:181`), so
migrations always precede the backend — but wallet, listener and backend have no relative ordering.

---

## 5. Frontend impact

**Almost all of this programme is business logic with no rendered consequence.** Mandatory `proof` on
the three flip routes is a schema field; the counters are server-side; the migration is server-side;
Gate 2's union lookup, node materialisation and deferral are server-side. The client edits that exist
are plumbing: carrying `checkoutToken` through `/sharing` → `/install`, sending a proof the client
already knows how to mint, classifying a retry, and counting proofless calls in the listener.

**The one concrete visible difference: a codeless install CTA.** On the **non-Shopify, proofless**
entry into the wallet's own `/sharing` page, `/install` today renders *"Don't lose your {{reward}}!
Copy this code"* with a code beneath it; after `install-code/generate` requires a credential it must
render the download CTA and no code instead of the error
(*"Failed to generate code. Please refresh."*, `packages/wallet-shared/src/i18n/locales/en/translation.json:802`,
which `useGenerateInstallCode.ts:30-32` → `InstallView.tsx:420-423` would otherwise surface, and where
refreshing never helps). That degradation is a **required wallet release shipped before or with**
`T3.3`, never after.

That path has neither credential: `SharingView.tsx:98` calls `buildInstallUrl({merchantId, clientId})`
with no install proof — the page holds no keypair and says so in-file — and `checkoutToken` is present
only on the Shopify order-lookup path (`useSharingIdentity.ts:34-50`). Its live volume is
**unmeasured**; that is one of the things the counters exist to measure, and it is the number that
sizes the loss.

**A dead button becomes a live one.** B1 (§3, T1.12) is the opposite of a regression: today a
wallet-bearing Shopify buyer gets `order-client` 404s, `useSharingIdentity` yields `undefined` after
5 retries, and the install CTA at `SharingView.tsx:148-152` silently does nothing. Gate 2's step-3
materialisation restores that handoff.

**Shopify keeps its attribution.** The post-purchase card already carries `checkoutToken` to
`/sharing` (`PostPurchaseCard.tsx:78-79`); the only work is carrying it through the `/sharing` →
`/install` hop where it is currently dropped, which is Gate 2's four client edits (§3). A Shopify
buyer's install stays attributed.

**The invisible cost, stated plainly: permanently unprovable ids stop being mergeable, silently.**
Legacy ids and non-UUID-shaped ids can never sign — `uuidToBytes` rejects them at
`sdk/core/src/identity/canonical.ts:96-101`, so the frozen 16-byte envelope field cannot even carry
them. Under mandatory proof they can never be a merge source or target again, and because rewards
resolve through `getWalletForGroup` at settlement, such a group becomes permanently **unpayable**, not
merely unattributed. Nothing appears on screen. Roughly **70% of users have not migrated off legacy
anonymous ids**, covering **20–30% of share links created** — those ids are merge *targets* on
`/merge/execute`. `T2.4` (`frak-migrate-v1`) narrows this to "the first client that ever asserts the
id from a key-holding context"; the residual is a write-off decision (OQ1). **This is the single
number that gates T3.1.**

**Everything else that could have been visible is avoided, and here is how.**

| Would-be visible change | Cause | How it is avoided |
|---|---|---|
| Merchant-side `useGetUserReferralStatus` turns a 200 into an error for every first-time visitor | "stop creating nodes on a `GET`" (`G17`) taken as resolve-or-404; `referralStatus.ts:15-38` resolves via `resolveSdkIdentity` → `resolveForAttribution`, which creates the anchor node | Resolve-only and return `{isReferred:false}` when no node exists. The response is identical either way — a freshly created group has no referral link. Do **not** 404. G17 has no owner this round; recorded so nobody takes the naive form |
| The in-app-browser escape stops working on old SDKs when the listener starts refusing (T3.11) | `useOnGetMergeToken` returns `null` when no proof is present | Already graceful: `getMergeToken` returns `null`, `Banner.tsx:197-204` redirects without a token, `iframeLifecycleManager.ts:85-92` omits `?fmt=`. No thrown error, no user-visible failure — one hop of attribution lost, which is the accepted tradeoff, and strictly cheaper than a backend 403 |
| A hanging spinner on install | — | Cannot happen: `InstallView.tsx:155-170` navigates after `MIN_PROCESSING_MS` in both branches |
| Losing the wallet `/sharing` self-link when it stops forwarding `a=` (T3.2) | `buildInstallProcessingEnsureAction` (`params.ts:85`) returns `undefined` with no id, so no ensure fires | The same link is covered from the merchant origin by `ensureIdentity`, proof-carrying. SUSPECTED near-zero cost; take one metric before committing |

**Silent-loss journeys and their mitigation**, because "no screen changed" is not the same as "no user
lost a reward":

| Journey | Cause | Avoidable? |
|---|---|---|
| Deep-link and Play-install-referrer installs — the best-attested install in the system | Deleting `ensure`'s whole wallet arm would take `:105-120` with it, and those installs reach `ensure` directly with a `frak-install-v1` and no ticket | **Yes, at zero security cost:** delete only `:78-88` and `:213-225`, keep the proof branch and make it mandatory (`T3.2`) |
| Queued installs in flight on the day `T3.2` lands | `PendingEnsureAction.anonymousId` is required and `ticket`/`proof` optional (`apps/wallet/app/module/pending-actions/types.ts:5-25`); the store persists for `INSTALL_TICKET_TTL_MS` = 7 days (`pendingActionsStore.ts:12`; the in-file comment at `:56-58` still says "24 hours" and is wrong) | **Mostly:** ship `T1.9` at least one wallet release earlier and flip against `ensure_arm{wallet_bare}`. Without `T1.9`, every stale old-shape action retries on every launch for a full week, raises no `ensureConflictStore` toast, and burns the 10 req/min limiter |
| Legacy migration on a merchant-pinned bundle | `migrateLegacyIdentity.ts:105` — `if (executeResponse.status < 500) clearPendingLegacyId()` destroys the marker on a 403 | **Partly:** `T1.9` fixes clients that update; pinned bundles cannot be reached. Size with the client counter and accept explicitly |
| In-app-browser escape on a pinned bundle | `resolveMergeTarget`'s unproven fallback (`lifecycleHandler.ts:232-233`), plus the proven-id branch at `:225-231` which also sends no proof when `sdkIdentity.proofs.merge` is absent | **Partly:** `T1.8` removes the `crypto.subtle` class; T3.11 makes the loss explicit and counted rather than silent. Merchants pinned to a bundle predating `sdkIdentity` on `resolved-config` are not reachable |
| SSO attribution, when the empty bindings are filled (`T3.8`) | The signed message changes; verification is exact-message; `IdentityOrchestrator.ts:236-245` logs and skips the merge while login still succeeds | **Yes:** dual-accept old and new bindings for one full `frak-ensure-v1` lifetime — 30 days |
| Native merge rows held in the outbox, if the merge-token TTL is cut (`T3.6`) | `MergeSender.kt:29-30` `holdTimeoutMillis` is 60 min, hard-coded to mirror the backend; a shorter server token expires before the hold does → 401 → dropped | **Yes:** cut the client hold in the same native release, or do not cut the TTL |

---

## 6. The programme — four buckets

This is the actionable core. Items keep their `T-ids`; the grouping is by **what gates them**, which
is the only thing that decides what ships when.

| Bucket | What it is | Gate |
|---|---|---|
| **A** | Security holes that need no flip | nothing — ship now |
| **B** | The two bugs | nothing — ship now |
| **C** | Shopify checkout-token work | nothing — can land immediately |
| **D** | Wired but not fired | everything ready to flip in **1–2 months**, alongside `ROLLOUT-STEP-3` (§7) |

**LoC:** `COUNTED` was read off the tree, `EST` is judged from the function sizes cited. Every row
states whether it is backend-only.

### Bucket A — security holes that need no flip

Proof obligation per row: *the change either alters only what an attacker can do, or alters nothing
observable in any legitimate flow.*

| # | Item | Closes | Files touched | LoC +/− | Release | Backend-only? | Proof of UX-neutrality |
|---|---|---|---|---|---|---|---|
| T1.1 | Credential-class counters + **shadow decision** at all four routes: `merge_execute_credential{class,merchant,caller}`, `merge_initiate_source{proof_presented}`, `install_code_generate_credential{class}`, `ensure_arm{wallet_ticket,wallet_bare,wallet_proof,sdk}`, `merge_execute_target_source{proven,fallback}`. Emit **inside `latchedProof.ts`**: `enforceLatchedProof` throws on `proof_invalid` (`:47-55`) and on `absent_latched` (`:65-70`) and returns a bare boolean otherwise, so three of the four classes are not observable at the call site | prerequisite for G1/G2/G3/G12; sizes every bucket-D flip | `infrastructure/telemetry/infraMetrics.ts`, `orchestration/identity/latchedProof.ts`, `orchestration/identity/AnonymousMergeOrchestrator.ts`, `api/user/identity/{ensure,installCode}.ts` | +102/−0 EST | backend deploy | **yes** | Pure observation; no branch changes an outcome. No existing counter can answer any cutover question — `infraMetrics.ts:53-59` ships exactly one identity counter, `identity_proof_checked_total{op,outcome}`, and its own doc admits absence is not recorded |
| T1.2 | Distinct counter + alert on the `WALLET_CONFLICT` branch of `IdentityOrchestrator.linkWalletToFingerprint` (today swallowed at `IdentityOrchestrator.ts:279` with `log.error` only) | **G26** | `orchestration/identity/IdentityOrchestrator.ts`, `infraMetrics.ts` | +18/−0 EST | backend deploy | **yes** | Logging only. `api/user/identity/ensure.ts:288-305` already does exactly this on the same condition; this copies it |
| T1.5 | Give each identity limiter a distinct `seed` | **G19** part / AID-007 | `api/user/identity/{ensure,installCode,orderClient}.ts` | +3/−3 COUNTED | backend deploy | **yes** | **Strictly looser, not tighter.** `rateLimiter.ts:185` seeds the Elysia plugin on `finalConfig`, which is `{windowMs, maxRequests}` only (`:21-24`); `ensure.ts:244`, `installCode.ts:68` and `orderClient.ts:21` are byte-identical `{60_000, 10}` and all three use the default IP extractor, so today they collapse into one shared 10/min IP bucket. Separating them gives each its own 10/min |
| T1.6 | Narrow `ensureIdentityKey`'s catch so a `setItem` quota error stops destroying a valid key | **G23** / AID-004 | `sdk/core/src/identity/sign.ts` | +18/−6 EST | web SDK release | no | Strictly reduces silent identity loss. The `try` at `sign.ts:200-238` wraps three `localStorage.setItem` calls and the catch unconditionally `removeItem(CLIENT_KEY_KEY)`; hoisting the writes out changes no flow shape |
| T1.7 | `getMergeToken.ts:36` → `await sdkConfigStore.resolveMerchantId()` | **G23** / AID-009 | `sdk/core/src/actions/getMergeToken.ts` | +4/−2 COUNTED | web SDK release | no | Today it signs over `metadata.merchantId ?? ""`, `uuidToBytes` throws (`canonical.ts:97-99`), `signProof` swallows and returns `null` (`sign.ts:264-265`) — the field is dead. Making it work only adds a proof to a call that already succeeds. **Must land after T1.6**: a now-valid proof latches the id (`AnonymousMergeOrchestrator.ts:158`) and `markProofSeen` never clears |
| T1.8 | `hashMergeToken` → `@noble/hashes` fallback when `crypto.subtle` is absent | untracked | `sdk/core/src/clients/createIFrameFrakClient.ts:331-342` | +8/−2 EST | web SDK release | no | Purely additive: today it returns `undefined` on a non-secure-context page and `buildSdkIdentity` omits the merge proof entirely (`:368-381`), while `signProof` *does* fall back to pure JS (`sign.ts:44-52`). Adding it can only produce a proof where none existed |
| T1.9 | Retry classification: treat `PROOF_REQUIRED`/`PROOF_OR_TOKEN_REQUIRED`/`MISSING_ANONYMOUS_ID` as non-retryable in `drainEnsures#isNonRetryable`, and stop `migrateLegacyIdentity` clearing its marker on a 403 | AID-016; **hard prerequisite for T3.1/T3.2** | `apps/wallet/app/module/pending-actions/drainEnsures.ts:22-27`, `sdk/core/src/actions/migrateLegacyIdentity.ts:105` | +14/−4 COUNTED | wallet + web SDK release | no | Today `isNonRetryable` matches only `WALLET_ALREADY_LINKED`, so any other 4xx re-fires for the full 7-day queue TTL; and `migrateLegacyIdentity.ts:105` permanently orphans a legacy id on any 403. Both changes only affect requests that already fail |
| T1.10 | Emit `x-frak-sdk-version` from `sdk/core` | prerequisite for the cutover conditions | `sdk/core/src/actions/{ensureIdentity,migrateLegacyIdentity}.ts`, RPC client | +14/−0 EST | web SDK release | no | Header-only. The backend already accepts and logs it (`infrastructure/macro/session.ts:68`, `index.ts:65`) with no consumer. Verified absent from `sdk/core` entirely; only `FrakSdkVersion.kt:15` and `FrakSDKVersion.swift:11` set it. Note it can never describe the population being sized — old SDKs do not send it |
| T1.13 | **Listener-side proofless counters.** `useOnGetMergeToken.ts:26` emits `merge_initiate_proofless{source="rpc"}` when `params?.[0]` is `undefined` and still forwards; `mergeTokenQueryOptions.ts:68` emits `source="listener_modal"`/`"embedded_wallet"` when `sourceAnonymousId` is present | readiness measurement for **G11**; the flip gate for T3.11/T3.1 | `apps/listener/app/module/hooks/useOnGetMergeToken.ts`, `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts` | +12/−0 EST | listener/wallet release | no | Counts only, forwards unchanged. **This is the only readiness signal that exists:** `sdkVersion` / `minVersion` across `apps/listener/**` returns one doc comment and `packages/rpc` has no version field, so presence-of-proof is the sole gateable signal. It also converts `mergeTokenQueryOptions`'s undated "no production merchant today" claim into data before flip day rests on it |
| T2.2 | Alarm — not a gate — when `/merge/execute` redeems a token minted from a wallet session and presents no target proof | instrumentation for **G2**; closes nothing | `AnonymousMergeOrchestrator.ts` | +20/−0 EST | backend deploy | **yes** | Counter and log only. **It must not be shipped as an enforcement branch:** `api/user/identity/merge.ts:19-24` passes **both** `sourceAnonymousId` and `sourceWalletAddress`, so an attacker supplies their own derived id plus a valid proof for it and the predicate never fires. It closes a code path, not an outcome — only T3.1 closes the outcome |
| T2.4 | `frak-migrate-v1` signed by the derived key over **both** ids, with the old proofless `execute` arm left open; copy `proof_seen_at` onto the legacy node on success so it stays resolvable for published `fCtx` links and is no longer absorbable | **G27** / AID-005 | `sdk/core/src/{identity/types.ts,actions/migrateLegacyIdentity.ts}`, `IdentityProofService.ts`, `AnonymousMergeOrchestrator.ts`, `IdentityRepository.ts`, golden fixtures | +83/−6 EST | backend, **then** web SDK (two merges) | no | Both arms open at once, so no client is stranded. **If the ordering is reversed**, an unknown op makes `PROOF_WINDOW_SECONDS[op]` `undefined`, `isFresh` returns `false` (`IdentityProofService.ts:41-45`) and every migration silently reports "expired". With the latch retained this round the marker it writes survives; a durable replacement is decided before the retirement round (OQ9) |
| T2.8 | `weightCache` invalidation on wallet attach | **G25** / AID-010 | `IdentityWeightService`, `IdentityRepository` | +12/−0 EST | backend deploy | **yes** | Neutral *only* with its prerequisite: the conflict surface must be mounted on the standalone `/install` entrypoint (AID-011) — today `EnsureConflictToast` is mounted only in `apps/wallet/app/routes/_wallet.tsx`. Without it, a user with two wallets who today merges silently inside the 30 s cache window now gets a 409 with nowhere to show it |
| T2.9 | `GET /pairings/find/:id` → `withWalletAuthent`, **keep** `pairingCode` in the response | **G28** | `api/user/wallet/pairing/management.ts:10-45` | +4/−0 EST | backend deploy | **yes** | The consumer already sits behind `_protected-fullscreen` and auto-fills the code (`apps/wallet/app/routes/_wallet/_protected-fullscreen/pairing.tsx`). Confirm `usePairingInfo` fires only after the session resolves. Dropping the field would not be neutral — it forces the user to type a code the app fills today |
| T1.11 | Doc corrections in `README.md` and `ROLLOUT.md`: the validity-window drift (AID-014), the stale prod-migration line, AID-018's two false claims, and `ROLLOUT.md`'s step-3 item 4 (not executable as written — §7) | — | `README.md`, `ROLLOUT.md` | +30/−40 EST | none | n/a | Docs only. `README.md:101-102` says `frak-merge-v1` ±2 min / `frak-ensure-v1` 90 days; the tree ships 600 s and 30 days (`IdentityProofService.ts:24-33`). `README.md:164` says "`prod` still needs its generated migration"; `services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql` is in the tree |

**Bucket A totals — source ≈ +312 / −23 (net +289); docs +30 / −40. No migration.** One backend
deploy, one web SDK release, one wallet/listener release. Nothing waits on a store submission,
`minVersion` or SDK propagation.

### Bucket B — the bugs

| # | Item | Closes | Files touched | LoC +/− | Release | Backend-only? | Blast radius and the test that pins today's behaviour |
|---|---|---|---|---|---|---|---|
| T1.3 | **B2.** Make `merge` a required param of `PurchaseLinkingOrchestrator.claimPurchase` (`:22` `merge?:` → `merge:`, `:87` `params.merge ?? true` → `params.merge`), and correct the doc block at `:14-21` which names `PurchaseWebhookOrchestrator` as the default's consumer — that class never calls this method. Add one line at the `merge:true` branch marking it as having no live caller | **G16** | `orchestration/PurchaseLinkingOrchestrator.ts`, `api/user/track/purchase.ts` | +5/−5 EST (the param change itself is +2/−1 COUNTED) | backend deploy | **yes** | **Zero production behaviour change, compile-enforced.** One production caller, `api/user/track/purchase.ts:58-69`, already passes `merge: false` at `:67`; the other five `claimPurchase` hits are `PurchaseLinkingOrchestrator.test.ts:71,104,135,165,199`. **Keep the arms.** Deleting them is strictly larger for the same end state: it removes the `associate` branch at `:177-191`, forces `rebindExisting` to a literal `false`, makes `ClaimPurchaseResult.merged` (`:31`) permanently false — which is an optional field in the route response schema at `purchase.ts:83` — and deletes the two tests in the `"merge: true / default"` describe (`:161-206`). With the param required the arms are dead-but-typed and still covered; deleting them later is easier, because the type change already proved there is exactly one caller. A green `bun run typecheck` **is** that proof |
| T1.12 | **B1.** Materialise the merchant-scoped anonymous node in the **Shopify credential path only** — Gate 2's ladder step 3 (T2.5) — with a server-minted id, minted only when the lookup returns none, in the same unit of work. **Ship with it, not after it:** `orderBy: asc(createdAt)` on `IdentityRepository.findAnonymousFingerprint` (`:195-207`, an unordered `findFirst`) | **B1**; unblocks `order-client` for wallet-bearing Shopify buyers | `IdentityRepository.ts` (the `orderBy`), plus the materialisation inside T2.5's new `InstallCredentialOrchestrator.ts` | +3/−1 COUNTED for the `orderBy`; the materialisation is counted in T2.5 | backend deploy (ships with bucket C) | **yes** | **Do not fix it in `resolveForAttribution`.** That would add a `findGroupByIdentity` + `createGroup`/`addNode` to **every** `track/interaction`, **every** `track/purchase` and **every** `referral-status` `GET`, writing a **caller-supplied, unauthenticated** `x-frak-client-id` value at the QPS of the tracking surface — a G17 security regression, not a bug fix. It would also break the write-discipline invariant pinned at `IdentityOrchestrator.test.ts:88-90` (`toHaveBeenCalledTimes(1)` → `2`) and the comment at `:86-87`, and falsify the doc block at `IdentityOrchestrator.ts:171-174`. Option 2 changes **no existing test**: the security invariant at `:85,:94-99` and the second test at `:102-129` stay green, and `sdkIdentity.test.ts:101` counts the orchestrator call, not the repo call. Without the `orderBy`, a group holding two anon nodes returns a nondeterministic id to `/sharing` |

**Bucket B totals — source ≈ +8 / −6 (net +2).** No migration, no client release, both backend-only.

### Bucket C — Shopify checkout-token work, lands immediately

| # | Item | Closes | Files touched | LoC +/− | Release | Backend-only? | Proof of UX-neutrality |
|---|---|---|---|---|---|---|---|
| T2.5 | **Gate 2 Phase A**: the `{merchantId, checkoutToken}` arm, the resolved-first ladder of §3 (resolved purchase → counted claim → materialisation → deferral → `UNRESOLVED`), then the four wallet edits that carry `checkoutToken` from `/sharing` to `/install` | **G12**, and the delivery vehicle for **B1** | `domain/identity/db/schema.ts`, `InstallCodeRepository.ts` (73-line hand-written CTE at `:24-96`), `InstallCodeService.ts`, **new** `orchestration/identity/InstallCredentialOrchestrator.ts`, `api/user/identity/installCode.ts`, `PurchaseClaimRepository.ts` (new finder + index), wallet `/sharing` → `/install` hop | +302/−0 EST | backend, then wallet **+ DB2** | no — four wallet edits | Purely additive: it only *adds* a second way to mint a code. Nothing that mints today stops minting. The `generate` route does not become strict here — that is T3.3, in bucket D |
| T1.14 | **Latch the server-minted id.** `proof_seen_at` written at attribution for an id materialised through the Shopify checkout-token path, via a **distinct** `latchServerMintedProof` repository method, behind a `frakmint_` value prefix, with one structured log line at the write | hardening: makes those ids non-absorbable on every merge path | `IdentityRepository.ts` (new method), `orchestration/identity/InstallCredentialOrchestrator.ts` | +25/−0 EST | backend deploy | **yes** | Safe **only** for the server-minted id (§3): no key for it can exist anywhere, and install-code never reads the latch — `installCode.ts:20-45` verifies a proof only when present, `:69-137` mints unconditionally, and `ensure.ts:53-73` short-circuits on `ticket` before any latch read. **Never latch a caller-supplied id on this path:** `markProofSeen` never clears, ~70% of ids traversing it are unmigrated, and each would take a permanent 403. Findable with `LIKE 'frakmint_%'`, reversible with one `UPDATE`, no schema change |

**Bucket C totals — source ≈ +327 / −0. One migration (DB2).** One backend deploy plus one wallet
deploy. No SDK dependency, no flip.

### Bucket D — wired but not fired

Everything below is written, tested and shipped **inert**; the flip is a schema field or a return
statement, 1–2 months out, gated on the counters in §7 rather than on a date.

| # | Item | Closes | Files touched | LoC +/− | Release | Backend-only? | The trade-off, quantified |
|---|---|---|---|---|---|---|---|
| T3.11 | **Listener refuses proofless `initiate`.** Flip `useOnGetMergeToken.ts` from count to `if (!proof) return null;`, and the `sourceAnonymousId` arm of `mergeTokenQueryOptions.ts` likewise. **Lands before T3.1** | **G11**; makes T3.1 a formality | `apps/listener/app/module/hooks/useOnGetMergeToken.ts`, `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts` | +4/−0 EST | listener/wallet release | no | The listener URL is unversioned — `` `${walletUrl}/listener` `` (`iframeHelper.ts:119-120`) — so this reaches **100% of embedded merchant pages on the next wallet web deploy**, independent of merchant SDK version. Degrades gracefully: `getMergeToken` returns `null`, `Banner.tsx:197-204` redirects without a token, `iframeLifecycleManager.ts:85-92` omits `?fmt=`. Strictly better than a backend 403, which produces the same `null` after a round trip, a logged 403 and rate-limit burn (`merge.ts:8`, 20/min). Gate: T1.13's counter |
| T3.1 | `proof` **required** on `/merge/execute` and on `/merge/initiate`'s anon-source arm, in the same deploy — flipping one leaves the merge capturable from the other direction. Two schema fields; the body ids stay and the existing `id_mismatch` check binds them | **G2** fully, **G13** source half | `api/user/identity/merge.ts` (schema), `AnonymousMergeOrchestrator.ts` (the `proofPresented ? resolve : find` ternary and `TARGET_NOT_FOUND`, `:220-242`) | +20/−31 (removal COUNTED) | backend deploy | **yes** | **U2/U3c ids can never be a merge source or target again**, and such a group becomes permanently unpayable via `getWalletForGroup`. ~70% of users are unmigrated, covering 20–30% of share links. Gated on T2.4 having drained or every legacy migration 403s, and on T3.11 having stopped the proofless callers — by then the backend never sees a proofless initiate, so this is a formality rather than a behavioural change. It does **not** fill `initiate`'s binding (OQ5, accepted §10) |
| T3.2 | `/identity/ensure`, both arms in one deploy. **SDK arm:** `proof` optional → required, one schema field (§2). **Wallet arm:** `frak-install-v1` required; **delete only the proofless variant** (`ensure.ts:78-88`) and the header fallback (`:213-225`), keeping and enforcing the proof branch at `:105-120`. **Plus the wallet-side prerequisite:** stop `SharingView`/`routes/sharing.tsx` forwarding `a=` when the page holds no credential for it | **G1**, and the `ensure` half of **G5** exposure | `api/user/identity/ensure.ts`, `apps/wallet/app/module/sharing/{component/SharingView.tsx,...}`, `apps/wallet/app/routes/sharing.tsx`, `apps/wallet/app/module/pending-actions/{types,drainEnsures,pendingActionsStore}.ts` | +52/−75 EST | backend + wallet | no | **The store binary is no longer the blocker — a wallet-side path is** (§7, F1). Every queued ensure holding neither ticket nor proof 400s for its remaining TTL: `pendingActionsStore.ts:12` sets `DEFAULT_ENSURE_TTL_MS = INSTALL_TICKET_TTL_MS` = **7 days**, so the write-off window is one week of in-flight users on deploy day. T1.9 first, at least one wallet release earlier |
| T3.3 | `install-code/generate` becomes the union body of §2: proof required on the SDK arm, `checkoutToken` on the Gate 2 arm, bare `{merchantId, anonymousId}` rejected 400 | **G3** admission half | `api/user/identity/installCode.ts`, `InstallView.tsx` (codeless CTA) | +55/−12 EST | backend + wallet | no | Kills the **non-Shopify** wallet `/sharing` → `/install` path outright; Gate 2 does not reach it (§5). The codeless CTA must ship in the preceding wallet release or the same one, never after. **Gate 2's claim-arm age bound must land in the same release**: the moment this route requires a credential, the forgeable-claim arm becomes the new weakest link (§3, §10) |
| T3.4 | Delete `resolveMergeTarget`'s unproven fallback **and** fix the proven-id branch that also sends no proof | **G10** | `apps/listener/.../lifecycleHandler.ts:216-234` | +6/−8 COUNTED | listener release | no | The in-app-browser escape stops merging for merchant-pinned SDKs — permanently, since the listener updates and the merchant bundle never does. One shot, no retry (AID-012). Needs `merge_execute_target_source{proven,fallback}` first; that population is unmeasured |
| T3.5 | **Install-ticket TTL cut to 1–2 hours.** Single-use is **not** taken (§10) | **G3** residual / AID-019 | `packages/app-essentials/src/constants/installTicket.ts`, `infrastructure/external/jwt.ts`, `InstallCodeService.ts`, wallet queue | +20/−7 EST | **backend + wallet, coordinated** | no | Races the passkey ceremony: `useResolveInstallCode` mints the ticket when the code is pasted, `useExecutePendingActions` drains it *after* authentication. "Minutes" loses attribution for anyone who pauses, backgrounds or fails a passkey; 1–2 hours covers a human-paced install without leaving a week-long bearer. Single-use additionally contradicts an in-file invariant (`jwt.ts:56-57`, "would deadlock the wallet's retry loop"). Decouple `INSTALL_TICKET_TTL_MS` from the shared client constant first and enforce `clientTTL ≥ serverTTL`. **Hard prerequisite of T3.3**: a stolen code is still a capture of the id it was minted for |
| T2.6 | Install **code** single-resolve — distinct from the ticket, and not covered by T3.5's decision | **G3** residual / AID-019 | `InstallCodeRepository.ts`, `InstallCodeService.ts` | +15/−0 EST | backend deploy **+ DB3** | **yes** | Neutral only if genuine cross-device use is nil. Today `CODE_TTL_HOURS = 72` with `MAX_RESOLVE_ATTEMPTS = 20`, and the code is reused across page reloads by the `create` CTE. Gate: a same-device signal on `install_code_resolved` reading ≈0 cross-device (OQ4). **Drop it if that measurement does not arrive** — it is the lowest-value row in this bucket and it is the only reason DB3 exists |
| T3.6 | Merge-token TTL cut | AID-003(b) / **G4** | `infrastructure/external/jwt.ts`, native `MergeSender.{kt,swift}` | +3/−3 EST | backend + native | no | The `?fmt=` escape is put **on the clipboard** for the user to paste into another browser (`InAppBrowserToast/index.tsx:47,65`) — a human-paced hop. Native holds rows for 60 min hard-coded to mirror the backend (`MergeSender.kt:29-30`); cutting the server side alone drops them at 401. This is the whole of G4's remediation now that consumption is dropped (§10) |
| T3.7 | Drop `anonymousId` from `install-code/resolve`'s 200 response body | **G19** | `api/user/identity/installCode.ts:105-118`, `useResolveInstallCode.ts` | +8/−7 COUNTED | backend + wallet, **two deploys** | no | **No SDK involvement, and the binary is propagated** — but the *current* wallet still reads it (`useResolveInstallCode.ts:65`), deliberately "so the store remains readable by a rolled-back build". The wallet must stop reading before the backend stops sending: wallet deploy, then backend deploy |
| T2.3 | **Conditional.** Add an empty-binding `frak-merge-v1` proof to `resolved-config` and have `mergeTokenQueryOptions` send it | **G11**, if refusal is not acceptable | `sdk/core/src/{identity/types.ts,clients/createIFrameFrakClient.ts}`, `apps/listener/.../lifecycleHandler.ts`, `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts`, `IdentityProofService.ts`, golden fixtures | +85/−4 EST | **sdk/core + listener + wallet** | no | **Build this only if T1.13's counter comes back non-zero.** The wallet origin holds no key — `signProof`/`frak-client-key` grep to zero hits across `apps/**` and `packages/**` — so this needs an SDK-sourced proof plus new listener plumbing, and reusing `sdkIdentity.proofs.merge` would 403 (it binds `SHA-256(mergeToken)`, `mergeTokenQueryOptions.ts:43-46`). Purely additive if built: the backend arm is fail-open today, so sending a proof moves a call from "allowed unproven" to "allowed proven". Blocked on OQ3 |
| T3.8 | Fill the empty bindings on `frak-ensure-v1` and `frak-sso-v1` (the wallet address or the SDK JWT `jti`; the wallet or credential id) | **G5**, **G6** | `sdk/core` signing sites, `IdentityProofService.ts`, backend callers | +75/−0 EST | backend + SDK | no | Changes the signed message. A merchant on a pinned bundle signs the old layout, verification fails, and the merge is **silently skipped** (`IdentityOrchestrator.ts:236-245`) while login still succeeds. Needs a dual-accept window of one full `frak-ensure-v1` lifetime — **30 days**. The longest-lead item in the bucket; start it last or defer it past the flip |
| T3.10 | Optional post-install recovery CTA — the inverted flow, offered and never required | degradation for Gate 2's `UNRESOLVED` and the null-`signProof` arms | a wallet surface + `mergeTokenQueryOptions`'s wallet arm | +60/−0 EST | wallet release | no | Never on the critical path of an install funnel; shown only when a recoverable unmerged group is known to exist, and only for a merchant with a domain on record. Whether it is a nicety or the only path is platform-dependent (OQ4) |

**Bucket D totals — source ≈ +403 / −147 (net +256). One conditional migration (DB3).** This is the
only bucket that deletes admission code and the only bucket that closes an admission gap.

### Dropped from this programme

Kept as a table so every id in the map still resolves to a decision rather than to silence.

| # | Was | Why it is not here |
|---|---|---|
| T1.4 | Merge-token consumption (`jti`/`consumed_at`, **DB4**) | Merge-token replay accepted as a risk (§10). A new table + repo for +95 LoC against an attack that first requires capturing a live 60-minute token. T3.6's TTL cut is the remaining half of G4 |
| T2.1 | `normalizeValue` lowercasing + **DB1** backfill | G8 is closed by mandatory proof instead (§4, DB1). Normalising on write survives as a **no-backfill hygiene item**, not a security fix |
| T2.7 | `asset_logs` wallet pinning (**DB5**) | **G15**, out of scope and filed separately (§9) — assessed as the highest value-per-risk item on the map, which is why it gets its own plan |
| T2.10 | Email node discipline | **G9**, out of scope and filed separately (§9), with the product decision already taken |
| T3.9 | Retire the latch (**DB6**, destructive) | The latch is retained this round; retirement is a later round with a stated precondition (§4, DB6). Its analysis is preserved there verbatim |

### Programme totals

| | Added | Removed | Net |
|---|---|---|---|
| **Bucket A** source | ~312 | ~23 | **+289** |
| **Bucket B** source | ~8 | ~6 | **+2** |
| **Bucket C** source | ~327 | ~0 | **+327** |
| **Bucket D** source | ~403 | ~147 | **+256** |
| **Hand-written source, all buckets** | **~1,050** | **~176** | **+874** |
| Tests | ~1,345 | ~520 | **+825** |
| Docs (`README.md` §2 corrected; `ROLLOUT.md` corrected, not retired) | ~30 | ~40 | **−10** |
| SQL migration files (1–2 migrations × 3 folders) | ~18 | 0 | +18 |
| Generated drizzle snapshots (up to 2 × 3 = 6 files; `dev/meta/0040_snapshot.json` is 3,575 lines, `prod/meta/0020_snapshot.json` 3,603) | ~21,500 | 0 | +21,500 |

**The programme is a net addition of roughly +874 hand-written source lines and +825 test lines.**
It never goes net-deleting, because the deletion (T3.9, −334) moved to a later round. The generated
snapshot cost dropped by two thirds because five of six migrations are gone.

### Test impact

| Suite | Change | Basis |
|---|---|---|
| `AnonymousMergeOrchestrator.test.ts` (503) | **10 of 17 cases assert latch/proofless behaviour** (`:102, :121, :146, :181, :316, :336, :430-447`, plus the `findNodeByIdentity` mocks at `:77, :107, :251, :276, :384`) ⇒ ~−200/+180 at T3.1. `:248` *"allows an unlatched legacy id as a merge target with no proof"* is rewritten — that is the intended regression signal | COUNTED |
| `test/api/user/identity/ensure.test.ts` (669) | the whole `"the live Tauri binary's request shape"` describe (`:142`) plus 5 of 8 `"resolution order"` cases (`:221, :242, :274, :395`) pin the bare variant ⇒ ~−200/+120 at T3.2 | COUNTED |
| `test/api/user/identity/merge.test.ts` (337) | ~7 of 12 cases ⇒ ~−120/+130 at T3.1 | EST |
| `IdentityOrchestrator.test.ts` (409) | **unchanged.** T3.9 is out of scope, so `:276`/`:338`'s `markProofSeen` assertions stand; and B1 is fixed in Gate 2, so the write-discipline assertions at `:86-93` stay green. Run it as the green baseline before touching §3 | COUNTED |
| `walletConflict.test.ts` (183), `mergeTieBreak.test.ts` (109) | **pass unmodified** — zero references to `markProofSeen`, `proofSeenAt` or the latch | COUNTED |
| `PurchaseLinkingOrchestrator.test.ts` | **unchanged by T1.3** — all five `claimPurchase` call sites (`:71,104,135,165,199`) already pass `merge` explicitly, and the `"merge: true / default"` describe (`:161-206`) keeps covering the retained arms. A green `bun run typecheck` is the proof that exactly one production caller exists | COUNTED |
| `test/api/user/identity/installCode.test.ts` (252) | Gate 2's cases: **resolved purchase beats a conflicting claim row** (the new explicit ordering), webhook-late (claim row only, counter emitted), webhook-never (deferred row, generation must not fail), S3/S4 materialisation with no merge, deterministic `findAnonymousFingerprint` with two anon nodes in one group, `frakmint_` prefix + latch on the minted id only, `{merchantId, checkoutToken, anonymousId}` → 400, reuse on `(merchantId, checkoutToken)`, `UNRESOLVED` with no ticket minted | EST |
| New: request-level limiter suite over the composed `identityApi` | mirrors `api/user/track/index.test.ts`, ~+90 | EST |
| `useOnGetMergeToken.test.ts`, `mergeTokenQueryOptions` tests | T1.13's counter on the proofless path, then T3.11's `null` return | EST |
| `buildInstallUrl.test.ts`, `apps/wallet/app/entry/shared/search.test.ts`, `routes/sharing.test.ts` | `checkoutToken` survives every hop from `/sharing` to `parseInstallSearch`; these three already pin the round-trip and are the single source of truth for it. T3.2 adds the "no `a=` without a credential" case here | COUNTED |
| Native | **no Kotlin/Swift source change** for a new op — `ProofCodec.kt` maps only install+merge and tolerates unmapped ops — **but both native CI suites iterate the whole golden corpus**, so a new fixture is consumed by Android and iOS CI | verified shape |

---

## 7. `ROLLOUT-STEP-3` and per-route readiness

**The wallet binary is propagated. That closes the store-approval dependency and nothing else.** Two
independent corrections follow, and both change what `ROLLOUT.md` says.

**Correction 1 — `ensure.ts:78`'s premise is false, so `ROLLOUT.md`'s step-3 item 4 is not executable
as written.** The comment says the bare arm is "kept only because the installed Tauri binary POSTs
exactly this shape". The currently-deployed **wallet web build** also lands on that arm with neither
credential, via the wallet's own `/sharing` → `/install` path:
`SharingView.tsx:94-99` (in-file: *"this page has no SDK keypair to sign with"*) →
`routes/sharing.tsx:55-57` (forwards `search: { m, a }` only) → `InstallView.tsx:85,:150-172` →
`drainEnsures.ts:104-109`. That page is **permanently** incapable of presenting either credential —
the wallet origin holds no keypair. A second, unmarked door is the header fallback at
`ensure.ts:213-225`: any wallet-session caller sending only `x-frak-client-id` is routed into
`resolveWalletEnsureAnonymousId` with a caller-named id, and there is no `ROLLOUT-STEP-3` marker
anywhere near it (markers exist only at `:43`, `:78`, `:101`, `:362`). Deleting `:78-88` and stopping
there leaves G1 fully open — this is AID-018.

**Correction 2 — `/merge/initiate` is not freely flippable.** `migrateLegacyIdentity.ts:54-73` is
already fail-safe: it signs a proof and `return`s at `:66` if it cannot. But it is one of three
callers, and the other two are the blockers:

| Caller | Proof today | Can an SDK release alone fix it? |
|---|---|---|
| `migrateLegacyIdentity.ts:54-73` | ✅ always; `if (!proof) return` | **Already fail-safe.** Nothing to do |
| `useOnGetMergeToken.ts:23-30` | ⚠️ `params?.[0]` — `undefined` on old SDKs, as its own comment says | **Partly.** `getMergeToken.ts:31-43` already signs, so new integrations are fixed; merchants pinned to an old `@frak-labs/core-sdk` are not. Only time plus jsDelivr `@latest` traffic closes it |
| `mergeTokenQueryOptions.ts:68-74` | ❌ never | **No.** No key on that origin. It needs T2.3's SDK-supplied proof *plus* listener plumbing — or T3.11's refusal, which is cheaper |

So `initiate` is blocked by the **same SDK propagation** as `execute`, and the cheapest unblock is not
a backend 403 but a listener refusal (T3.11), which reaches 100% of embedded pages on the next wallet
deploy regardless of merchant SDK version.

### The 16 `ROLLOUT-STEP-3` markers, classified

10 non-doc files, 16 occurrences.

| Marker | Classification |
|---|---|
| `ensure.ts:43`, `:78`, `:362` (3) | **Blocked on a wallet-side change, not on the binary** — the `/sharing` hop and the header fallback. Owned by T3.2 |
| `ensure.ts:101` ("should the install proof be exchanged for a ticket?") | **Closable now — it is a decision, not a dependency.** Answered: keep direct acceptance (§10, accepted proof leak). Record the decision, delete the marker |
| `installCode.ts:105` (`anonymousId` kept for old binaries) | **Closable now, wallet-only, two deploys.** No SDK involvement. Owned by T3.7 |
| `pending-actions/types.ts:22`, `drainEnsures.ts:103`, `pendingActionsStore.ts:37`, `:46`, `pendingActionsStore.test.ts:29` (5) | **Wallet-only, gated on the bare arm going.** Same deploy as T3.2 |
| `lifecycleHandler.ts:217`, `:232` (2) | **Blocked on SDK propagation** — the fallback exists because an old SDK's `resolved-config` payload has no signed `sdkIdentity`. Owned by T3.4 |
| `AnonymousMergeOrchestrator.ts:112` (+ `TODO(merge-initiate-proof)` `:117-121`) | **Blocked on SDK propagation *and* on `mergeTokenQueryOptions`.** The TODO's claim that "the SDK's RPC path already sends one" is true of the *current* SDK only. Owned by T3.11 then T3.1 |
| `mergeTokenQueryOptions.ts:41` | **Blocked on SDK propagation**, not — as the doc implies — on a wallet-side fix. Owned by T3.11 (or T2.3) |
| `latchedProof.ts:80`, `:118` (2) | Cosmetic tails; they follow the last arm to flip |

### Per-route readiness

| Route / arm | What blocks it **today** | What unblocks it | Roughly when |
|---|---|---|---|
| `/identity/ensure` wallet **ticket** branch | nothing | — | already fine |
| `/identity/ensure` wallet **proof** branch (M20) | nothing | make it mandatory as part of T3.2 | with T3.2 |
| `/identity/ensure` wallet **bare** arm (M3/G1) | **not the binary.** The wallet `/sharing` → `/install` hop, the unmarked header fallback `:213-225`, and 7 days of pending-action replay | T1.9 (retry classification) → wallet deploy that stops forwarding `a=` and drains the queue → T3.2 deletes `:78-88` and `:213-225` | wallet deploy now, flip **+7 days** after it |
| `/identity/ensure` **SDK** arm (M1) | old SDK versions omit `proof` entirely, exactly as `useOnGetMergeToken` does | SDK propagation only. Measured by `ensure_arm{sdk}` proof-presence (T1.1); no version signal exists (T1.10 helps only for new SDKs) | **1–2 months** |
| `/merge/initiate`, `migrateLegacyIdentity` caller | nothing — already signs, fails safe | — | ready |
| `/merge/initiate`, `useOnGetMergeToken` caller | old SDKs send `params?.[0] === undefined` | T1.13 counts now; **T3.11 refuses locally** — one wallet deploy reaches every merchant page regardless of their SDK version | count now, refuse in **1–2 months** |
| `/merge/initiate`, `mergeTokenQueryOptions` caller | the wallet origin has **no key at all** — cannot self-heal by SDK propagation | T3.11, or T2.3 if T1.13's counter is non-zero | same as above |
| `/merge/initiate` backend schema (T3.1) | its three callers above | T3.11 first — after which the backend never sees a proofless initiate, making the flip a formality | **1–2 months** |
| `/merge/execute` (M6/G2) | `migrateLegacyIdentity.ts:82-96` sends no proof at all; native `MergeSender` already fail-closed | T2.4 (`frak-migrate-v1`, backend-accepts-first) drained, then SDK propagation. Flip **in the same deploy as `initiate`** | **1–2 months** |
| `install-code/generate` (M-x1/G3) | the keyless wallet `/sharing` origin, which has no credential to present | Gate 2 (bucket C) exists first, then T3.3 + the codeless CTA + T3.5's TTL cut + the claim-age bound | Gate 2 now, flip **1–2 months** |
| `install-code/resolve` response body | the shipped Tauri binary types `anonymousId` as required, and the current wallet still reads it | wallet stops reading, then backend stops sending. **No SDK involvement** | two wallet/backend deploys, any time |
| `/track/*` (M7/M10) | out of scope by design — must stay usable by keyless clients | — | never |

**Do not couple the ensure flip to the initiate flip.** They have different blockers: initiate is
blocked on SDK propagation and closable by listener refusal; ensure's bare arm is blocked on a
wallet-side path plus an unmarked fallback, and needs a 7-day queue drain first.

---

## 8. Rollout constraints

### In-flight credentials, by TTL

| Credential | TTL | Anchor |
|---|---|---|
| install code | 72 h, reused if >6 h remain | `InstallCodeRepository.ts` `CODE_TTL_HOURS`, `REUSE_MIN_REMAINING_HOURS` |
| install ticket | **7 days**, "Not single-use" → **1–2 h** after T3.5 | `packages/app-essentials/src/constants/installTicket.ts:6`; `infrastructure/external/jwt.ts:56-65` |
| pending ensure action (client `localStorage`) | **7 days**, same constant (the in-file comment at `pendingActionsStore.ts:56-58` says 24 hours and is wrong) | `pendingActionsStore.ts:12` |
| merge token | 60 min | `jwt.ts` `anonymousMerge` |
| native merge queue hold | 60 min, hard-coded to mirror the backend | `MergeSender.kt:29-30` |
| `frak-ensure-v1`, `frak-install-v1` | **30 days** | `IdentityProofService.ts:25-27` |
| `frak-merge-v1`, `frak-sso-v1` | 10 min | same |

**Every credential outlives a deploy**, so *any change to what a credential means needs a dual-accept
window at least as long as that credential's TTL* — 30 days for ensure/install proofs, 7 days for the
ticket and the persisted queue, 72 h for the code, 60 min for the merge token. "No state in which a
route is half-enforced" reasons about routes; the actual half-state is **credentials already in the
wild**. This is why T3.8 needs 30 days of dual-accept and why T3.2's write-off window is one week.

### Deployed-client breakage

- Published native SDKs are at **`1.0.0-beta.2`** (`sdk/android/gradle.properties`). Merchants pin.
  Keeping `targetAnonymousId`/`sourceAnonymousId` on the wire is what keeps them unaffected by T3.1.
- The web SDK CDN default is `@latest`, so most merchants auto-upgrade; npm consumers pin their own
  build. A merchant pinned to a bundle predating `sdkIdentity` on `resolved-config` **never recovers**
  — the listener updates, the merchant bundle does not.
- **The listener is the exception and the lever.** Its URL is built unversioned, so every SDK version
  loads the current deployment. That is why T3.11 exists.
- **Hard-fail populations:** the wallet `/sharing` → `/install` hop and the header fallback at T3.2;
  pre-ticket binaries at T3.7.
- **Genuinely unaffected:** native `MergeSender` under mandatory proof — it mints a proof on every
  attempt and returns `Hold` when signing yields null; `sdk/legacy` (touches no identity route);
  `/track/*`.

### Per-item rollback

| Item | Verdict |
|---|---|
| T1.1–T1.3, T1.5–T1.13 | **Clean.** Code-only, revertible |
| T1.14 | **Reversible by one statement**, by design: `UPDATE identity_nodes SET proof_seen_at = NULL WHERE identity_value LIKE 'frakmint_%'`. That is the entire reason for the prefix |
| T2.4 | **Irreversible per user** where it writes `proof_seen_at` onto legacy nodes: `markProofSeen` never clears (`IdentityRepository.ts:125-131`), so after a rollback those nodes require a proof they can never produce |
| T2.5 | **Irreversible once one deferred row exists** — a rolled-back build whose Drizzle schema declares `anonymous_id` `notNull` reads `null` and 500s on the response schema |
| T3.1–T3.4, T3.11 | Code-only, cleanly revertible — but attribution lost in the window is unrecoverable, and reverting still needs a full deploy |
| DB6 (later round) | **One-way door, total identity outage on rollback.** Not scheduled here |

**Deploy ordering.** One `sst deploy --stage gcp-{staging,production}` per push to `dev`/`main`
deploys backend, wallet, listener and shopify **together**, and the only ordering guarantee is
`bootstrapJob` → backend. The web SDK ships on a separate pipeline (Changesets → npm + jsDelivr), so a
single push touching both `services/backend` and `sdk/core` fires both workflows **concurrently** —
which is why T2.4's "backend accepts before SDK emits" must be two separate merges. Also: T2.5 is
backend + DB2, then a *separate* deploy for the wallet hop; T3.5 must decouple `INSTALL_TICKET_TTL_MS`
from the shared constant first; the codeless CTA must precede any `generate` or `resolve` body change;
T3.7 is wallet-then-backend; T1.9 precedes T3.1 and T3.2 by at least one wallet release.

### Shadow mode and kill switches

**No feature-flag mechanism exists** in the backend today; the only precedent is `MIN_VERSION_*`,
captured at module load (`api/common/version.ts`, needs a pod restart).

1. **Shadow mode before every bucket-D flip.** Compute the decision, emit the counter, do not enforce.
   The shape already exists as `verifyProofUnenforced` (`latchedProof.ts:79-123`), and it is the only
   thing that converts an undecidable cutover condition into a measured would-403 rate per merchant
   per caller. It stays for this whole round, because the latch stays.
2. **Three separate env kill switches, read per request** (not at module load):
   `MERGE_PROOF_REQUIRED`, `ENSURE_SDK_PROOF_REQUIRED`, `ENSURE_BARE_ARM_ENABLED`. One flag is wrong —
   the three have different blast radii and different revert urgency. They must be plumbed through
   `infra/gcp/secrets.ts` **and set in `deploy.yml`**, or they revert on the next deploy (the same
   defect that already makes `MIN_VERSION_IOS/ANDROID` silently reset to `0.0.0`).
3. **T3.5 cannot have a client-side kill switch.** `INSTALL_TICKET_TTL_MS` is compiled into the wallet
   bundle and the store binary. Make the *server* ticket TTL an env value, decouple it from
   `pendingActionsStore`, and enforce `clientTTL ≥ serverTTL`.
4. **T3.11 is its own kill switch.** It is two `return null` statements in a surface that redeploys in
   minutes and reaches every merchant page; reverting it is one deploy.
5. **T3.4 needs `merge_execute_target_source{proven,fallback}` first.** The pinned-SDK population is
   currently unmeasured entirely.

### Cutover conditions

Flip on counters, not on a date. `merge_execute_credential{absent_unlatched}` at or near zero,
dimensioned by `merchantId`, is *the* cutover number; `merge_initiate_proofless{source}` (T1.13) at
zero on **all three** sources; `legacy_migration{outcome}` drain rate flat; Gate 2 live with a non-zero
`checkout_token` share on Shopify merchants; `ensure_arm{wallet_bare}` at or near zero before T3.2;
`install_credential_claim_arm` at zero before the degraded Gate 2 path is closed. Minimum 4–8 weeks of
observation after the counters land, ended by those numbers and not by elapsed time. Two SQL queries
size the exposure being traded away:

```sql
SELECT date_trunc('week', created_at), count(*) FILTER (WHERE proof_seen_at IS NOT NULL), count(*)
FROM identity_nodes WHERE identity_type='anonymous_fingerprint' GROUP BY 1;

SELECT count(*) FROM identity_nodes n
WHERE n.identity_type='anonymous_fingerprint' AND n.proof_seen_at IS NULL
  AND EXISTS (SELECT 1 FROM asset_logs a WHERE a.identity_group_id = n.group_id);
```

`x-frak-sdk-version` (T1.10) will be empty for exactly the population being sized, and
`version=unknown` is the cutover number rather than a gap. **Presence-of-proof is the only signal that
exists** — there is no SDK version field at the RPC boundary at all — which is why T1.13 is a
bucket-A item and not an afterthought.

---

## 9. Out of scope, filed separately

Both are real, both are owned elsewhere, and neither belongs inside an admission-control programme.
Recorded here with the decision already taken so nobody re-opens them as part of this work.

**Email nodes — M13, M14, G9 (formerly T2.10).**
An `email` node is written before verification: `register.ts:155-160` calls `linkWalletToFingerprint({email})`
unconditionally with no code sent, and `email.ts:115` attaches on the verification *request*, before
the code goes out. The node is global (not merchant-scoped) and holds a unique slot, so any un-claimed
address can be squatted and its real owner denied verification; `resolveEmail` additionally discloses
`{wallet, authenticatorIds}` for unverified nodes (`AuthenticatorLookupOrchestrator.ts:59`).
**Decision — option C:** keep the address **pending** on an `email_verification_codes` challenge row
(exactly what the rotation path already does), show an **informational prompt on the wallet home
page**, and offer an **invitation to verify in the profile page**. No new step at registration, no
silently dropped address, no screen removed. This also answers OQ6. The client reads that key off
`email` rather than `pendingEmail` (`AddEmailCard/index.tsx:39`, `useWalletSecurityStatus.ts:33`) move
in the same release as the backend change, and a one-off audit of existing unverified email nodes runs
with it. **Filed separately.**

**`asset_logs` wallet pinning — G15 (formerly T2.7, DB5).**
Group membership **is** the payout instruction: rewards attach to an identity group, the payout
address is resolved at settlement through `getWalletForGroup`, and lockups run to 150 days. That is
what turns every admission gap on the map from an attribution problem into a money problem, and it is
worth fixing **even if every merge gap closes**. It was assessed as the **highest value-per-unit-of-risk
item on the map** — and that is precisely why it deserves its own plan, with its own blast-radius
analysis over the settlement path and `IdentityMergeService.mergeGroupsByWallet`'s rewrite of pinned
addresses, rather than a single row inside a programme about request schemas. **Filed separately.**

Also out of scope and already filed elsewhere: `/track/*` and referral-link planting (**G17**,
**G18**) — mandatory proof structurally cannot reach routes that must stay usable by keyless clients,
and an attacker who enumerates client ids becomes referrer-of-record with **no merge at all**;
buyer-writable purchase identity on the Shopify and Magento webhooks (**G14**), which Gate 2's Phase B
residual leans on staying bounded by `coalesce` first-writer-wins; and auth hardening — server
challenges, `signCount`, `jti`/revocation on wallet JWTs, scope enforcement on
`resolveWalletOrSdkSession` (**G21**, **G22**).

---

## 10. Accepted risks

Decisions, not omissions. Each is accepted because closing it costs more surface than the attack is
worth, and because this round optimises for a small surface and low LoC.

| Risk | Why it is accepted |
|---|---|
| **Forgeable purchase claims (G20).** `/user/track/purchase` is unauthenticated and `claimPurchase` performs no existence check on `(orderId, token)`, so a claim row can be written for an order that does not exist | What it buys is **attribution theft**, not takeover: the forged-claim → `/sharing` → `/install` chain is dead at step 2, because `order-client` reads `purchases` only. And it grants nothing `install-code/generate` already grants to anyone holding the same id. Gate 2's resolved-first ordering closes the real-order class; the fabricated-order class needs the claim-age bound, which must land **before** T3.3 |
| **Forgeable checkout tokens.** `checkoutToken` is `Order.checkout_token` — readable by every staff account and every app with `read_orders`, not single-use, non-expiring, not confidential | Its real strength is "merchant-staff-or-better within one merchant", which already removes the cross-merchant zero-cost attack entirely. Gate 2 never lets a caller *name* an id, which is the property that matters (OQ2) |
| **The 10-minute `initiate` window (G7, OQ5).** A captured `frak-merge-v1` mints a token for the victim's group inside that window; the binding stays empty | Filling it needs a server nonce or a two-phase mint — a new route shape and a round trip on the modal path. Exploiting it requires capturing a live proof inside 10 minutes: a sniffing or phishing attack, categorically more sophisticated than the caller-names-an-id attack this programme closes |
| **Merge-token replay inside its window (G4, formerly T1.4).** The 60-minute `?fmt=` token is not consumed on use | Same shape: replay requires capturing the token first. A `consumed_merge_tokens` table plus repo is +95 LoC and a migration against that. T3.6's TTL cut is the cheap half and is retained |
| **A 1–2 hour install ticket rather than a single-use one (T3.5).** A leaked ticket is a bearer capability for that window | Single-use races the passkey ceremony — the ticket is minted when the code is pasted and drained after authentication — and contradicts an in-file invariant at `jwt.ts:56-57`. 1–2 hours covers a human-paced install while cutting today's **7-day** window by two orders of magnitude |
| **A leaked `frak-install-v1` proof costs one id its attribution** (`ensure.ts:101`'s open question, answered) | Keep accepting the install proof directly rather than forcing an exchange for a ticket. Losing one id's attribution is far better than the alternative this programme actually closes: two HTTP calls handing an attacker someone else's attribution |
| **`install-code/generate` stays a latch bypass for any known `anonymousId` until T3.3** | Pre-existing, and it dominates G20 — which is why G20's acceptance is not "the chain is safe". It is the reason T3.3 and the claim-age bound must ship together |

---

## 11. Open questions

Each is a decision for a human, not something to be settled in code review. Answers taken this round
are recorded inline.

**OQ1 — How completely is the permanently-unprovable population written off?**
U2 (no stored key: the legacy population and any id copied to a surface without its key) and U3c
(ids not expressible in the frozen 16-byte field) can never sign. **~70% of users are unmigrated,
covering 20–30% of share links created.**
Options: (i) delete `migrateLegacyIdentity`'s execute arm outright — legacy attribution lost
permanently, and AID-005's alias dies with it; (ii) `frak-migrate-v1` + first-writer-wins on the
legacy node (T2.4) — recoverable by the first client that ever asserts the id from a key-holding
context, which collapses the claim window from *forever* to *once* without proving legacy ownership;
(iii) keep a proofless legacy arm, in which case mandatory proof is narrowed, not achieved.
**Recommendation: (ii)**, with (i) as the fallback if the legacy drain counter shows the residual value
is negligible. (iii) is the status quo with better documentation. **This is the number that gates
T3.1.**

**OQ2 — Does an order-derived credential admit an id that has a key?**
A Shopify buyer whose merchant also runs the web SDK holds a key-holding id, and Gate 2 admits it
without a signature. Options: (a) refuse, losing pre-install attribution for exactly those buyers;
(b) accept, on the reasoning that Gate 2 never lets the caller *name* an id, so the "derived, not
named" property holds; (c) have the storefront theme listener mint the code with its proof and sync
the resulting **code** — not the raw id — into a cart attribute the post-purchase surface can read.
**Recommendation: (b).** The question is not "does this credential beat a ratchet" but "is
order-derivation an acceptable credential class at all" — and if it is not, Gate 2 should not exist.
Keep (c) in reserve; do not take (a) blind.

**OQ3 — `frak-merge-v1`'s 10-minute window versus a long-open modal.**
A proof signed at modal-open expires while the user reads, and signing lazily is not possible from
that context (`mergeTokenQueryOptions.ts:49-56`). Options: (i) a longer window for the empty-binding
`initiate` case specifically; (ii) re-sign on submit via an SDK round-trip; (iii) a separate op with
its own window. **Recommendation: (iii)** if a round-trip is not available — a distinct op keeps the
domain separation that (i) erodes. **This blocks T2.3 only**, and T2.3 is now conditional on T1.13's
counter, so this question may never need answering.

**OQ4 — Is the deferred merge automatic on a later organic merchant visit, and is cross-device install
real?**
Two unmeasured facts that decide the same two items. The deferred merge is suspected to differ by
platform — plausibly automatic on Chrome/Android via the listener's wallet session, plausibly
impossible on iOS/Safari under storage partitioning, which is the same platform where the install code
exists at all. And no route, param, string, doc or test frames the code as desktop→phone; the only
telemetry (`install_code_resolved {has_wallet, merchant_domain}`) does not distinguish the cases.
**Recommendation:** add a same-device signal to `install_code_resolved` before T2.6 makes the code
single-resolve — and if that measurement does not arrive, **drop T2.6**. Instrument the organic-visit
merge before building T3.10. If deferral is automatic on Android and impossible on iOS, T3.10 is an
iOS-only surface. If genuine cross-device use is material, extend `PairingOrchestrator` — never the
code: a live authenticated bidirectional channel lets the device holding the key sign at *redeem*
time, and a one-shot human-carried code structurally cannot.

**OQ5 — How does `/merge/initiate`'s proof get bound to the token it mints? — ANSWERED: it does not,
this round.**
It cannot be bound to `SHA-256(mergeToken)` the way `execute` is: the client signs before the request
and the token does not exist until after enforcement runs (`enforceProof` at
`AnonymousMergeOrchestrator.ts:123`, `resolveAndAssociate` at `:150`, `generateToken` at `:165`).
Options were: (i) a server nonce fetched first; (ii) a two-phase mint; (iii) leave the binding empty.
**Taken: (iii), as an explicitly accepted risk (§10, G7)** — and it must not be described as closed.
T3.1 makes the proof mandatory without filling the binding, and says so.

**OQ6 — Register-with-email, under email-node discipline. — ANSWERED, and moved out of scope.**
Decision: keep the address pending, prompt informationally on the wallet home page, invite
verification from the profile page. Today's flow is preserved exactly, with no screen removed and no
new registration step. Owned by the separate email plan (§9).

**OQ7 — Should `resolveForAttribution` materialise the merchant anonymous node instead of Gate 2? —
ANSWERED: no.**
Doing it in the attribution path would fix S3/S4 for every consumer, but at the cost of writing a
caller-supplied, unauthenticated node on every `track/*` request — a G17 regression at the QPS of the
tracking surface, including a `GET` that would then always write. It also contradicts the
write-discipline invariant pinned at `IdentityOrchestrator.test.ts:86-93`. **Materialise in Gate 2**
(T1.12/T2.5), with a server-minted id, at 1/1000th the write rate and zero blast outside the Shopify
install path. Raise the attribution-path change separately if it is ever wanted, with its own
blast-radius analysis.

**OQ8 — Is `checkoutToken` strong enough to be the sole Gate 2 credential, and is the web pixel's
`localStorage` sandbox-scoped?**
`checkoutToken` equals `Order.checkout_token`: readable by every staff account, every app with
`read_orders`, present in every pixel payload and every order webhook, persisted indefinitely in
`purchases.purchase_token`, not single-use, non-expiring, not confidential. Its real strength is
"merchant-staff-or-better within one merchant", not "buyer". Separately, if `browser.localStorage` in
the web pixel is sandbox-scoped rather than storefront-scoped, S2 is much rarer than it looks and
almost all Shopify traffic sits in S5/S6/S8, which makes deferral load-bearing rather than a tail case.
Neither is answerable from this repo.
**Recommendation:** Phase A on the token alone, Phase B scheduled. Phase A already raises the bar from
"anyone who reads a share link" to "someone with access to that merchant's orders", which removes the
cross-merchant zero-cost attack entirely, and it does not block anything on a Shopify review cycle.
Note the residual Phase B does *not* close: nothing in the session token binds it to a checkout, so a
staff member can still mint for their own shop's orders — a merge-side control, not an admission-side
one. Run a one-off telemetry check on the pixel's claim rate before sizing deferral.

**OQ9 — Does the legacy-node marker survive the latch retirement? — DEFERRED with the retirement.**
T2.4 writes `proof_seen_at` onto the legacy node to make it non-absorbable. The latch is retained this
round, so the marker survives and nothing is lost today. Before DB6 is ever scheduled, decide between
(i) keeping the column for legacy nodes only, (ii) a durable `legacy_claimed_at` column, and (iii)
accepting that legacy aliases become absorbable again. **Recommendation: (ii)** — and note that
T1.14's `frakmint_` value prefix already answers the same question for server-minted ids, for free,
because a value prefix is independent of any column. Decide it before the retirement round, because
retrofitting means a second data migration over the same rows.
