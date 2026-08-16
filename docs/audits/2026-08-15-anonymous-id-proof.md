# Anonymous ID Proof-of-Possession — Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543a89c29bb81279c26dfa445e441b61d1` · **Range audited:** `2a51ba4c8` (plan) … `a9e4dc543` (HEAD), principally `71ea819ac`…`cc826290a` plus the native/backend follow-ups `0542b55d1`, `f6ff19afc`, `7a673da17`, `98d424362`, `97ee0c1ed`.

## Status — 2026-08-15

The detailed analysis and the remediation for every finding recorded here now live in `docs/plans/identity-proof-of-possession/`, in
two documents:

- **`MERGE-SURFACE-MAP.md`** — where identities get merged, what attests each side, and the `G*` gap ids that carry these findings
  forward.
- **`MERGE-ADMISSION-PLAN.md`** — the admission decision and the tiered remediation programme.

This file is retained as the **audit record**: what was examined, what was found, and the ids, severities and priorities that the
other audit reports and the plan documents cross-reference. It is no longer a working document. **For anything actionable — current
analysis, remedy, sequencing, effort — the plan documents are authoritative**, and where the two disagree, the plans win.

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

Severity is technical; Priority is the schedule (`P0-now` · `P1-next` · `P2-when-picked-up`). Every id below is load-bearing — other
audit reports and the plan documents cite these numbers. "Now tracked as" points at the gap id in `MERGE-SURFACE-MAP.md`; an empty
cell means the map does not carry that finding.

| ID | Severity | Priority | One-line finding | Now tracked as |
|---|---|---|---|---|
| AID-001 | Critical | **P0-now** | Unauthenticated `install-code/generate`+`resolve` launders any `anonymousId` into an install ticket whose branch in `ensure` never reads the latch | G3 (client half G12) |
| AID-020 | Critical | **P0-now** | Any wallet can claim an arbitrary unlatched `anonymousId` via `merge/initiate`+`merge/execute` in two calls, with no proof and no install code | G2 |
| AID-003 | High | P1-next | Merge tokens are never consumed: a captured `?fmt=` is a 60-min unlimited-use group-capture capability | G4 (initiate binding G7) |
| AID-004 | High | P1-next | A `localStorage` quota error deletes a valid private key, then migration silently orphans the identity | G23 |
| AID-005 | High | P1-next | The legacy id survives migration as a permanently unlatched alias for a latched identity | G27 |
| AID-018 | High | **P0-now** | The `ROLLOUT-STEP-3` marker set is incomplete: three backend sites carrying the same bypass have no marker | |
| AID-006 | Medium | P1-next | `anonymous_fingerprint` is case-normalised for proof verification but not for persistence | G8 |
| AID-007 | Medium | P1-next | Three identity limiters share `name`+`seed` and collapse into one bucket | G19 |
| AID-008 | Medium | P1-next | The `frak-sso-v1` proof rides in a search param and is never stripped from the URL | G6 (transport half) |
| AID-009 | Medium | P1-next | `getMergeToken` signs over `config.metadata.merchantId`, not the resolved one | G23 |
| AID-010 | Medium | P1-next | `weightCache` is not invalidated on wallet attach, so `WALLET_CONFLICT` can read stale state | G25 |
| AID-011 | Medium | P2-when-picked-up | `WALLET_ALREADY_LINKED` is unreportable on the standalone `/install` surface | |
| AID-012 | Medium | P1-next | Inbound `fmt` is consume-on-read with new hard-failure modes and no retry | G13 (adjacent) |
| AID-019 | Medium | P1-next | The install ticket is 7-day, non-single-use, and one code yields up to 20 tickets | G3 |
| AID-013 | Low | P2-when-picked-up | No test pins cross-merchant proof scoping (property holds; coverage does not) | |
| AID-014 | Low | P1-next | Every validity window in `README.md` is wrong, and the fragment-only rule is absolute where the code is not | |
| AID-015 | Low | P2-when-picked-up | The envelope version byte is not covered by the signature | |
| AID-016 | Low | P2-when-picked-up | Ensure actions retry permanently-doomed 4xx/403 requests for a week | |
| AID-017 | Low | **P0-now** | An `frak-ensure-v1` proof is an unbound 30-day bearer credential | G5 |

The wallet-session-arm branch on `/merge/execute` that this audit originally proposed as the AID-020 P0 fix is **bypassable** —
`api/user/identity/merge.ts` passes both `sourceAnonymousId` and `sourceWalletAddress`, so an attacker supplies their own derived id
plus a valid proof for it and the branch never fires. It closes a code path, not an outcome; treat it as alarm-only instrumentation,
not a remedy. The plan documents own the fix.

## Closed by ROLLOUT-STEP-3

- **AID-002 (was Critical) — the `/identity/ensure` bare wallet arm nullifies the latch.** Step 3 deletes the bare bearer arm; the
  carry-overs are the `x-frak-client-id` header fallback (`ensure.ts:213-225`) and the still-unproven ticket half, which is AID-001.
  Tracked as G1.
- **The bare-arm half of the `README.md` §2 drift.** The latch invariant stays false after step 3, via AID-001.

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
