# Anonymous ID Proof-of-Possession — Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543a89c29bb81279c26dfa445e441b61d1` · **Range audited:** `2a51ba4c8` (plan) … `a9e4dc543` (HEAD), principally `71ea819ac`…`cc826290a` plus the native/backend follow-ups `0542b55d1`, `f6ff19afc`, `7a673da17`, `98d424362`, `97ee0c1ed`.

## Status — re-verified 2026-09-04 against `5f7c52f33`

**Both criticals and every P0 are closed** — AID-001, 002, 004, 006, 007, 009, 014,
016, 018 and 020 are deleted from this file; the programme that closed them is recorded in
[`../plans/identity-proof-of-possession/README.md`](../plans/identity-proof-of-possession/README.md),
which also holds the invariants that must not be undone. What is left below is open, partial, or
open by design (AID-005 is the population `/merge/execute` is deliberately left unflipped for).

The 2026-09-04 pass re-read every closure against the tree rather than the remediation commit
messages. Three corrections to the 2026-08-18 statuses: **AID-011 regressed** on 2026-09-03
(`337260551`); **AID-010** is partial, not closed; **AID-017** is de-prioritised to P2 (still Low: a captured proof only wins a group that never got its wallet). It also found one
operational blocker — the prod migration for `install_codes.checkout_token` does not exist — and
three new app-side defects, all listed under [Re-verification 2026-09-04](#re-verification-2026-09-04).

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
| AID-003 | High | P1-next | Merge tokens are never consumed: a captured `?fmt=` is a 60-min unlimited-use group-capture capability | **Open.** Reach now requires a proof to obtain, which bounds who can mint one, but a captured token is still replayable for its TTL |
| AID-005 | High | P1-next | The legacy id survives migration as a permanently unlatched alias for a latched identity | **Open by design.** This is the population `/merge/execute` is deliberately left unflipped for |
| AID-008 | Medium | P1-next | The `frak-sso-v1` proof rides in a search param and is never stripped from the URL | **Open.** Client-side, untouched |
| AID-010 | Medium | P1-next | `weightCache` is not invalidated on wallet attach, so `WALLET_CONFLICT` can read stale state | **Partial.** The merge paths invalidate; the three `addNode` callers (`auth/email.ts`, `IdentityOrchestrator.ts`, `InstallCredentialOrchestrator.ts`) still do not, so a weight can be ≤30 s stale after a wallet attach. Low residual |
| AID-011 | Medium | P2-when-picked-up | `WALLET_ALREADY_LINKED` is unreportable on the standalone `/install` surface | **Regressed 2026-09-03.** `337260551` removed `EnsureConflictToast` from `entry/install/main.tsx` on the premise that the SPA surfaces the conflict after the redirect. It cannot: `ensureConflictStore` is not persisted, the exit is `window.location.replace("/wallet")`, and `drainEnsures` removes the action before raising. Re-mount the toast or persist the flag |
| AID-012 | Medium | P1-next | Inbound `fmt` is consume-on-read with new hard-failure modes and no retry | **Mostly closed.** The redemption itself now retries a network failure or a 5xx twice (~5 s) in `lifecycleHandler`, where the HTTP status is actually observable; a 4xx is never retried, so a new refusal code cannot become retryable by omission. Safe to repeat because the token is not consumed server-side (AID-003). Residual: a page closed mid-backoff, and the SDK→listener `postMessage` hop, which has no ack — both need a durable queue, which would put a replayable group-capture token at rest on disk |
| AID-019 | Medium | P1-next | The install ticket is 7-day, non-single-use, and one code yields up to 20 tickets | **Partly closed, partly accepted.** TTL is env-driven and clamped; multi-use is now a recorded decision in `jwt.ts` — a burn-set deadlocks the wallet's retry loop. The 20-per-code fan-out stands |
| AID-013 | Low | P2-when-picked-up | No test pins cross-merchant proof scoping (property holds; coverage does not) | **Open.** Still the cheapest item outstanding |
| AID-015 | Low | P2-when-picked-up | The envelope version byte is not covered by the signature | **Open.** Codec-level, untouched |
| AID-017 | Low | P2-when-picked-up (was P0-now) | An `frak-ensure-v1` proof is an unbound 30-day bearer credential | **Open.** Binding still `32 zero bytes` (`sdk/core/src/identity/canonical.ts`), window still 30 days. Re-read 2026-09-04: the proof is only minted while a wallet is connected (`watchWalletStatus.ts`), so a replay hits `WALLET_CONFLICT` unless the original link never committed — the reachable population is "ensure 5xx'd after the proof left the browser", and the proof travels in a POST body no backend log prints. Fix is cheap (bind `SHA-256(walletAddress)` as `frak-ensure-v2`, v1 fallback; only `sdk/core` mints it, no native side) but not urgent |

## Re-verification 2026-09-04

Against `dev` @ `5f7c52f33`; nothing below is on `origin/main`. Every closure in the table was
re-read in the code and its tests (`installCode.test.ts`, `sign.test.ts`, `ensure.test.ts`,
`AnonymousMergeOrchestrator.test.ts`), not taken from the remediation commits. The closures hold
except where the table now says otherwise. New findings continue the id space so cross-references
stay unambiguous.

| ID | Severity | Priority | Finding |
|---|---|---|---|
| AID-021 | High (operational) | **P0-now** | **The prod migration for `install_codes.checkout_token` does not exist.** `services/bootstrap/drizzle/prod/` stops at `0020`; the column (plus `anonymous_id DROP NOT NULL`, the `install_codes_credential_present` CHECK and two indexes) lives only in `dev/0043` and `local/0039` (`630af0dfc`). `migrate-pg.ts` selects `./drizzle/prod` when `STAGE` is prod, and `InstallCodeRepository.ts` names `checkout_token` in raw SQL on both `generate` and `resolve` — every install-code call 500s with `42703` the moment this reaches `main`. Generate the prod migration before merging |
| AID-022 | Medium | P1-next | **A logged-in user never drains a queued ensure outside the auth pages.** `useExecutePendingActions` is mounted only by `register.tsx`, `login.index.tsx` and `LoginWithEmailPage`; `fireEnsureActions` only by `InstallView`. `_auth.tsx`'s `beforeLoad` bounces a logged-in user to `/wallet`, whose layout drains nothing. An ensure queued by `useResolveInstallCode` or `useInstallReferrer` from a logged-in session sits until the 7-day TTL, contradicting the "next launch" comments in `pendingActionsStore`. Drain from the wallet layout |
| AID-023 | Low | P2-when-picked-up | **Three non-retryable 400s are retried for the TTL.** `ensure.ts` throws `MERCHANT_MISMATCH`, `ANONYMOUS_ID_MISMATCH` and `INCOMPLETE_IDENTITY` as 400s; none is in `drainEnsures`' `MISSING_CREDENTIAL_CODES`, so the action is retried on every launch for a week. Same class as the closed AID-016, three codes wider. One-line fix |
| AID-024 | Low | P2-when-picked-up | **The identity rate limiter is single-instance, in-memory and IP-keyed** (`rateLimiter.ts`). The replay and enumeration bounds relied on by AID-003 and AID-019 do not hold across replicas or behind a shared egress |
| AID-025 | Nit | P2-when-picked-up | **Stale "verified, not enforced" comments** contradict the enforced code at `installCode.ts` (generate's anonymous arm), `ensure.ts` ("Verified when present, never required"), `latchedProof.ts` (two `ROLLOUT-STEP-3` markers), and the wallet's `drainEnsures.ts` / `pendingActionsStore.ts` / `pending-actions/types.ts`, which still name `ENSURE_BARE_ARM_ENABLED`, a backend flag deleted by `8cdd4b8e4`. Comment-budget item; the next reader will "fix" the code to match |

**Not re-verified in this pass:** AID-015 (codec-level; no commit under `sdk/core/src/identity/`
touched the envelope since the audit, so "untouched" is taken on that evidence); whether `validateToken` honours `exp` with clock skew (assumed
standard `jose`). No request was executed against a live backend.

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
