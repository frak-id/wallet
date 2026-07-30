# Closing the remaining merge surfaces (§1.5, §1.6, §1.7)

Implementation plan for the three unresolved findings in `DECISIONS.md`.

**Headline: two deletions and one new proof op — no new round-trips.**

- **V2 (pairing)** — deleted outright. The merge is a redundant duplicate of one
  `/user/identity/ensure` already performs proof-gated.
- **V3 (webhook)** — a one-line write guard.
- **V1 (SSO)** — **kept and proof-gated**, not deleted. It carries a real product
  capability (see C3): linking a never-had-a-wallet referee's anonymous reward history to
  the wallet they create via SSO. New `frak-sso-v1` op, short window, opportunistic.

> **Note on how this plan evolved.** §0 below argues V1 and V2 are redundant because
> `/identity/ensure` performs the same merge. That argument is **correct for V2 and for
> V1's fallback path**, but it is *not* a reason to delete V1: the eager SSO merge is what
> makes rewards visible immediately on the merchant's own page. §0 is retained because it
> is what justifies deleting V2 and what makes V1's "no proof ⇒ no merge, no error"
> degradation safe.

---

## 0. The central finding: V1 and V2 are redundant, not unprotected

`sdk/core/src/actions/ensureIdentity.ts` signs `frak-ensure-v1` and POSTs
`/user/identity/ensure`. The backend SDK arm (`api/user/identity/ensure.ts`) runs
`enforceLatchedProof` (`resolveSdkEnsureAnonymousId`, `:163-190`), gates `markProofSeen`
on `proofVerified`, then calls `resolveAndAssociate` at `:351`.

That is the **same merge, on the same node pair**:

| | node pair passed to `resolveAndAssociate` |
|---|---|
| `linkWalletToFingerprint` (`IdentityOrchestrator.ts:200-211`) | `[{wallet}, {anonymous_fingerprint, clientId, merchantId}]` |
| pairing join (`PairingOrchestrator.ts:455`) | `[{wallet}, originNode]` — same shape |
| `buildIdentityNodes` → ensure (`sdkIdentity.ts:56-76`) | `[{wallet}, {anonymous_fingerprint, clientId, merchantId}]` |

`ensureIdentity`'s own docstring (`:11-14`) already states the relationship:

> *"Acts as a failsafe: if the primary merge (SSO, pairing, login/register) missed or
> silently failed, this ensures the link is eventually established."*

The trigger is automatic: `watchWalletStatus.ts:84-89` fires `ensureIdentity` whenever a
connected status carries an `interactionToken`. Both flows land there:

- **SSO** → `sso.tsx` success handler → `sso_complete` RPC → listener `sessionStore`.
- **Pairing** → `applyDistantSession` (`origin.ts`) writes the session into the listener's
  `sessionStore` directly.
- Either way → `useWalletStatusListener.ts:104` `sessionStore.subscribe(...)` → re-emits
  `connected` + `interactionToken` → SDK → `ensureIdentity`.

So the eager merges are **unproven duplicates of a proven merge**. Deleting them removes
the attack surface and loses nothing.

### V1 is narrower than §1.5 documented

`linkWalletToFingerprint` requires `clientId && merchantId` (`:204`), and `merchantId` on
login/register comes **only** from `ssoContext` (`SsoActions.tsx:22-24`). So the merge
fires **only in the SSO flow** — exactly where a live SDK + iframe is guaranteed to exist.
Non-SSO wallet logins never merge at all. This makes the ensure fallback *certain*, not
merely likely, in every case where the deleted code did anything.

### Latency is harmless — verified, not assumed

The eager merge is synchronous with auth; ensure lands milliseconds later (seconds in
redirect-mode SSO, which navigates away and back). `IdentityMergeService.runMergeInTrx`
**retroactively repoints every identity-group-keyed table**, so records written during the
window are healed when the merge lands:

| Table | Repointed? |
|---|---|
| `identity_nodes` | ✅ (loser wallet nodes soft-unlinked, not deleted) |
| `purchases.identity_group_id` | ✅ `:228-231` |
| `interaction_logs.identity_group_id` | ✅ `:234-239` |
| `asset_logs.identity_group_id` | ✅ `:242-245` |
| `referral_links.{referrer,referee}_identity_group_id` | ✅ `:261-296`, active rows, with conflict + self-loop soft-delete guards |
| `purchase_claims.claiming_identity_group_id` | ✅ |
| `referral_codes.owner_identity_group_id` | ✅ with active-code conflict resolution |
| `affiliate_attribution.identity_group_id` | ✅ with `(provider, merchant_id)` conflict resolution |
| `asset_logs.recipient_wallet` | ❌ **intentionally** — immutable on-chain payout record, only written at settlement (a later cron) |

Rewards cannot be mispaid: `SettlementOrchestrator.enrichWithWalletAndInteraction`
(`:257-297`) re-resolves the wallet at settlement time and, on `null`, calls
`revertSettlementToPending` **without burning a retry** — "no wallet" is explicitly a
transient state. Settlement runs on a cron far slower than the window.

The merge's conflict/self-loop guards exist *precisely* because writes can land on
not-yet-merged groups. This deletion does not introduce that race; it is the race the
system is already built to absorb on every other async merge trigger.

**One residual, cosmetic:** `getUserReferralStatus` wraps its call in `withCache` with a
30s TTL and no merge-aware invalidation, so a stale "not referred" can render for ≤30s if
queried inside the window (most plausibly redirect-mode SSO). Affects which post-purchase
card variant shows. No persisted record, no payout. Accepted; noted below as a follow-up.

---

## C1 — V3: guard the webhook attribution write

**Standalone, no dependency on the redundancy argument. Ship first.**

`PurchaseRepository.upsertWithItems` (`:42-57`) `onConflictDoUpdate` contains
`...(identityGroupId ? { identityGroupId } : {})` with no check that the row already
carries a *different* group — so every Shopify/Magento `orders/updated` redelivery
repoints attribution, last-writer-wins.

**Fix:** preserve a pre-existing non-null group. Use a SQL-level `COALESCE` on the
excluded/existing values rather than a read-then-write (which would race across concurrent
webhook deliveries):

```ts
...(identityGroupId
    ? { identityGroupId: sql`coalesce(${purchasesTable.identityGroupId}, ${identityGroupId})` }
    : {}),
```

**Three callers** (`PurchaseWebhookOrchestrator.ts:101,128,179`) — `:101` passes no group,
`:128` passes a claim-derived one, `:179` the cart-attribute one. A blanket removal would
break `:128`; `COALESCE` is correct for all three (first non-null wins).

**Files:** `services/backend/src/domain/purchases/repositories/PurchaseRepository.ts`.

**Tests:** webhook redelivery with a *different* `_frak-client-id` must not repoint an
already-attributed purchase; a first delivery with no prior group must still attribute.

---

## C2 — V2: delete `originNode` end to end

Confirmed safe: **exactly two producers**, both in `apps/listener`; **zero** in
`apps/wallet`, so the released Tauri binary never sent it and no backward-compat window is
needed. No API returns it, no analytics reads it, no test locks in the merge semantics.

Delete in this order (client first, so no client is sending a field the server just
dropped):

1. `apps/listener/.../SsoButton.tsx:213-222,266` — drop construction + option.
2. `apps/listener/.../AuthenticateWithPhone/index.tsx:36,67` — same.
3. `packages/wallet-shared/src/pairing/component/{LaunchPairing,PairingView}/index.tsx` +
   `hook/useOriginPairingFlow.ts` — drop the prop/param.
4. `packages/wallet-shared/src/pairing/clients/origin.ts:46,224` —
   `InitiatePairingOptions.originNode` + the `connect` forward.
5. `packages/wallet-shared/src/pairing/clients/base.ts:28,99-100` — `ConnectionParams`
   member + `serialiseConnectionParams` branch.
6. `services/backend/.../PairingOrchestrator.ts` — `parseOriginNode` (`:119-125`), the
   threading through `handleOpen`/`handleInitiate`, and **the merge block `:452-465`**.
7. `services/backend/.../PairingRepository.ts:62,70` — `originNode` from `create()`.

**Do NOT touch** `domain/pairing/db/schema.ts:49` unilaterally. Removing the field makes
`drizzle-kit` want to drop the column on the next generate, and `services/backend/AGENTS.md`
is explicit that **migrations are authored by the db team**. Leave the nullable jsonb
column in place (harmless, no FK/index dependents) and hand the `DROP COLUMN` over
separately.

**Tests:** update the two `originNode: undefined` assertions in
`LaunchPairing/index.test.tsx:125,169` (mechanical call-shape change). Add a backend test
asserting a pairing join no longer merges anything.

---

## C3 — V1: proof-gate the SSO merge (do NOT delete it)

**Superseded decision.** §0's redundancy argument does *not* apply here. The eager SSO
merge is a **product capability**, not an optimisation:

> A user clicks a referral link, browses anonymously, accrues referral/reward history under
> an `anonymous_fingerprint` group, and **never creates a wallet**. Later they hit a
> merchant's "See my rewards" profile section → SSO → register → **the merge must link that
> anonymous history to the brand-new wallet** so the merchant page can show their rewards.

This is the failsafe for "referee arrived via referral, never made a wallet". Deleting it
would break the headline flow. So: keep the merge, **gate it on a proof**.

### Why a NEW op (`frak-sso-v1`) rather than reusing `frak-ensure-v1`

The semantic is nearly identical, so reuse is tempting. It is wrong, for one concrete
reason: **the validity window is per-op, not per-route** (`PROOF_WINDOW_SECONDS`,
`IdentityProofService.ts:26-30`).

An SSO proof rides in a **URL** (`?p=` blob) — it lands in browser history, referrer
headers, and anything that copies the link. An ensure proof rides in a **request body**
over an authenticated channel. These deserve very different exposure windows. If they
share an op, the URL-borne proof inherits `frak-ensure-v1`'s **30 days**, and the short
window we want becomes unenforceable — a captured SSO URL would also be replayable on the
ensure path for a month.

Domain separation is exactly what the `op` field exists for (`canonical.ts:29-31`: the op
bytes are signed, so a signature for one op never verifies for another).

### The replay analysis that drives the window

The proof asserts *"I possess the key for clientId X"*. It does **not** say *"link X to
wallet Y"* — the wallet does not exist yet at signing time, so it cannot.

So the real question is capture-and-replay: an attacker who obtains a victim's SSO URL can
open it, register their **own** wallet, and the backend will happily verify the proof and
merge the victim's group onto the attacker's wallet.

Two things contain this, and one does not:

- ❌ **Binding does not help.** There is no server-issued nonce at SSO-URL-generation time
  (the URL is built entirely client-side, no round-trip). Anything client-derivable that
  we could bind to is *also in the URL the attacker captured*. A nonce would require a
  round-trip, which is rejected as overengineering for a capability this narrow.
- ✅ **`WALLET_CONFLICT` closes it after the fact.** Once the victim completes their own
  auth, their group has a wallet, and `checkWalletPriority`
  (`IdentityWeightService.ts:265-279`) throws `WALLET_CONFLICT` on any later merge with a
  different wallet. **The attacker only wins if they replay before the victim finishes.**
  (Verified: the guard needs *both* sides to have a wallet — which is why it does **not**
  protect the pre-auth case, the whole reason this product flow exists.)
- ✅ **The window is the only real lever.** It bounds how long a leaked URL stays a bearer
  credential.

**Window: 10 minutes.** Long enough for a passkey ceremony plus a fumbled retry or an email
step; short enough that a URL in history is not a durable capability. This is the key
tunable — if real SSO completion times run longer, raise it deliberately, not by accident.
Note the proof also signs `merchantId`, so a proof for merchant A is useless on merchant B.

### Opportunistic, never fatal — and therefore no latch interaction

**Do not use `enforceLatchedProof` here.** Its `PROOF_REQUIRED` throw would 403 a *login*.
Worse, it would fire exactly for well-behaved users: the SDK ensure path latches the id, so
a subsequent SSO login from an **old Tauri binary** (which cannot send the new field) would
start failing. Breaking login over an identity-graph nicety is unacceptable.

Instead the merge is **opportunistic**:

| proof | behaviour |
|---|---|
| present + valid | merge (the product capability) |
| present + invalid | **no merge**, log as a security event |
| absent | **no merge**, no error |

Never 403. An attacker sending a garbage proof gets exactly what they get today by sending
none: nothing. And when the proof is absent, `/identity/ensure` still establishes the link
later, proof-gated — §0's argument holds as the *fallback*, just not as a replacement.

This makes old-binary compatibility automatic: they omit the field, skip the eager merge,
and get the ensure one. No `minVersion` gate needed.

Use `identityProofService.verify` (returns a result), **not** `verifyOrThrow`.

### Changes

**SDK** — mint and carry the proof:
1. `sdk/core/src/identity/types.ts:18` — add `"frak-sso-v1"` to `ProofOp`.
2. `services/.../IdentityProofService.ts:26-30` — add the window entry (TS will not compile
   without it — the `Record<ProofOp, number>` is a forcing function).
3. `sdk/core/src/actions/openSso.ts:96` — sign alongside the existing clientId resolution.
   The popup-blocker constraint is **already** violated here (`:96` awaits
   `getClientIdAsync()`, `:104` awaits `resolveMerchantId()`), and both are cache hits in
   the common case; one more cached-key signature (<1 ms) does not change the picture. The
   comment at `:93-94` should be corrected — it no longer describes the code.
4. `sdk/core/src/utils/sso/sso.ts` — add `proof?: string` to `FullSsoParams` (`:14-21`),
   a short key (`pf`) to `CompressedSsoData` (`:104-124`), and map it in
   `ssoParamsToCompressed` (`:81-94`). Additive; there is no version field, and old wallet
   builds simply read `undefined`.

**Wallet** — carry it flow-scoped, consume once:
5. `packages/wallet-shared/src/authentication/utils/ssoDataCompression.ts` — map `pf` back.
6. `packages/wallet-shared/src/stores/types.ts:100-106` — add `proof?: string` to
   `SsoContext`.
7. `apps/wallet/app/routes/_wallet/_sso/sso.tsx:87-92` — stash it in `setSsoContext`.
   **Deliberately `ssoContext`, not `clientIdStore`**: `authenticationStore.ts:19` documents
   `ssoContext` as in-memory only, whereas `clientIdStore` is persisted, has no TTL, is
   never cleared (`clearClientId` has zero call sites), and is replayed ambiently onto every
   request by `backendClient.ts:35`. A time-boxed credential must not live there.
8. `useLogin.ts:136` / `useRegister.ts:78` — send `proof` in the body, next to the existing
   `merchantId` (same pattern, already established). Clear it from `ssoContext` after the
   call so it is single-use per flow.

**Backend** — verify before merging:
9. `login.ts:62,125`, `register.ts:154` — accept optional `proof` in the body schema, pass
   it through.
10. `IdentityOrchestrator.linkWalletToFingerprint` (`:193-211`) — take `proof?: string`;
    build the `anonymous_fingerprint` node only when `clientId && merchantId && proofValid`.
    Gate `markProofSeen` on the verification result (**never** unconditionally —
    `latchedProof.ts:22-26`).
11. `recover.ts` — drop `clientId` entirely. It passes no `merchantId`, so it never merged
    (§1.8); removing it kills the latent hazard permanently.

**Fixtures:** regenerate `golden-proofs.json` via `bun scripts/generate-golden-proofs.ts`
(`fixtures:generate`) with a `frak-sso-v1` entry — consumed by **both** SDK and backend
tests, so divergence stays structurally impossible.

### The two SSO producers that cannot sign

`useSsoLink.ts:47` (listener) and `ssoHandler.ts:186-198` (`frak_openSso` redirect mode)
both run on the **wallet origin**, which has no signing key — only the merchant page does.
They therefore emit no proof and **degrade to no-merge**, which is the fail-safe direction.
The link is still established by ensure. Do not attempt to forward a proof to the listener
for this: `buildSdkIdentity` ships `install`/`merge` proofs over `resolved-config`, but
those have different ops and windows, and reusing one here would reintroduce exactly the
cross-op window leak that motivated `frak-sso-v1`.

### Tests

- Valid `frak-sso-v1` proof ⇒ SSO register merges the anonymous group onto the new wallet
  (**the product flow** — this is the test that proves the capability still works).
- Forged/absent proof ⇒ **no merge**, and **login still succeeds** (the compat guarantee).
- Expired proof (>10 min) ⇒ no merge.
- Proof for merchant A replayed on merchant B ⇒ no merge.
- Legacy no-key client (`signProof` returns `null`) ⇒ no proof, login fine, ensure links
  later via fail-open.
- `markProofSeen` is **not** called when verification fails.

---

## Cross-cutting: the fail-open path must keep working

Every change above must preserve the legacy no-key client path. Those clients cannot
produce a proof at all; `enforceLatchedProof` fail-open (`latchedProof.ts:71-77`) is what
keeps them working. A test asserting a legacy (no `frak-client-key`) client still links via
ensure is **required** in each of C1–C3, because that path is the one most likely to be
silently broken by tightening.

## Rollout

No deploy prerequisites, no `minVersion` gate, no store wait — none of these routes are
touched by the released binary in the affected code paths (V1 needs `ssoContext.merchantId`,
which the binary's own login flow does not set; V2 is listener-only; V3 is webhook-only).

Order: **C1 → C2 → C3**, separate commits. C1 is independent. C2 rests on the redundancy
argument. C3 is the largest (SDK + wallet + backend + fixtures) and is the only one that
adds a wire-format op — land it last and alone.

C3 needs **no** `minVersion` gate: the proof field is optional everywhere, and an old
binary that omits it simply skips the eager merge and gets the ensure one.

## Open question for C3

**Is 10 minutes the right window?** It is the single security-relevant tunable, and it was
chosen from reasoning about passkey-ceremony duration, not from data. If real SSO
completion times (especially with an email step, or a user who tabs away) exceed it,
legitimate merges will silently stop happening — and the failure is invisible, because the
flow degrades to no-merge rather than erroring. Worth checking against real funnel timings
before shipping, and worth a metric on `frak-sso-v1` expired-proof rejections.

## Follow-ups (not in scope)

- `getUserReferralStatus`'s 30s `withCache` has no merge-aware invalidation (cosmetic
  staleness above). Consider clearing it on a `connected` status transition.
- The "pre-pairing anonymous browsing ↔ paired wallet" link now rests entirely on ensure.
  If product ever wants it *eagerly*, it must come back proof-gated, not as `originNode`.
- §1.5's `useSsoLink.ts:47` `clientId ?? ""` (empty-string id) is unaffected by C3 but
  still worth cleaning.

## Not verified

- No exploit test was written for any of the three; severity is argued from the call graph.
- The 30s `withCache` staleness was reasoned about, not reproduced.
- Whether any *external* SDK consumer calls `processReferral`/pairing APIs in a way that
  depends on `originNode` — repo-internal callers are exhaustively enumerated, external
  ones cannot be.
