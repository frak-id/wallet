# Wallet Merge — Follow-up Tasks

> **Status:** Open. Captures the audit findings deferred from the main merge implementation. Each entry includes a severity tag, the relevant file:line refs, the rationale for deferring, a sketch of the eventual fix, and a quick-win tag where applicable.

This document is the canonical landing place for everything the merge audit surfaced but the initial implementation chose not to address inline. Items are grouped by area; severity tags mirror the original audit (🔴 critical / 🟠 high / 🟡 medium / 🟢 low / 🔵 nit).

When you pick one up, please leave it in this file with a `**Closed in PR #…**` line rather than deleting the entry — the rationale is useful context for anyone revisiting the design.

## Tag legend

- `[loc-win]` — removes ≥30 LOC.
- `[simplicity]` — collapses branching or state.
- `[generification]` — extracts a reusable primitive.
- `[no-win]` — genuine work, no leverage (correctness fix, UX copy, perf-only).

A single item can carry multiple tags. Items without tags are observational or design-level (no concrete refactor).

---

## Recently closed

The following items were landed in the simplification pass (see commit `🧹 First-pass simplification of the wallet merge feature`). They remain in the body of the doc below with a `**Closed**` tag where applicable so the original rationale and design notes stay searchable.

- ✅ Step CSS duplication — extracted `walletMerge/component/stepLayout.css.ts`.
- ✅ L3 RemoteConsentBody / RemoteSwitchBody — collapsed into `RemotePairingPanel`.
- ✅ L4 SuccessStep unused `settle` prop — dropped from the prop type + call site.
- ✅ Address-shorten duplicate — `AssetMigrationStep` now imports the canonical util.
- ✅ `signMergeConsentLocally` duplicated 3× — extracted to `walletMerge/utils/signMergeConsentLocally.ts`.
- ✅ M11 register inline session mint — routes through `WalletSessionService.mintForCredential`.
- ✅ WS DTO drift — extracted `WsSignatureRequestBase` and `WsSignatureResponseBase`.
- ✅ `MERGE_INVALID_CONSENT` 401 schema — swapped `t.String()` → `t.ErrorResponse` on both merge routes.
- ✅ Preview cache key — now includes the requester credential id.
- ✅ Pairing store subscription too broad — shallow selector via `useShallow` on `{pairing, status}`.
- ✅ Identity cache `addNode` invalidation — drops the negative cache entry after insert.
- ✅ Phantom `invalidateBindingAfterCommit` comment — rewritten to match the actual in-tx eviction tradeoff.

The following items were verified during the same pass and found to **no longer apply** (or to contradict project preferences). They are kept in the body below with the rationale, marked `**Outdated**`:

- ❌ `detectSettledMerge` consent-bypass residual — closed by the `resolveSettledLoser` cross-check landed in the security hardening commit.
- ❌ M3 EmailFormScreen consolidation incomplete — `EmailInputStep` already delegates `alreadyUsed` upward.
- ❌ Route context boilerplate — guards diverge intentionally; nothing left to share.
- ❌ `MergeFlow` unmount-effect dep `[strategy.cancel]` fragile — `strategy.cancel` identity is provably stable (memoised client + `useCallback([client])`). Going back to a `useRef` was explicitly rejected by the maintainer.
- ❌ `MergeFlow` `stepKindRef` collapse to `successRef` — zero LOC win, narrows the ref's type for no functional gain.
- ❌ M5 sessionStore three actions collapse — `parkSession`/`popSession`/`discardPreviousSession` have distinct semantics (park, restore, drop); merging would muddle intent.

---

## Backend — Security & DoS

### 🟠 H5: `authenticatorHint` enables targeted pairing DoS `[no-win]`
- **Where:** `services/backend/src/domain/pairing/repositories/PairingConnectionRepository.ts:152`, `domain/pairing/db/schema.ts:65`
- **Issue:** `action=initiate` on the pairing WS is unauthenticated. The partial unique index `(authenticator_hint) WHERE resolved_at IS NULL AND authenticator_hint IS NOT NULL` enforces at most one unresolved pairing per hint — so an attacker who knows a credential ID can squat the hint slot, blocking that credential from joining a cross-device merge until cleanup runs.
- **Existing mitigations** (verified):
  - Per-IP rate limit at the WS open handler — **10 initiations/min per IP** (`api/user/wallet/pairing/ws.ts:12-66`).
  - Partial unique index makes a single hint un-squattable beyond one pending pairing at a time.
  - `cleanupPairings` cron runs every 6h and deletes unresolved rows older than 10 min (`jobs/pairing.ts:19-47`).
- **Gaps left open:**
  - Botnet across many IPs can still exhaust hint slots faster than the 10-min GC clears them.
  - The unique constraint violation on a duplicate hint is **not gracefully handled** in `handleInitiateRequest` — surfaces as an unhandled DB exception rather than a clean WS close with a typed error code.
  - `action=join` and reconnect paths have no rate limit at the WS level.
- **Recommended fix:**
  - Catch the unique-constraint error on hint insert and close the WS with a typed code (`HINT_ALREADY_PENDING`).
  - Add a per-`authenticator_hint` throttle (e.g. max 1 pending hint per hint value per 10 min, regardless of IP).
  - Consider shortening the GC window for hinted pairings specifically (e.g. 2 min).
- **Why deferred:** Existing rate limit + partial unique + 6h GC give defence-in-depth for the realistic threat model. Tightening should ride the broader pairing-throttle revisit rather than block the merge feature.

### 🟠 NEW: `detectSettledMerge` consent-bypass residual on retry `[no-win]` — **Outdated**
- **Resolution:** The cross-check in `resolveSettledLoser` IS sufficient against the exploit path described here. Verified during pass 1: a captured pre-merge loser JWT carries `wallet = preMergeLoserAddress`. On replay, `params.requesterWallet` equals the JWT's `wallet`, which the helper compares against `unlinked.smartWalletAddress` (the DB row written at unlink time). For the legitimate retry case those match by construction; for an attacker fabricating a different address the comparison rejects. The wallet-session auth middleware does trust the JWT `address` blindly (a real but separate concern, scoped to the 30d JWT TTL and unrelated to merge), so no new middleware hook is needed for this finding.

### 🟠 NEW: `/merge/preview` & `/merge/settle` rate limit `[no-win]` — **Closed**
- **Where:** `services/backend/src/api/user/wallet/merge/index.ts`
- **Status:** Closed in the security hardening commit — `mergeRoutes.use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 5 }))`. Keeping the entry for traceability.

### 🟡 NEW: `publishMergeCompleted` retries are unbounded `[simplicity]`
- **Where:** `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts:354-362, 462-470`
- **Issue:** Every retried `settle()` republishes a fresh loser session over both pairing topics. Combined with the per-minute rate limit above, an attacker holding a valid loser JWT can still trigger 5 fresh session mints + topic publishes per minute. Each republish minted session is fully valid.
- **Recommended fix:** Cap the republish to once per `pairingId` (track via a short-lived in-memory set or by checking `pairing.lastMergeCompletedPublishedAt`). Skip when the last publish is < N minutes old.
- **Why deferred:** Rate limit caps the blast radius; cleanup is best done alongside the `MergeSnapshot` resolver work (see below).

### 🟡 NEW: `getActiveAuthenticatorIdsByWallet` has no `tx?` and no `LIMIT` `[no-win]`
- **Where:** `services/backend/src/domain/identity/repositories/WalletBindingRepository.ts:117-142`
- **Issue:** Used by login email path + email-conflict path. After repeated merges a wallet can accumulate many active bindings; the read pulls all of them and never sees a transaction context, so callers inside a tx still get the cached snapshot.
- **Recommended fix:** Accept optional `tx?: PgTransaction`; cap result at `LIMIT 20` (UX rarely needs more, surface a debug log if cap is hit).
- **Why deferred:** Real bindings-per-wallet today is ≤ 4; defer until we see the count climb.

---

## Backend — Session minting consistency

### 🟢 M11: `register` mints sessions inline instead of via `WalletSessionService.mintForCredential` `[simplicity]` — **Closed**
- **Where:** `services/backend/src/api/user/wallet/auth/register.ts`, `domain/auth/services/WalletSessionService.ts`
- **Status:** Closed in pass 1. Register now calls `AuthContext.services.walletSession.mintForCredential({ authenticatorId, walletAddress, publicKey, transports })` and returns the result directly. The inline JWT-sign + SDK-JWT-build block (and the `additionalData = {}` no-op) is gone, and the response now includes `transports` for consistency with login.

---

## Frontend — Settle / merge UX

### 🟠 H7: `useLoserAssetCheck` silently swallows balance-fetch errors `[no-win]`
- **Where:** `apps/wallet/app/module/walletMerge/hook/useLoserAssetCheck.ts:68`, `component/AssetMigrationStep/index.tsx:128`
- **Issue:** `useGetUserBalance()` returns `{ userBalance, isLoading }` with no `error/isError`. When the fetch fails, `userBalance` is undefined → `stablecoinBalances` is `null` → `hasDetectableFunds === false`. The UI then reassures the user "no funds to move", when actually the backend just didn't respond.
- **Recommended fix:**
  1. Either extend the existing `useGetUserBalance` to expose `error`/`isError`/`refetch`, or build a thin wrapper in the merge module that gives us those signals.
  2. In `AssetMigrationStep`, treat error as a distinct "couldn't verify funds" state with a retry button. Keep the user-checkbox path (transfer anyway) as the escape hatch.
- **Why deferred:** Touches `useGetUserBalance` in `wallet-shared` (shared with other surfaces). Wants a proper review of the hook's contract rather than a local merge-only workaround.

### 🟡 M10: Settle error code mapping is generic `[no-win]`
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergeSettle.ts:88-89`, `component/SettlingStep/index.tsx:101-130`
- **Issue:** Every 4xx, 5xx, or revert error renders the same toast. The hook already extracts a string error code via `extractSettleErrorCode`, but the UI ignores the discriminator.
- **Recommended mapping:**
  | Error code | UX action |
  |---|---|
  | `MERGE_USER_OP_REVERTED` | "Signing failed on-chain. Try again." — back to `sign` step |
  | `MERGE_INVALID_CONSENT` | "Consent expired. Reconfirm on your other device." — back to `consent` step (re-collect signature) |
  | `MERGE_ON_CHAIN_PASSKEY_MISSING` / `MERGE_ON_CHAIN_PASSKEY_MISMATCH` | "Something's off with the on-chain state. Start over." — back to `preview` |
  | 5xx / network | "Couldn't reach the server. Retry." — same step, retry button |
  | Anything else | Current generic copy |
- **Why deferred:** Requires a copy review with product/localisation (each branch needs `en` + `fr` strings).

### 🟡 M9: Settle has no max-wait / user-escape path `[no-win]`
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergeSettle.ts:69-80`, `component/SettlingStep/index.tsx:112-123`
- **Issue:** `waitForTransactionReceipt(confirmations: 8)` can hold the UI on a spinner for minutes on Arbitrum. The user has no escape hatch.
- **Recommended fix:** Show block-confirmation progress (1/8 → 8/8) and offer a "Save and finish later" CTA. Stash the `loserAuthenticatorId + onChainTxHash + loserConsentSignature` triple in `sessionStorage` (or React Query mutation key) so the user can resume by re-entering `/profile/add-email` and hitting "Finish merge".
- **Why deferred:** Adds a resume path that needs storage design + UX validation. Not blocking — the spinner state is correct, just suboptimal. Note: retry path itself is fine — `waitForTransactionReceipt` hits the RPC's confirmation cache (~200ms re-hop) so re-calling after a settled tx is cheap.

---

## Backend — Tie-breakers & determinism

### 🟠 H3: `pickWinner()` tiebreaker is not symmetric across devices `[simplicity]`
- **Where:** `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts` — `pickWinner` helper near the bottom of the file
- **Issue:** Equal weight + equal `createdAt` falls back to "requester wins". In Phase 2 both devices call `preview()` independently — they'd disagree on the winner because `requester` differs per call.
- **Recommended fix:** Use a role-independent final tiebreaker. Lowercase wallet address comparison is deterministic, role-independent, and cheap:
  ```ts
  if (requester.createdAt?.getTime() === target.createdAt?.getTime()) {
      return requesterWallet.toLowerCase() < targetWallet.toLowerCase();
  }
  ```
- **Why deferred:** Edge case (two groups created in the same millisecond, identical weights). Real but low-probability. Worth fixing before Phase 2 lands in earnest since both sides will hit `preview`.

---

## Backend — Schema & migrations

### 🟠 B4: Two `authenticator_wallet_bindings` tables exist (libSQL + PG) `[loc-win]`
- **Where:** `services/bootstrap/drizzle/libsql/0003_salty_gunslinger.sql` (libSQL — unused), `services/bootstrap/drizzle/local/0021_amazing_scarlet_witch.sql` (PG — runtime)
- **Status:** Known. The libSQL migration is a leftover from the original Phase 1 design before the table was moved to postgres. Runtime code (`WalletBindingRepository`, login, register, backfill) only ever touches the PG table.
- **Recommended fix:** Drop the libSQL migration + snapshot in `meta/`. Update `docs/wallet-merge-phase-1.md` to reflect PG ownership. Remove `recovery_blob` from docs unless Phase 3 brings it back.
- **Why deferred:** DB migrations are human-generated and owned by the DB team. The libSQL migration hasn't shipped to prod yet; will be cleaned up alongside the next migration batch.

### 🟡 H10: Backfill skips legacy NULL-wallet rows with emails `[no-win]`
- **Where:** `services/bootstrap/src/backfill-auth-bindings.ts:168-171`, `:203`
- **Issue:** Rows with `smart_wallet_address IS NULL` are skipped in `migrateEmailForRow`. The design doc claims login lazy-fills them via `ensureActiveBinding`, but that hook only seeds the binding — it doesn't migrate the email value.
- **Recommended fix:** When backfill encounters a NULL-wallet row, first look up the active PG binding by `authenticatorId`. If a binding exists, use *that* wallet address to drive the email migration. Skip only when neither libSQL nor PG knows the wallet.
- **Why deferred:** Affects a narrow band of legacy rows. Low impact in practice.

### 🟡 H11: Backfill uses `OFFSET` pagination and is N+1 on email migration `[no-win]`
- **Where:** `services/bootstrap/src/backfill-auth-bindings.ts:117` (OFFSET), `:139`+`:196` (per-row email loop)
- **Issue:** `LIMIT/OFFSET` grows quadratically with table size; ~500k rows make boot time noticeable. Email migration does 2-3 PG reads + maybe 1 write **per row** sequentially.
- **Recommended fix:**
  - Switch to keyset pagination: `WHERE id > lastSeenId ORDER BY id LIMIT 500`.
  - Per batch, bulk-fetch wallet identity nodes by IN clause, bulk-fetch existing email nodes by group id, then bulk-insert missing email rows.
- **Why deferred:** Bootstrap runs once per deploy and the auth table is currently small (~thousands, not millions). Will become important before the table 10×.

---

## Backend — Cache invalidation gaps

### 🟡 Identity cache invalidation on `addNode` `[simplicity]` — **Closed (partially)**
- **Where:** `services/backend/src/domain/identity/repositories/IdentityRepository.ts`
- **Status:** Closed for `identityGroupIdCache` in pass 1 — `addNode` now calls `identityGroupIdCache.delete(cacheKey)` after the insert, so a negative-cached result for the same `(type, value, merchantId)` is dropped immediately. `walletByGroupCache` invalidation for wallet nodes is still TODO; the win there is narrower since `findGroupByIdentity` (the negative-cache path) is the hot read.

### 🟢 `repointBinding` cache eviction races with outer transaction — **documented (loose end closed)**
- **Where:** `services/backend/src/domain/identity/repositories/WalletBindingRepository.ts` — see the docstring on `repointBinding`.
- **Status:** The descriptive comment in the source has been rewritten (pass 1) to match the actual behaviour: cache invalidation fires unconditionally at the end of the method, and when `tx` is provided we accept a bounded race window capped by the 60s LRU TTL. No phantom `invalidateBindingAfterCommit` reference remains.

---

## Backend — Query efficiency

### 🟡 Bulk updates return every row id only to count `[no-win]`
- **Where:** `services/backend/src/orchestration/identity/IdentityMergeService.ts:162-205, 220-236, 248-260, 537-560`
- **Issue:** `.returning({ id })` then `.length` is used to count migrated rows. For users with thousands of asset_logs/interactions/referrals, this materialises every row in app memory.
- **Recommended fix:** Drop counts where they're not surfaced to the API. For counts that are surfaced, use raw SQL CTE-counted updates (Drizzle's `.execute(sql\`...\`)` pattern already used elsewhere in this file for `push_tokens`).
- **Why deferred:** Affects only high-volume users (probably <5% of the user base). Not a correctness issue, just a perf optimisation.

### 🟡 Preview hot path could collapse into a single resolver `[generification]`
- **Where:** `WalletMergeOrchestrator.preview()`, `settle()` (recomputes preview via `detectSettledMerge` + `preview`), `mintSessionForCredential` (refetches the same credential)
- **Issue:** A single merge does the credential lookup multiple times across preview → settle → mint. Acceptable today; bothersome at scale. The latest commit's `detectSettledMerge` adds another full binding pair re-fetch upstream of `preview`.
- **Recommended fix:** Build a single `MergeSnapshot` resolver returning bindings, groups, weights, and loser credential in one call. Pass it through settle, detectSettledMerge, and the session minter. Eliminates the duplicate binding/group lookups between preview() and detectSettledMerge.
- **Why deferred:** The current code is correct and clear. Refactor is mechanical but invasive (every helper takes preview-shaped data). Worth doing when next touching the orchestrator for unrelated reasons.

---

## Backend — Multi-chain readiness

### 🟢 NEW: Consent challenge does not bind to `chainId` `[no-win]`
- **Where:** `packages/app-essentials/src/webauthn/mergeConsent.ts:53-68`
- **Issue:** Challenge string format is `frak-merge-consent:{UTC hour}:{winner}:{loser authid}`. A consent assertion captured on one chain could in principle be replayed against a merge orchestrator running on a different chain, since the binding repository methods take `chainId` explicitly but the challenge does not. Multi-chain merge isn't a Phase 1/2 concern.
- **Recommended fix:** Append `:{chainId}` to the format. Bump challenge version + accept old+new for one release window.

### 🟢 NEW: Consent replay window is effectively ±1h = 3h `[no-win]`
- **Where:** `packages/app-essentials/src/webauthn/mergeConsent.ts:53-68`, comment at `WalletMergeOrchestrator.ts:223`
- **Issue:** `buildMergeConsentChallengeSlots` emits three candidate strings (current hour, ±1h). The comment claims this "absorbs clock skew + slow flows" but in practice clock-skew tolerances are usually measured in minutes, not hours. A 3-hour replay window is wider than needed.
- **Recommended fix:** Drop to a 5-minute grid (return three slots covering ±5min). Sync the comment with reality, or document why the hourly grid is intentional.

### 🟢 NEW: `PairingConnectionRepository.handleResumeRequest` hardcodes `currentChainId` `[no-win]`
- **Where:** `services/backend/src/domain/pairing/repositories/PairingConnectionRepository.ts:294-314`
- **Issue:** Resume now queries `getActiveBinding({ credentialId, chainId: currentChainId })`. If a credential's active binding lives on a chain other than the gateway default, resume will silently fail with `PAIRING_NOT_FOUND` after a merge. Same-chain in Phase 1/2, so not yet user-visible.
- **Recommended fix:** Carry the binding chainId in the pairing row, or fall back to "any active binding for this credential" with a logged disambiguation.

---

## Backend — API surface

### 🟡 WS DTO drift between direct + topic shapes `[loc-win] [generification]` — **Closed**
- **Where:** `services/backend/src/domain/pairing/dto/WebsocketDirectMessage.ts`, `WebsocketTopicMessage.ts`
- **Status:** Closed in pass 1. `WsSignatureRequestBase` + `WsSignatureResponseBase` now live alongside `WsSignatureKind` in `WebsocketDirectMessage.ts`; the topic-side `WsSignatureRequest` extends `WsSignatureRequestBase` with `{ pairingId, partnerDeviceName }`; both direct + topic `signature-response` payloads now share `WsSignatureResponseBase` directly. Future field additions land in a single place.

### 🟡 Concurrent email-association race in `addNode` `[no-win]`
- **Where:** `services/backend/src/api/user/wallet/auth/email.ts:94-104`, `domain/identity/repositories/IdentityRepository.ts:182-216`
- **Issue:** `POST /auth/email` checks conflict, then calls `addNode()`. `addNode` returns the existing node on unique conflict, so a racing client can be told "success" even though the email belongs to a different group.
- **Recommended fix:** Use a strict insert helper. If the returned node's `groupId` differs from the caller's group, return the normal `"conflict"` response.

### 🟢 Route context boilerplate duplicated — **Outdated**
- **Where:** `services/backend/src/api/user/wallet/merge/preview.ts`, `merge/settle.ts`
- **Status:** No extraction warranted. Each route is a single Elysia handler with a one-line session-type predicate that exists specifically because the two routes accept different session shapes (preview rejects distant-webauthn; settle accepts it). The response schemas were the only true duplicate and pass 1 already made them consistent by fixing the 401 shape. Nothing left to share.

### 🟢 `MERGE_INVALID_CONSENT` 401 schema returns `t.String()` `[simplicity]` — **Closed**
- **Where:** `services/backend/src/api/user/wallet/merge/preview.ts`, `settle.ts`
- **Status:** Closed in pass 1. Both routes now use `t.ErrorResponse` for the 401 slot, in line with all other error codes on the route. Generated Eden / OpenAPI clients now type the 401 body as `{ code, message }`.

### 🟢 WebAuthn consent verifier error handling `[simplicity]`
- **Where:** `services/backend/src/domain/auth/services/WebAuthNService.ts:168-175` (parse try/catch), `:190-206` (BigInt + verify unguarded)
- **Issue:** `verifyConsentSignature` catches JSON parse errors but not malformed `BigInt(x)`, missing fields, or `WebAuthnP256.verify` throws — malformed client input becomes a 500 instead of 401.
- **Fix:** Wrap the full decode + verify block; return `false` on any throw. Add tests for the failure modes.

---

## Frontend — Module-level polish

### 🟡 M3: `EmailFormScreen` consolidation incomplete `[loc-win][simplicity]` — **Outdated**
- **Where:** `apps/wallet/app/module/common/component/EmailFormScreen/index.tsx`, `module/onboarding/component/EmailInputStep/index.tsx`, `module/settings/component/AddEmail/index.tsx`
- **Status:** Verified during pass 1 — the consolidation described here is already in place. `EmailInputStep` no longer owns the `alreadyUsed` state; it surfaces conflicts via an `onAlreadyUsed` callback the parent route handles. `AddEmail.FlowState` is a clean discriminated union with `input/conflict/merging/success` kinds, not an `alreadyUsed` boolean.

### 🟢 L3: `RemoteConsentBody` and `RemoteSwitchBody` are near-duplicates `[loc-win][generification]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/component/ConsentStep/index.tsx`, `SwitchStep/index.tsx`, new `apps/wallet/app/module/walletMerge/component/RemotePairingPanel/index.tsx`
- **Status:** Closed in pass 1. The two bodies were byte-for-byte identical except for the i18n key namespace, so the extracted `RemotePairingPanel` now owns the QR + status + retry scaffold and each call site passes a 5-key `i18nKeys` object. Both step files lost the duplicated JSX + their unused `PairingQrCode`/`PairingStatus`/`Spinner` imports.

### 🟢 L4: `SuccessStep` accepts unused `settle` prop `[loc-win]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/component/SuccessStep/index.tsx`, `MergeFlow/index.tsx`
- **Status:** Closed in pass 1. The prop is gone from both the type and the call site; the `Step` union's `success` variant no longer carries the unused `settle: MergeSettleResponse`. If the surviving-wallet detail copy ever lands, the data threads back from `MergeSettleResponse` at that point.

### 🟢 Thin wrapper components `[loc-win]`
- **Where:** `AddEmail/SuccessStep.tsx`, `EmailAlreadyUsedStep/index.tsx`
- **Issue:** Each is 40-50 LOC of just-pass-through wrapper around `EmailFlowResultScreen`. Inlining into the parent orchestrators saves files and centralises flow logic. Bundle with M3.

### 🟢 Address-shorten utility duplicated `[loc-win][generification]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/component/AssetMigrationStep/index.tsx`, `walletMerge/utils/shortenAddress.ts`
- **Status:** Closed in pass 1. `AssetMigrationStep` now imports the canonical util (which carries the missing `address.length <= 12` guard the inline copy was lacking).

### 🟢 Step CSS duplication `[loc-win]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/component/stepLayout.css.ts` (new), plus consumers `ConsentStep`, `SwitchStep`, `SignStep`, `SettlingStep`, `PreviewStep`, `AssetMigrationStep`.
- **Status:** Closed in pass 1. The shared `body` + `footer` recipes now live in `stepLayout.css.ts`. Pure-duplicate files (ConsentStep, SwitchStep, SignStep, SettlingStep) were deleted and their components import from the shared module directly. PreviewStep and AssetMigrationStep re-export `body`/`footer` from the shared module so they keep their existing `styles.body` / `styles.footer` JSX references while only owning their step-specific styles locally.

### 🟡 NEW: `signMergeConsentLocally` duplicated 3× `[generification]` — **Closed (2 of 3 sites)**
- **Where:** `apps/wallet/app/module/walletMerge/utils/signMergeConsentLocally.ts` (new), `walletMerge/hook/useLoserConsent.ts`, `walletMerge/strategy/useRemoteMergeStrategy.ts`.
- **Status:** Pass 1 extracted the canonical util and migrated the two merge-side call sites (`useLoserConsent` is now a one-line wrapper; `useRemoteMergeStrategy`'s `needsSwitch=true` branch defers to the same util). The third site — `packages/wallet-shared/src/pairing/hook/useSignSignatureRequest.tsx` raw-assertion branch — is a different shape (it receives a pre-built challenge from the origin and dispatches via `client.sendSignatureResponse`) so it stays as-is for now; a narrower `buildWebAuthnAssertion` helper could absorb its `WebAuthnP256.sign → btoa(JSON.stringify(assertion))` tail if that pattern recurs.

### 🟡 NEW: `MergeFlow` unmount-effect dep `[strategy.cancel]` is fragile `[simplicity]` — **Outdated**
- **Where:** `apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`
- **Status:** Verified during pass 1. The dep IS stable in practice: `strategy.cancel` resolves to `undefined` for the local strategy and to `useCallback([client])` for the remote strategy, where `client = useMemo(() => getOriginPairingClient(), [])` is a singleton. The cleanup fires exactly once on unmount. Reverting to a `cancelRef` was explicitly rejected by the maintainer in the security hardening commit's review — the dep-based approach makes the dependency honest to the linter and avoids the manual `cancelRef.current = strategy.cancel` mirroring assignment.

### 🟢 NEW: `MergeFlow` `stepKindRef` mirror could collapse to a `successRef` `[simplicity]` — **Outdated**
- **Where:** `apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`
- **Status:** No net win. Collapsing the string-typed `stepKindRef` to a `successRef = useRef(false)` is a same-LOC swap that narrows the type for no functional gain and loses the ability to branch on other step kinds without re-introducing a ref. Leaving `stepKindRef` as-is.

### 🟢 NEW: `target.handleMergeCompleted` does not `discardPreviousSession()` `[no-win]`
- **Where:** `packages/wallet-shared/src/pairing/clients/target.ts:194-206`
- **Issue:** Target mirrors origin's session write but skips `discardPreviousSession()`. Target never parks during merge, so no parked state exists, but the asymmetry is a footgun if the mobile ever participates in a parked-session flow elsewhere.
- **Fix:** Add the call defensively or comment why it's intentionally absent.

### 🔵 NEW: `useAutoMutation` extraction across step components
- **Where:** `apps/wallet/app/module/walletMerge/component/{ConsentStep,SwitchStep,SettlingStep}/index.tsx`
- **Issue:** Same `startedRef + run + retry resets ref` boilerplate triplicated.
- **Fix:** Extract `useAutoMutation(mutation, args, { enabled, onSuccess })`. ~30 LOC win, declarative "auto-fire vs explicit CTA" handling.

---

## Frontend — Session store API

### 🟡 M5: Three session-store actions for one workflow `[simplicity]` — **Outdated**
- **Where:** `packages/wallet-shared/src/stores/sessionStore.ts`
- **Status:** Reviewed during pass 1. The three actions have distinct semantics: `parkSession` saves a snapshot (idempotent — refuses to overwrite an existing parked session), `popSession` restores it (rollback), `discardPreviousSession` drops it without restoring (commit). Collapsing to `clearParkedSession(restore: boolean)` would muddle a discriminated three-state contract into a single boolean and lose the idempotency guard on `parkSession`. Keeping all three named actions.

### 🟢 `previousSession` persistence `[simplicity]`
- **Where:** `packages/wallet-shared/src/stores/sessionStore.ts:61` (persist `partialize`)
- **Question:** Persisting `previousSession` means a tab refresh during a swap dance keeps the restore target alive. But the React-only flow state in `AddEmail` resets on refresh, so the restored target is by definition orphaned. Worth re-evaluating whether persistence is needed at all — dropping it removes the orphan-snapshot risk that motivated the MergeFlow mount-pop fix.

---

## Frontend — Analytics

### 🟡 Merge funnel under-instrumented `[no-win]`
- **Where:** `packages/wallet-shared/src/common/analytics/events/onboarding.ts`, `apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`
- **Issue:** `MergeFlow` transitions through 7 steps with zero `trackEvent` calls. We have no funnel data to optimise the flow.
- **Recommended events:**
  - `merge_attempted` (mode: local|remote, has_passkey_locally: bool)
  - `merge_step_completed` (step: preview|assets|consent|switch|sign|settling, mode, duration_ms)
  - `merge_step_failed` (step, error_code, mode)
  - `merge_aborted` (last_step, mode)
  - `merge_completed` (mode, total_duration_ms, requester_was_loser: bool)
- **Why deferred:** Wants schema review with the analytics team to fit the existing event taxonomy.

### 🟢 French i18n polish `[no-win]`
- **Where:** `packages/wallet-shared/src/i18n/locales/fr/translation.json`
- **Issue:** "combiner" (lines 116, 147, 162) → "fusionner" is more idiomatic for wallet merge. "passkey" left untranslated (lines 179, 187, 204, 207, 507-509) while "clé d'accès" is used elsewhere (lines 392, 400-403, 706).
- **Why deferred:** Localisation review pass.

---

## Frontend — Performance polish

### 🟢 Pairing store subscription is too broad `[simplicity]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/strategy/useRemoteMergeStrategy.ts`, `walletMerge/strategy/types.ts`
- **Status:** Closed in pass 1. The strategy now subscribes through `useStore(client.store, useShallow((s) => ({ pairing: s.pairing, status: s.status })))` and the `MergeStrategy.remote.pairingState` type narrowed to a new `RemotePairingSlice = Pick<OriginPairingState, "pairing" | "status">`. Signature-request churn no longer re-renders the strategy or downstream step components.

### 🟢 `ensurePairingReady` claims idempotence but always calls `initiatePairing` `[simplicity]`
- **Where:** `apps/wallet/app/module/walletMerge/strategy/useRemoteMergeStrategy.ts:256-295`
- **Fix:** Track the last set of params passed; short-circuit when already paired for the same `{authenticatorHint, applySession}`.

### 🟢 Preview cache key doesn't include requester `[simplicity]` — **Closed**
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergePreview.ts`, `packages/wallet-shared/src/authentication/queryKeys/auth.ts`
- **Status:** Closed in pass 1. `authKey.merge.preview` now accepts an optional `requesterAuthenticatorId` and includes it in the key tuple; `useMergePreview` plumbs `currentAuthenticatorId` from `MergeFlow` through. A session switch between renders for the same target now resolves to a fresh key.

### 🟢 Aria-live missing on settling/consent loading states `[no-win]`
- **Where:** `SettlingStep/index.tsx:112-123`, `ConsentStep/index.tsx:222-228`
- **Fix:** Add `role="status"` + `aria-live="polite"` semantics and focus the step title on transitions.

---

## How to triage from here

When picking up an item:
1. Move its section to the top of this file under an "In progress" heading.
2. When you land the fix, replace the section with a one-line `**Closed in PR #…**` entry so the rationale stays searchable.
3. If new follow-ups surface during the fix, add them here.

When picking a sprint, prioritise the `[loc-win]` and `[simplicity]` items — they pay for themselves in cognitive load and are usually mechanical to land. The `[generification]` items are higher-leverage but more invasive. The `[no-win]` items are necessary work but rarely a good sprint kickoff — schedule them when the surrounding code is already open.
