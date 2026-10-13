# Anonymous ID Proof-of-Possession — Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543a89c29bb81279c26dfa445e441b61d1` · **Range audited:** `2a51ba4c8` (plan) … `a9e4dc543` (HEAD), principally `71ea819ac`…`cc826290a` plus the native/backend follow-ups `0542b55d1`, `f6ff19afc`, `7a673da17`, `98d424362`, `97ee0c1ed`.

## Status — re-verified 2026-10-13 against `5638ed04f`

**Both criticals and every P0 are closed.** AID-001, 002, 004, 006, 007, 009, 014, 016, 018 and 020
were deleted from this file in earlier passes. The programme that closed them is recorded in
[`../plans/identity-proof-of-possession/README.md`](../plans/identity-proof-of-possession/README.md),
which also holds the invariants that must not be undone. The enforcing code and the prod migration
are now on `origin/main`; the 2026-09-04 note that nothing was is out of date.

This pass re-read every remaining finding in the code, not in the commit messages. Two leave the file:

- **AID-021 — closed by `682c4089d` (2026-09-07).** `services/bootstrap/drizzle/prod/0021_aspiring_shiva.sql`
  adds `install_codes.checkout_token`, drops `NOT NULL` on `anonymous_id`, and adds the
  `install_codes_credential_present` CHECK and `install_codes_merchant_checkout_token_idx`. It is
  listed in `prod/meta/_journal.json`. Prod is now at `0022` (`accc4e217`). I read the files; I did
  not query a database.
- **AID-010 — no longer applicable.** No commit closed it. The premise does not hold. Weight reads
  `getWalletForGroup`, and only a `wallet` node changes that. `addNode` is called from
  `IdentityOrchestrator.ts:56` (creates a new group, so no weight is cached yet), `:293` (email),
  `InstallCredentialOrchestrator.ts:200` (server-minted anonymous id) and `api/user/wallet/auth/email.ts:115`
  (email). None attaches a wallet to an existing group. A wallet joins a group only through a merge,
  and `associate` (`IdentityOrchestrator.ts:128-130`) and `WalletMergeOrchestrator.ts:302-313`
  invalidate both sides. The 30 s TTL (`IdentityWeightService.ts:85-88`) can still stale the asset,
  referral and interaction counts. That only skews an anchor tie-break; it cannot hide a
  `WALLET_CONFLICT`.

Thirteen findings stay. **Open:** AID-003, 005, 008, 011, 013, 015, 017, 022, 023, 024. **Partial:**
AID-012, 019, 025. Severities and priorities are unchanged.

**AID-011 is still regressed.** `337260551` took the toast out of the standalone `/install` page and
nothing has put it back. See the table.

**The `/merge/execute` gate is still unflipped, on purpose.** `executeMerge` passes
`refuseUnproven: false` (`AnonymousMergeOrchestrator.ts:252`) and `initiateMerge` passes `true`
(`:160`). The parameter is required (`:54`), so deleting it is a compile error. An unproven target is
admitted when its node exists and has never latched (`:289`), and refused with `TARGET_NOT_FOUND`
when it does not. Plan README §3 describes this correctly. It is also what keeps AID-005 open.

Three claims in the 2026-09-04 text were wrong and are corrected below: AID-005's proposed fix was
attributed to a plan row that rejects it; AID-019's ticket TTL is a fixed constant, not env-driven;
AID-024 over-reached on the install-code cap, which is stored in Postgres. The AID-005 correction is
spelled out under [Findings added 2026-09-04](#findings-added-2026-09-04).

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
judged on 2026-08-15** — both columns lead with their original values so other audit reports that
cite them still resolve, and carry any later re-grade after an arrow. Each finding cell ends with
the current read.

| ID | Severity | Priority | Finding |
|---|---|---|---|
| AID-003 | Medium | P1-next | Merge tokens are never consumed: a captured `?fmt=` is a 60-min unlimited-use group-capture capability. **Open.** `validateToken` (`AnonymousMergeService.ts:56`) verifies the JWT and that the source group exists — no `jti`, no `consumed_at`, no burn. TTL is 60 min (`jwt.ts:45-52`) and `jose` enforces it (`jwt.ts:224`). Minting requires a proof, which bounds who can obtain one, but `?fmt=` sits in the address bar (`iframeLifecycleManager.ts:66,87`, `InAppBrowserToast/index.tsx:168`, `ExplorerDetail/index.tsx:115`) and `createIFrameFrakClient` only strips it after the iframe connects (`createIFrameFrakClient.ts:410-419`), so anything scraping `location.href` has already shipped it off-box. `01fae51d5` now addresses the iframe→parent `postMessage` of the token to the merchant origin; the address bar is unchanged. Replay merges the victim's group into the attacker's; `associate` throws `WALLET_CONFLICT` on differing wallets, so the only paying case is a wallet-less victim group whose unsettled attribution then settles to the attacker. Do **not** fix by burning on first use — `createIFrameFrakClient` and AID-012's retry both rely on non-consumption; bind the token to its target, or consume with an idempotency window |
| AID-005 | High | P1-next | The legacy id survives migration as a permanently unlatched alias for a live identity group. **Open.** `migrateLegacyIdentity` sends `/merge/execute` with no proof (`migrateLegacyIdentity.ts:139-153`; the proof it signs at `:99-107` is for `/merge/initiate`), so `markProofSeen` never runs on the legacy node — a *successful* migration still leaves it unlatched, and `mergeGroups` repoints it into the now-live group. It is a live alias, not a stale orphan. The id is a bare `localStorage` UUID published as `c` in every pre-derivation `fCtx` link, so unlike AID-003 there is no capture step and no expiry: mint a token for your own id, `execute` against a public legacy id, and `refuseUnproven: false` (`AnonymousMergeOrchestrator.ts:252`) lets it through as long as the node exists (`:289`). Most reachable finding in this file. **No fix is on file** — see the AID-005 note below. While the gate stays unflipped (plan README §3) the alias stays claimable, so the choice is §3's: flip and write off the keyless tail, or accept this |
| AID-008 | Medium | P1-next | The `frak-sso-v1` proof rides in a search param and is never stripped from the URL. **Open.** Client-side, untouched. `generateSsoUrl` packs it as `pf` into `?p=` (`sdk/core/src/utils/sso/sso.ts:47,103`). The wallet's `/sso` route decodes it in `beforeLoad` and leaves the URL alone (`apps/wallet/app/routes/_wallet/_sso/sso.tsx:60-96`). The backend takes it only inside a 10-minute window (`IdentityProofService.ts:27-30`), which is the only bound on a captured URL |
| AID-011 | Medium | P2-when-picked-up | `WALLET_ALREADY_LINKED` is unreportable on the standalone `/install` surface. **Regressed 2026-09-03, still open.** `337260551` removed `EnsureConflictToast` from `entry/install/main.tsx` on the premise that the SPA surfaces the conflict after the redirect. It cannot. `ensureConflictStore` is a plain in-memory store (`ensureConflictStore.ts:19`). `fireEnsureActions` removes the action before it raises (`drainEnsures.ts:101-109`). `InstallView.tsx:258` fires the ensure, and the page leaves through `window.location.replace("/wallet")` after `MIN_PROCESSING_MS` = 500 ms (`InstallView.tsx:146`, `main.tsx:48`). The SPA document starts with `raised: false`, so the toast mounted in `AppShell/index.tsx:125` never sees it. A fast response raises the flag where no toast is mounted; a slow one is cut off by the navigation. Re-mount the toast or persist the flag |
| AID-012 | Medium | P1-next | Inbound `fmt` is consume-on-read with new hard-failure modes and no retry. **Mostly closed; the residual stands.** The redemption retries a network failure or a 5xx twice (~5 s) in `lifecycleHandler` (`MERGE_RETRY_DELAYS_MS`, `lifecycleHandler.ts:228`; `attemptMerge`, `:242`), where the HTTP status is actually observable; a 4xx is never retried, so a new refusal code cannot become retryable by omission. Safe to repeat because the token is not consumed server-side (AID-003). Residual: a page closed mid-backoff, and the SDK→listener `postMessage` hop, which has no ack — both need a durable queue, which would put a replayable group-capture token at rest on disk |
| AID-019 | Medium | P1-next | The install ticket is 7-day, non-single-use, and one code yields up to 20 tickets. **Partly closed, partly accepted.** The TTL is not env-driven: it is the fixed `INSTALL_TICKET_TTL_MS` (`packages/app-essentials/src/constants/installTicket.ts:7`), shared with the wallet's pending-action store and compiled into store binaries, so it moves only with a coordinated release. Multi-use is a recorded decision in `jwt.ts:56-66` — a burn-set deadlocks the wallet's retry loop. The 20-per-code fan-out stands: `MAX_RESOLVE_ATTEMPTS = 20` (`InstallCodeRepository.ts:13`) is enforced in Postgres (`:81`, `:132-137`), so it does hold across replicas |
| AID-013 | Low | P2-when-picked-up | No test pins cross-merchant proof scoping (property holds; coverage does not). **Open.** Still the cheapest item outstanding. The one suite that runs the real verifier on arbitrary inputs, `IdentityProofService.test.ts` (tamper cases, `:117-176`), never changes `merchantId`. The route and orchestrator suites either mock the verifier or feed it the golden fixture's own merchant (`ensure.test.ts:805-840`, `IdentityOrchestrator.test.ts:324`) |
| AID-015 | Low | P2-when-picked-up | The envelope version byte is not covered by the signature. **Open.** Codec-level, layout unchanged since the audit. `buildProofMessage` signs op, merchantId, anonymousId, binding and ts (`canonical.ts:126`). The version byte is written by `encodeProof` and only compared in `decodeProof` (`canonical.ts:229`, `:259`), which rejects anything but 1. Nothing is exploitable until a second version exists |
| AID-017 | Low | P2-when-picked-up | An `frak-ensure-v1` proof is an unbound 30-day bearer credential. **Open.** `ensureIdentity.ts:61` still signs it with no binding (32 zero bytes, `sdk/core/src/identity/canonical.ts`), and the window is still 30 days (`IdentityProofService.ts:25`). The proof is only minted while a wallet is connected (`watchWalletStatus.ts:75`), so a replay hits `WALLET_CONFLICT` unless the original link never committed — the reachable population is "ensure 5xx'd after the proof left the browser", and the proof travels in a POST body no backend log prints. Fix is cheap (bind `SHA-256(walletAddress)` as `frak-ensure-v2`, v1 fallback; only `sdk/core` mints it, no native side) but not urgent |

## Findings added 2026-09-04

Added on 2026-09-04, when every closure in the table above was re-read in the code and its tests (`installCode.test.ts`, `sign.test.ts`, `ensure.test.ts`, `AnonymousMergeOrchestrator.test.ts`), not taken from the remediation commits. New findings continue the id space so cross-references stay unambiguous. The status of each is as of 2026-10-13.

| ID | Severity | Priority | Finding |
|---|---|---|---|
| AID-022 | Medium | P1-next | **A logged-in user never drains a queued ensure outside the auth pages.** **Open.** `useExecutePendingActions` is mounted only by `register.tsx:185`, `login.index.tsx:47` and `LoginWithEmailPage/index.tsx:34`; `fireEnsureActions` only by that hook and `InstallView.tsx:258`. `_auth.tsx`'s `beforeLoad` (`:6-14`) bounces a logged-in user to `/wallet`, whose layout drains nothing. An ensure queued by `useResolveInstallCode.ts:59` or `useInstallReferrer.ts:74` from a logged-in session sits until the 7-day TTL, contradicting the "next launch" comment in `drainEnsures.ts:62`. Drain from the wallet layout |
| AID-023 | Low | P2-when-picked-up | **Three non-retryable 400s are retried for the TTL.** **Open.** `ensure.ts` throws `MERCHANT_MISMATCH` (`:66`), `ANONYMOUS_ID_MISMATCH` (`:72`) and `INCOMPLETE_IDENTITY` (`:332`) as 400s; none is in `MISSING_CREDENTIAL_CODES` (`drainEnsures.ts:29-36`), so the action is retried on every launch for a week. Same class as the closed AID-016, three codes wider. One-line fix |
| AID-024 | Low | P2-when-picked-up | **The identity rate limiter is single-instance, in-memory and IP-keyed.** **Open.** `InMemoryRateLimitStore` (`infrastructure/rateLimit/rateLimiter.ts:39`) says so itself (`:36`). The identity buckets are `merge` 20/min and `ensure` 10/min, among others. The backend HPA allows 1–2 replicas (`infra/gcp/backend.ts:129-134`), so a bucket can double, and a shared egress shares one. The per-code cap on install-code resolves is not part of this: it lives in Postgres (AID-019) |
| AID-025 | Nit | P2-when-picked-up | **Stale "verified, not enforced" comments** contradict the enforced code. **Partly closed.** The `ROLLOUT-STEP-3` markers and every `ENSURE_BARE_ARM_ENABLED` reference are gone (`d6dffc705`, `0fb7ea262`), in `latchedProof.ts` and in the wallet's `drainEnsures.ts`, `pendingActionsStore.ts` and `pending-actions/types.ts`. Still wrong: `installCode.ts:92` ("Verify when present, never require one" — the route refuses without a proof, `:134-144`) and `:167` ("once the generate flip is enabled"); `ensure.ts:101` ("Verified when present, never required" — the wallet arm refuses without a proof or ticket, `:143-148`); and `IdentityProofService.ts:19`, which calls the merge token "single-use" (AID-003). Comment-budget item; the next reader will "fix" the code to match |

**Severity is graded on reachable damage, not on credential shape.** Three findings here describe an
unbound or unconsumed credential, and all three end at the same place: a replay merges the victim's
group into the attacker's, `associate` refuses it with `WALLET_CONFLICT` whenever both groups hold a
wallet, so the only case that pays is a wallet-less victim group whose unsettled attribution then
settles to the attacker. What separates them is how the attacker gets the credential, and that is
what the grades now track. **AID-017** (Low) needs a proof captured out of an unlogged POST body.
**AID-003** (Medium) needs a `?fmt=` captured out of the address bar, which anything reading
`location.href` gets for free before the SDK strips it. **AID-005** (High) needs nothing captured at
all — its subject is a bare UUID published in every pre-derivation `fCtx` link, and it never expires.

**AID-005 is not "open by design", and it has no fix on file.** What plan README §3 makes deliberate is the unflipped `refuseUnproven` on `/merge/execute`. That gate is also what keeps the legacy alias claimable: `migrateLegacyIdentity` executes without a proof, so `markProofSeen` never runs on the legacy node, and `mergeGroups` repoints it into the live group. The plan's gap G27 (`MERGE-SURFACE-MAP.md`, deleted; read it with `git show e92988d6e^:docs/plans/identity-proof-of-possession/MERGE-SURFACE-MAP.md`) filed this as "closed by the flips" and rejected a `frak-migrate-v1` proof, because the legacy id has no key to sign with. That held only if the last flip, T3.1b, shipped. It did not. The `frak-migrate-v1` fix this audit proposed on 2026-09-04, signed over both ids plus a first-writer-wins marker, is withdrawn: the legacy id is public, so a signature over it proves nothing the attacker's own key cannot, and first-writer-wins rewards whoever writes first. I know of no way to authenticate a keyless id.

**Not verified in this pass:** no request was executed against a live backend and no database was queried, so whether each prod migration has actually run is unknown; only the files and journal entries are confirmed. I did not audit surface added since 2026-09-04 beyond the paths cited above: the referral-code onboarding (`4985b8711`, `ff0373d9f`), `getInstallUrl` and the short `/i` install links (`2dac70a58`, `ce9ef54b6`, `0fd46ac0b`).

## Audit coverage

Findings are scored against the post-`ROLLOUT-STEP-3` baseline. The attack chains were verified by reading route wiring, orchestrators
and schema, not by executing requests: **no emulator, no simulator and no live database were used**, and each chain is a 3–4 request
reproduction that should be confirmed on staging before triage. The crypto claims *were* verified by execution — a mutation test over
the signed message and a cross-merchant replay test, both cleaned up afterwards. **The local `node_modules` install was broken** in
this checkout (`react` is not hoisted, because the working-tree `bun.lock` carries internal verdaccio URLs), so **every React/DOM
suite fails locally with `React.act is not a function` and none could be run**; that is an install artifact, not a defect in scope,
and no React/DOM test result informs any finding here. The pure-logic backend and SDK identity suites ran fine. Not verified: whether
the `proof_seen_at` migration is applied in every environment (it exists in all three sets, `prod/0020` included; applied-ness was never checked) — confirm this first, because if the column is missing anywhere every
proof-absent merge 500s; whether any production client emits a mixed-case `anonymousId`; and whether a host-embedded wallet page with
no `returnScheme` occurs in any live merchant configuration. Not traced: `IdentityWeightService#determineAnchor`'s tie-break, which
sets the blast radius of every capture above. The dark corner for the next auditor is the composed HTTP layer — nearly all backend
coverage is unit-level against orchestrators, and the most serious findings here are route-wiring mistakes no unit test could catch.
