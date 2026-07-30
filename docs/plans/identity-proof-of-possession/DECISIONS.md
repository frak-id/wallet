# Implementation decisions — identity proof-of-possession (phases 0 → 4a)

Companion to [`README.md`](./README.md). This file records every decision taken during
implementation, every divergence from the plan, and why.

**Branch:** `feat/identity-proof-of-possession`
**Scope:** Phase 0, 1, 2, 3, 4a. Phase 4b/5/6 are out of scope.

---

## 1. Corrections to the plan (found before writing code)

### 1.1 🔴 §3.9 misses two of three merge sites — BLOCKER

The plan states that `track/*` reaches the merge machinery through
`resolveSdkIdentity → resolveAndAssociate` (`sdkIdentity.ts`). That is one of **three**
sites. `POST /user/track/purchase` takes the same `x-frak-client-id` +
`x-wallet-sdk-auth` header pair and reaches the merge machinery twice more:

| # | Site | Reached from |
|---|---|---|
| 1 | `resolveSdkIdentity` → `resolveAndAssociate` (`sdkIdentity.ts:110`) | `/track/interaction`, `/merchant/referral-status` |
| 2 | `claimPurchase` → `resolveAndAssociate` (`PurchaseLinkingOrchestrator.ts:80`) | `/track/purchase` |
| 3 | `reconcileWithExistingPurchase` → `associate` (`PurchaseLinkingOrchestrator.ts:132`) | `/track/purchase` |

Fixing only site 1 would leave the headline single-request attack fully open on
`/track/purchase`. **All three are fixed.** See §2.2 below.

> **This enumeration was itself incomplete.** The sweep covered `track/*` and
> `/track/purchase` only; the wallet auth routes are a fourth merge surface and remain
> unprotected. See §1.5.

### 1.2 🔴 §3.6's rate-limit key does not behave as the plan implies — BLOCKER

`rateLimitMiddleware`'s `keyExtractor` returning `null` **skips the limiter entirely**
(`rateLimiter.ts:196` — `if (key === null) return;`). It does *not* fall back to IP. A
naive `(merchantId, clientId)` extractor therefore leaves every header-less request
completely unlimited — worse than today, because it *looks* protected.

Two further traps:

- Elysia dedupes plugins by `name` + `seed`, and `seed` is `finalConfig`, which
  **excludes `keyExtractor`** (`rateLimiter.ts:186-191`). Two stacked limiters sharing
  `windowMs`/`maxRequests` silently collapse into one. They **must** differ numerically.
- The store is in-memory per-pod, so with N replicas the effective limit is N×. The plan
  notes this for §3.3 but not §3.6.

**Decision:** stack two limiters with deliberately different configs — an identity-keyed
bucket (`track:{merchantId}:{clientId}`, 120/min) and an IP-keyed catch-all (300/min).
Unit-test the extractor + store directly, not over HTTP (`isRunningLocally` short-circuits
`consume()` in tests).

### 1.3 🔴 Two more attribution-mutating writes on `/track/purchase` — found during audit

Removing the merge from `claimPurchase` was not sufficient. Two further writes on the
same unauthenticated path still let a caller take over someone else's attribution, both
found while auditing the workers' output, neither in the plan:

- **`reconcileWithExistingPurchase` repointed the purchase row.** With the merge skipped,
  control fell through to `updateIdentityGroup`, overwriting `purchase.identityGroupId`
  with the caller's group. Same theft, no merge required. Fixed: the stored attribution is
  kept and the interaction is recorded against it.
- **`claimPurchase` rebound the purchase *claim*.** When the webhook has not landed yet,
  the claim row's `claimingIdentityGroupId` is what the webhook later reads to attribute
  the purchase. `PurchaseClaimRepository.upsert` overwrote it unconditionally, so whoever
  called `/track/purchase` last won. Fixed: the SDK arm is first-claim-wins
  (`onConflictDoNothing`, returning the existing claim); the trusted webhook path keeps
  rebinding.

Lesson recorded because it generalises: **"stop merging" is not the same as "stop
mutating attribution"**. Every write reachable from an unauthenticated route that decides
which identity group owns a record has to be audited, not just the calls into the merge
machinery. Both of these sat one and two steps downstream of the merge call the plan named.

### 1.4 🟠 §3.3 per-code limiting is not implementable as specified

The plan concedes "per-code limiting needs shared state to mean anything", then schedules
it in Phase 1 as a code change. With the in-memory store, a limit of 5 across 3 pods is 15.

**Decision:** ship the *durable* version — an `attempts` counter on the `install_codes`
row. There is an exact in-repo precedent: the sibling `email_verification_codes` table
already carries `attempts: integer("attempts").notNull().default(0)` with the documented
rationale *"`attempts` caps brute-force"* (`identity/db/schema.ts:177`). `install_codes` is
the one code table missing it. Correct across replicas, no Redis, one column on a table we
are already touching. Folded into the same DDL request as `proof_seen_at`.

---

### 1.5 🔴 The auth routes are a fourth merge surface, and they carry no proof — UNRESOLVED

> **Status: ✅ FIXED.** New `frak-sso-v1` op (10-minute window, empty binding). `openSso`
> signs it; it rides the compressed SSO URL as `pf`, is stashed in the **in-memory**
> `ssoContext` (never `clientIdStore`, which is persistent, TTL-less and replayed
> ambiently), travels in the login/register body, and is verified in
> `linkWalletToFingerprint` before the fingerprint node is built.
>
> **Opportunistic, never fatal**: valid ⇒ merge; invalid ⇒ no merge + warn; absent ⇒ no
> merge, no error. Login can never break, so old Tauri binaries (which send no proof) keep
> working and fall back to `/identity/ensure`. `markProofSeen` is gated on actual
> verification. Plan: `MERGE-SURFACE-CLEANUP.md` (C3).
>
> An earlier draft proposed deleting this merge as redundant with `/identity/ensure`. That
> was **rejected**: the eager SSO merge carries a product capability — linking the reward
> history of a referee who never created a wallet to the wallet they create via SSO, so a
> merchant's "See my rewards" page works immediately.
>
> `recover.ts` no longer reads `x-frak-client-id` at all — it never passed a `merchantId`,
> so it never merged; removing it kills the latent hazard permanently.

§1.1 above corrected the plan from one merge site to three. That audit swept `track/*`
and `/track/purchase` only. It missed a fourth surface: **the wallet auth routes**.

```
login.ts:62,125            ─┐
register.ts:154            ─┼→ linkWalletToFingerprint({ walletAddress, clientId, merchantId })
RecoveryClaimOrchestrator  ─┘        └→ resolveAndAssociate([wallet, anonymous_fingerprint])
  .ts:155                                   └→ mergeService.mergeGroups(...)   ← real merge
```

All three read `clientId` from the `x-frak-client-id` header and reach
`mergeGroups`. None calls `enforceLatchedProof`, which landed on exactly two arms
(`/merge/initiate`, `/identity/ensure`).

Note the asymmetry with `resolveForAttribution` (`IdentityOrchestrator.ts:157-177`), which
was *deliberately* hardened — its comment states a forged header "can then only
mis-attribute into the forger's own group, never move anyone else's group — `mergeGroups`
is never called from this path." The auth path has the opposite property: it **does** call
`mergeGroups`. An attacker who plants a victim's `clientId` and then registers a fresh
wallet pulls the victim's anonymous group into their own — and registration mints the
session, so no pre-existing wallet is needed.

**Why SSO makes this the softest injection point.** The wallet cannot read the merchant
site's `localStorage`, so the SDK ships the anonymous id across the origin boundary inside
the compressed `?p=` payload (`cId`, `sso.ts:87`). `/sso` stores it
(`sso.tsx:96-98`) into `clientIdStore`, and `backendClient.ts:35` then attaches it as
`x-frak-client-id` on **every** subsequent wallet→backend call for the rest of the
session. `cId` is attacker-controlled plaintext in a base64 blob in a URL, with no
signature over the payload.

That last point is the actual structural problem, and it is worth stating plainly:
**`clientIdStore` is sticky and ambient.** It is set once and then rides along on
unrelated requests. The three call sites above did not ask for a `clientId`; they just
read a header that the transport layer attaches unconditionally.

**Which of the three are actually reachable** — checked, because "reads the header" and
"performs a merge" are not the same claim:

| Site | Sends `merchantId`? | Merge reachable? |
|---|---|---|
| `login.ts:62,125` | yes | **yes** |
| `register.ts:154` | yes (`cleanMerchantId`) | **yes** |
| `RecoveryClaimOrchestrator.ts:155` | **no** | **no** — inert |

`linkWalletToFingerprint` only appends the `anonymous_fingerprint` node when
`clientId && merchantId` are *both* present (`IdentityOrchestrator.ts:204`). Recovery
passes only `clientId`, so the node is never built and the call degrades to a
single-node `resolveAndAssociate` — no merge. The header on the recovery path is
therefore **inert today, and arguably should never have been plumbed**: the recovery flow
has no merchant context and no reason to carry a merchant-scoped anonymous id. It is
load-bearing only as a latent hazard — anyone adding a `merchantId` there later silently
activates a merge on a binary-reachable route.

**Why this cannot be fixed the way the other arms were.** `enforceLatchedProof` needs the
proof to travel with the id. On the SDK arm the proof rides the request body. Here the id
crosses via a URL the SDK generates but the *wallet* consumes, and the signing key lives
in the merchant page's `localStorage` — the wallet origin cannot mint a proof for it. The
proof would have to be generated SDK-side in `generateSsoUrl` and carried as a fourth
compressed field, then forwarded by the wallet as a header. That runs straight into the
same unsolved shape as `TODO(merge-initiate-proof)`: a ±2min proof window versus an SSO
popup the user can leave open indefinitely.

**Not verified by test.** The attack is derived from reading the call graph; no failing
test reproduces it yet. Treat the severity as argued, not demonstrated.

Smaller adjacent finding: `useSsoLink.ts:47` passes `clientId ?? ""`, sending an
empty-string id rather than omitting the field.

### 1.6 🔴 Pairing WS `originNode` — a fifth merge surface, unauthenticated — UNRESOLVED

> **Status: ✅ FIXED.** `originNode` deleted end-to-end (producers, transport, server
> parsing, persistence, and the merge in `handleJoin`). `PairingOrchestrator` no longer
> depends on `IdentityOrchestrator` at all, so even a legacy DB row that still carries an
> `origin_node` value cannot trigger a merge. The `origin_node` column has since been
> dropped as well (`drizzle/local/0036`, `drizzle/dev/0040`); `prod` still needs its own
> generated migration before this branch is promoted there.
>
> The link it used to make is still established afterwards, proof-gated, by
> `/identity/ensure`. Plan: `MERGE-SURFACE-CLEANUP.md` (C2).

**This is the most exposed of the merge surfaces found so far**, because unlike §1.5 it
needs no wallet registration and the identity node is passed *directly* rather than
inferred from a header.

`GET /user/wallet/pairing/ws` (`api/user/wallet/pairing/ws.ts:44`) accepts an
`originNode` query param: base64 JSON deserialised straight into an `IdentityNode` by
`PairingOrchestrator.parseOriginNode` (`:119-125`) — a bare `JSON.parse` with **no
signature, no ownership check, no `enforceLatchedProof`**. `handleInitiate` (`:139`)
stores it verbatim on the pairing row.

On a successful join, `PairingOrchestrator.ts:453-458` calls:

```ts
resolveAndAssociate([{ type: "wallet", value: wallet.address }, pairing.originNode])
```

Two distinct groups ⇒ `IdentityOrchestrator.ts:142` ⇒ `mergeGroups`. The attacker's own
wallet is one node; a **victim's** `anonymous_fingerprint` (or `email`) is the other.

Why the existing guards don't stop it:

- **`checkWalletPriority`** (`IdentityWeightService.ts:187-200`) only fires when *both*
  sides already carry a wallet. A forged fingerprint/email node has none, so the
  conflict guard never triggers.
- **`authenticatorHints` pinning** (`PairingOrchestrator.ts:399-406`) is opt-in and set
  by the *initiator* — i.e. the attacker, who simply omits it.
- **Rate limiting** is 10/min per IP (`ws.ts:12`), which bounds throughput, not the
  attack.
- `action=initiate` requires **no authentication at all**; only the later `join` needs a
  valid wallet JWT, and *any* wallet works — notably the attacker's own.

The legitimate producer confirms the shape: `SsoButton.tsx:213-222` builds `originNode`
from `resolvingContext.clientId` client-side, with no proof attached.

**Severity vs §1.5:** §1.5 requires registering a wallet with a planted header. This
requires only opening a WebSocket with a chosen JSON blob, then joining with any wallet.
**Not verified by exploit test** — derived from source, same caveat as §1.5.

### 1.7 🟠 Webhook cart-attribute purchase attribution is last-writer-wins

> **Status: ✅ FIXED.** `upsertWithItems` now wraps the conflict-update in
> `coalesce(purchases.identity_group_id, <new>)`, making attribution first-writer-wins.
> Plan: `MERGE-SURFACE-CLEANUP.md` (C1).

§1.3 fixed two attribution repoints on `/track/purchase`, but a third entry point into
the same class of write was not enumerated.

`PurchaseWebhookOrchestrator.upsertWithCartAttributeIdentity`
(`PurchaseWebhookOrchestrator.ts:160-183`) resolves the `_frak-client-id` Shopify cart
attribute (`shopifyWebhook.ts:90`; Magento equivalent `magentoWebhook.ts:63`) to a group
and writes it onto the purchase row via `PurchaseRepository.upsertWithItems`
(`PurchaseRepository.ts:42-57`), whose `onConflictDoUpdate` includes:

```ts
...(identityGroupId ? { identityGroupId } : {})
```

No check that the row already carries a *different* `identityGroupId` — unlike the now-
guarded `reconcileWithExistingPurchase` (§1.3). Shopify and Magento fire `orders/updated`
repeatedly (capture, fulfilment, refund), so **every redelivery re-overwrites the
attribution**, last-writer-wins.

The webhook *envelope* is HMAC-verified, so this is not remotely forgeable. But the cart
attribute *inside* it is written client-side by the storefront SDK at checkout, so it
carries exactly the same no-proof weakness as the header — relayed through Shopify
instead of sent directly.

Bounded: it repoints one purchase row, it is not a graph merge, and it costs the attacker
a real paid order. The fix is the §1.3 guard applied here — skip the overwrite when the
row already has a non-null, different group.

**Confirmed intact while sweeping:** both §1.3 fixes still hold — `merge` is hard-coded
`false` at `purchase.ts:86`, and `PurchaseClaimRepository.upsert` (`:38-53`) still gates
`onConflictDoUpdate` behind `rebindExisting`.

### 1.8 ✅ Merge surfaces checked and found inert

Recorded so the next sweep does not re-derive them:

| Path | Why it cannot merge |
|---|---|
| `/track/purchase` → `claimPurchase` | `merge: false` hard-coded (`purchase.ts:86`); both merge branches guarded |
| `/track/interaction`, `/merchant/referral-status` | `sdkIdentity.ts` uses `resolveForAttribution` only — never `resolveAndAssociate` |
| Webhooks → `PurchaseWebhookOrchestrator.ts:177` | single-element node array ⇒ `IdentityOrchestrator.ts:118-124` short-circuits before `mergeGroups` (the *attribution write* is still an issue — §1.7) |
| `RecoveryClaimOrchestrator.ts:155` | no `merchantId` ⇒ the `clientId && merchantId` guard at `IdentityOrchestrator.ts:204` never builds the node |
| `/wallet/merge/{settle,preview}` | wallet↔wallet only; proof is a WebAuthn signature, no `clientId` enters |
| `referrerClientId` on arrival | read-only group lookup (`ArrivalHandler.ts:160`), no write gated on it |
| `ReferralService.registerReferral` | explicit first-referrer-wins (`ReferralService.ts:39-51`) |
| `IdentityRepository.addNode` / `markProofSeen` | `onConflictDoNothing` / `isNull(proofSeenAt)` one-way latch |

Also confirmed: `FrakClientIdHeaderSchema` is **not** applied globally — every route opts
in explicitly (`commonApiSchemas.ts:24-27`). The ambient-attachment problem noted in §1.5
is on the *client* (`backendClient.ts:35`), not the server.

## 2. Architecture decisions

### 2.1 Shared canonical crypto lives in `@frak-labs/core-sdk/identity`

The frozen byte layout (§2.3) and derivation (§2.1) must be byte-identical in the SDK
(sign) and the backend (verify), and both must assert the same golden fixtures. Anything
less than one source of truth reproduces the §8 failure mode the plan exists to prevent.

`packages/app-essentials` is **private**; `sdk/core` is **published** — so shared code
cannot live in app-essentials. The direction must be `sdk/core → backend`, and that
already has a precedent: `ExplorerOrchestrator.ts` imports `@frak-labs/core-sdk/rewards`,
and `services/backend/package.json` already depends on `@frak-labs/core-sdk` as
`workspace:*`.

```
sdk/core/src/identity/
├── canonical.ts   # PURE, no crypto. Byte layout, RFC-4122 twiddle, base64url,
│                  # proof envelope encode/decode. THE frozen artifact.
├── derive.ts      # deriveClientId(pubkeyUncompressed) — SHA-256 + canonical
├── sign.ts        # BROWSER ONLY — keygen, raw hex key persistence, signProof.
│                  # @noble is not a conditional fallback module — sign.ts imports
│                  # both @noble/curves/webcrypto.js (WebCrypto-backed) and
│                  # @noble/curves/nist.js (pure JS) unconditionally and picks one at sign time.
├── verify.ts      # BACKEND ONLY — WebCrypto verify, never imports @noble
├── types.ts
├── index.ts
└── fixtures/golden-proofs.json
```

Why the split into `sign.ts` / `verify.ts` rather than one module: it gives tree-shaking a
clean seam so verification code never reaches the browser bundle.

**Bundle-safety rules (enforced by a guard test):**

- `sign.ts` must never import `verify.ts`.
- No file under `sdk/core/src/{config,clients,actions,utils,bundle.ts}` may import
  `identity/verify` or the `identity/index.ts` barrel — browser code imports
  `identity/canonical` and `identity/sign` by **deep path**.
- `identity` is added to the **NPM** entry map in `tsdown.config.ts` only, never to the
  CDN IIFE block (whose sole entry is `bundle.ts`).

The backend resolves `@frak-labs/core-sdk/identity` to **TypeScript source**, because
`bunfig.toml` sets `conditions = ["development", "import"]` and the export map has a
`development` condition. No build step, no stale artifacts. `services/backend/build.ts`
uses `packages: "bundle"`, so the source is inlined into the binary — no runtime dep.
`dependency-cruiser` sets `doNotFollow: { path: "node_modules" }`, so the import is
invisible to `arch:check` — no layering violation, no rule edits.

`verify.ts` uses **WebCrypto only** (native under Bun). `@noble/curves` stays a
browser-fallback concern and never enters the backend.

### 2.2 Golden fixtures: one file, three consumers, frozen private keys

`sdk/core/src/identity/fixtures/golden-proofs.json` is the Phase 0 deliverable, generated
by a committed, re-runnable script (`sdk/core/scripts/generate-golden-proofs.ts`) with
**hardcoded test-only private keys**. A fixture file regenerated with fresh randomness on
each run is not a golden fixture — it is a round-trip test, which §8 explicitly calls
insufficient.

Asserted by `canonical.test.ts`, `verify.test.ts`, and the backend's
`IdentityProofService.test.ts` — the last imports the **same JSON**, so divergence is
impossible by construction. Native (Phase 6) reads the same repo path. Never copy it.

### 2.3 Backend placement

Proof verification is pure, single-domain and stateless → a **domain service**. Policy
needing identity-graph state (the latch) is a **repository read** consumed by the
**orchestrator**. Routes carry zero policy.

| File | Action |
|---|---|
| `domain/identity/services/IdentityProofService.ts` | new — stateless verify + per-op windows |
| `domain/identity/context.ts` | wire `services.identityProof` |
| `domain/identity/repositories/IdentityRepository.ts` | add `findNodeByIdentity`, `markProofSeen` |
| `orchestration/identity/AnonymousMergeOrchestrator.ts` | enforcement lives here |
| `orchestration/identity/IdentityOrchestrator.ts` | add `resolveForAttribution` (§3.9) |
| `api/user/identity/{merge,ensure}.ts` | parse + forward `proof`, nothing else |

`IdentityProofService` must **not** import `IdentityRepository` — it stays pure and
trivially unit-testable with no DB mock.

`ensure.ts` is the one justified exception to "orchestrator owns policy": it already calls
`identity.resolveAndAssociate` directly and has no dedicated orchestrator. Verifying there
is cheaper than inventing an `EnsureOrchestrator` for one call site. Documented inline.

**Enforcement ordering is load-bearing** — one private method, reused by both merge arms:

```
enforceProof(op, anonymousId, merchantId, proof, binding?):
  1. proof present → verify; invalid ⇒ 403 PROOF_INVALID; valid ⇒ markProofSeen; return
  2. proof absent  → read node; node.proofSeenAt set ⇒ 403 PROOF_REQUIRED; else allow
```

The latch read happens **only when the proof is absent**. On the proven path — the future
steady state — there is zero extra query, and verification is pure CPU (~100 µs).

### 2.4 §3.9 — `resolveForAttribution`, and all three merge sites

One new method on `IdentityOrchestrator`:

```ts
/**
 * Resolve nodes to a single attribution group WITHOUT merging (§3.9).
 * Precedence: the authenticated wallet's group when present, else the
 * anonymous fingerprint's. A forged client id can then only mis-attribute
 * into the forger's own group, never move anyone else's.
 */
async resolveForAttribution(nodes: IdentityNode[]): Promise<{ groupId: string }>
```

Two intentional properties:

- It **still calls `resolve`**, which creates the group when absent. That is required — a
  brand-new anonymous visitor hitting `/track/interaction` must get a group. Creation is
  safe; *reassignment* is the attack.
- It resolves **one node, not all**. Resolving the non-anchor node would create a group we
  immediately discard — a write on every request for no benefit. Strictly faster than
  today: one query-or-insert instead of N plus weight computation.

Sites 2 and 3 are closed with a `merge?: boolean` (default `true`) on
`ClaimPurchaseParams`, passed `false` **only** from `api/user/track/purchase.ts`. The
webhook path (`PurchaseWebhookOrchestrator`) is server-to-server and keeps merging.
Rejected: making `claimPurchase` unconditionally non-merging — it is also called from
trusted flows where merging is correct.

### 2.5 `proof_seen_at`, not `proofSeen`

Same storage cost, same one-way-latch semantics (`IS NOT NULL`), but it records *when* —
the difference between "this id is latched" and "we can investigate the §2.6
conflicting-migration alarm". It also matches the table's existing idiom exactly
(`unlinkedAt`, `verifiedAt` are both nullable timestamps).

Nullable, no default, no new index — `findNodeByIdentity` hits the existing unique
constraint `(identity_type, identity_value, merchant_id)`.

**Migration handling.** `services/backend/AGENTS.md` says migrations are db-team-owned.
That rule forbids authoring files under `services/bootstrap/drizzle/`, not declaring
columns in `domain/*/db/schema.ts` — the schema file is the domain's source of truth and
is what `db:generate` derives SQL from. So: **declare the column, write no migration**,
and file the exact DDL in [`DB-MIGRATION-REQUEST.md`](./DB-MIGRATION-REQUEST.md).

Requested at the **start of Phase 1**, not Phase 4a — the column is inert until written,
and Phase 4a enforcement is otherwise blocked on db-team lead time.

---

## 3. Divergences from the plan

| # | Plan says | We do | Why |
|---|---|---|---|
| D1 | §3.9 fixes `sdkIdentity.ts` | also fix `PurchaseLinkingOrchestrator` (4 sites total) | §1.1 + §1.3 — the plan is incomplete; shipping only site 1 leaves the headline attack open on `/track/purchase` |
| D2 | §3.6 rate-limit by `(merchantId, clientId)` | **two stacked limiters**, identity-keyed + IP catch-all, with different `maxRequests` | §1.2 — a lone identity extractor limits nothing for header-less callers, and identical configs collapse via Elysia's plugin dedupe |
| D3 | §3.3 per-code attempt limiting via the rate limiter | durable `attempts` column on `install_codes` | §1.3 — the in-memory store is per-pod; §5 leans on §3.3 as *the* interim mitigation, so it has to actually work |
| D4 | §4.6 `proofSeen` boolean | `proof_seen_at` nullable timestamp | §2.5 — same cost, makes the §2.6 alarm investigable, matches table idiom |
| D5 | §2.2 `frak-ensure-v1` window = 90 days | **30 days** | The 90-day justification is the install→forget→reopen funnel, which runs on the **wallet** arm — and that arm carries a *ticket*, not this proof, capped at the 7-day `DEFAULT_ENSURE_TTL_MS`. The SDK arm signs in place at call time, so a long window buys nothing and only extends bearer exposure. Windows are backend **policy**, not frozen wire format, so this stays revisable after native ships. |
| D6 | §2.6 legacy→derived migration merge, in Phase 2 | deferred out of phases 0–4a, then **shipped after 4a with derive-before-boot ordering** | See §3.1 below |
| D7 | §2.2 backend verifies via a shared SDK `verify.ts` | **verification lives only in the backend** (`IdentityProofService`) | The SDK never verifies anything, so shipping a verifier in it is dead weight on every merchant page and a wider public surface for no gain. What is genuinely shared — and what the golden fixtures pin — is the canonical byte layout and the derivation, which both sides must agree on to the byte. Signing is the SDK's job; verifying is the backend's. Also removes the need for the bundle-isolation test that existed only to keep `verify.ts` out of the browser build. |
| D8 | §2.4 accepts the pure-JS fallback's bundle weight | **embed `@noble/curves`, do not stub it out of the CDN build** | See §3.3 below |
| D9 | §7 Phase 4a: "a legacy id may be a merge target but never a merge source" | source arm is **latch-gated**, like the target arm (reverted from a brief unconditional detour — see §3.4) | See §3.4 below |
| D10 | §5 install proof reaches `/identity/ensure` via a `generate`+`resolve` ticket exchange | **forwarded on the existing arm** as a `frak-install-v1` proof, no exchange, no extra round-trip | See §3.5 below |

### 3.1 D6 — deferring the §2.6 migration merge *(now shipped — see 3.1.1)*

The plan has the SDK auto-run `merge/initiate` + `merge/execute` on every existing
client's next visit, to fold their legacy id into the newly derived one. It then spends a
full subsection establishing that this is unsolvable ("the migration is itself the
attack") and accepting the risk.

**We ship derivation for new clients only** (no `frak-client-id` present). Existing legacy
ids keep working untouched, as merge *targets*, exactly as today.

> Superseded by §3.1.1 — derivation now also runs for existing clients, folding the legacy
> id in via a background merge. The reasoning below is kept because it explains why the
> migration was *not* shipped in Phase 2, which is still correct.

Reasons, in order:

1. **It adds attack surface during the worst possible window.** The migration is an
   unauthenticated-by-construction merge, shipped in Phase 2 — before Phase 4a enforcement
   is live. It hands attackers a new, legitimate, fully-valid code path against precisely
   the population the plan admits it cannot protect.
2. **The benefit is narrow.** Continuity of one merchant's attribution for users who
   already have a legacy id — an id which, per §2.6, stays claimable forever either way.
3. **It is the largest avoidable LoC block in scope**: an async retry path, a failure
   path, next-page-load id flip semantics, the atomicity trap, *and* the
   conflicting-migration alarm (which per §9.3 currently has no destination anyway).
4. **Nothing later depends on it.** A proven-source migration merge becomes *enforceable*
   after Phase 4a, so revisiting it later is strictly better than shipping it now.

Not a scope cut for convenience — it removes code **and** improves the security posture.
To revisit after Phase 4a; tracked here, not lost.

### 3.1.1 D6 revisited — the migration ships, with different ordering

Revisited as planned, once latch-gating landed. Every deferral reason above has either
expired or was answered by a change in ordering:

1. *"Adds attack surface before enforcement is live"* — **expired.** `/merge/initiate`'s
   `sourceAnonymousId` arm now verifies a `frak-merge-v1` proof, so the migration's source
   side is proven. It is no longer an unauthenticated-by-construction merge.
2. *"The benefit is narrow"* — unchanged, and accepted. It buys continuity of one
   merchant's attribution.
3. *"Largest avoidable LoC block"* — **mostly dissolved by the new ordering** (below):
   there is no next-page-load flip semantics and no id-desync case to handle. What remains
   is one action file plus a retry marker. The conflicting-migration alarm is still not
   built — §9.3 gives it no destination — so it stays out.
4. *"Nothing later depends on it"* — **inverted.** Enforcing proofs across the SDK and
   listener surface *does* now depend on it: until legacy ids are migrated, the population
   that structurally cannot sign is every pre-derivation client, and enforcing against them
   is what the dual-arm work exists to prevent. The migration is the prerequisite that
   shrinks that population to ≈ 0.

**Divergence from README §2.6: the id flips immediately, not on the next page load.**

§2.6 defers the flip because `getClientId()` is synchronous while the merge is async, so
flipping mid-session would desynchronise the SDK from the listener's `clientIdStore`
(seeded from the `?clientId=` iframe param at load) and from any share link already
rendered on the page.

That constraint only exists if the merge has to finish before the flip. It does not:
keygen and derivation are purely local (`localStorage` + WebCrypto, ~1–3 ms, no network) —
only the merge needs the backend. So `ensureIdentityKey` derives over the legacy id
*before* `createIframe` sets `iframe.src`, and the merge runs afterwards, unawaited. The
listener is seeded with the derived id from its first line of code and never observes the
legacy one. Nothing to reload, no desync, no next-page-load semantics.

This was considered and rejected as a variant that flips the cache and reloads the iframe:
`createIFrameLifecycleManager`'s `isConnectedDeferred` resolves once and never resets, so
swapping `iframe.src` would leave `client.request()`'s connection gate open against a
reloading frame; and a full teardown/recreate strands the client references held by
`window.FrakSetup.client` and by merchant code. Deriving first avoids the entire problem.

**Optimistic, with a durable retry marker.** The flip is not conditional on the merge
succeeding. A failure leaves the legacy id *orphaned* — still resolving on the backend,
just not yet linked — so the two histories stay split until a retry succeeds. The legacy
id is written to `localStorage["frak-client-id-legacy"]` **before** the flip (so a crash
between the two writes cannot lose it) and cleared only on a confirmed merge, or on a 4xx
that retrying could never fix. 5xx and network errors keep the marker and retry next visit.

Accepted risk, unchanged from §2.6 and unfixable: the merge proves `newId` but nothing
about `legacyId`, so an attacker can run the identical valid migration against any
harvested legacy id. First-come-first-served. Judged acceptable at current volumes — few
live merchants, almost no sharing traffic.

| File | Change |
|---|---|
| `sdk/core/src/identity/sign.ts` | derive over a stored legacy id instead of returning it untouched; write + expose the `frak-client-id-legacy` marker |
| `sdk/core/src/actions/migrateLegacyIdentity.ts` | new — `initiate` (proven source) → `execute` (unproven legacy target), marker cleared only on confirmation |
| `sdk/core/src/config/clientId.ts` | `initClientId` schedules the migration, deliberately unawaited |

### 3.3 D8 — `@noble/curves` ships in the CDN bundle

The IIFE/CDN format cannot code-split: a single `<script>` tag has no module loader, so a
dynamic `import()` gets inlined. A first pass therefore aliased the fallback to a throwing
stub on the CDN target, keeping that bundle small at the cost of HTTP merchants silently
degrading to an unprovable legacy id.

**Superseded — the dual-signer abstraction that motivated a lazy split is gone.** An
earlier revision of this decision argued the cost was acceptable because
`@frak-labs/components` code-splits `@noble/curves` into its own lazy chunk (~13 KB gzip),
fetched only by non-secure-context clients, while everyone else paid nothing. That
reasoning no longer applies: `sign.ts` was rewritten to drop the bespoke
`Signer`/`Keypair`/`getSigner`-probe/keypair-cache abstraction and instead import
`@noble/curves/webcrypto.js` and `@noble/curves/nist.js` directly, both **statically**.
Verified against the built ESM output — the published chunk now contains a plain
`import{p256 as r}from"@noble/curves/webcrypto.js"`, not a `await import(...)`. `@noble/curves`
now ships in the entry chunk for every consumer, secure context or not. There is no more
lazy path to point to.

**Accepted anyway, on different grounds.** The eager load is a real, unconditional cost —
not free, and this section previously implied it was. It is accepted because collapsing two
independent signer implementations (a hand-rolled WebCrypto path and a hand-rolled noble
path, reconciled through a JWK interchange format and a low-S normaliser) into one path that
uses noble for both backends made the *total* bundle smaller, not larger, despite the eager
import: the CDN/IIFE bundle went from 41,378 to 28,933 bytes gzip (−12.4 KB), and total dist
ESM from 14,077 to 13,509 bytes gzip. One eager dependency outweighed two independent
implementations. §2.4 remains the reason the fallback exists at all and is unconditional to
begin with: a dual-tier system where HTTP merchants keep getting unprovable ids preserves
the exact hole this work exists to close.

### 3.4 D9 — the merge source arm is latch-gated, not unconditional

§7 Phase 4a reads as though a named `sourceAnonymousId` must always carry a proof. Taken
literally that is unshippable today: the listener's `useOnGetMergeToken` still drops its
RPC param, so nothing in production sends one and **every** in-app-browser escape would
403 — the exact flow the same section's acceptance criteria require to keep working end
to end.

Both arms are therefore latch-gated: an id that has never proven itself keeps working, and
from its first valid proof onward it must always present one. The intended end state is
reached without a flag day, and the practical effect matches §7's rule — a legacy id has
no key, so it can never latch, and once the listener sends proofs every derived id latches
on first use.

The residual gap is that an unproven derived id stays claimable until it first signs. §7
accepts exactly this ("accept that the migration path keeps legacy ids claimable-as-target
by whoever moves first"), and §2.6 is explicit there is no fix beyond shipping early.

**Resolved in `3e84f376e`.** The premise was that no caller sends a proof, which stopped
being true once the listener forwarded its RPC param. The source arm is now unconditional:
a named `sourceAnonymousId` must carry a valid proof. `/merge/execute` stays latch-gated,
since its targets are frequently legacy ids that can never produce one.

**Reverted, post-`3e84f376e`, back to latch-gated — see `DUAL-ARM-PLAN.md`.** The
"unconditional" premise above was wrong in a different way than the one it fixed: the
listener forwarding its RPC param means a *current-generation* caller sends a proof, but
it does nothing for the SDK's own legacy population. `signProof` returns `null` — never
throws — whenever no key is stored (`sdk/core/src/identity/sign.ts`), which is every
client that predates derivation, and D6 above ships derivation for *new* clients only. So
unconditional enforcement on this arm 403'd every legacy client hitting the in-app-browser
escape — the exact flow this section's own acceptance criteria require to keep working.
The same defect existed on `/identity/ensure`'s SDK arm (`ensure.ts`), which had been made
unconditional at the same time.

Both arms now call the same `enforceLatchedProof` helper
(`services/backend/src/orchestration/identity/latchedProof.ts`) that `/merge/execute`
always used — one policy function, three call sites, instead of a bespoke
`requireProof` (deleted) duplicating the same logic slightly differently. Net effect: the
end state described two paragraphs up ("an id that has never proven itself keeps working,
and from its first valid proof onward it must always present one") is exactly what ships
now — the unconditional detour did not reach that state any faster, it just broke legacy
callers on the way.

**Cost of the revert, stated honestly (`DUAL-ARM-PLAN.md` D-A):** an attacker holding a
harvested *legacy* `sourceAnonymousId` can still mint a merge token for it on this arm —
identical to pre-branch behaviour, and identical to what §2.6 already proves is
unfixable by any design in this document. For a *derived* id the exposure is bounded to
the window before its first proof-carrying call, which in practice is one call wide,
since the listener sends a proof on this arm for every derived id already
(`useOnGetMergeToken.ts`). `/merge/execute` is unaffected by this revert — it was already
latch-gated and stays exactly as it was.

See also D10 below for the analogous fix to `/identity/ensure`'s wallet arm, which had a
different bug (a proof op it could never satisfy) rather than an over-strict policy.

### 3.5 D10 — the install proof reaches `/identity/ensure` by forwarding, not exchange

§5's ticket design is unaffected — `install-code/resolve` still mints a ticket
unconditionally and it remains the strongest credential on that path. This decision is
about the *other* two install entry points, the direct `/install?m=&a=#p=` link and the
Play referrer, neither of which goes through `generate`/`resolve` at all.

An initial design (recorded, then rejected, in `DUAL-ARM-PLAN.md`'s original D-B) had
`InstallProcessing` call `install-code/generate` + `install-code/resolve` purely to trade
the `#p=` proof it already holds for a ticket, adding two network round-trips to the
direct-link path for no new credential — the wallet already had a proof, it just wasn't
wired anywhere.

**Shipped instead:** `/identity/ensure`'s wallet arm already accepts an optional `proof`
field (`ensure.ts`) — verified when present, logged, never required, never rejecting. It
had been verifying that field as `op: "frak-ensure-v1"`, an op the wallet can never
produce (no signing key on that origin — README §2.0, §9 "settled"), so the check failed
for every proof it would ever see and the failure was silently swallowed by the
log-only path. Fixed by changing the op to `"frak-install-v1"`, which binds exactly
`merchantId` ‖ `anonymousId` with an empty binding — precisely the tuple this arm needs
to authenticate, and precisely what the wallet's `#p=`/referrer proof already is. The
wallet now forwards that proof on `PendingEnsureAction.proof` through to the existing
`/identity/ensure` POST body, alongside `merchantId`/`anonymousId` (and `ticket`, when
present). Zero new round-trips, zero new backend arms, zero schema changes.

**On domain separation.** README §4.3 warns that collapsing distinct proof ops into one
generic signature would undo the domain-separation protection the golden fixtures pin.
That warning stands, and this is not that: `frak-install-v1` keeps its own prefix, its own
fixture, its own binding rule in `canonical.ts`. It simply gained one more *accepting*
endpoint, on an arm whose bare fallback (a raw `anonymousId` with zero proof at all) is
still open until `ROLLOUT-STEP-3`. The security delta today is therefore zero-or-positive:
anyone who could already forge this arm with a bare id gains nothing new from also being
able to present a `frak-install-v1` proof.

**The decision to revisit at `ROLLOUT-STEP-3`.** Once the bare `anonymousId` arm is
deleted, `frak-install-v1` stops being redundant with an open fallback and becomes a
*sufficient* ensure credential on its own — at which point its "high" leak-surface rating
(README §2.2: URL fragment + Play referrer, browser history, `Referer` headers, link
previews) starts to matter, and the ticket-exchange design should be reconsidered on its
merits from that tagged site rather than assumed necessary today.

### 3.2 Kept as-is, deliberately

- Derivation over a registry (§2.1) — the TOFU argument is sound.
- The latch (§4.6) — the keystone. Without it Phase 4a has no per-identity trigger and
  degrades to a flag day gated on an undefined coverage threshold.
- Binding `SHA-256(mergeToken)` instead of a replay cache (§2.2.1) — stateless, correct.
- `track/*` unsigned (§4.5) — correct, *given* §3.9 lands completely (see D1).
- `#p=` / `#fmt=` fragments over search params — cheap, real reduction in leak surface.
- All three op strings (`frak-merge-v1`, `frak-ensure-v1`, `frak-install-v1`) are frozen in
  `canonical.ts` and the fixtures in Phase 0, even though `frak-install-v1` is only
  consumed from Phase 3 — the format must be frozen before native branches.

---

## 4. Commit plan

| # | Commit | Wave |
|---|---|---|
| # | Commit | Status |
|---|---|---|
| C1 | freeze the wire format (phase 0) | ✅ `af8d9f81e` |
| C2+C3 | track/* resolve-only + drop raw-hex bypass | ✅ `470ca57be` |
| C4 | rate-limit track/* | ✅ `3cebbb90d` |
| C5 | WALLET_CONFLICT on ensure, backend half | ✅ `241ad83d6` |
| C6+C7 | per-code attempts, order-client limit, schema columns | ✅ `4e51e0f5c` |
| — | audit fix: don't repoint an attributed purchase (§1.3) | ✅ `409bc6439` |
| — | audit fix: first-claim-wins on purchase claims (§1.3) | ✅ `477f1429a` |
| C8 | surface non-retryable ensure failure, client half | ✅ `e7fde0fdd` |
| C9+C10+C11 | SDK keygen/derivation/proofs + backend verify (phase 2) | ✅ `bb565ab0c` |
| C13 | enforce proofs on latched ids (phase 4a) | ✅ `56cd290ef` |
| C12 (backend half) | install ticket + JWT audience/401 fixes (phase 3) | ✅ `9e75e83c0` |
| C12 (client half) | listener/wallet proof plumbing, `#p=` fragment | ✅ `3e84f376e` |
| STEP-2 | mandatory proofs on the non-store-gated arms | ⚠️ **superseded** — see D9 revert, `DUAL-ARM-PLAN.md` WS-BE-1. Both arms are latch-gated, not mandatory. `ROLLOUT-STEP-2` no longer marks live code. |
| WS-BE-1/2/3 | dual-arm revert + wallet proof plumbing + doc sync (this pass) | ✅ landed on `feat/identity-proof-of-possession` |

Conflict hotspots, each owned by a single worker: `sdkIdentity.ts` (C2+C3),
`ensure.ts` (C5 → C11 → C13, serialised), `orchestration/context.ts` (C11+C13).

---

## 5. Open items carried forward

- ✅ **The DDL is applied** — migration
  `services/bootstrap/drizzle/local/0035_natural_carlie_cooper.sql` adds both
  `identity_nodes.proof_seen_at` and `install_codes.attempts`, exactly as
  `DB-MIGRATION-REQUEST.md` specifies. Phase 4a is no longer blocked. The ordering rule
  below still applies to every environment this branch is deployed to.
  This is a **hard deploy prerequisite, not a soft one**. The claim on this line
  used to say enforcement is "fail-open… the pre-existing behaviour, not a regression" if
  deployed ahead of the DDL. That claim was checked against the actual repository code
  and found **false**: `IdentityRepository.findNodeByIdentity` and `markProofSeen` use
  Drizzle's relational query builder, which selects/writes `proof_seen_at` explicitly: a
  missing column raises an undefined-column error (`42703`), not a `null`/no-op. Deployed
  ahead of the DDL, every `/merge/execute` call with no proof 500s, and every successful
  `/merge/initiate` anonymous-arm call 500s on the latch write — strictly worse than the
  403 it replaces. A scoped `42703` guard was considered and rejected
  (`DUAL-ARM-PLAN.md` D-G) as scaffolding for what is a deploy-ordering problem, not a
  logic one. **Do not deploy to any environment before migration `0035` is confirmed
  applied there.** See `ROLLOUT.md` and the corrected `DB-MIGRATION-REQUEST.md`.
- ✅ §2.6 migration merge (D6) — **shipped**, see §3.1.1. Enforcing proofs across the SDK
  and listener surface is now unblocked on this, but still blocked on
  `TODO(merge-initiate-proof)` (the listener modal / embedded-wallet path sends no proof).
- ✅ **The wallet auth routes** (§1.5) — **fixed** via the `frak-sso-v1` proof.
- ⚠️ **The `frak-sso-v1` 10-minute window is a reasoned guess, not measured.** It is the
  only security-relevant tunable, and its failure mode is *silent*: an expired proof
  degrades to no-merge with no error, so legitimate merges would simply stop happening.
  Validate against real SSO funnel timings, and add a metric on expired `frak-sso-v1`
  rejections before relying on it.
- ✅ **The pairing WS `originNode` merge** (§1.6) — **fixed**, deleted end-to-end.
- ✅ **Webhook cart-attribute attribution** (§1.7) — **fixed**, first-writer-wins.
- ✅ **`origin_node` column dropped** from `device_pairing` (`drizzle/local/0036`,
  `drizzle/dev/0040`). The `prod` migration history still needs the equivalent generated
  migration before this branch is deployed there.
- **The merge-surface enumeration is now believed complete** (§1.8 lists what was checked
  and found inert). Three sweeps were needed to get here; treat any new
  `resolveAndAssociate`/`associate` caller as security-relevant by default.
- The §2.6 conflicting-migration alarm is still **not built** — two different derived ids
  racing to claim the same legacy id is the harvesting signal, but §9.3 gives it no
  Alertmanager destination. Out of scope with the migration itself.
- **No bundle-size regression guard.** An eager `@noble/curves` import in the entry chunk is
  now the intended, shipped design (§3.3), not a hypothetical regression — but there is
  still no CI check pinning the bundle size, so a future change that grows it further would
  only be caught by manual inspection.
- **`?fmt=` is still a search param.** README §4.2/§5 want it moved to a fragment, with the
  SDK accepting both before the wallet switches. Not started; it is the highest-leak merge
  surface since the URL is user-visible and shareable. Out of scope for the dual-arm
  revision (`DUAL-ARM-PLAN.md` §5).
- **README §9.4 (`#p=` fragment survival) is no longer load-bearing.** Previously this
  needed on-device verification before Phase 3 submission, because the fragment was the
  *only* proof transport on the direct-install path. It no longer is: the legacy
  `(merchantId, anonymousId)` pair now always travels alongside the proof end-to-end
  (dual-arm decision), so a stripped fragment degrades to the existing bare-pair flow
  instead of losing attribution. `install_page_viewed`/`install_processing_triggered`
  (`has_install_proof`) and `install_store_clicked`/`install_referrer_resolved`
  (`has_referrer_proof`) telemetry now answer the survival question empirically from
  production instead of requiring an on-device test pass (`DUAL-ARM-PLAN.md` D-D).
- **STEP-3 is the only remaining gated work** — see `ROLLOUT.md`. Blocked on store
  approval *and* the `minVersion` bump, in that order.

### Rollout

See `ROLLOUT.md`. `apps/wallet` builds **both** the web app and the Tauri store binary
from one source, so every contract the installed binary touches
(`install-code/generate`, `install-code/resolve`, `/identity/ensure`'s wallet arm,
`pendingActionsStore`) has to stay permissive until `minVersion` excludes old builds.
The listener/SDK arms have no such constraint and can be tightened immediately.
Eight `ROLLOUT-STEP-{1,2,3}` markers in the code mark every site that changes, greppable
as a single list.

### Pre-existing bugs found while auditing (both fixed in `9e75e83c0`)

- **The JWT `aud` claim was never enforced.** `buildJwtContext` accepted and signed it, but
  `verify()` never passed it to `jwtVerify`, and the JWT-spec claims merged into the
  validator widen any `t.Literal` a schema declares back to an optional string. A token
  minted under a *different* audience with the same secret and payload shape verified
  fine. The pre-existing cross-type test passed on payload shape alone — confirmed by
  weakening the schema literal and watching it still pass. Fixed at the source, so every
  context benefits; only `installTicket` sets `aud` today, so nothing else changed
  behaviour.
- **`/identity/ensure` returned 401 for every request.** A route-local `headers` schema
  *replaces* the one `sessionContext` declares in its `.guard()` rather than merging, so
  the auth macro never saw `x-wallet-auth`. Reproduced on unmodified HEAD. It is the only
  route in the codebase combining a local `headers` schema with the auth macro — worth a
  lint rule if a second one ever appears.
- §9.3 — the §3.5 / §2.6 alarms still have no Alertmanager destination. Out of scope here.
- §9.4 — whether `#p=` survives the install redirect chain must be verified on-device
  before Phase 3 store submission.
