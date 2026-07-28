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

### 1.3 🟠 §3.3 per-code limiting is not implementable as specified

The plan concedes "per-code limiting needs shared state to mean anything", then schedules
it in Phase 1 as a code change. With the in-memory store, a limit of 5 across 3 pods is 15.

**Decision:** ship the *durable* version — an `attempts` counter on the `install_codes`
row. There is an exact in-repo precedent: the sibling `email_verification_codes` table
already carries `attempts: integer("attempts").notNull().default(0)` with the documented
rationale *"`attempts` caps brute-force"* (`identity/db/schema.ts:177`). `install_codes` is
the one code table missing it. Correct across replicas, no Redis, one column on a table we
are already touching. Folded into the same DDL request as `proof_seen_at`.

---

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
├── sign.ts        # BROWSER ONLY — keygen, JWK persistence, signProof, @noble fallback
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
| D1 | §3.9 fixes `sdkIdentity.ts` | also fix `PurchaseLinkingOrchestrator` (2 sites) | §1.1 — the plan is incomplete; shipping only site 1 leaves the headline attack open |
| D2 | §3.6 rate-limit by `(merchantId, clientId)` | **two stacked limiters**, identity-keyed + IP catch-all, with different `maxRequests` | §1.2 — a lone identity extractor limits nothing for header-less callers, and identical configs collapse via Elysia's plugin dedupe |
| D3 | §3.3 per-code attempt limiting via the rate limiter | durable `attempts` column on `install_codes` | §1.3 — the in-memory store is per-pod; §5 leans on §3.3 as *the* interim mitigation, so it has to actually work |
| D4 | §4.6 `proofSeen` boolean | `proof_seen_at` nullable timestamp | §2.5 — same cost, makes the §2.6 alarm investigable, matches table idiom |
| D5 | §2.2 `frak-ensure-v1` window = 90 days | **30 days** | The 90-day justification is the install→forget→reopen funnel, which runs on the **wallet** arm — and that arm carries a *ticket*, not this proof, capped at the 7-day `DEFAULT_ENSURE_TTL_MS`. The SDK arm signs in place at call time, so a long window buys nothing and only extends bearer exposure. Windows are backend **policy**, not frozen wire format, so this stays revisable after native ships. |
| D6 | §2.6 legacy→derived migration merge, in Phase 2 | **deferred out of phases 0–4a** | See §3.1 below |

### 3.1 D6 — deferring the §2.6 migration merge

The plan has the SDK auto-run `merge/initiate` + `merge/execute` on every existing
client's next visit, to fold their legacy id into the newly derived one. It then spends a
full subsection establishing that this is unsolvable ("the migration is itself the
attack") and accepting the risk.

**We ship derivation for new clients only** (no `frak-client-id` present). Existing legacy
ids keep working untouched, as merge *targets*, exactly as today.

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
| C1 | `feat(sdk): freeze proof-of-possession wire format (phase 0)` | **serial — blocks D** |
| C2 | `fix(backend): make track/* resolve-only (§3.9)` | A |
| C3 | `fix(backend): drop raw-hex wallet bypass (§3.7)` | A (after C2, same file) |
| C4 | `feat(backend): rate-limit track/* (§3.6)` | A |
| C5 | `feat(backend): handle WALLET_CONFLICT on ensure (§3.8)` | B |
| C6 | `feat(backend): per-code + order-client limiting (§3.3, §3.4)` | B |
| C7 | `feat(backend): declare proof_seen_at + install-code attempts` | B |
| C8 | `feat(wallet): surface non-retryable ensure failure (§3.8 client half)` | C |
| C9 | `feat(sdk): P-256 keygen, JWK storage, derived client id (phase 2)` | D, after C1 |
| C10 | `feat(sdk): attach proofs to ensure + getMergeToken (§4.1, §4.2)` | D, after C9 |
| C11 | `feat(backend): verify proofs when present (phase 2)` | D, after C1 |
| C12 | `feat(listener,wallet): install ticket + proof plumbing (phase 3)` | E |
| C13 | `feat(backend): enforce proofs on latched ids (phase 4a)` | F, last |

Conflict hotspots, each owned by a single worker: `sdkIdentity.ts` (C2+C3),
`ensure.ts` (C5 → C11 → C13, serialised), `orchestration/context.ts` (C11+C13).

---

## 5. Open items carried forward

- **Phase 4a is blocked on the db team** applying the DDL in `DB-MIGRATION-REQUEST.md`.
  Enforcement code ships behind the column; until it exists the latch never sets and every
  id behaves as legacy — fail-open, which is the pre-existing behaviour, not a regression.
- §2.6 migration merge (D6) — revisit after Phase 4a.
- §9.3 — the §3.5 / §2.6 alarms still have no Alertmanager destination. Out of scope here.
- §9.4 — whether `#p=` survives the install redirect chain must be verified on-device
  before Phase 3 store submission.
