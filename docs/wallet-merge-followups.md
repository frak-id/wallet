# Wallet Merge — Follow-up Tasks

> **Status:** Open. Captures the audit findings deferred from the main merge implementation. Each entry includes a severity tag, the relevant file:line refs, the rationale for deferring, and a sketch of the eventual fix.

This document is the canonical landing place for everything the merge audit surfaced but the initial implementation chose not to address inline. Items are grouped by area; severity tags mirror the original audit (🔴 critical / 🟠 high / 🟡 medium / 🟢 low).

When you pick one up, please leave it in this file with a `**Closed in PR #…**` line rather than deleting the entry — the rationale is useful context for anyone revisiting the design.

---

## Backend — Security & DoS

### 🟠 H5: `authenticatorHint` enables targeted pairing DoS
- **Where:** `services/backend/src/domain/pairing/repositories/PairingConnectionRepository.ts:68`, `domain/pairing/db/schema.ts:65`
- **Issue:** `action=initiate` on the pairing WS is unauthenticated. The partial unique index `(authenticator_hint) WHERE resolved_at IS NULL AND authenticator_hint IS NOT NULL` enforces at most one unresolved pairing per hint — so an attacker who knows a credential ID can squat the hint slot, blocking that credential from joining a cross-device merge until cleanup runs.
- **Existing mitigations** (verified by the audit):
  - Per-IP rate limit at the WS open handler — **10 initiations/min per IP** (`api/user/wallet/pairing/ws.ts:12-66`).
  - Partial unique index makes a single hint un-squattable beyond one pending pairing at a time.
  - `cleanupPairings` cron runs every 6h and deletes unresolved rows older than 10 min (`jobs/pairing.ts:19-47`).
- **Gaps left open:**
  - Botnet across many IPs can still exhaust hint slots faster than the 10-min GC clears them.
  - The unique constraint violation on a duplicate hint is **not gracefully handled** in `handleInitiateRequest` — surfaces as an unhandled DB exception rather than a clean WS close with a typed error code.
  - `action=join` and reconnect paths have no rate limit at the WS level.
- **Recommended fix (when prioritised):**
  - Catch the unique-constraint error on hint insert and close the WS with a typed code (`HINT_ALREADY_PENDING`) so clients can surface a clean error.
  - Add a per-`authenticator_hint` throttle (e.g. max 1 pending hint per hint value per 10 min, regardless of IP) so a botnet can't squat the same hint across many IPs.
  - Consider shortening the GC window for hinted pairings specifically (e.g. 2 min) since the merge flow itself is short-lived.
- **Why deferred:** Existing rate limit + partial unique + 6h GC give defence-in-depth for the realistic threat model. Botnet-scale DoS on a single user's merge is a low-probability/low-impact attack — the worst case is the user retries in 10 min. Tightening this should ride the broader pairing-throttle revisit rather than block the merge feature.

---

## Backend — Session minting consistency

### 🟢 M11: `register` mints sessions inline instead of via `WalletSessionService.mintForCredential`
- **Where:** `services/backend/src/api/user/wallet/auth/register.ts:189`, `domain/auth/services/WalletSessionService.ts:50`
- **Issue:** Register manually signs the wallet JWT + SDK JWT instead of going through the same `mintForCredential` helper that login and merge use. The two paths are functionally equivalent today, but any future change to the session shape (claims, expiry, transports normalisation) has to be applied in both places.
- **Recommended fix:** Route register's WebAuthn success path through `mintForCredential({ authenticatorId, walletAddress, publicKey, transports })`. The helper already exists; this is a swap, not new code.
- **Why deferred:** Cosmetic. No correctness or security issue today, just a drift risk. Best handled as part of a broader session-shape audit.

---

## Frontend — Settle / merge UX

### 🟠 H7: `useLoserAssetCheck` silently swallows balance-fetch errors
- **Where:** `apps/wallet/app/module/walletMerge/hook/useLoserAssetCheck.ts:68`, `component/AssetMigrationStep/index.tsx:128`
- **Issue:** `useGetUserBalance()` returns `{ userBalance, isLoading }` with no `error/isError`. When the fetch fails, `userBalance` is undefined → `stablecoinBalances` is `null` → `hasDetectableFunds === false`. The UI then reassures the user "no funds to move", when actually the backend just didn't respond.
- **Recommended fix:**
  1. Either extend the existing `useGetUserBalance` to expose `error`/`isError`/`refetch`, or build a thin wrapper in the merge module that gives us those signals.
  2. In `AssetMigrationStep`, treat error as a distinct "couldn't verify funds" state with a retry button. Keep the user-checkbox path (transfer anyway) as the escape hatch.
- **Why deferred:** Touches `useGetUserBalance` in `wallet-shared` (shared with other surfaces). Wants a proper review of the hook's contract rather than a local merge-only workaround.

### 🟡 M10: Settle error code mapping is generic
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergeSettle.ts:88`, `component/SettlingStep/index.tsx:101`
- **Issue:** Every 4xx, 5xx, or revert error renders the same toast. The hook already extracts a string error code via `extractSettleErrorCode`, but the UI ignores the discriminator.
- **Recommended mapping:**
  | Error code | UX action |
  |---|---|
  | `MERGE_USER_OP_REVERTED` | "Signing failed on-chain. Try again." — back to `sign` step |
  | `MERGE_INVALID_CONSENT` | "Consent expired. Reconfirm on your other device." — back to `consent` step (re-collect signature) |
  | `MERGE_ON_CHAIN_PASSKEY_MISSING` / `MERGE_ON_CHAIN_PASSKEY_MISMATCH` | "Something's off with the on-chain state. Start over." — back to `preview` |
  | 5xx / network | "Couldn't reach the server. Retry." — same step, retry button |
  | Anything else | Current generic copy |
- **Why deferred:** Requires a copy review with product/localisation (each branch needs `en` + `fr` strings). Best landed as a polished UX pass rather than a piecemeal fix.

### 🟡 M9: Settle has no max-wait / user-escape path
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergeSettle.ts:69-80`, `component/SettlingStep/index.tsx:73`
- **Issue:** `waitForTransactionReceipt(confirmations: 8)` can hold the UI on a spinner for minutes on Arbitrum. The user has no escape hatch.
- **Recommended fix:** Show block-confirmation progress (1/8 → 8/8) and offer a "Save and finish later" CTA. Stash the `loserAuthenticatorId + onChainTxHash + loserConsentSignature` triple in `sessionStorage` (or React Query mutation key) so the user can resume by re-entering `/profile/add-email` and hitting "Finish merge".
- **Why deferred:** Adds a resume path that needs storage design + UX validation. Not blocking — the spinner state is correct, just suboptimal.

---

## Backend — Tie-breakers & determinism

### 🟠 H3: `pickWinner()` tiebreaker is not symmetric across devices
- **Where:** `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts:467-479`
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

### 🟠 B4: Two `authenticator_wallet_bindings` tables exist (libSQL + PG)
- **Where:** `services/bootstrap/drizzle/libsql/0003_salty_gunslinger.sql` (libSQL — unused), `drizzle/local/0021_amazing_scarlet_witch.sql` (PG — runtime)
- **Status:** Known. The libSQL migration is a leftover from the original Phase 1 design before the table was moved to postgres. Runtime code (`WalletBindingRepository`, login, register, backfill) only ever touches the PG table.
- **Recommended fix:** Drop the libSQL migration + snapshot. Update `docs/wallet-merge-phase-1.md` to reflect PG ownership. Remove `recovery_blob` from docs unless Phase 3 brings it back.
- **Why deferred:** DB migrations are human-generated and owned by the DB team. The libSQL migration hasn't shipped to prod yet; it'll be cleaned up alongside the next migration batch.

### 🟡 H10: Backfill skips legacy NULL-wallet rows with emails
- **Where:** `services/bootstrap/src/backfill-auth-bindings.ts:203`
- **Issue:** Rows with `smart_wallet_address IS NULL` are skipped in `migrateEmailForRow`. The design doc claims login lazy-fills them via `ensureActiveBinding`, but that hook only seeds the binding — it doesn't migrate the email value.
- **Recommended fix:** When backfill encounters a NULL-wallet row, first look up the active PG binding by `authenticatorId`. If a binding exists, use *that* wallet address to drive the email migration. Skip only when neither libSQL nor PG knows the wallet.
- **Why deferred:** Affects a narrow band of legacy rows (created before `smart_wallet_address` was non-NULL). Low impact in practice; can be cleaned up in a follow-up backfill batch.

### 🟡 H11: Backfill uses `OFFSET` pagination and is N+1 on email migration
- **Where:** `services/bootstrap/src/backfill-auth-bindings.ts:117` (OFFSET), `:139`+`:208` (per-row email loop)
- **Issue:** `LIMIT/OFFSET` grows quadratically with table size; ~500k rows make boot time noticeable. Email migration does 2-3 PG reads + maybe 1 write **per row** sequentially.
- **Recommended fix:**
  - Switch to keyset pagination: `WHERE id > lastSeenId ORDER BY id LIMIT 500`.
  - Per batch, bulk-fetch wallet identity nodes by IN clause, bulk-fetch existing email nodes by group id, then bulk-insert missing email rows.
- **Why deferred:** Bootstrap runs once per deploy and the auth table is currently small (~thousands, not millions). Will become important before the table 10×; defer until then.

---

## Backend — Cache invalidation gaps

### 🟡 (deferred) Identity cache invalidation on `addNode`
- **Where:** `services/backend/src/domain/identity/repositories/IdentityRepository.ts:68,182`
- **Issue:** `findGroupByIdentity` caches `null` results (negative cache). `addNode` never invalidates the affected key, so a newly added email or wallet can be invisible for up to 60s after creation.
- **Recommended fix:** After successful insert in `addNode`, delete the corresponding cache key (`buildIdentityCacheKey(params.type, params.value, params.merchantId)`). Also invalidate `walletByGroupCache` for wallet nodes.
- **Why deferred:** Negative-cache TTL is short (60s). Real but bounded staleness; not user-visible in the merge happy-path.

### 🟢 (deferred) `repointBinding` cache eviction races with outer transaction
- **Where:** `services/backend/src/domain/identity/repositories/WalletBindingRepository.ts:repointBinding`
- **Issue:** When called inside an outer caller `tx`, the cache invalidation fires before the outer transaction commits. A concurrent reader can repopulate the cache with pre-commit state during that window.
- **Status:** Knowingly accepted. The 60s TTL bounds staleness; chasing proper post-commit eviction would require either a deferred-hook abstraction (Drizzle has none) or pushing the responsibility onto every caller. Comment in the source documents the tradeoff.

---

## Backend — Query efficiency

### 🟡 (deferred) Bulk updates return every row id only to count
- **Where:** `services/backend/src/orchestration/identity/IdentityMergeService.ts:142-185, 200-252, 531-540, 680-696`
- **Issue:** `.returning({ id })` then `.length` is used to count migrated rows. For users with thousands of asset_logs/interactions/referrals, this materialises every row in app memory.
- **Recommended fix:** Drop counts where they're not surfaced to the API. For counts that are surfaced, use raw SQL CTE-counted updates (Drizzle's `.execute(sql\`...\`)` pattern already used elsewhere in this file for `push_tokens`).
- **Why deferred:** Affects only high-volume users (probably <5% of the user base). Not a correctness issue, just a perf optimisation.

### 🟡 (deferred) Preview hot path could collapse into a single resolver
- **Where:** `WalletMergeOrchestrator.preview()`, `settle()` (recomputes preview), `mintLoserSession`/`mintSessionForCredential` (refetches the same credential)
- **Issue:** A single merge does the credential lookup three times across preview → settle → mint. Acceptable today; bothersome at scale.
- **Recommended fix:** Build a single `MergeSnapshot` resolver returning bindings, groups, weights, and loser credential in one call. Pass it through settle.
- **Why deferred:** The current code is correct and clear. Refactor is mechanical but invasive (every helper takes preview-shaped data). Worth doing when next touching the orchestrator for unrelated reasons.

---

## Frontend — Module-level polish

### 🟡 M3: `EmailFormScreen` consolidation incomplete
- **Where:** `apps/wallet/app/module/common/component/EmailFormScreen/index.tsx`, `module/onboarding/component/EmailInputStep/index.tsx`, `module/settings/component/AddEmail/index.tsx`
- **Issue:** `EmailFormScreen` is a good shared primitive, but `EmailInputStep` still owns the `alreadyUsed` state and the `checkEmail` mutation rather than delegating to the shared component. Three places still wire similar validation/handler shapes.
- **Recommended fix:** Move the `alreadyUsed` branching into `EmailFormScreen` via an `onAlreadyUsed` callback. Onboarding and settings supply different result/conflict components.
- **Why deferred:** No correctness issue. Cleanup wave once the merge flow stabilises in prod.

### 🟢 L3: `RemoteConsentBody` and `RemoteSwitchBody` are near-duplicates
- **Where:** `apps/wallet/app/module/walletMerge/component/ConsentStep/index.tsx:168`, `SwitchStep/index.tsx:155`
- **Issue:** Both render "pair QR + status banner + retry button" with cosmetic differences. Extract `RemotePairingPanel` and share.

### 🟢 L4: `SuccessStep` accepts unused `settle` prop
- **Where:** `apps/wallet/app/module/walletMerge/component/SuccessStep/index.tsx:9`
- **Fix:** Either render surviving-wallet detail from it (nice-to-have UX touch) or drop the prop.

### 🟢 (deferred) Thin wrapper components
- **Where:** `AddEmail/SuccessStep.tsx`, `EmailAlreadyUsedStep/index.tsx`
- **Issue:** Each is 40-50 LOC of just-pass-through wrapper around `EmailFlowResultScreen`. Inlining into the parent orchestrators saves files and centralises flow logic.

### 🟢 (deferred) Address-shorten utility duplicated
- **Where:** `apps/wallet/app/module/walletMerge/component/AssetMigrationStep/index.tsx:180`, `walletMerge/utils/shortenAddress.ts`
- **Fix:** Import the existing utility instead of re-implementing.

### 🟢 (deferred) Step CSS duplication
- **Where:** `ConsentStep/index.css.ts:4`, `SwitchStep/index.css.ts:4`, `SignStep/index.css.ts:4`
- **Fix:** Single `stepLayout.css.ts` shared across merge steps.

---

## Frontend — Session store API

### 🟡 M5: Three session-store actions for one workflow
- **Where:** `packages/wallet-shared/src/stores/sessionStore.ts`
- **Issue:** `parkSession`, `popSession`, `discardPreviousSession` could collapse into a single `clearParkedSession(restore: boolean)` action.
- **Why deferred:** API stability — touching the session store affects multiple consumers (wallet, listener). Worth doing as part of a broader sessionStore refactor.

### 🟢 (deferred) `previousSession` persistence
- **Where:** `packages/wallet-shared/src/stores/sessionStore.ts` (persist config)
- **Question:** Persisting `previousSession` means a tab refresh during a swap dance keeps the restore target alive. But the React-only flow state in `AddEmail` resets on refresh, so the restored target is by definition orphaned. Worth re-evaluating whether persistence is needed at all.

---

## Frontend — Analytics

### 🟡 (deferred) Merge funnel under-instrumented
- **Where:** `packages/wallet-shared/src/common/analytics/events/onboarding.ts`, `apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`
- **Issue:** `MergeFlow` transitions through 7 steps with zero `trackEvent` calls. We have no funnel data to optimise the flow.
- **Recommended events:**
  - `merge_attempted` (mode: local|remote, has_passkey_locally: bool)
  - `merge_step_completed` (step: preview|assets|consent|switch|sign|settling, mode, duration_ms)
  - `merge_step_failed` (step, error_code, mode)
  - `merge_aborted` (last_step, mode)
  - `merge_completed` (mode, total_duration_ms, requester_was_loser: bool)
- **Why deferred:** Wants schema review with the analytics team to fit the existing event taxonomy.

### 🟢 (deferred) French i18n polish
- **Where:** `packages/wallet-shared/src/i18n/locales/fr/translation.json`
- **Issue:** "combiner" → "fusionner" is more idiomatic for wallet merge. "passkey" left untranslated; "clé d'accès" is the conventional rendering.
- **Why deferred:** Localisation review pass.

---

## Frontend — Performance polish

### 🟢 (deferred) Pairing store subscription is too broad
- **Where:** `apps/wallet/app/module/walletMerge/strategy/useRemoteMergeStrategy.ts:70`
- **Issue:** `useStore(client.store)` subscribes to the entire pairing store. Even in local mode the remote strategy hook always runs (rules of hooks), so this re-renders on every pairing state change even when irrelevant.
- **Fix:** Use shallow selectors for the two fields actually read (`status`, `pairing.id`).

### 🟢 (deferred) `ensurePairingReady` claims idempotence but always calls `initiatePairing`
- **Where:** `apps/wallet/app/module/walletMerge/strategy/useRemoteMergeStrategy.ts:240`
- **Fix:** Track the last set of params passed; short-circuit when already paired for the same `{authenticatorHint, applySession}`.

### 🟢 (deferred) Preview cache key doesn't include requester
- **Where:** `apps/wallet/app/module/walletMerge/hook/useMergePreview.ts:18`
- **Issue:** Key is just `targetAuthenticatorId`. After an account switch the cached preview can resolve to stale winner/loser data.
- **Fix:** Include the captured `currentAuthenticatorId` or requester wallet in the query key.

### 🟢 (deferred) Aria-live missing on settling/consent loading states
- **Where:** `SettlingStep/index.tsx:112`, `ConsentStep/index.tsx:222`
- **Fix:** Add `role="status"` + `aria-live="polite"` semantics and focus the step title on transitions.

---

## Backend — API surface

### 🟡 (deferred) WS DTO drift between direct + topic shapes
- **Where:** `services/backend/src/domain/pairing/dto/WebsocketDirectMessage.ts:49`, `WebsocketTopicMessage.ts:12`
- **Issue:** `WsSignatureRequest` and `WsSignatureResponse` are duplicated between direct and topic DTOs with near-identical fields. The recent `signatureKind` addition had to be applied to both.
- **Fix:** Extract a base payload type; topic payloads extend it with `pairingId` and `partnerDeviceName`.

### 🟡 (deferred) Concurrent email-association race in `addNode`
- **Where:** `services/backend/src/api/user/wallet/auth/email.ts:85`, `domain/identity/repositories/IdentityRepository.ts:197`
- **Issue:** `POST /auth/email` checks conflict, then calls `addNode()`. `addNode` returns the existing node on unique conflict, so a racing client can be told "success" even though the email belongs to a different group.
- **Fix:** Use a strict insert helper. If the returned node's `groupId` differs from the caller's group, return the normal `"conflict"` response.

### 🟢 (deferred) Route context boilerplate duplicated
- **Where:** `services/backend/src/api/user/wallet/merge/preview.ts:22`, `merge/settle.ts:30`
- **Fix:** Extract `getMergeRequesterContext(walletSession, mode)` shared by both.

### 🟢 (deferred) `MERGE_INVALID_CONSENT` 401 schema returns `t.String()`
- **Where:** `services/backend/src/api/user/wallet/merge/preview.ts:43`, `settle.ts:52`
- **Fix:** Use `t.ErrorResponse` for consistency with the other error responses on the same route.

### 🟢 (deferred) WebAuthn consent verifier error handling
- **Where:** `services/backend/src/domain/auth/services/WebAuthNService.ts:107,121,190`
- **Issue:** `verifyConsentSignature` catches JSON parse errors but not malformed `BigInt(x)`, missing fields, or `WebAuthnP256.verify` throws — malformed client input becomes a 500 instead of 401.
- **Fix:** Wrap the full decode + verify block; return `false` on any throw. Add tests for the failure modes.

---

## How to triage from here

When picking up an item:
1. Move its section to the top of this file under an "In progress" heading.
2. When you land the fix, replace the section with a one-line `**Closed in PR #…**` entry so the rationale stays searchable.
3. If new follow-ups surface during the fix, add them here.
