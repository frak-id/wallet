# Dual-arm plan — carry the proof *and* the legacy pair, everywhere

**Status:** planning. Supersedes `ROLLOUT.md` "Steps 1 and 2 — done" and the
`DECISIONS.md` D9 resolution wherever they conflict. `README.md` §1–§4 (the design
rationale, the frozen wire format) is untouched and still authoritative.

**Branch:** `feat/identity-proof-of-possession`

---

## 0. Why this document exists

The branch shipped a rollout that is **stricter than the product decision allows**. Two
backend arms hard-403 a caller that presents only `(merchantId, anonymousId)`:

| Arm | File | Behaviour today |
|---|---|---|
| `/identity/merge/initiate`, `sourceAnonymousId` | `AnonymousMergeOrchestrator.ts:82-102` (`requireProof`), called `:151-157` | **403 `PROOF_REQUIRED`** when proof absent. No latch check. |
| `/identity/ensure`, SDK arm | `api/user/identity/ensure.ts:106-125` (`resolveSdkEnsureAnonymousId`) | **403 `PROOF_REQUIRED`** when proof absent. |

Both were made unconditional in `3e84f376e` on the reasoning that "the listener now
forwards its proof, so there is no fail-open path left to preserve." That reasoning holds
only if *every* caller is a current-generation SDK/listener. It is not the decision the
repo owner wants, and it is not true in the field:

- the SDK returns `null` from `signProof` and sends **no proof** whenever there is no
  stored key (`sdk/core/src/identity/sign.ts:367-378`) — i.e. **every legacy client**,
  which is the entire pre-derivation population;
- `DECISIONS.md` D6 deliberately ships derivation **for new clients only**, so legacy ids
  are never migrated and can *never* produce a proof;
- the listener explicitly falls back to the unproven legacy id rather than aborting
  (`lifecycleHandler.ts:214-236` `resolveMergeTarget`).

So today, on the live path, a legacy client hitting the in-app-browser escape or the SDK
ensure gets a hard 403 and loses attribution outright. That is the bug.

### The revised decision (authoritative)

1. **Do not drop `anonymousId` anywhere yet.** Every flow carries **both** the proof and
   the legacy `(merchantId, anonymousId)` pair; the backend accepts both.
2. **Every transport carries both arms** — the Play referrer, the direct `/install` link,
   the install code, ensure, and both merges.
3. **No arm hard-403s for a missing proof before Phase 5 / `ROLLOUT-STEP-3`.**
   Latch-gating (proof required *once an id has ever proven itself*) is the maximum
   allowed strictness. Unconditional mandatory is not.
4. **The wallet handles both gracefully.** The web wallet, which deploys instantly, can
   run purely on the proof mechanism; the Tauri binary cannot.
5. **Backward-compat data keeps the installed binary alive.** Once the new binary ships
   and `minVersion` is bumped, the scaffolding is deleted — every such site carries a
   single greppable marker so the deletion is mechanical.

### The one-line summary of the change

> Replace *unconditional* proof requirements with *latch-gated* ones, and finish wiring
> the proof through the three wallet paths that currently drop it.

Latch-gating is not a security downgrade relative to the intent of the plan. `README.md`
§4.6 designed the latch precisely so enforcement is **per-identity and continuous**
rather than a flag day: an id that has ever signed must always sign. Unconditional
enforcement adds strictness *only* for ids that have never signed — which is exactly the
legacy population that can never sign, i.e. the population we are required not to break.
The security delta is therefore confined to **derived ids that have not yet signed once**,
a window that closes on each id's first proof-carrying call.

---

## 1. Verified current state

Everything below was read on this branch, not inferred.

### 1.1 Backend

| Route / arm | Gating | Evidence |
|---|---|---|
| `/merge/initiate`, wallet-session arm | **never gated** — session is the proof | `AnonymousMergeOrchestrator.ts:151` guard is `if (sourceAnonymousId)` |
| `/merge/initiate`, `sourceAnonymousId` arm | 🔴 **unconditional 403** | `requireProof` `:82-102`; no latch read |
| `/merge/execute` | ✅ latch-gated | `enforceProof` `:33-71`; proof-absent path reads `findNodeByIdentity`, 403 only when `node?.proofSeenAt` |
| `/identity/ensure`, SDK arm | 🔴 **unconditional 403** | `ensure.ts:113-118` |
| `/identity/ensure`, wallet arm | ✅ permissive; proof verified-and-logged only | `ensure.ts:70-92` |
| `/install-code/generate` | ✅ permissive; proof telemetry only | `installCode.ts:24-41` |
| `/install-code/resolve` | ✅ returns **both** `anonymousId` and `ticket` | `installCode.ts:104-131` |

Arm selection on `/identity/ensure` keys off the **absence of a wallet credential**
(`ensure.ts:236-247`), not field placement — deliberately, so an SDK caller cannot dodge
its requirement by moving the id into the body. That discriminator is correct and stays.

### 1.2 🔴 The `proof_seen_at` DDL does not exist — deploy blocker

Verified by search, not assumption:

- `services/bootstrap/drizzle/` contains exactly one migration, `v2/0000_lonely_stryfe.sql`.
- `grep -rn "proof_seen" --include=*.sql .` → **no matches anywhere in the repo**.
- `identity_nodes` in that baseline (`:45-53`) has no `proof_seen_at`.
- `install_codes.attempts` is likewise absent from the SQL while declared in
  `schema.ts:180`.
- `services/backend/AGENTS.md:54` — "DB Migration generation are always human generated…
  it will be done by the db team." So the absence is expected process-wise; the risk is
  that the *code* does not tolerate it.

`DB-MIGRATION-REQUEST.md` claims enforcement would "either no-op (harmless) or fail at
runtime"; `DECISIONS.md` §5 claims it is "fail-open… safe to deploy ahead of the DDL".
**Both claims are false for the code as written:**

- `IdentityRepository.findNodeByIdentity` (`:107-121`) uses Drizzle's relational query
  builder against `identityNodesTable`, which emits an explicit column list including
  `proof_seen_at`. A missing column raises `column "proof_seen_at" does not exist` — a
  500, not a `null`.
- `markProofSeen` (`:132-152`) does `UPDATE … SET proof_seen_at = …  WHERE … proof_seen_at IS NULL`
  — same failure.

Blast radius if deployed against a DB without the column:

- **every** `/merge/execute` with no proof (the common case today) 500s inside
  `enforceProof` before the merge even starts;
- **every** successful `/merge/initiate` anon arm 500s on `markProofSeen`.

This is strictly worse than the 403 it is meant to replace. See workstream **BE-0**.

### 1.3 SDK / listener — already correct, dual-arm

- `signProof` returns `null`, never throws, when no key (`sign.ts:367-378`). Callers treat
  proofs as always-optional.
- Proofs produced: ensure (`actions/ensureIdentity.ts:56-69`), merge-initiate with an
  empty binding (`actions/getMergeToken.ts:29-42`), and `sdkIdentity.proofs.{merge,install}`
  on `resolved-config` (`clients/createIFrameFrakClient.ts:349-395`, attached `:519-523`).
- Listener forwards proof **and** legacy pair on both merge routes, and falls back to the
  unproven id rather than aborting (`lifecycleHandler.ts:195-238`, `useOnGetMergeToken.ts:17-31`).
- `buildInstallUrl.ts:20-21` → `/install?m=&a=` plus `#p=` when a proof exists. Correct.
- `?fmt=` is still a **search param** on both sides (`ExplorerDetail/index.tsx:116` writes,
  `createIFrameFrakClient.ts:424-427` reads). The fragment move has not started.

Net: the SDK and listener already implement the revised decision. **They need almost no
change** — see WS-2, which is small and mostly optional.

### 1.4 Wallet — where the real gaps are

| # | Gap | Evidence | Severity |
|---|---|---|---|
| W1 | `InstallProcessing` never receives the `#p=` proof; builds a bare `{merchantId, anonymousId}` ensure action. This is the path taken by **Tauri and by logged-in web users** — the mainline direct-link flow. | `install.tsx:96-99` passes `proof` only to `InstallCodeView`; `:120,133-139` | 🔴 high |
| W2 | Play referrer string carries **no `proof=`**, contradicting README §5 step 1. | `install.tsx:262-267` | 🔴 high |
| W3 | Referrer consumer reads only `merchantId`/`anonymousId`. | `useInstallReferrer.ts:47-56,70-77` | 🔴 high (pairs with W2) |
| W4 | `pendingActionsStore` has no `version`/`migrate`, so there is no hook for the eventual `version: 2` that drops `anonymousId`. | `pendingActionsStore.ts:113-119` | 🟠 medium |
| W5 | Ensure dedupe key is always `ensure:${merchantId}:${anonymousId}`, never ticket-based. | `pendingActionsStore.ts:35-36` | 🟡 low |
| W6 | `PendingEnsureAction` has no `proof` field. | `types.ts:5-17` | 🟠 medium (blocks W1) |
| W7 | `sharing.tsx` builds `/install?m=&a=` with no proof and structurally cannot sign. | `sharing.tsx:181-190` | ⚪ by design, not a gap |

`useExecutePendingActions.tsx:146-157` already sends `{merchantId, anonymousId, ...(ticket && {ticket})}`
— correctly dual-arm. It never sends a `proof`; W1 changes that.

---

## 2. Design decisions this plan makes

### D-A. Backend reversals: latch-gated, not mandatory, not fully permissive

Both offending arms move to the **exact shape `/merge/execute` already has**: proof
present ⇒ verify (invalid ⇒ 403 `PROOF_INVALID`); proof absent ⇒ read the latch, 403
`PROOF_REQUIRED` only if latched, otherwise allow.

Reuse `enforceProof` rather than adding a third policy shape. `requireProof` is **deleted**,
not kept behind a flag — a second policy function is exactly the dual-arm carve-out that
README §5 warns becomes load-bearing forever.

**Security cost, stated honestly, per arm:**

- **`/merge/initiate` source arm.** This mints a merge token for an arbitrary named id.
  Reverting to latch-gated means an attacker holding a harvested *legacy* id can still
  mint a token for it — which is exactly the pre-branch behaviour and exactly what
  README §2.6 proves is unfixable ("an already-published legacy id cannot be secured,
  under any design in this document"). For a **derived** id the exposure is bounded by
  the latch: the id is claimable only until its first proof-carrying call, after which it
  is permanently protected. Since the listener already sends a proof on this arm for
  every derived id (`useOnGetMergeToken.ts:22-29`), that window is one call wide in
  practice. Residual risk is confined to the legacy population, which §2.6 already accepts
  and which §3's rate limiting + oracle closure is the real mitigation for.
- **`/identity/ensure` SDK arm.** The merge target here is `walletSession.address` under a
  mandatory auth macro, so README §2.2.1 already establishes that a replay "cannot move
  the group" — a same-wallet replay is a no-op, a different-wallet replay hits
  `WALLET_CONFLICT`. The proof adds defence for the *source* id only, and the latch
  preserves it for every id that has signed once. This is the cheaper of the two
  reversals.

Both reversals are **required** by decision 3 regardless; the above is the cost accounting,
not a re-litigation.

### D-B. How the proof reaches ensure on the wallet arm — **forward it on the existing arm** *(revised by repo owner)*

> **This section was rewritten after the oracle pass.** The oracle chose a
> `generate` + `resolve` ticket exchange. The repo owner rejected it as
> overengineering: *"I don't get why we should do two additional roundtrips. We should
> keep the same flow as actual, just with a proof instead of the combo (or combo +
> proof)."* That is decisive, and on inspection it is also the cheaper *and* more honest
> change. The rejected option is preserved at the bottom for the record.

**The key fact the oracle missed:** `/identity/ensure`'s wallet arm **already accepts an
optional `proof`** (`ensure.ts:70-92`). It verifies it and logs the outcome, never
requires it, never rejects on it. No new arm, no new field on the route, no schema change
is needed — the transport already exists and is already permissive.

But that block is **dead code today**, and this is the actual bug:

```ts
// ensure.ts:76-82 — the wallet arm
const result = await IdentityContext.services.identityProof.verify({
    op: "frak-ensure-v1",   // ← the wallet can NEVER produce this
    ...
});
```

The wallet has no signing key — README §2.0 puts the key on the *merchant* origin, and
§9's "settled" list is explicit that the wallet "does not need, and must not get, a second
P-256 identity key." So a `frak-ensure-v1` proof cannot reach this arm by any path. The
only proof that ever arrives here is the `frak-install-v1` one from `#p=` or the Play
referrer. The verification is therefore guaranteed to fail for every proof it will ever
see, and the failure is only logged — so nothing has surfaced it.

**Decision: verify the wallet arm's proof as `frak-install-v1`, and forward it from
`InstallProcessing`.**

`frak-install-v1` binds exactly `merchantId` ‖ `anonymousId` with an empty binding field
(README §2.3), which is precisely the tuple `/identity/ensure` needs to authenticate.
No re-binding, no new op, no new arm, no round-trip.

Concretely:
- `ensure.ts:76-82` — change `op` to `"frak-install-v1"`.
- `PendingEnsureAction` gains `proof?: string` (W6).
- `InstallProcessing`, `useInstallReferrer`, and `useResolveInstallCode` populate it.
- `useExecutePendingActions` sends `{merchantId, anonymousId, ...(ticket && {ticket}), ...(proof && {proof})}`.

Every arm travels together, which is exactly decision 1.

#### On the domain-separation objection

README §4.3 warns that making the install proof valid elsewhere "would undo every other
mitigation here." That warning is about **collapsing the ops into one generic signature**,
and it remains correct. This is not that: the op stays domain-separated in
`canonical.ts`, the fixtures are untouched, and `frak-install-v1` gains exactly one
additional accepting endpoint — one whose bare arm currently accepts a **raw unproven
`anonymousId`** from anyone.

So the security delta today is **zero-or-positive**: a caller holding a leaked install
proof can do nothing at `/identity/ensure` that a caller holding the leaked *raw id*
cannot already do, because the bare arm is open until `ROLLOUT-STEP-3`. Accepting the
proof is strictly more evidence than accepting the id alone.

**The decision that must be revisited is at `ROLLOUT-STEP-3`, not now.** When the bare
`anonymousId` arm is deleted, `frak-install-v1` becomes a *sufficient* ensure credential
rather than a redundant one, and at that point its "high" leak rating (README §2.2) starts
to matter. Tag the site so that choice is forced then:

> `ROLLOUT-STEP-3`: when the bare `anonymousId` arm is deleted, decide whether
> `frak-install-v1` remains sufficient on its own or must be exchanged for a ticket
> first. It is redundant with the bare arm today; it would be load-bearing without it.

The ticket arm (`ensure.ts:29-52`) is untouched and remains the stronger credential for
the install-code path, which already mints one.

<details>
<summary>Rejected: the ticket-exchange option (oracle's original D-B)</summary>

`InstallProcessing` would call `install-code/generate` + `resolve` to swap the `#p=` proof
for a 7-day `install-ticket` JWT, then carry the ticket. Rejected: two extra network calls
on the mainline direct-link path, new failure and retry states, a `proof` field on
`PendingEnsureAction` carried solely for exchange retry — all to avoid widening an op at
an endpoint whose bare arm is currently open anyway. It buys nothing until
`ROLLOUT-STEP-3`, and at `ROLLOUT-STEP-3` it can be adopted then, on its merits, from a
tagged site.

</details>

### D-C. Play referrer shape — both arms, measured

```
merchantId=<uuid>&anonymousId=<uuid>&proof=<base64url>
```

Measured against the real fixture (`sdk/core/src/identity/fixtures/golden-proofs.json`,
`frak-install-v1` entry) rather than the plan's ~300-char estimate:

| Component | Chars |
|---|---|
| proof, raw | **284** |
| proof, after `encodeURIComponent` | **284** (base64url has no reserved chars — the encode is a no-op) |
| legacy pair `merchantId=…&anonymousId=…` | 96 |
| **full dual string, raw** | **387** |
| **full dual string, `encodeURIComponent`'d as the referrer value** | **397** |

Against the ~1024-char Play cap that is **39 %** utilisation, comfortable. Recorded here
because README §2.3 flags the referrer as "the binding constraint on that field, and any
future addition must be measured against it" — this is that measurement.

Producer `install.tsx:262-267`, consumer `useInstallReferrer.ts:47-56`. Existing keys are
untouched and stay first in the string, so an old binary parsing with `URLSearchParams`
reads exactly what it reads today and ignores the third key.

### D-D. Does `#p=` survive the redirect chain? — assume no, and do not depend on it

README §9.4 leaves this open. It now matters more, so the plan **removes the dependency**
rather than resolving it:

- The Play referrer carries `proof=` as a **normal key**, not a fragment (D-C). Fragments
  cannot survive a store round-trip at all — the referrer is a separate string, which
  README §2.2 already notes.
- On the direct `/install` link, the fragment is the **only** proof transport, and the
  `m`/`a` search params are always present alongside it. If the fragment is stripped by an
  interstitial, `parseInstallProofFragment` returns `undefined`
  (`install.tsx:57-64`, try/catch, never throws) and the flow degrades to the legacy pair.
  **Attribution is preserved either way** — that is the whole point of keeping both arms.

So the answer to §9.4 is no longer load-bearing. It stays worth measuring: WS-3 adds a
`trackEvent` distinguishing "install page reached with `m`/`a` and a fragment proof" from
"…without", which answers §9.4 empirically from production data instead of on-device
testing. **No fallback mechanism is required**, because the legacy arm *is* the fallback —
and decision 1 says it stays.

### D-E. Greppable marker — reuse `ROLLOUT-STEP-3`, one marker only

Do **not** introduce a new marker. `ROLLOUT-STEP-3` already means exactly "delete this
once `minVersion` excludes pre-ticket binaries", it already appears at the right sites,
and `ROLLOUT.md` already documents the grep. A second marker would fragment the deletion
list — the precise failure README §5 warns about.

`ROLLOUT-STEP-1` and `ROLLOUT-STEP-2` become **stale** once WS-1 lands (STEP-2 marked the
now-reverted mandatory arms). WS-1 removes STEP-2 markers with the code they annotate;
WS-4 rewrites the docs so the grep list is `STEP-1` (additive, done) and `STEP-3`
(deletion, pending).

**Complete `ROLLOUT-STEP-3` inventory after this plan** — every site that must be deleted
or flipped at Phase 5:

*Backend*
1. `api/user/identity/installCode.ts:104-110,150` — `anonymousId` in the `resolve` response.
2. `api/user/identity/ensure.ts:54-66` — bare-`anonymousId` wallet arm.
3. `api/user/identity/ensure.ts:70-92` — verified-but-not-enforced proof block on the wallet arm (becomes enforced).
4. `orchestration/identity/AnonymousMergeOrchestrator.ts` `enforceProof` proof-absent branch — the fail-open `return false` (all three arms, after WS-1).
5. `domain/identity/services/InstallCodeService.ts:47-59` — unconditional `mintTicket` (becomes gated once `generate` requires a proof).

*Wallet*
6. `module/pending-actions/types.ts` — `anonymousId` on `PendingEnsureAction` (→ `version: 2` migration drops it) and the new `proof` field.
7. `module/pending-actions/hook/useExecutePendingActions.tsx:146-150` — `anonymousId` in the ensure body.
8. `module/pending-actions/stores/pendingActionsStore.ts` — `dedupeKey`'s `anonymousId` branch; bump to `version: 2`.
9. `routes/install.tsx` — the `a` search param, and the bare-action fallback in `InstallProcessing`.
10. `routes/install.tsx` (referrer builder) — `anonymousId=` in the referrer string.
11. `module/onboarding/hook/useInstallReferrer.ts` — the `anonymousId` read and the bare action it writes.
12. `routes/sharing.tsx:181-190` — the `?a=` construction site.

*Listener / SDK*
13. `apps/listener/app/module/sharing/buildInstallUrl.ts` — the `a` param.
14. `apps/listener/app/module/handlers/lifecycleHandler.ts` `resolveMergeTarget` — the unproven fallback branch.
15. `sdk/core/src/clients/createIFrameFrakClient.ts:424-427` — the `?fmt=` search-param read, once no pre-fragment binary remains.

Sites 1–3, 6–13 exist today; 4, 5, 14, 15 are added or re-tagged by this plan. Site 15 is
gated on the `fmt` fragment move, which is **out of scope here** (see §5).

**Explicitly not marked:** the bare `x-frak-client-id` arm on `track/*`. README §3.9 is
emphatic that it is permanent and correct.

### D-F. Web-wallet-proof-only vs. Tauri dual-arm — **do not split; the split is already free**

The task calls this the trickiest constraint. It dissolves on inspection: **no `IS_TAURI`
branch is needed, and none should be added.**

The web wallet and the binary run the same source, but they arrive at the install flow
through *different inputs*, and the input already discriminates:

- The **web** wallet is reached from the listener's install URL, which carries `#p=`
  whenever the SDK could sign (`buildInstallUrl.ts:20-21`). With WS-3, that proof is
  exchanged for a ticket and the ensure call is ticket-backed — i.e. **proof-only in
  substance**, without a platform check.
- The **binary** is reached via the Play referrer or a cold deep link. With WS-3 the
  referrer carries `proof=` too, so a *new* binary is equally ticket-backed. An *old*
  binary ignores the third key and uses the legacy pair — unchanged, unbricked.

The behavioural difference therefore comes from **whether a proof was present in the
input**, not from which shell is running. That is a data-driven branch, which is testable,
has one code path, and needs no `minVersion` coordination.

An `IS_TAURI` split would be actively wrong: `IS_TAURI` is true for both the *old* binary
(must stay permissive) and the *new* binary (could be strict), so it does not discriminate
the thing that matters. `minVersion` is the only correct discriminator for binary
generation, and it is a backend gate, not a client branch.

**Conclusion:** the web wallet gets proof-only behaviour *emergently*, via D-B's exchange.
The only place the strictness difference is enforced is the backend at Phase 5, gated on
`minVersion`. No client-side platform fork.

### D-G. The `proof_seen_at` DDL risk — **documented, not coded around** *(revised by repo owner)*

> **Revised after the oracle pass.** The oracle proposed a `42703` catch guard in the
> repository (WS-BE-0), shipping first and alone. The repo owner deferred it: *"it will be
> tackled when we finish the logical implementation."*

The finding in §1.2 stands and is real — the code does **not** fail open against a DB
without the column, contrary to what `DB-MIGRATION-REQUEST.md` and `DECISIONS.md` §5 both
claim. But it is a **deploy-ordering problem, not a logic problem**, and adding a
temporary shim to the repository layer is exactly the kind of scaffolding this plan is
trying to remove.

**Decision: fix the docs now, gate the deploy, write no guard code.**

- WS-4 corrects the false "harmless no-op" / "safe to deploy ahead of the DDL" claims and
  records that the DDL is a **hard deploy prerequisite**, not an optional lead-time
  optimisation.
- The DDL in `DB-MIGRATION-REQUEST.md` must be applied before this branch reaches any
  environment. That is a db-team dependency and it is now correctly labelled as blocking.
- If the DDL turns out to be genuinely unobtainable before ship, revisit the `42703`
  guard then — it is a ~10-line change and nothing in this plan depends on the decision.

**WS-BE-0 is dropped.** WS-BE-1 no longer has a prerequisite workstream.

---

## 3. Workstreams

Ordered. Each is independently shippable and scoped to minimise file overlap.

---

### ~~WS-BE-0~~ — dropped

See D-G. The `42703` guard is not being written; the DDL becomes a documented hard deploy
prerequisite instead (WS-4). WS-BE-1 has no prerequisite workstream.

---

### WS-BE-1 — revert both mandatory arms to latch-gated, and fix the dead proof check

**Owner:** backend worker A. **Depends on:** nothing.

**Files**
- `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts`
- `services/backend/src/api/user/identity/ensure.ts`
- `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.test.ts`
- `services/backend/test/api/user/identity/ensure.test.ts`

**Change**
1. **Delete `requireProof`** (`:82-102`). At `:151-157`, call `enforceProof` instead, with
   `binding: new Uint8Array(0)` (initiate has no merge token to bind — matches
   `getMergeToken.ts:29-33`).
2. Gate the `markProofSeen` at `:180-186` on `enforceProof`'s boolean return, mirroring
   `executeMerge:239-251`. Today it is unconditional because a proof was guaranteed; it no
   longer is, and latching an id that never proved possession would be a **one-way
   corruption** — it would permanently lock out a legacy id.
   🔴 **This is the highest-risk line in the workstream. Get it right.**
3. In `ensure.ts`, replace `resolveSdkEnsureAnonymousId`'s unconditional throw
   (`:113-118`) with the same latch-gated policy. Because `ensure.ts` has no orchestrator
   (DECISIONS §2.3), it needs the latch read: call
   `IdentityContext.repositories.identity.findNodeByIdentity` and 403 only when
   `proofSeenAt` is set; on a valid proof call `markProofSeen`.
   > Prefer extracting the shared policy rather than duplicating it a third time. The
   > cheapest correct shape is a small helper the orchestrator and `ensure.ts` both call.
4. **Fix the dead proof check on the wallet arm (D-B).** `ensure.ts:76-82` verifies the
   wallet arm's optional `proof` as `op: "frak-ensure-v1"` — an op the wallet can never
   produce, so the check fails for every proof it will ever see and only logs. Change the
   op to `"frak-install-v1"` (binding stays `new Uint8Array(0)`). Still verified-and-logged,
   still never required, still never rejects — only the op changes.
   Tag the site `ROLLOUT-STEP-3` with the note from D-B: when the bare `anonymousId` arm is
   deleted, decide whether `frak-install-v1` stays sufficient on its own or must be
   exchanged for a ticket.
5. Remove now-false `ROLLOUT-STEP-2` comments; retag the fail-open branches
   `ROLLOUT-STEP-3` per D-E items 3–4.
6. Keep the arm discriminator (`ensure.ts:236-247`) untouched.

**Acceptance**
- A `frak-install-v1` proof on the wallet arm now verifies successfully (assert against
  the golden fixture) instead of silently failing; an invalid one is still logged and
  still does not reject.
- Legacy pair with no proof: `/merge/initiate` (source arm) and `/identity/ensure` (SDK
  arm) both **200**.
- Same call for a **latched** id: **403 `PROOF_REQUIRED`**.
- Invalid proof anywhere: **403 `PROOF_INVALID`**.
- Valid proof latches the id; the next unproven call for it 403s.
- Wallet-session arm of `/merge/initiate` still never gated.
- `/merge/execute` behaviour unchanged.

**Tests**
- `AnonymousMergeOrchestrator.test.ts:73-112,275` — invert the three `PROOF_REQUIRED`
  assertions to "allowed when unlatched", and **add** "403 when latched".
- Add: initiate with no proof does **not** call `markProofSeen` (guards change 2).
- `ensure.test.ts:365-418` — same inversion for the SDK arm; keep `:472`'s
  "cannot dodge the arm by moving the id into the body" test, re-pointed at the latch.

---

### WS-2 — SDK / listener *(smallest workstream; may be folded into WS-4)*

**Owner:** sdk worker.

The SDK and listener already satisfy the revised decision (§1.3). Only:

**Files**
- `apps/listener/app/module/handlers/lifecycleHandler.ts` (comments only)
- `sdk/core/src/clients/createIFrameFrakClient.ts` (comments only)

**Change** — correct comments asserting the mandatory regime, and tag
`resolveMergeTarget`'s unproven fallback `ROLLOUT-STEP-3` (D-E item 14). **No behaviour
change.**

**Acceptance** — no runtime diff; existing SDK/listener suites pass unchanged.

**Explicitly out of scope:** the `?fmt=` search-param → fragment move. It is real
(DECISIONS §5) but orthogonal to dual-arm, is store-gated, and requires SDK-accepts-both
before the wallet switches. See §5.

---

### WS-3 — wallet: wire the proof through every install path 🔴 *the main workstream*

**Owner:** wallet worker. **Depends on:** WS-BE-0/1 deployed (the exchange calls a
permissive `generate`, which is already permissive, so it can develop in parallel).

**Files**
- `apps/wallet/app/routes/install.tsx`
- `apps/wallet/app/module/onboarding/hook/useInstallReferrer.ts`
- `apps/wallet/app/module/pending-actions/types.ts`
- `apps/wallet/app/module/pending-actions/stores/pendingActionsStore.ts`
- `apps/wallet/app/module/pending-actions/hook/useExecutePendingActions.tsx`
- `apps/wallet/app/module/recovery-code/hook/useResolveInstallCode.ts` (read-only check)

**Changes**

**W1 — `InstallProcessing` must receive and forward the proof.** Pass `proof` at
`install.tsx:99`. Inside, include it on the ensure action when present:
`{type:"ensure", merchantId, anonymousId, proof}`. With no proof, the action is exactly
today's `{merchantId, anonymousId}`. **No exchange, no extra network call** (D-B) — the
proof rides to `/identity/ensure` on the existing optional `proof` field alongside the
legacy pair.

**W2 — Play referrer carries both arms.** `install.tsx:262-267`:
`merchantId=…&anonymousId=…&proof=…`, appending `proof` only when present. Existing keys
keep their positions. Add the D-C measurement as a comment so the 1024-char budget is not
re-derived later.

**W3 — referrer consumer reads the proof.** `useInstallReferrer.ts`: read `proof` from the
`URLSearchParams`, add it to `ReferrerData`, and include it on the pending action it
writes. Keep `clientIdStore.setClientId(anonymousId)` (`:77`) — README §2.0 documents that
exception.

**W6 — `PendingEnsureAction` gains `proof?: string`, and `useExecutePendingActions` sends
it.** Body becomes
`{merchantId, anonymousId, ...(ticket && {ticket}), ...(proof && {proof})}` — every arm
travels together (decision 1). Tag `ROLLOUT-STEP-3`.

**W7 — `useResolveInstallCode` forwards a proof too** if one is in scope on that path, for
consistency; the ticket remains the primary credential there and takes precedence
backend-side.

**W4 — `pendingActionsStore` gains `version: 1` + identity `migrate`.** README §5 step 1
asks for this "now, while the migration is a no-op". A store persisted by an old build has
no `version`; zustand treats that as `0`, so the migrate must return the state untouched.
🔴 **Must not throw on rehydrate** — the same store backs `navigation` actions used by
pairing and deep links (README §6.1).

**W5 — dedupe key.** Prefer `ensure:${merchantId}:${ticket}` when a ticket is present,
else the existing `ensure:${merchantId}:${anonymousId}`. Tag the legacy branch.

**Telemetry (answers §9.4, per D-D).** On `install_page_viewed`, add
`has_install_proof: Boolean(proof)`; on the referrer path, `has_referrer_proof`. Together
these measure fragment survival in production.

**Acceptance**
- Direct link **with** `#p=`, logged-in web: an ensure action carrying `proof` is stored
  and drained; the ensure call includes `merchantId`, `anonymousId` **and** `proof`, and
  the backend verifies the proof successfully (end-to-end against WS-BE-1).
- No extra network round-trips are introduced on the direct-link path.
- Same link with the fragment **stripped**: falls back to the bare pair, attribution
  preserved, no error surfaced.
- Play referrer with `proof=`: new binary exchanges it for a ticket; **a build without W3
  parses the same string and ignores `proof`** (assert with the literal string).
- A `frak_pending_actions_store` payload written by the current build rehydrates cleanly
  with `version: 1`, `navigation` actions intact.
- Ensure body always contains `merchantId` + `anonymousId`, plus `ticket` when available.

**Tests**
- `install.test.tsx` — extend: proof present → action carries `proof`; no proof → bare
  action, byte-identical to today.
- New `useInstallReferrer.test.ts` — dual-key string parses; proof-less string still works;
  malformed proof degrades.
- `pendingActionsStore` — rehydrate an unversioned payload; ticket-based dedupe.
- `useExecutePendingActions.test.tsx` — body shape with and without a ticket.
- Keep `parseInstallProofFragment`'s existing never-throws coverage.

---

### WS-4 — docs + marker hygiene

**Owner:** docs worker. **Depends on:** WS-BE-1 and WS-3 landing (describe reality).

**Files** — `docs/plans/identity-proof-of-possession/{ROLLOUT,DECISIONS,README,DB-MIGRATION-REQUEST}.md`

**Edits**

*`ROLLOUT.md`* — largest change.
- "What is already safe to enforce now": `/merge/initiate` source arm and `/identity/ensure`
  SDK arm move from **Enforced** to **latch-gated**. Delete the sentence claiming the SDK
  arm is enforced.
- "Steps 1 and 2 — done": rewrite "**Mandatory:** …" → "**Latch-gated:** `/merge/initiate`
  source arm, `/merge/execute`, `/identity/ensure` SDK arm."
- Replace the "safe to deploy ahead of the DDL" claim with §1.2's finding and the WS-BE-0
  guard.
- Update the grep line to `ROLLOUT-STEP-1|ROLLOUT-STEP-3` and inline D-E's inventory.

*`DECISIONS.md`*
- **D9** — its "Resolved in `3e84f376e`… the source arm is now unconditional" is reverted.
  Rewrite: latch-gated on all three arms, with D-A's cost accounting. Keep the history.
- §5 open items — replace the DDL bullet with §1.2; add "`#p=` survival is no longer
  load-bearing (D-D)".
- §4 commit table — mark `STEP-2` superseded.
- Add a D10 row: install proof → ticket exchange, never a `frak-install-v1` arm on ensure
  (D-B).

*`README.md`* — minimal, it is the "why" document.
- §7 Phase 4a — note that "a legacy id may be a merge *target* but never a merge *source*"
  is deferred past Phase 5; the source arm is latch-gated.
- §5 step 1 — tick the now-done referrer `proof=` and `pendingActionsStore version: 1`.
- §9.4 — record D-D: answered by telemetry, no longer blocking.

*`DB-MIGRATION-REQUEST.md`* — correct the false "no-op (harmless)" claim; reference WS-BE-0.

**Acceptance** — no doc claims an arm is mandatory; the grep in `ROLLOUT.md` returns
exactly the D-E inventory; every changed doc statement is traceable to a file:line.

---

## 4. Conflict hotspots

| File | Workstreams | Owner |
|---|---|---|
| `IdentityRepository.ts` | WS-BE-1 (latch reads from `ensure.ts`) | backend worker A |
| `AnonymousMergeOrchestrator.ts` (+ its test) | WS-BE-1 only | backend worker A |
| `ensure.ts` (+ its test) | WS-BE-1 only | backend worker A |
| `install.tsx` | WS-3 W1 + W2 (same file, two changes) | **wallet worker** — single owner, one commit |
| `pendingActionsStore.ts` | WS-3 W4 + W5 | wallet worker |
| `types.ts` (pending-actions) | WS-3 W6 | wallet worker |
| `lifecycleHandler.ts` | WS-2 (comments) | sdk worker |
| the four plan docs | WS-4 only | docs worker |

**All backend policy work is one owner (A) in two sequential commits.** The latch policy
touches three files with one semantic; splitting it across workers reproduces the
`ensure.ts` serialisation problem DECISIONS §4 already recorded.

Backend, wallet, sdk and docs have **zero file overlap** and run fully in parallel — except
that WS-4 describes the others, so it merges last.

**Suggested order:** (`WS-BE-1` ‖ `WS-3` ‖ `WS-2`) → `WS-4`.

---

## 5. Explicitly out of scope

- **`?fmt=` search param → fragment.** Real (DECISIONS §5) but orthogonal, store-gated,
  and requires SDK-accepts-both first. Track separately.
- **§2.6 legacy → derived migration merge.** Still deferred per D6. Latch-gating does not
  change that calculus.
- **Phase 5 / `ROLLOUT-STEP-3` execution.** Blocked on store approval + `minVersion`.
- **`install-code/generate` requiring a proof.** Stays permissive; `installCode.ts:11-23`
  documents why (the wallet's own sharing page has nothing to sign with).
- **Alertmanager destinations** (README §9.3).

---

## 6. Residual risks

1. **Derived-but-never-signed ids stay claimable** until their first proof-carrying call.
   Inherent to latch-gating; accepted by decision 3. Bounded by the listener already
   sending proofs on the affected arms.
2. **Legacy ids remain claimable forever.** README §2.6 proves unfixable. Unchanged.
3. 🔴 **The `proof_seen_at` DDL is a hard deploy prerequisite** (D-G). Deploying this
   branch against a DB without the column 500s `/merge/execute` and the initiate anon arm.
   No guard is being written; the mitigation is deploy ordering plus corrected docs.
4. **`markProofSeen` gating on `initiate` (WS-BE-1 change 2) is one-way.** A latch written
   for an id that never proved possession permanently locks that id out. Needs the explicit
   test called for above.
5. **`frak-install-v1` becomes load-bearing at `ROLLOUT-STEP-3`** (D-B). Today it is
   redundant with an open bare-`anonymousId` arm, so accepting it costs nothing. When that
   arm is deleted, the op's "high" leak rating (README §2.2) starts to matter and the
   ticket-exchange option must be reconsidered from the tagged site.