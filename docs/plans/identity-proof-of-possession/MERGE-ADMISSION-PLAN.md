# Merge admission — the plan

**Invariant:** an anonymous identity may only be admitted into a merge by a caller that can
demonstrate possession of that identity's key, or by a credential the backend derives itself from
state the caller cannot write. Naming an id is never sufficient, on any route, for any id.

**Companion:** [`MERGE-SURFACE-MAP.md`](./MERGE-SURFACE-MAP.md) is the reference — where identities
get merged (`M1`–`M20`), what attests each side, and the gap list (`G1`–`G28`). It describes the
surface. This document decides the shape and schedules the work.

**Relationship to [`ROLLOUT.md`](./ROLLOUT.md):** `ROLLOUT.md` frames the flip as gated on the wallet
store binary and `minVersion`. That is true only for `/identity/ensure`'s **wallet** arm, which is the
one caller the Tauri binary actually has. The wallet binary is not a caller of `/merge/*`,
`install-code/*` or the SDK arm of `/identity/ensure`; nothing else in this plan waits on store
approval. `ROLLOUT-STEP-3` remains scheduled and lands ahead of this plan; the map's Q2 records
exactly which rows it closes.

**Naming, so nothing is ambiguous.** `ROLLOUT-STEP-3` is the marker set in the tree and the step in
`ROLLOUT.md`; it is the only thing either document calls a "step". Work items here are tiered
(`T1.x`, `T2.x`, `T3.x`). Migrations are `DB1`–`DB6`. Gaps (`G-*`) and audit findings (`AID-*`) keep
their ids and are owned by the map.

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
with **no `proof` field**. It is byte-identical to `sdk/core/src/actions/migrateLegacyIdentity.ts`,
which posts the same body because no proof can exist for a legacy id, so the backend has no signal
that separates the attack from the legitimate migration.

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
before the signature is even checked. So requiring the proof gives **identical security to removing
the body field**, while keeping the field is backward compatible and removing it would be a breaking
wire change for the published native SDKs at `1.0.0-beta.2` and for any merchant-pinned web build.

The consequence is the whole reason this is affordable: on `/merge/execute`, `/merge/initiate`'s
anon-source arm and `/identity/ensure`'s SDK arm the change is **only** `t.Optional(t.String())` →
`t.String()` on `proof`, and letting the existing verification do the binding. No wire change, no id
re-plumbing, no new derivation helper. The one place a server-side derivation is genuinely needed is
the Shopify `checkoutToken` arm of `install-code/generate`, where the id comes from the order rather
than from a proof (§3).

Once a proof is always present, "the caller named a foreign id" is not a case that can be expressed
on the wire. There is nothing left to latch, no fail-open branch to reason about, and the
case-normalisation hazard on the latch read (`G8`) stops being a silent defeat of enforcement. It
also deletes the `proofPresented ? resolve : findGroupByIdentity` ternary and `TARGET_NOT_FOUND`:
with a proof always present the target is always get-or-create.

### Why not the alternatives

| | (a) Per-gate provenance | **(b) Mandatory proof** | (c) Inverted wallet→merchant consent | (d) Reversed-payload code |
|---|---|---|---|---|
| **Closes** | `install-code/generate` and the ticket downstream of it | the whole caller-named class wherever a key is reachable | the same set as (b), by the same mechanism | the code-carried journeys only |
| **Leaves open** | `/merge/*`, both `ensure` arms, `/track/*`, the webhooks | `ensure`'s bare wallet variant (deletion), `/track/*`, the webhooks, keyless surfaces | everything (b) leaves open, **plus** every journey with no wallet session at hand-off | everything (c) does, and it cannot be minted where it is needed |
| **UX cost** | none | none on screen; a bounded, measurable attribution write-off | **high** — a required return hop on an acquisition funnel | medium-high — moves the paste target to a merchant page |
| **Impl cost** | high: columns, indexes, union lookup, node materialisation, deferral, ticket claim | medium: prerequisites, one schema flip repeated 3×, one union body, telemetry, observation window | all of (b) **plus** a consent-capability table, a return-link builder, a merchant landing contract, a new wallet surface | high: the current `install_codes` shape contradicts a capability token in four ways |
| **Machinery deleted** | almost none | the latch, `enforceLatchedProof`, `verifyProofUnenforced`, `markProofSeen`, `proof_seen_at`, the `ROLLOUT-STEP-3` marker set, the `proofPresented ? …` ternary | nothing (b) does not already delete; **adds** a surface | deletes the `(merchant_id, anonymous_id)` reuse key; adds everything else |

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
is the one shape in the programme that breaks a deployed client on purpose, and it is gated on
`ROLLOUT-STEP-3`, `minVersion` and the `ensure_arm{wallet_bare}` counter.

---

## 3. Gate 2: Shopify without a signature

The Shopify post-purchase and order-status surfaces hold an id and no key: they are a **UI
extension** (`purchase.thank-you.block.render`, `customer-account.order-status.block.render`), not a
classic `Checkout::PostPurchase::Render`, so there is no Shopify-signed input payload of any kind and
a merchant-origin signature is structurally impossible inside the sandbox. Gate 2 is the only design
for that population, and the population is permanent and self-renewing.

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
| S3/S4 pixel claimed with a wallet JWT (± clientId), webhook arrived | yes | set | **often no** — `merge: false` ⇒ `resolveForAttribution` resolves only the anchor and never creates the anonymous node (`IdentityOrchestrator.ts:172-185`, regression-tested) | 404 | resolved, by materialising the node |
| S5 pixel first, webhook not yet arrived | **no** | — | — | 404 | resolved from `purchase_claims` |
| S6 webhook first, no claim, no cart attribute | yes | **NULL** | — | 404 | deferred |
| S7 webhook failed permanently (HMAC mismatch, subscription removed) | no | — | — | 404 forever | deferred, then unattributed |
| S8 pixel never fires (ad-blocker/JS off) and no cart attribute | yes (S6) | NULL forever | — | 404 forever | deferred, then unattributed |
| S9 token mismatch/absent (`purchase_token` is nullable, the lookup is an equality match) | maybe | — | — | 404 | deferred, then unattributed |
| S10 merchant has no `merchant_webhooks` row | — | — | — | 404 | rejected at generate |

Two structural notes. S3/S4 is not a race — waiting longer never fixes it. And the current
`order-client` fallback is anti-correlated with the state that works: `useSharingIdentity` only
queries it when `!immediateClientId`, and `immediateClientId` comes from the same `_frak-client-id`
cart attribute that produces S1. The fallback fires precisely where its best case cannot occur.

### Degradation ladder

Applied in order at `generate`. Constraint: a failed or delayed webhook must never fail install-code
generation for a legitimate buyer.

1. **Union lookup, first hit wins.** `purchases` on `(webhook_id, purchase_token)` **∪**
   `purchase_claims` on `(merchant_id, purchase_token)`. The pixel writes a claim row when the webhook
   has not landed (`PurchaseLinkingOrchestrator.ts:118-127`) and the webhook deletes it on reconcile
   (`PurchaseWebhookOrchestrator.ts:126`), so in steady state exactly one of the two exists and the
   union resolves whichever arrived **first**. This is what makes Gate 2 immune to a late webhook, and
   it covers S1, S2 and S5. Shopify tokens pass `normalizePurchaseToken` untouched (the `wc_order_`
   suffix rule is WooCommerce-only), so the key matches on both sides. `PurchaseClaimRepository` has
   no `(merchantId, purchaseToken)` finder today — its only finder requires `orderId`, which
   `/sharing` does not carry — so one must be added, with an index.
2. **Materialise the merchant-scoped anonymous node** when the resolved group has none (S3/S4).
   `IdentityRepository.addNode` with a server-minted UUID for
   `(group, 'anonymous_fingerprint', merchantId)`. The id is never caller-supplied and never published
   before it exists, so there is no window in which it is claimable. Done *in Gate 2* rather than by
   changing `resolveForAttribution` to always create the node: that behaviour is explicitly
   regression-tested (`IdentityOrchestrator.test.ts:86-93`) and changing it would alter what `track/*`
   writes for every merchant — see OQ7.
3. **Defer resolution to `resolve` time** (S6–S9). Mint the code with `anonymous_id = NULL` and
   `checkout_token` set. The user gets a code; nothing fails. The code lives 72h against a webhook
   whose normal latency is seconds, and realistic time-to-redeem is a store download plus an app open,
   so this converts S6 from "always lost" to "essentially always won". It does nothing for S7/S8/S9,
   which are state failures and not timing failures — do not claim otherwise.
4. **Unattributed.** If `resolve` still cannot resolve the token it returns a terminal `UNRESOLVED`
   outcome. The app proceeds as a fresh identity: new wallet, no pre-install attribution. It must
   **never** fall back to a caller-named `anonymousId`, which would recreate the hole one hop later.

The honest cost of (3): the failure in (4) surfaces *after* the user has installed the app and typed
a code, at maximum sunk cost. Acceptable only because deferral creates codes that do not exist today
— in S6–S9 the wallet sharing page currently resolves no `clientId` at all and renders no code.
Deferral never converts a working path into a failing one.

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

**Open, and carried into §8:** whether `checkoutToken` is strong enough as the sole Gate 2 credential
and whether the web pixel's `localStorage` is sandbox-scoped, which together decide whether deferral
is load-bearing or a tail case (OQ8); whether Gate 2 should admit an id that *does* have a key (OQ2);
and whether node materialisation belongs in the attribution path instead (OQ7).

---

## 4. Database impact

Conventions (`services/bootstrap/AGENTS.md`; `src/migrate-pg.ts:9-27`): three Postgres folders routed
at runtime by `POSTGRES_SCHEMA` / `STAGE` — `local`, `dev`, `prod`. Every schema change needs a
numbered `.sql` in **all three**, a `meta/NNNN_snapshot.json` and a `_journal.json` entry, and they are
human-written — never auto-generated. Next free numbers: `local/0039`, `dev/0043`, `prod/0021`. There
are **no down migrations anywhere**: `migrate-pg.ts` runs drizzle `migrate()` over up-only `.sql`, so
rollback means redeploying an older image against a forward-migrated database. A `dev`-only migration
passes staging and breaks production silently on the next deploy.

| # | Owner | Table | What it changes | Additive / destructive | Backfill | Reversible |
|---|---|---|---|---|---|---|
| **DB1** | T2.1 | `identity_nodes` | lowercase every `anonymous_fingerprint` `identity_value`, to match a `normalizeValue` that now lowercases them | **data migration; destructive to colliding rows** | **REQUIRED, in the same deploy as the code**, with collision resolution — `identity_nodes_unique_identity` is on the **raw** value (`domain/identity/db/schema.ts:80-82`, `nullsNotDistinct`), so a collision is a node *merge*, not an `UPDATE`. Without it every existing mixed-case row becomes unreachable and its attribution is orphaned | **No** — original case is unrecoverable |
| **DB2** | T2.5 | `install_codes`, `purchase_claims` | `ALTER anonymous_id DROP NOT NULL`; `ADD checkout_token`; `CHECK (anonymous_id IS NOT NULL OR checkout_token IS NOT NULL)`; index `(merchant_id, checkout_token)`; index `purchase_claims (merchant_id, purchase_token)` | additive | no | partially — re-adding `NOT NULL` fails once one deferred row exists, and a rolled-back build whose Drizzle schema declares `anonymous_id` `notNull` reads `null` and 500s on the response schema |
| **DB3** | T2.6 | `install_codes` | single-resolve marker (`consumed_at`) | additive | no | yes |
| **DB4** | T1.4 | new `consumed_merge_tokens` (`jti`, `consumed_at`) | new table + index | additive | no | yes — burned tokens do not un-burn, but nothing reads the table on an older image |
| **DB5** | T2.7 | `asset_logs` | wallet address pinned at reward creation when the group already has one | additive | optional | yes |
| **DB6** | T3.9 | `identity_nodes` | `DROP COLUMN proof_seen_at` | **destructive** | n/a | **No — the only one-way door in the programme, and it must be last.** `db.query.identityNodesTable.findFirst` selects the full column list, so after the drop **any** rolled-back image raises `42703` on `findGroupByIdentity` / `findEmailNode` — login, register and tracking, not just merges. Ship it in its own release with a written "no rollback past this point" |

Every migration must be applied before the branch that names the new column is deployed to that
environment; against a database missing it Postgres raises `42703` and the route 500s. The only
ordering guarantee in the infra is `bootstrapJob` → backend (`infra/gcp/backend.ts:181`), so
migrations always precede the backend — but wallet, listener and backend have no relative ordering.

---

## 5. Frontend impact

**Almost all of this programme is business logic with no rendered consequence.** Mandatory `proof` on
the three flip routes is a schema field; the counters are server-side; the migrations are server-side;
Gate 2's union lookup, node materialisation and deferral are server-side. The client edits that exist
are plumbing: carrying `checkoutToken` through `/sharing` → `/install`, sending a proof the client
already knows how to mint, and classifying a retry.

**The one concrete visible difference: a codeless install CTA.** On the **non-Shopify, proofless**
entry into the wallet's own `/sharing` page, `/install` today renders *"Don't lose your {{reward}}!
Copy this code"* with a code beneath it; after `install-code/generate` requires a credential it must
render the download CTA and no code instead of the error
(*"Failed to generate code. Please refresh."*, `packages/wallet-shared/src/i18n/locales/en/translation.json:802`,
which `useGenerateInstallCode.ts:30-32` → `InstallView.tsx:420-423` would otherwise surface, and where
refreshing never helps). That degradation is a **required wallet release shipped before or with**
`T3.3`, never after.

That path has neither credential: `SharingView.tsx:98` calls `buildInstallUrl({merchantId, clientId})`
with no install proof, and `checkoutToken` is present only on the Shopify order-lookup path
(`useSharingIdentity.ts:34-50`). Its live volume is **unmeasured** — that is one of the things the
counters exist to measure, and it is the number that sizes the loss.

**Shopify keeps its attribution.** The post-purchase card already carries `checkoutToken` to
`/sharing` (`PostPurchaseCard.tsx:78-79`); the only work is carrying it through the `/sharing` →
`/install` hop where it is currently dropped, which is Gate 2's four client edits (§3). A Shopify
buyer's install stays attributed.

**The invisible cost, stated plainly: permanently unprovable ids stop being mergeable, silently.**
Legacy ids and non-UUID-shaped ids can never sign — `uuidToBytes` rejects them at
`sdk/core/src/identity/canonical.ts:96-101`, so the frozen 16-byte envelope field cannot even carry
them. Under mandatory proof they can never be a merge source or target again, and because rewards
resolve through `getWalletForGroup` at settlement, such a group becomes permanently **unpayable**, not
merely unattributed. Nothing appears on screen. `T2.4` (`frak-migrate-v1`) narrows this to "the first
client that ever asserts the id from a key-holding context"; the residual is a write-off decision
(OQ1).

**Everything else that could have been visible is avoided, and here is how.**

| Would-be visible change | Cause | How it is avoided |
|---|---|---|
| "Add your email" card reappears and the security card says "no email" while a code is in flight | `T2.10` removes the pre-verification `email` node; `getEmailStatus` then returns `email: null` (`EmailVerificationService.ts:60-63`), and both `AddEmailCard/index.tsx:39` and `useWalletSecurityStatus.ts:33` key off `email` | Switch those two reads to `pendingEmail` **in the same release**. It is `T2.10`'s named prerequisite, not an optional follow-up |
| Merchant-side `useGetUserReferralStatus` turns a 200 into an error for every first-time visitor | "stop creating nodes on a `GET`" (`G17`) taken as resolve-or-404; `referralStatus.ts:15-38` resolves via `resolveSdkIdentity` → `resolveForAttribution`, which creates the anchor node | Resolve-only and return `{isReferred:false}` when no node exists. The response is identical either way — a freshly created group has no referral link. Do **not** 404 |
| Register-with-email either silently drops the address or adds a verification step the user never had | `register.ts:155-160` calls `linkWalletToFingerprint({email})` unconditionally with no code sent, and email-node discipline forbids the write | Undecided — OQ6. A decision, not a defect |
| A hanging spinner on install | — | Cannot happen: `InstallView.tsx:155-170` navigates after `MIN_PROCESSING_MS` in both branches |

**Silent-loss journeys and their mitigation**, because "no screen changed" is not the same as "no user
lost a reward":

| Journey | Cause | Avoidable? |
|---|---|---|
| Deep-link and Play-install-referrer installs — the best-attested install in the system | Deleting `ensure`'s whole wallet arm would take `:105-120` with it, and those installs reach `ensure` directly with a `frak-install-v1` and no ticket | **Yes, at zero security cost:** delete only `:78-88` and `:213-225`, keep the proof branch and make it mandatory (`T3.2`) |
| Queued installs in flight on the day `T3.2` lands | `PendingEnsureAction.anonymousId` is required and `ticket`/`proof` optional (`apps/wallet/app/module/pending-actions/types.ts:5-25`); the store persists for `INSTALL_TICKET_TTL_MS` = 7 days (`pendingActionsStore.ts:12`) | **Mostly:** ship `T1.9` at least one wallet release earlier and flip against `ensure_arm{wallet_bare}` |
| Legacy migration on a merchant-pinned bundle | `migrateLegacyIdentity.ts:105` — `if (executeResponse.status < 500) clearPendingLegacyId()` destroys the marker on a 403 | **Partly:** `T1.9` fixes clients that update; pinned bundles cannot be reached. Size with the client counter and accept explicitly |
| In-app-browser escape on a pinned bundle | `resolveMergeTarget`'s unproven fallback (`lifecycleHandler.ts:232-233`), plus the proven-id branch at `:225-231` which also sends no proof when `sdkIdentity.proofs.merge` is absent | **Partly:** `T1.8` removes the `crypto.subtle` class, `T2.3` gives the listener a real proof. Merchants pinned to a bundle predating `sdkIdentity` on `resolved-config` are not reachable |
| SSO attribution, when the empty bindings are filled (`T3.8`) | The signed message changes; verification is exact-message; `IdentityOrchestrator.ts:236-245` logs and skips the merge while login still succeeds | **Yes:** dual-accept old and new bindings for one full `frak-ensure-v1` lifetime — 30 days |
| Native merge rows held in the outbox, if the merge-token TTL is cut (`T3.6`) | `MergeSender.kt:29-30` `holdTimeoutMillis` is 60 min, hard-coded to mirror the backend; a shorter server token expires before the hold does → 401 → dropped | **Yes:** cut the client hold in the same native release, or do not cut the TTL |

---

## 6. Tiered programme

This is the actionable core. Tier 1 is unconditional. Tier 2 is unconditional *after* a named
prerequisite. Tier 3 requires a decision with a number attached, and only Tier 3 closes an admission
gap. **LoC:** `COUNTED` was read off the tree, `EST` is judged from the function sizes cited.

### Tier 1 — zero UX risk, ship now

Proof obligation per row: *the change either alters only what an attacker can do, or alters nothing
observable in any legitimate flow.*

| # | Item | Closes | Files touched | LoC +/− | Release | Proof of UX-neutrality |
|---|---|---|---|---|---|---|
| T1.1 | Credential-class counters + **shadow decision** at all four routes: `merge_execute_credential{class,merchant,caller}`, `merge_initiate_source{proof_presented}`, `install_code_generate_credential{class}`, `ensure_arm{wallet_ticket,wallet_bare,wallet_proof,sdk}`, `merge_execute_target_source{proven,fallback}`. Ordinary Prometheus counter increments plus log lines on code paths that already run — no behaviour change, no schema, no client work. Emit **inside `latchedProof.ts`**: `enforceLatchedProof` throws on `proof_invalid` (via `verifyOrThrow`, `:47-55`) and on `absent_latched` (`:65-70`) and returns a bare boolean otherwise, so three of the four classes are not observable at the call site | prerequisite for G1/G2/G3/G12; sizes every Tier-3 flip | `infrastructure/telemetry/infraMetrics.ts`, `orchestration/identity/latchedProof.ts`, `orchestration/identity/AnonymousMergeOrchestrator.ts`, `api/user/identity/{ensure,installCode}.ts` | +102/−0 EST | backend-only | Pure observation; no branch changes an outcome. No existing counter can answer any cutover question — `infraMetrics.ts:53-59` ships exactly one identity counter, `identity_proof_checked_total{op,outcome}`, and its own doc admits absence is not recorded |
| T1.2 | Distinct counter + alert on the `WALLET_CONFLICT` branch of `IdentityOrchestrator.linkWalletToFingerprint` (today swallowed at `IdentityOrchestrator.ts:279` with `log.error` only) | **G26** | `orchestration/identity/IdentityOrchestrator.ts`, `infraMetrics.ts` | +18/−0 EST | backend-only | Logging only. `api/user/identity/ensure.ts:288-305` already does exactly this on the same condition; this copies it |
| T1.3 | Make `merge` a required param of `PurchaseLinkingOrchestrator.claimPurchase` (kill `const merge = params.merge ?? true`, `:87`) | **G16** | `orchestration/PurchaseLinkingOrchestrator.ts`, `api/user/track/purchase.ts` | +2/−1 COUNTED | backend-only | One production caller, `api/user/track/purchase.ts:58-69`, already passes `merge: false` explicitly. Every other call site is `PurchaseLinkingOrchestrator.test.ts` — verified by call-site grep, no production behaviour can change |
| T1.4 | Merge-token **consumption**: `jti`/`consumed_at`, burn on first *successful* `execute` | **G4** / AID-003(a) | new `consumed_merge_tokens` table + repo, `domain/identity/services/AnonymousMergeService.ts`, `AnonymousMergeOrchestrator.ts`, `domain/identity/db/schema.ts` | +95/−0 EST | backend-only **+ DB4** | Every live consumer redeems once: `apps/listener/.../lifecycleHandler.ts:311-352` is fire-and-forget with the token already stripped from the URL (AID-012); `sdk/android/.../MergeSender.kt:38-42` returns `Hold` and re-queues rather than re-posting a succeeded row. Burn-on-**success** means a retry after a failure still works |
| T1.5 | Give each identity limiter a distinct `seed` | **G19** part / AID-007 | `api/user/identity/{ensure,installCode,orderClient}.ts` | +3/−3 COUNTED | backend-only | **Strictly looser, not tighter.** `rateLimiter.ts:185` seeds the Elysia plugin on `finalConfig`, which is `{windowMs, maxRequests}` only (`:21-24`); `ensure.ts:244`, `installCode.ts:68` and `orderClient.ts:21` are byte-identical `{60_000, 10}` and all three use the default IP extractor (`rateLimiter.ts:170-183`), so today they collapse into one shared 10/min IP bucket. Separating them gives each its own 10/min |
| T1.6 | Narrow `ensureIdentityKey`'s catch so a `setItem` quota error stops destroying a valid key | **G23** / AID-004 | `sdk/core/src/identity/sign.ts` | +18/−6 EST | web SDK release | Strictly reduces silent identity loss. The `try` at `sign.ts:200-238` wraps three `localStorage.setItem` calls and the catch unconditionally `removeItem(CLIENT_KEY_KEY)`; hoisting the writes out changes no flow shape |
| T1.7 | `getMergeToken.ts:36` → `await sdkConfigStore.resolveMerchantId()` | **G23** / AID-009 | `sdk/core/src/actions/getMergeToken.ts` | +4/−2 COUNTED | web SDK release | Today it signs over `metadata.merchantId ?? ""`, `uuidToBytes` throws (`canonical.ts:97-99`), `signProof` swallows and returns `null` (`sign.ts:264-265`) — the field is dead. Making it work only adds a proof to a call that already succeeds. **Must land after T1.6**: a now-valid proof latches the id (`AnonymousMergeOrchestrator.ts:158`) and `markProofSeen` never clears (`IdentityRepository.ts:125-131`) |
| T1.8 | `hashMergeToken` → `@noble/hashes` fallback when `crypto.subtle` is absent | untracked | `sdk/core/src/clients/createIFrameFrakClient.ts:331-342` | +8/−2 EST | web SDK release | Purely additive: today it returns `undefined` on a non-secure-context page and `buildSdkIdentity` omits the merge proof entirely (`:368-381`), while `signProof` *does* fall back to pure JS (`sign.ts:44-52`). Adding it can only produce a proof where none existed |
| T1.9 | Retry classification: treat `PROOF_REQUIRED`/`PROOF_OR_TOKEN_REQUIRED` as non-retryable in `drainEnsures#isNonRetryable`, and stop `migrateLegacyIdentity` clearing its marker on a 403 | AID-016; prerequisite for T3.1/T3.2 | `apps/wallet/app/module/pending-actions/drainEnsures.ts:23-27`, `sdk/core/src/actions/migrateLegacyIdentity.ts:105` | +14/−4 COUNTED | wallet + web SDK release | Today `isNonRetryable` matches only `WALLET_ALREADY_LINKED`, so any other 4xx re-fires for the full 7-day queue TTL; and `migrateLegacyIdentity.ts:105` permanently orphans a legacy id on any 403. Both changes only affect requests that already fail |
| T1.10 | Emit `x-frak-sdk-version` from `sdk/core` | prerequisite for the cutover conditions | `sdk/core/src/actions/{ensureIdentity,migrateLegacyIdentity}.ts`, RPC client | +14/−0 EST | web SDK release | Header-only. The backend already accepts and logs it (`infrastructure/macro/session.ts:68`, `index.ts:65`) with no consumer. Verified absent from `sdk/core` entirely; only `FrakSdkVersion.kt:15` and `FrakSDKVersion.swift:11` set it |
| T1.11 | Doc corrections in `README.md` and `ROLLOUT.md`: the validity-window drift (AID-014), the stale prod-migration line, and AID-018's two false claims | — | `README.md`, `ROLLOUT.md` | +25/−40 EST | n/a | Docs only. `README.md:101-102` says `frak-merge-v1` ±2 min / `frak-ensure-v1` 90 days; the tree ships 600 s and 30 days (`IdentityProofService.ts:24-33`). `README.md:164` says "`prod` still needs its generated migration"; `services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql` is in the tree |

**Tier 1 totals — source ≈ +278 / −18 (net +260); tests ≈ +415 / −10; docs +25 / −40. One migration
(DB4). One backend deploy plus one web SDK release plus one wallet release.** Nothing waits on a store
submission or `minVersion`.

### Tier 2 — zero UX risk *after* a named prerequisite

| # | Item | Closes | Prerequisite | Files touched | LoC +/− | Release | Proof of UX-neutrality (once the prereq holds) |
|---|---|---|---|---|---|---|---|
| T2.1 | Add `anonymous_fingerprint` to `IdentityRepository.normalizeValue` (`:31-38`, currently `return value`) | **G8** / AID-006 | **Run the mixed-case audit query and ship the backfill (DB1) in the same deploy** | `IdentityRepository.ts` | +2/−1 COUNTED | backend-only **+ DB1** | Neutral **only with the backfill**. `identity_nodes_unique_identity` is on the raw value (`domain/identity/db/schema.ts:80-82`, `nullsNotDistinct`), so lowercasing lookups without a backfill makes every existing mixed-case row unreachable and silently orphans its group |
| T2.2 | Alarm — not a gate — when `/merge/execute` redeems a token minted from a wallet session and presents no target proof | instrumentation for **G2**; closes nothing | T1.1 | `AnonymousMergeOrchestrator.ts` | +20/−0 EST | backend-only | Counter and log only. **It must not be shipped as an enforcement branch:** `api/user/identity/merge.ts:19-24` passes **both** `sourceAnonymousId` and `sourceWalletAddress`, so an attacker supplies their own derived id plus a valid proof for it and the predicate never fires. It closes a code path, not an outcome — only T3.1 closes the outcome |
| T2.3 | **Add** an empty-binding `frak-merge-v1` proof to `resolved-config` and have `mergeTokenQueryOptions` send it (do *not* yet delete anything) | **G11** | OQ3 settled (`frak-merge-v1`'s 10-min window vs a modal left open) **and** an `sdk/core` release, because the wallet origin holds no key | `sdk/core/src/{identity/types.ts,clients/createIFrameFrakClient.ts}`, `apps/listener/.../lifecycleHandler.ts`, `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts`, `IdentityProofService.ts` (`PROOF_WINDOW_SECONDS` is an exhaustive `Record<ProofOp, number>` — a new op is a compile error until updated), golden fixtures | +85/−4 EST | **sdk/core + listener + wallet** | Purely additive: the backend arm is latch-gated and fail-open today (`latchedProof.ts:59-73`), so sending a proof where none was sent can only move a call from "allowed unproven" to "allowed proven" |
| T2.4 | `frak-migrate-v1` signed by the derived key over **both** ids, with the old proofless `execute` arm left open; copy `proof_seen_at` onto the legacy node on success so it stays resolvable for published `fCtx` links and is no longer absorbable | **G27** / AID-005 | The backend must **accept** the op in an earlier, separate merge than the SDK that emits it | `sdk/core/src/{identity/types.ts,actions/migrateLegacyIdentity.ts}`, `IdentityProofService.ts`, `AnonymousMergeOrchestrator.ts`, `IdentityRepository.ts`, golden fixtures | +83/−6 EST | backend + web SDK | Both arms open at once, so no client is stranded. **If the ordering is reversed**, an unknown op makes `PROOF_WINDOW_SECONDS[op]` `undefined`, `isFresh` returns `false` (`IdentityProofService.ts:41-45`) and every migration silently reports "expired". Note the interaction with T3.9: the first-writer-wins marker this buys lives in the column T3.9 drops — see OQ9 |
| T2.5 | Gate 2 Phase A: `{merchantId, checkoutToken}` arm, union lookup over `purchases ∪ purchase_claims`, node materialisation, deferral, then the four wallet edits that carry `checkoutToken` from `/sharing` to `/install` | **G12** | A **new orchestrator** — the union lookup crosses identity → purchases, and root `AGENTS.md` forbids `service → service` | `domain/identity/db/schema.ts`, `InstallCodeRepository.ts` (73-line hand-written CTE at `:24-96`), `InstallCodeService.ts`, **new** `orchestration/identity/InstallCredentialOrchestrator.ts`, `api/user/identity/installCode.ts`, wallet `/sharing` → `/install` hop | +302/−0 EST | backend, then wallet **+ DB2** | Purely additive: it only *adds* a second way to mint a code. Nothing that mints today stops minting |
| T2.6 | Install code single-resolve | **G3** residual / AID-019 | OQ4 measured: a same-device signal on `install_code_resolved` reads ≈0 cross-device. **Falls to Tier 3 if it does not** | `InstallCodeRepository.ts`, `InstallCodeService.ts` | +15/−0 EST | backend-only **+ DB3** | Neutral only if genuine cross-device use is nil. Today `CODE_TTL_HOURS = 72` with `MAX_RESOLVE_ATTEMPTS = 20`, and the code is reused across page reloads by the `create` CTE |
| T2.7 | Bind `asset_logs` to the wallet resolved **at reward creation when one already exists** | **G15** (cheap half) | `IdentityMergeService.mergeGroupsByWallet` must rewrite pinned addresses | `domain/…/asset_logs` schema + settlement path | +40/−0 EST *(not traced — the highest-uncertainty row here)* | backend-only **+ DB5** | For walletless pre-install groups behaviour is unchanged — still resolved at settlement via `getWalletForGroup`. For wallet-bearing groups the address is identical unless the group's wallet changed, which is either the attack or `M15`. **Highest value-per-risk item in the programme; do it early** |
| T2.8 | `weightCache` invalidation on wallet attach | **G25** / AID-010 | The conflict surface must be mounted on the standalone `/install` entrypoint (AID-011) — today `EnsureConflictToast` is mounted only in `apps/wallet/app/routes/_wallet.tsx` | `IdentityWeightService`, `IdentityRepository` | +12/−0 EST | backend-only | Neutral *only* with the prereq: without it, a user with two wallets who today merges silently inside the 30 s cache window now gets a 409 with nowhere to show it |
| T2.9 | `GET /pairings/find/:id` → `withWalletAuthent`, **keep** `pairingCode` in the response | **G28** | Confirm `usePairingInfo` fires only after the session resolves | `api/user/wallet/pairing/management.ts:10-45` | +4/−0 EST | backend-only | The consumer already sits behind `_protected-fullscreen` and auto-fills the code (`apps/wallet/app/routes/_wallet/_protected-fullscreen/pairing.tsx`). Dropping the field would not be neutral — it forces the user to type a code the app fills today |
| T2.10 | Email node discipline: no `email` node before verification (route the register-supplied address into an `email_verification_codes` challenge row, as the rotation path already does); `resolveEmail` disclosure gated on `verifiedAt` | **G9** | The two `email`-keyed client reads must switch to `pendingEmail` **in the same release**; OQ6 answered | `api/user/wallet/auth/email.ts:110-120`, `EmailVerificationService.ts:45-64`, `orchestration/identity/AuthenticatorLookupOrchestrator.ts`, `apps/wallet/app/module/wallet/component/AddEmailCard/index.tsx:39`, `apps/wallet/app/module/settings/hook/useWalletSecurityStatus.ts:33` | +72/−24 EST | backend + wallet | Without the prereq the "Add your email" card reappears while a code is in flight (§5). A one-off audit of existing unverified email nodes is needed — they hold global unique slots today |

**Tier 2 totals — source ≈ +635 / −35 (net +600); tests ≈ +865 / −0. Four migrations (DB1, DB2, DB3,
DB5). Backend + one wallet release + one `sdk/core` release.**

**What Tiers 1 and 2 do *not* close, stated plainly: every admission gap.** One-call capture via
`ensure`'s bare wallet variant (**G1**) still works with only an attacker wallet JWT; two-call capture
via `/merge/execute` (**G2**) still works; install-ticket laundering (**G3**) still works; referral
planting (**G18**) and buyer-writable purchase identity (**G14**) are untouched by design. What they
buy is measurement, one closed bearer capability, the amplifier fix (T2.7 — what turns a capture from
*money* back into *attribution*), and every prerequisite the flips need: roughly 15% of the risk
reduction and 100% of the ability to make the remaining 85% a decision rather than a gamble.

### Tier 3 — requires a real trade-off

| # | Item | Closes | Files touched | LoC +/− | Release | The trade-off, quantified |
|---|---|---|---|---|---|---|
| T3.1 | `proof` **required** on `/merge/execute` and on `/merge/initiate`'s anon-source arm, in the same deploy — flipping one leaves the merge capturable from the other direction. Two schema fields; the body ids stay and the existing `id_mismatch` check binds them | **G2** fully, **G13** source half | `api/user/identity/merge.ts` (schema), `AnonymousMergeOrchestrator.ts` (the `proofPresented ? resolve : find` ternary and `TARGET_NOT_FOUND`, `:220-242`) | +20/−31 (removal COUNTED) | backend-only | **U2/U3c ids can never be a merge source or target again**, and because rewards resolve through `getWalletForGroup` at settlement such a group becomes permanently unpayable. Gated on T2.4 or every legacy migration 403s. Note it does **not** fill `initiate`'s binding — see OQ5 |
| T3.2 | `/identity/ensure`, both arms in one deploy. **SDK arm:** `proof` optional → required, one schema field (§2). **Wallet arm:** `frak-install-v1` required; **delete only the proofless variant** (`ensure.ts:78-88`) and the header fallback (`:213-225`), keeping and enforcing the proof branch at `:105-120` | **G1**, and the `ensure` half of **G5** exposure | `api/user/identity/ensure.ts`, `apps/wallet/app/module/pending-actions/{types,drainEnsures,pendingActionsStore}.ts` | +40/−70 EST src; wallet +12/−5 | backend + wallet, `ROLLOUT-STEP-3`-gated | Every queued ensure holding neither ticket nor proof 400s for its remaining TTL. `pendingActionsStore.ts:12` sets `DEFAULT_ENSURE_TTL_MS = INSTALL_TICKET_TTL_MS` = **7 days**, so the write-off window is one week of in-flight users on deploy day. T1.9 first |
| T3.3 | `install-code/generate` becomes the union body of §2: proof required on the SDK arm, `checkoutToken` on the Gate 2 arm, bare `{merchantId, anonymousId}` rejected 400 | **G3** admission half | `api/user/identity/installCode.ts`, `InstallView.tsx` (codeless CTA) | +55/−12 EST | backend + wallet | Kills the **non-Shopify** wallet `/sharing` → `/install` path outright; Gate 2 does not reach it (§5). The codeless CTA must ship in the preceding wallet release or the same one, never after |
| T3.4 | Delete `resolveMergeTarget`'s unproven fallback **and** fix the proven-id branch that also sends no proof | **G10** | `apps/listener/.../lifecycleHandler.ts:216-234` | +6/−8 COUNTED | listener release | The in-app-browser escape stops merging for merchant-pinned SDKs — permanently, since the listener updates and the merchant bundle never does. One shot, no retry (AID-012). Needs `merge_execute_target_source{proven,fallback}` first; that population is unmeasured |
| T3.5 | Install-ticket TTL cut + single-use | **G3** residual / AID-019 | `packages/app-essentials/src/constants/installTicket.ts`, `infrastructure/external/jwt.ts`, `InstallCodeService.ts`, wallet queue | +46/−7 EST | **backend + wallet, coordinated** | Races the passkey ceremony: `useResolveInstallCode` mints the ticket when the code is pasted, `useExecutePendingActions` drains it *after* authentication. "Minutes" loses attribution for anyone who pauses, backgrounds or fails a passkey, and single-use contradicts an in-file invariant (`jwt.ts:56-57`, "would deadlock the wallet's retry loop"). Choose the TTL from the measured resolve→register latency, and stop `INSTALL_TICKET_TTL_MS` being a shared client constant first. **Hard prerequisite of T3.3**, not a parallel track: a stolen code is still a capture of the id it was minted for |
| T3.6 | Merge-token TTL cut | AID-003(b) | `infrastructure/external/jwt.ts`, native `MergeSender.{kt,swift}` | +3/−3 EST | backend + native | The `?fmt=` escape is put **on the clipboard** for the user to paste into another browser (`packages/wallet-shared/src/common/component/InAppBrowserToast/index.tsx:47,65`) — a human-paced hop. Native holds rows for 60 min hard-coded to mirror the backend (`MergeSender.kt:29-30`); cutting the server side alone drops them at 401 |
| T3.7 | Drop `anonymousId` from `install-code/resolve`'s 200 body | **G19** | `api/user/identity/installCode.ts:105-118`, `useResolveInstallCode.ts` | +8/−7 COUNTED | backend + wallet, `minVersion`-gated | `ResolveResult.anonymousId` is a **required** field in the shipped Tauri binary's typed result (`useResolveInstallCode.ts:10-18`), and `:56-58` states in-file it is kept "so the store remains readable by a rolled-back build" |
| T3.8 | Fill the empty bindings on `frak-ensure-v1` and `frak-sso-v1` (the wallet address or the SDK JWT `jti`; the wallet or credential id) | **G5**, **G6** | `sdk/core` signing sites, `IdentityProofService.ts`, backend callers | +75/−0 EST | backend + SDK | Changes the signed message. A merchant on a pinned bundle signs the old layout, verification fails, and the merge is **silently skipped** (`IdentityOrchestrator.ts:236-245`) while login still succeeds. Needs a dual-accept window of one full `frak-ensure-v1` lifetime — **30 days** |
| T3.9 | Retire the latch: delete `latchedProof.ts` (`enforceLatchedProof` and `verifyProofUnenforced`), `markProofSeen` and its **six** call sites — `ensure.ts:114`, `ensure.ts:151`, `installCode.ts:33`, `AnonymousMergeOrchestrator.ts:158`, `AnonymousMergeOrchestrator.ts:247`, `IdentityOrchestrator.ts:254` — plus `findNodeByIdentity` (`IdentityRepository.ts:100-122`), whose only production caller is `latchedProof.ts:60`; remove the `ROLLOUT-STEP-3` markers (16 occurrences across 10 non-doc files); drop `proof_seen_at` | — | those files; `domain/identity/db/schema.ts:77`; `README.md` §2; `ROLLOUT.md` | **−334 / +20** COUNTED | backend-only **+ DB6, destructive** | One-way door (§4). The regression signal is that `walletConflict.test.ts` and `mergeTieBreak.test.ts` pass **unmodified** — verified, they contain zero references to `markProofSeen`, `proofSeenAt` or the latch. `IdentityOrchestrator.test.ts` is **not** part of that signal: `:276` and `:338` assert `markProofSeen` was called, so it must change with the `IdentityOrchestrator.ts:254` call site |
| T3.10 | Optional post-install recovery CTA — the inverted flow, offered and never required | degradation for Gate 2's `UNRESOLVED` and the null-`signProof` arms | a wallet surface + `mergeTokenQueryOptions`'s wallet arm | +60/−0 EST | wallet release | Never on the critical path of an install funnel; shown only when a recoverable unmerged group is known to exist, and only for a merchant with a domain on record. Whether it is a nicety or the only path is OQ4-adjacent and platform-dependent (§8) |

**Tier 3 totals — source ≈ +345 / −481 (net −136); tests ≈ +770 / −685. One migration (DB6).** This is
the only tier that is net-deleting and the only tier that closes an admission gap.

### Programme totals

| | Added | Removed | Net |
|---|---|---|---|
| **Tier 1** source | ~278 | ~18 | **+260** |
| **Tier 2** source | ~635 | ~35 | **+600** |
| **Tier 3** source | ~345 | ~481 | **−136** |
| **Hand-written source, all tiers** | **~1,258** | **~534** | **+724** |
| Tests | ~2,050 | ~695 | **+1,355** |
| Docs (`README.md` §2 rewritten; `ROLLOUT.md` retired at T3.9, 105 lines) | ~25 | ~145 | **−120** |
| SQL migration files (6 migrations × 3 folders) | ~55 | 0 | +55 |
| Generated drizzle snapshots (6 × 3 = 18 files; `dev/meta/0040_snapshot.json` is 3,575 lines, `prod/meta/0020_snapshot.json` 3,603) | ~64,000 | 0 | +64,000 |

**The programme is a net addition of roughly +724 hand-written source lines and +1,355 test lines.**
It is net-deleting only at T3.9, which is last and gated behind everything above it.

### Test impact

| Suite | Change | Basis |
|---|---|---|
| `AnonymousMergeOrchestrator.test.ts` (503) | **10 of 17 cases assert latch/proofless behaviour** (`:102, :121, :146, :181, :316, :336, :430-447`, plus the `findNodeByIdentity` mocks at `:77, :107, :251, :276, :384`) ⇒ ~−200/+180 at T3.1. `:248` *"allows an unlatched legacy id as a merge target with no proof"* is rewritten — that is the intended regression signal | COUNTED |
| `test/api/user/identity/ensure.test.ts` (669) | the whole `"the live Tauri binary's request shape"` describe (`:142`) plus 5 of 8 `"resolution order"` cases (`:221, :242, :274, :395`) pin the bare variant ⇒ ~−200/+120 at T3.2 | COUNTED |
| `test/api/user/identity/merge.test.ts` (337) | ~7 of 12 cases ⇒ ~−120/+130 at T3.1 | EST |
| `IdentityOrchestrator.test.ts` (409) | **must be modified at T3.9** — `:276` and `:338` assert `markProofSeen` was called | COUNTED |
| `walletConflict.test.ts` (183), `mergeTieBreak.test.ts` (109) | **pass unmodified** — zero references to `markProofSeen`, `proofSeenAt` or the latch | COUNTED |
| `test/api/user/identity/installCode.test.ts` (252) | Gate 2's cases: webhook-late (claim row only), webhook-never (deferred row, generation must not fail), S3/S4 materialisation with no merge, `{merchantId, checkoutToken, anonymousId}` → 400, reuse on `(merchantId, checkoutToken)`, `UNRESOLVED` with no ticket minted | EST |
| New: `IdentityRepository.test.ts` | **does not exist**; T2.1's normalisation case needs a new file, ~+60 | COUNTED (absent from the test-file list) |
| New: request-level limiter suite over the composed `identityApi` | mirrors `api/user/track/index.test.ts`, ~+90 | EST |
| `buildInstallUrl.test.ts`, `apps/wallet/app/entry/shared/search.test.ts`, `routes/sharing.test.ts` | `checkoutToken` survives every hop from `/sharing` to `parseInstallSearch`; these three already pin the round-trip and are the single source of truth for it | COUNTED |
| Native | **no Kotlin/Swift source change** for a new op — `ProofCodec.kt` maps only install+merge and tolerates unmapped ops — **but both native CI suites iterate the whole golden corpus**, so a new fixture is consumed by Android and iOS CI | verified shape |

---

## 7. Rollout constraints

### In-flight credentials, by TTL

| Credential | TTL | Anchor |
|---|---|---|
| install code | 72 h, reused if >6 h remain | `InstallCodeRepository.ts` `CODE_TTL_HOURS`, `REUSE_MIN_REMAINING_HOURS` |
| install ticket | **7 days**, "Not single-use" | `packages/app-essentials/src/constants/installTicket.ts:6`; `infrastructure/external/jwt.ts:56-65` |
| pending ensure action (client `localStorage`) | **7 days**, same constant | `pendingActionsStore.ts:12` |
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
- **Hard-fail populations:** the shipped Tauri binary at T3.2 (`ensure.ts:78-80` says in-file it is
  "kept only because the installed Tauri binary POSTs exactly this shape"); pre-ticket binaries at
  T3.7.
- **Genuinely unaffected:** native `MergeSender` under mandatory proof — it mints a proof on every
  attempt and returns `Hold` when signing yields null; `sdk/legacy` (touches no identity route);
  `/track/*`.

### Per-item rollback

| Item | Verdict |
|---|---|
| T1.1–T1.3, T1.5–T1.11 | **Clean.** Code-only, revertible |
| T1.4 | Partially irreversible — burned tokens do not un-burn |
| T2.1 | **Reversible in code, data-orphaning while live** unless DB1 ships in the same deploy |
| T2.4 | **Irreversible per user** where it writes `proof_seen_at` onto legacy nodes: `markProofSeen` never clears (`IdentityRepository.ts:125-131`), so after a rollback those nodes require a proof they can never produce |
| T2.5 | **Irreversible once one deferred row exists** — a rolled-back build whose Drizzle schema declares `anonymous_id` `notNull` reads `null` and 500s on the response schema |
| T3.1–T3.4 | Code-only, cleanly revertible — but attribution lost in the window is unrecoverable, and reverting still needs a full deploy |
| T3.9 | **One-way door, total identity outage on rollback.** ≥1 full release after the last reader, with a written "no rollback past this point" |

**Deploy ordering.** One `sst deploy --stage gcp-{staging,production}` per push to `dev`/`main`
deploys backend, wallet, listener and shopify **together**, and the only ordering guarantee is
`bootstrapJob` → backend. The web SDK ships on a separate pipeline (Changesets → npm + jsDelivr), so a
single push touching both `services/backend` and `sdk/core` fires both workflows **concurrently** —
which is why T2.4's "backend accepts before SDK emits" must be two separate merges. Also: T2.5 is
backend + all three migrations, then a *separate* deploy for the wallet hop; T3.5 must decouple
`INSTALL_TICKET_TTL_MS` from the shared constant first; the codeless CTA must precede any `generate`
or `resolve` body change; T3.9 ships alone.

### Shadow mode and kill switches

**No feature-flag mechanism exists** in the backend today; the only precedent is `MIN_VERSION_*`,
captured at module load (`api/common/version.ts`, needs a pod restart).

1. **Shadow mode before every Tier-3 flip.** Compute the decision, emit the counter, do not enforce.
   The shape already exists as `verifyProofUnenforced` (`latchedProof.ts:79-123`), and it is the only
   thing that converts an undecidable cutover condition into a measured would-403 rate per merchant
   per caller. Adopt it as the generic pre-flip shape and keep it until T3.9 removes its subject.
2. **Three separate env kill switches, read per request** (not at module load):
   `MERGE_PROOF_REQUIRED`, `ENSURE_SDK_PROOF_REQUIRED`, `ENSURE_BARE_ARM_ENABLED`. One flag is wrong —
   the three have different blast radii and different revert urgency. They must be plumbed through
   `infra/gcp/secrets.ts` **and set in `deploy.yml`**, or they revert on the next deploy (the same
   defect that already makes `MIN_VERSION_IOS/ANDROID` silently reset to `0.0.0`).
3. **T3.5 cannot have a client-side kill switch.** `INSTALL_TICKET_TTL_MS` is compiled into the wallet
   bundle and the store binary. Make the *server* ticket TTL an env value, decouple it from
   `pendingActionsStore`, and enforce `clientTTL ≥ serverTTL`.
4. **T3.4 needs `merge_execute_target_source{proven,fallback}` first.** The pinned-SDK population is
   currently unmeasured entirely.
5. **T3.9 needs no switch — it needs a written point of no return.**

### Cutover conditions

Flip on counters, not on a date. `merge_execute_credential{absent_unlatched}` at or near zero,
dimensioned by `merchantId`, is *the* cutover number; `merge_initiate_source{proof_presented}` at
~100%; `legacy_migration{outcome}` drain rate flat; Gate 2 live with a non-zero `checkout_token` share
on Shopify merchants; `ensure_arm{wallet_bare}` at or near zero before T3.2. Minimum 4–8 weeks of
observation after the counters land, ended by those numbers and not by elapsed time. Two SQL queries
size the exposure being traded away:

```sql
SELECT date_trunc('week', created_at), count(*) FILTER (WHERE proof_seen_at IS NOT NULL), count(*)
FROM identity_nodes WHERE identity_type='anonymous_fingerprint' GROUP BY 1;

SELECT count(*) FROM identity_nodes n
WHERE n.identity_type='anonymous_fingerprint' AND n.proof_seen_at IS NULL
  AND EXISTS (SELECT 1 FROM asset_logs a WHERE a.identity_group_id = n.group_id);
```

Until T1.10 ships, the `x-frak-sdk-version` dimension is empty for exactly the population being sized,
and `version=unknown` is the cutover number rather than a gap.

---

## 8. Open questions

Each is a decision for a human, not something to be settled in code review.

**OQ1 — How completely is the permanently-unprovable population written off?**
U2 (no stored key: the legacy population and any id copied to a surface without its key) and U3c
(ids not expressible in the frozen 16-byte field) can never sign.
Options: (i) delete `migrateLegacyIdentity`'s execute arm outright — legacy attribution lost
permanently, and AID-005's alias dies with it; (ii) `frak-migrate-v1` + first-writer-wins on the
legacy node (T2.4) — recoverable by the first client that ever asserts the id from a key-holding
context, which collapses the claim window from *forever* to *once* without proving legacy ownership;
(iii) keep a proofless legacy arm, in which case mandatory proof is narrowed, not achieved.
**Recommendation: (ii)**, with (i) as the fallback if the legacy drain counter shows the residual value
is negligible. (iii) is the status quo with better documentation.

**OQ2 — Does an order-derived credential admit an id that has a key?**
A Shopify buyer whose merchant also runs the web SDK holds a key-holding id, and Gate 2 admits it
without a signature. Options: (a) refuse, losing pre-install attribution for exactly those buyers;
(b) accept, on the reasoning that Gate 2 never lets the caller *name* an id, so the "derived, not
named" property holds; (c) have the storefront theme listener mint the code with its proof and sync
the resulting **code** — not the raw id — into a cart attribute the post-purchase surface can read.
**Recommendation: (b).** With no latch in the picture the question is not "does this credential beat a
ratchet" but "is order-derivation an acceptable credential class at all" — and if it is not, Gate 2
should not exist. Keep (c) in reserve; do not take (a) blind.

**OQ3 — `frak-merge-v1`'s 10-minute window versus a long-open modal.**
A proof signed at modal-open expires while the user reads, and signing lazily is not possible from
that context (`mergeTokenQueryOptions.ts:49-56`). Options: (i) a longer window for the empty-binding
`initiate` case specifically; (ii) re-sign on submit via an SDK round-trip; (iii) a separate op with
its own window. **Recommendation: (iii)** if a round-trip is not available — a distinct op keeps the
domain separation that (i) erodes. Whether (ii) is reachable from the listener modal was not settled.
**This blocks T2.3.**

**OQ4 — Is the deferred merge automatic on a later organic merchant visit, and is cross-device install
real?**
Two unmeasured facts that decide the same two items. The deferred merge is suspected to differ by
platform — plausibly automatic on Chrome/Android via the listener's wallet session, plausibly
impossible on iOS/Safari under storage partitioning, which is the same platform where the install code
exists at all. And no route, param, string, doc or test frames the code as desktop→phone; the only
telemetry (`install_code_resolved {has_wallet, merchant_domain}`) does not distinguish the cases.
**Recommendation:** add a same-device signal to `install_code_resolved` before T2.6 makes the code
single-resolve, and instrument the organic-visit merge before building T3.10. If the deferral is
automatic on Android and impossible on iOS, T3.10 is an iOS-only surface and should be scoped as one.
If genuine cross-device use is material, extend `PairingOrchestrator` — never the code: a live
authenticated bidirectional channel lets the device holding the key sign at *redeem* time, and a
one-shot human-carried code structurally cannot.

**OQ5 — How does `/merge/initiate`'s proof get bound to the token it mints?**
It cannot be bound to `SHA-256(mergeToken)` the way `execute` is: the client signs before the request
and the token does not exist until after enforcement runs (`enforceProof` at
`AnonymousMergeOrchestrator.ts:123`, `resolveAndAssociate` at `:150`, `generateToken` at `:165`).
Options: (i) a server nonce fetched first, which is a new route shape and a round trip on the modal
path; (ii) a two-phase mint (reserve, then sign over the reservation); (iii) leave the binding empty
and accept that a captured 10-minute `initiate` proof can mint a token for the victim's group (G7).
**Recommendation:** (ii) if the modal round trip is acceptable, else (i); (iii) is the status quo and
must not be described as closed. Either way it is a separate change from T3.1, which is why T3.1 does
not claim it.

**OQ6 — Register-with-email, under email-node discipline.**
`register.ts:155-160` calls `linkWalletToFingerprint({email})` unconditionally, with no code sent.
Under T2.10 the node cannot be written before verification, so either the address is silently dropped
at registration or the user gains a verification step they did not have. Options: (a) drop the address
and prompt for it later in settings; (b) write a challenge row at registration and send the code
immediately, adding a step; (c) keep the address on the challenge row silently and surface it as
`pendingEmail` with no code until the user asks.
**Recommendation: (c)** — it preserves today's flow exactly and is the only option with no screen
change; (b) is defensible if the product wants verified email at registration.

**OQ7 — Should `resolveForAttribution` materialise the merchant anonymous node instead of Gate 2?**
Doing it in the attribution path fixes S3/S4 for every consumer and removes a class of permanently
missing nodes; it also changes what `/track/purchase` writes for every merchant and contradicts an
explicit regression test (`IdentityOrchestrator.test.ts:86-93`).
**Recommendation:** materialise in Gate 2 for now, and raise the attribution-path change separately
with its own blast-radius analysis. Do not fold a tracking-path behaviour change into an
admission-control plan.

**OQ8 — Is `checkoutToken` strong enough to be the sole Gate 2 credential, and is the web pixel's
`localStorage` sandbox-scoped?**
`checkoutToken` equals `Order.checkout_token`: readable by every staff account, every app with
`read_orders`, present in every pixel payload and every order webhook, persisted indefinitely in
`purchases.purchase_token`, not single-use, non-expiring, not confidential. Its real strength is
"merchant-staff-or-better within one merchant", not "buyer". Separately, if
`browser.localStorage` in the web pixel is sandbox-scoped rather than storefront-scoped, S2 is much
rarer than it looks and almost all Shopify traffic sits in S5/S6/S8, which makes deferral load-bearing
rather than a tail case. Neither is answerable from this repo.
**Recommendation:** Phase A on the token alone, Phase B scheduled. Phase A already raises the bar from
"anyone who reads a share link" to "someone with access to that merchant's orders", which removes the
cross-merchant zero-cost attack entirely, and it does not block anything on a Shopify review cycle.
Note the residual Phase B does *not* close: nothing in the session token binds it to a checkout, so a
staff member can still mint for their own shop's orders — a merge-side control, not an admission-side
one. Run a one-off telemetry check on the pixel's claim rate before sizing deferral.

**OQ9 — Does the legacy-node marker survive the latch retirement?**
T2.4 writes `proof_seen_at` onto the legacy node to make it non-absorbable; T3.9 drops the column,
which silently reverts that property. Options: (i) keep the column for legacy nodes only; (ii) give
the marker its own durable column (`legacy_claimed_at`) written by T2.4 from the start; (iii) accept
that legacy aliases become absorbable again after T3.9.
**Recommendation: (ii)** — decide it *before* T2.4 ships, because retrofitting means a second data
migration over the same rows.

### Not covered by this plan, and it does not claim to be

`/track/*` and referral-link planting (**G17**, **G18**) — mandatory proof structurally cannot reach
routes that must stay usable by keyless clients, and an attacker who enumerates client ids becomes
referrer-of-record with **no merge at all**. Buyer-writable purchase identity on the Shopify and
Magento webhooks (**G14**) — the same "caller names an id" shape on the webhook side, bounded today
only by `coalesce` first-writer-wins, and Gate 2's Phase B residual leans on it staying bounded; scope
it before Phase B. Pre-claiming against guessed order tokens (**G20**). Auth hardening — server
challenges, `signCount`, `jti`/revocation on wallet JWTs, scope enforcement on
`resolveWalletOrSdkSession` (**G21**, **G22**). Each needs its own plan; none should be folded into
this one.
