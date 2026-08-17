# Anonymous ID Proof-of-Possession — Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543a89c29bb81279c26dfa445e441b61d1` · **Range audited:** `2a51ba4c8` (plan) … `a9e4dc543` (HEAD), principally `71ea819ac`…`cc826290a` plus the native/backend follow-ups `0542b55d1`, `f6ff19afc`, `7a673da17`, `98d424362`, `97ee0c1ed`.

## Status — remediated 2026-08-18

**Both criticals and every P0 but AID-017 are closed.** Of the rest, AID-003, AID-008,
AID-013, AID-015 and AID-017 are open, and AID-005 is open by design — it is the population
`/merge/execute` is deliberately left unflipped for. The programme that closed the others is
recorded in
[`../plans/identity-proof-of-possession/README.md`](../plans/identity-proof-of-possession/README.md),
which is the authoritative document for what remains open and for the invariants that must not be
undone. The surface map and admission plan this file used to point at are deleted; their `G*` gap
ids are gone with them, so the table below now carries status directly.

This file is retained as the **audit record**: what was examined, what was found, and the ids and
severities other audit reports cross-reference.

## Verdict

The cryptographic core is sound, and I could not break it. `IdentityProofService#check` derives the id from the public key embedded in
the proof and compares it to the id the caller claimed, rejecting `id_mismatch` before the signature is even checked
(`services/backend/src/domain/identity/services/IdentityProofService.ts:144-146`). The signed message is frozen, merchant-scoped,
cross-platform and fixture-pinned; a proof minted for merchant A is rejected for merchant B, and mutation-testing the message
construction reddens 12 backend tests. So **a spoofed stored client id cannot assert another identity anywhere a proof is required** —
the id↔key binding is verified, not registered, and there is no TOFU race to lose.

The defect is not any single route. It is that the latch is **fail-open on ids that have never proven**: `enforceLatchedProof` refuses
only when `proof_seen_at` is already set, and returns `false` — which every caller reads as *allow* — for a node that never signed.
That is precisely the pre-install population: the sharer and the buyer holding unclaimed, unsettled attribution with no wallet
attached yet. `WALLET_CONFLICT` is the only other brake and it fires only when both groups already carry different wallets, so it is
absent on exactly the same set. And this is money, not bookkeeping: `SettlementOrchestrator.ts:269` resolves the payout wallet through
the identity group, so whoever captures the group is the one paid.

## Findings

Severity is technical; Priority is the schedule (`P0-now` · `P1-next` · `P2-when-picked-up`) **as
judged on 2026-08-15** — both columns are left at their original values so other audit reports that
cite them still resolve. Status is current.

| ID | Severity | Priority | One-line finding | Status |
|---|---|---|---|---|
| AID-001 | Critical | **P0-now** | Unauthenticated `install-code/generate`+`resolve` launders any `anonymousId` into an install ticket whose branch in `ensure` never reads the latch | **Closed.** `generate`'s anonymous arm requires a valid proof, so a ticket is only ever minted for a proven id or a server-derived one |
| AID-020 | Critical | **P0-now** | Any wallet can claim an arbitrary unlatched `anonymousId` via `merge/initiate`+`merge/execute` in two calls, with no proof and no install code | **Closed at step 1.** `/merge/initiate`'s anon-source arm refuses without a proof, breaking the chain before `execute` is reached |
| AID-003 | High | P1-next | Merge tokens are never consumed: a captured `?fmt=` is a 60-min unlimited-use group-capture capability | **Open.** Reach now requires a proof to obtain, which bounds who can mint one, but a captured token is still replayable for its TTL |
| AID-004 | High | P1-next | A `localStorage` quota error deletes a valid private key, then migration silently orphans the identity | **Closed.** `persistIdentity` sits outside `ensureIdentityKey`'s guarded block, so a write failure never reaches the catch that clears the key; the legacy marker is written before the key/id pair, and `pendingLegacyId` is returned from memory whether or not the write landed, so the merge retries next visit. Two regression tests pin both halves |
| AID-005 | High | P1-next | The legacy id survives migration as a permanently unlatched alias for a latched identity | **Open by design.** This is the population `/merge/execute` is deliberately left unflipped for |
| AID-018 | High | **P0-now** | The `ROLLOUT-STEP-3` marker set is incomplete: three backend sites carrying the same bypass have no marker | **Closed.** The unmarked door was the `x-frak-client-id` header fall-through; it lands on the same bare exit, which now refuses |
| AID-006 | Medium | P1-next | `anonymous_fingerprint` is case-normalised for proof verification but not for persistence | **Closed.** `IdentityRepository#normalizeValue` now lower-cases it, and that one method governs both lookup and persist. Safe because ids are lowercase by construction — `deriveClientIdFromHash` builds them from `bytesToHex`, and server-minted ones from `crypto.randomUUID()` |
| AID-007 | Medium | P1-next | Three identity limiters share `name`+`seed` and collapse into one bucket | **Closed.** Distinct buckets: `identity-ensure`, `identity-merge`, `identity-install-code-generate`, `identity-install-code-resolve` |
| AID-008 | Medium | P1-next | The `frak-sso-v1` proof rides in a search param and is never stripped from the URL | **Open.** Client-side, untouched |
| AID-009 | Medium | P1-next | `getMergeToken` signs over `config.metadata.merchantId`, not the resolved one | **Closed.** The handler reads the resolved `merchantId` off the listener context |
| AID-010 | Medium | P1-next | `weightCache` is not invalidated on wallet attach, so `WALLET_CONFLICT` can read stale state | **Closed.** Invalidation had already shipped; the finding was stale when written |
| AID-011 | Medium | P2-when-picked-up | `WALLET_ALREADY_LINKED` is unreportable on the standalone `/install` surface | **Closed.** Conflict surface added, bundle delta measured against the eager budget |
| AID-012 | Medium | P1-next | Inbound `fmt` is consume-on-read with new hard-failure modes and no retry | **Mostly closed.** The redemption itself now retries a network failure or a 5xx twice (~5 s) in `lifecycleHandler`, where the HTTP status is actually observable; a 4xx is never retried, so a new refusal code cannot become retryable by omission. Safe to repeat because the token is not consumed server-side (AID-003). Residual: a page closed mid-backoff, and the SDK→listener `postMessage` hop, which has no ack — both need a durable queue, which would put a replayable group-capture token at rest on disk |
| AID-019 | Medium | P1-next | The install ticket is 7-day, non-single-use, and one code yields up to 20 tickets | **Partly closed, partly accepted.** TTL is env-driven and clamped; multi-use is now a recorded decision in `jwt.ts` — a burn-set deadlocks the wallet's retry loop. The 20-per-code fan-out stands |
| AID-013 | Low | P2-when-picked-up | No test pins cross-merchant proof scoping (property holds; coverage does not) | **Open.** Still the cheapest item outstanding |
| AID-014 | Low | P1-next | Every validity window in `README.md` is wrong, and the fragment-only rule is absolute where the code is not | **Closed.** That README was rewritten; windows are no longer restated where they can drift |
| AID-015 | Low | P2-when-picked-up | The envelope version byte is not covered by the signature | **Open.** Codec-level, untouched |
| AID-016 | Low | P2-when-picked-up | Ensure actions retry permanently-doomed 4xx/403 requests for a week | **Closed.** All six refusal codes are non-retryable in `drainEnsures`, which is what makes the deploy-day burst decay |
| AID-017 | Low | **P0-now** | An `frak-ensure-v1` proof is an unbound 30-day bearer credential | **Open, scheduled.** Binding it changes a signed message, which needs ~30 days of dual-accept across two store binaries |

The wallet-session-arm branch on `/merge/execute` that this audit originally proposed as the AID-020 P0 fix is **bypassable** —
`api/user/identity/merge.ts` passes both `sourceAnonymousId` and `sourceWalletAddress`, so an attacker supplies their own derived id
plus a valid proof for it and the branch never fires. It closes a code path, not an outcome; treat it as alarm-only instrumentation,
not a remedy. It shipped as exactly that: `identity_merge_execute_wallet_source_unproven_total`,
a labelled alarm, never a gate. The real fix was closing `/merge/initiate`.

## AID-002

**Closed.** The `/identity/ensure` bare wallet arm no longer nullifies the latch: it throws
`PROOF_OR_TOKEN_REQUIRED`. Both carry-overs went with it — the `x-frak-client-id` header fallback
lands on the same exit (AID-018), and the ticket half is only reachable for a credential already
presented at `generate` (AID-001).

## Audit coverage

Findings are scored against the post-`ROLLOUT-STEP-3` baseline. The attack chains were verified by reading route wiring, orchestrators
and schema, not by executing requests: **no emulator, no simulator and no live database were used**, and each chain is a 3–4 request
reproduction that should be confirmed on staging before triage. The crypto claims *were* verified by execution — a mutation test over
the signed message and a cross-merchant replay test, both cleaned up afterwards. **The local `node_modules` install was broken** in
this checkout (`react` is not hoisted, because the working-tree `bun.lock` carries internal verdaccio URLs), so **every React/DOM
suite fails locally with `React.act is not a function` and none could be run**; that is an install artifact, not a defect in scope,
and no React/DOM test result informs any finding here. The pure-logic backend and SDK identity suites ran fine. Not verified: whether
the `proof_seen_at` migration is applied in every environment — confirm this first, because if the column is missing anywhere every
proof-absent merge 500s; whether any production client emits a mixed-case `anonymousId`; and whether a host-embedded wallet page with
no `returnScheme` occurs in any live merchant configuration. Not traced: `IdentityWeightService#determineAnchor`'s tie-break, which
sets the blast radius of every capture above. The dark corner for the next auditor is the composed HTTP layer — nearly all backend
coverage is unit-level against orchestrators, and the most serious findings here are route-wiring mistakes no unit test could catch.
