# Wallet Merge — Phase 1: Backend Foundation + Same-Device Fast Path

> **Status:** Design draft. Phase 1 ships the storage refactor, identity-merge gaps, and the same-device merge flow. Phase 2 (cross-device via pairing-with-hint) builds on this foundation — see `docs/wallet-merge-phase-2.md`.

## Goal

A user is signed in on a device as Wallet A. They type an email already attached to Wallet B (a different smart-account address tied to a different passkey, likely the same person's other wallet on the same OS keychain). If Wallet B's passkey is discoverable on this same device, complete the merge entirely locally — two biometric prompts at most, no pairing, no cross-device coordination.

The on-chain primitive (`multiWebAuthNValidatorV2.addPassKey`) and the wagmi smart-account client are reused as-is. The work is mostly:

1. Refactor the libSQL authenticator schema so `(authenticator, chain) → wallet` is properly modeled with history.
2. Close existing gaps in `IdentityMergeService` (push tokens, asset-log recipient, referral codes).
3. Add a thin `WalletMergeOrchestrator` that verifies the on-chain state, repoints the binding, and runs the identity-graph merge.
4. Refactor the AddEmail conflict branch into the local merge flow.

---

## Scope

In Phase 1:
- Same-device merge only — both passkeys must resolve via a local WebAuthn assertion on the requesting device.
- Both supported chains (Arbitrum mainnet + Arbitrum Sepolia) for the binding model; merge is per-chain.
- New `authenticator_wallet_bindings` table; dual-write to the existing `authenticators.smart_wallet_address` and `authenticators.email` columns for safety.
- Bootstrap-driven back-fill of existing rows (idempotent batched job).

Out of Phase 1 (covered later):
- Cross-device pairing-with-hint flow (Phase 2).
- Recovery flow refactor onto the binding model (kept as-is for now; new `reason = 'recovery'` value reserved but unused).
- Recovery blob column (declared on the binding table, unused).
- `setPrimaryPassKey` UX, on-chain fund sweep, multi-chain UX (Phase 3+).
- Dropping the old `authenticators.smart_wallet_address` and `authenticators.email` columns (deferred to a follow-up PR once dual-write has run cleanly in prod).

---

## Schema changes

### `authenticators` (existing, keep all columns during dual-write)

```
authenticators:
  id                     TEXT PRIMARY KEY,    -- WebAuthn credentialId
  smart_wallet_address   TEXT,                -- KEPT (dual-write) — drop in a later PR
  email                  TEXT,                -- KEPT (dual-write) — drop in a later PR
  user_agent             TEXT NOT NULL,
  public_key_x           TEXT NOT NULL,
  public_key_y           TEXT NOT NULL,
  credential_public_key  TEXT NOT NULL,
  counter                INTEGER NOT NULL,
  credential_device_type TEXT NOT NULL,
  credential_backed_up   INTEGER NOT NULL,
  transports             TEXT
```

The `authenticators_email_lower_idx` index added in migration `0002` stays in place during dual-write. After cutover the index and the columns get dropped together.

### `authenticator_wallet_bindings` (new)

```
authenticator_wallet_bindings:
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  authenticator_id     TEXT NOT NULL REFERENCES authenticators(id),
  chain_id             INTEGER NOT NULL,
  smart_wallet_address TEXT NOT NULL,
  email                TEXT,                 -- nullable, denormalized across chains for a credential
  recovery_blob        TEXT,                 -- nullable, declared for Phase 3+; never read or written in Phase 1
  created_at           INTEGER NOT NULL,     -- unix ts
  unlinked_at          INTEGER,              -- null = currently active
  reason               TEXT NOT NULL         -- 'initial' | 'merged' (Phase 1 only)

-- One active binding per (authenticator, chain)
CREATE UNIQUE INDEX awb_active_idx
  ON authenticator_wallet_bindings(authenticator_id, chain_id)
  WHERE unlinked_at IS NULL;

-- Fast lookup of "which credentials currently bind to this wallet on this chain"
CREATE INDEX awb_wallet_active_idx
  ON authenticator_wallet_bindings(smart_wallet_address, chain_id)
  WHERE unlinked_at IS NULL;

-- Case-insensitive email lookup scoped to active bindings, per chain
CREATE INDEX awb_email_lower_active_idx
  ON authenticator_wallet_bindings(LOWER(email), chain_id)
  WHERE unlinked_at IS NULL AND email IS NOT NULL;
```

### Binding semantics

- **One credential, two bindings.** Each authenticator gets one active binding per chain. On register, two rows are inserted (Arb mainnet + Arb Sepolia) with the same `smart_wallet_address` (derivation is deterministic — same passkey ⇒ same address across chains given matching factory addresses).
- **Email is denormalized across a credential's active bindings.** Updating an email mutates every active row for the credential, keeping the same string on every chain. Reads can target any active binding and will return the same value.
- **`unlinked_at` is set on merge.** A new row with `reason = 'merged'` and the winner's wallet address gets inserted; the previous row gets `unlinked_at` stamped. The credential keeps every prior wallet binding visible for audit.
- **`recovery_blob` is reserved.** The column exists but Phase 1 never writes it. The recovery flow refactor lands later.

### History pattern (matches the brief)

| id | auth_id | chain | wallet | email | created_at | unlinked_at | reason |
|---|---|---|---|---|---|---|---|
| 1 | A | 42161 | XX | u@e | t0 | **t1** | `initial` |
| 2 | A | 42161 | YY | u@e | **t1** | NULL | `merged` |
| 3 | A | 421614 | XX | u@e | t0 | NULL | `initial` |

In this example credential A had its Arbitrum-mainnet binding merged at t1; the Sepolia binding is untouched and still points at the original deterministic wallet.

---

## Migration & back-fill plan

DB migrations are human-generated. The SQL above goes into `services/backend/src/domain/auth/db/schema.ts` (Drizzle schema) and a hand-written migration file under `services/backend/drizzle-libsql/` (or wherever the auth migrations live). The bootstrap step picks it up automatically (`runLibsqlMigrations`).

### Back-fill via bootstrap

A new step is added to `services/bootstrap/src/index.ts` between `runLibsqlMigrations` and `ensureBuckets`:

```ts
await runPgMigrations();
await runLibsqlMigrations();
await runLibsqlAuthBindingBackfill();   // NEW — batched, idempotent, fail-fast
await ensureBuckets();
```

`services/bootstrap/src/backfill-auth-bindings.ts` (new):

- **Reads** the env-configured chain ids (`FRAK_CHAIN_IDS` — e.g. `[42161, 421614]`). If any chain id is missing the script logs and skips that chain (it won't crash the deploy).
- **Loops in batches of N=500 rows**: `SELECT * FROM authenticators WHERE smart_wallet_address IS NOT NULL ORDER BY id LIMIT 500 OFFSET ?`.
- For each row, inserts one binding per chain id with `INSERT INTO authenticator_wallet_bindings (authenticator_id, chain_id, smart_wallet_address, email, created_at, reason) VALUES (?, ?, ?, ?, unixepoch(), 'initial') ON CONFLICT (authenticator_id, chain_id) WHERE unlinked_at IS NULL DO NOTHING`.
- **Skips rows with `smart_wallet_address IS NULL`** (old auth records from before the column existed). These are handled lazily on the next login of that credential — see "Lazy back-fill on login" below.
- **Idempotent**: running the bootstrap a second time inserts nothing thanks to the partial unique index.
- **Logs**: rows scanned, bindings inserted per chain, rows skipped (null wallet). One summary line at completion.

The script can be re-run safely if it crashes midway — the `ON CONFLICT DO NOTHING` clause handles partial progress.

### Lazy back-fill on login

`AuthenticationService.login()` (or whichever method finalises login post-WebAuthn verification) gets a side-effect after a successful credential lookup:

```ts
const credential = await authRepo.getByCredentialId(credId);
const bindings = await authRepo.getActiveBindings(credId);

if (bindings.length === 0) {
    // Legacy credential with no binding yet — back-fill in place.
    const wallet = credential.smartWalletAddress
        ?? webAuthnService.deriveWalletAddress(credential);
    for (const chainId of allConfiguredChainIds) {
        await authRepo.createBinding({
            credentialId: credId,
            chainId,
            smartWalletAddress: wallet,
            email: credential.email ?? null,
            reason: "initial",
        });
    }
    // If the authenticators column was null too (very old row), also dual-write it back.
    if (!credential.smartWalletAddress) {
        await authRepo.legacyDualWriteWallet(credId, wallet);
    }
}
```

This guarantees every active credential has its binding within one user session even if bootstrap skipped it. The side-effect is O(2 inserts) on first login post-cutover, then becomes a no-op.

---

## Repository surface

All changes are in `services/backend/src/domain/auth/repositories/AuthenticatorRepository.ts`. Existing method names are kept where their semantics are unchanged; new methods are added alongside.

### Unchanged signatures (semantics preserved via dual-read)

| Method | Behavior |
|---|---|
| `getByCredentialId(id)` | Returns the row from `authenticators`. Pure credential lookup, no wallet info. |

### Modified signatures (chain-aware)

| Method | New shape | Notes |
|---|---|---|
| `getBySmartWalletAddress(addr)` | `getByActiveWallet({ chainId, smartWalletAddress })` | Joins `authenticator_wallet_bindings` filtered to active. Falls back to `authenticators.smart_wallet_address` if no binding exists yet (dual-write window). |
| `findByEmail(email)` | `findByEmail({ chainId, email })` | Reads from `awb_email_lower_active_idx`; same fallback. |
| `updateEmail({ credentialId, email })` | `updateEmail({ credentialId, email })` | Updates **every active binding** for the credential (denormalised across chains) AND the legacy `authenticators.email` column. |
| `getEmail({ credentialId })` | `getEmail({ credentialId, chainId? })` | Reads from any active binding; `chainId` argument is optional (any binding works for the email value). |
| `createAuthenticator({...})` | `createAuthenticator(credentialFields)` + chained `seedInitialBindings({ credentialId, smartWalletAddress, email?, chainIds })` | Register handler calls both inside a transaction; one row in `authenticators`, two rows in `authenticator_wallet_bindings` (one per configured chain). Dual-writes the wallet/email back to the legacy columns. |

### New methods

| Method | Purpose |
|---|---|
| `getActiveBindings(credentialId)` | All currently-active binding rows for a credential (across chains). |
| `getActiveBinding({ credentialId, chainId })` | Single active row or null. |
| `createBinding({ credentialId, chainId, smartWalletAddress, email?, reason })` | Insert a binding. Used by register, by lazy back-fill, and by the merge orchestrator. |
| `repointBinding({ credentialId, chainId, toSmartWalletAddress, emailPolicy, reason })` | Inside a single libSQL transaction: stamp `unlinked_at` on the active row, insert a new active row pointing at `toSmartWalletAddress`. `emailPolicy` controls whether to carry the email forward (`keep`, `clear`, or a string to set explicitly). Also updates the legacy `authenticators.smart_wallet_address` + `email` columns so dual-write stays in sync. |
| `legacyDualWriteWallet(credentialId, smartWalletAddress)` | Used only by the lazy back-fill path to fix rows where the legacy column itself was NULL. |

`repointBinding` is the only place that mutates an existing binding row. Every binding mutation goes through it so dual-write and history-insert can't drift out of sync.

---

## `IdentityMergeService` extensions

File: `services/backend/src/orchestration/identity/IdentityMergeService.ts`.

### Options bag

`mergeGroups(anchorGroupId, mergingGroupId, options?)` gains:

```ts
type MergeOptions = {
    migratePushTokens?:        boolean;     // default true
    migrateAssetLogsRecipient?: boolean;     // default true
    referralCodePolicy?:       "migrate-revoke-on-conflict";  // default; only policy for now
};
```

### New SQL ops in the existing transaction

Added to `mergeGroups` after the existing steps, before deleting the merging group row:

```sql
-- push_tokens: move active rows, drop orphan endpoint conflicts
UPDATE push_tokens
   SET wallet = $anchor_wallet
 WHERE wallet = $merging_wallet
   ON CONFLICT (wallet, type, endpoint) DO NOTHING;
DELETE FROM push_tokens
 WHERE wallet = $merging_wallet;

-- asset_logs: pending rows redirect to anchor; settled rows are immutable
UPDATE asset_logs
   SET recipient_wallet = $anchor_wallet
 WHERE recipient_wallet = $merging_wallet
   AND status NOT IN ('settled', 'expired');

-- referral_codes: migrate historicals always; for actives, resolve via policy
WITH winner_active AS (
  SELECT 1
    FROM referral_codes
   WHERE owner_identity_group_id = $anchor_group
     AND revoked_at IS NULL
   LIMIT 1
)
UPDATE referral_codes
   SET revoked_at = NOW(),
       revocation_reason = 'merged-into-winner'
 WHERE owner_identity_group_id = $merging_group
   AND revoked_at IS NULL
   AND EXISTS (SELECT 1 FROM winner_active);   -- only revoke if there's a conflict

UPDATE referral_codes
   SET owner_identity_group_id = $anchor_group
 WHERE owner_identity_group_id = $merging_group;
```

Three new ops, all inside the existing PG transaction. `mergeGroupsByWallet(winnerWallet, loserWallet, options)` resolves the group ids and calls `mergeGroups`.

`notification_sent.wallet` stays keyed by the original wallet (audit trail). Documented as intentional in the schema comment.

---

## `WalletMergeOrchestrator`

New file: `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts`.

```ts
class WalletMergeOrchestrator {
    constructor(
        private authRepo: AuthenticatorRepository,
        private identityRepo: IdentityRepository,
        private identityWeightSvc: IdentityWeightService,
        private identityMergeSvc: IdentityMergeService,
        private webAuthNValidatorReader: ContractReader,    // wraps publicClient.readContract
    ) {}

    async preview({ requesterWallet, targetAuthenticatorId, chainId }): Promise<MergePreview> {
        const target = await this.authRepo.getActiveBinding({
            credentialId: targetAuthenticatorId,
            chainId,
        });
        if (!target) throw new MergeError("target-binding-not-found");

        const [requesterGroup, targetGroup] = await Promise.all([
            this.identityRepo.findGroupByIdentity({ type: "wallet", value: requesterWallet }),
            this.identityRepo.findGroupByIdentity({ type: "wallet", value: target.smartWalletAddress }),
        ]);

        const [requesterWeight, targetWeight] = await Promise.all([
            this.identityWeightSvc.getGroupWeight(requesterGroup.id),
            this.identityWeightSvc.getGroupWeight(targetGroup.id),
        ]);

        const winner =
            requesterWeight.total > targetWeight.total ||
            (requesterWeight.total === targetWeight.total &&
             requesterGroup.createdAt <= targetGroup.createdAt)
                ? { wallet: requesterWallet, group: requesterGroup }
                : { wallet: target.smartWalletAddress, group: targetGroup };
        const loser = winner.wallet === requesterWallet
            ? { wallet: target.smartWalletAddress, group: targetGroup }
            : { wallet: requesterWallet, group: requesterGroup };

        return {
            chainId,
            requesterWallet,
            targetWallet: target.smartWalletAddress,
            winner: winner.wallet,
            loser:  loser.wallet,
            loserAuthenticatorId: /* the credential id whose binding points to loser */,
            loserPublicKey:       /* { x, y } from authenticators table */,
            movedCounts:          /* IdentityWeightService + extra conflict counters */,
            conflicts:            /* duplicate-referee-link count, etc. */,
            immutables:           /* settled asset_logs count for loser */,
            identitiesBeingMerged: /* loser's identity_nodes */,
        };
    }

    async settle({ requesterWallet, targetAuthenticatorId, chainId, onChainTxHash }): Promise<void> {
        // Recompute preview deterministically (no stored snapshot in Phase 1)
        const preview = await this.preview({ requesterWallet, targetAuthenticatorId, chainId });

        // 1. Verify the userOp landed and produced the expected on-chain state
        const receipt = await this.webAuthNValidatorReader.waitForReceipt(chainId, onChainTxHash);
        if (receipt.status !== "success") throw new MergeError("user-op-reverted");

        const onChainPubkey = await this.webAuthNValidatorReader.getPasskey(
            chainId,
            preview.winner,
            keccak256(toHex(preview.loserAuthenticatorId)),
        );
        if (
            onChainPubkey.x !== BigInt(preview.loserPublicKey.x) ||
            onChainPubkey.y !== BigInt(preview.loserPublicKey.y)
        ) throw new MergeError("on-chain-passkey-mismatch");

        // 2. libSQL repoint (atomic in libSQL tx)
        await this.authRepo.repointBinding({
            credentialId: preview.loserAuthenticatorId,
            chainId,
            toSmartWalletAddress: preview.winner,
            emailPolicy: "clear",   // loser's email cleared; winner's preserved
            reason: "merged",
        });

        // 3. PG identity merge (atomic in PG tx)
        await this.identityMergeSvc.mergeGroupsByWallet(preview.winner, preview.loser, {
            migratePushTokens: true,
            migrateAssetLogsRecipient: true,
            referralCodePolicy: "migrate-revoke-on-conflict",
        });

        // 4. Emit event (in-process)
        eventEmitter.emit("walletMerged", {
            chainId,
            winner: preview.winner,
            loser:  preview.loser,
            credentialId: preview.loserAuthenticatorId,
        });
    }
}
```

Cross-DB safety: each step is independently idempotent (verified in D.3 of the Phase 2 doc, same shape). A crashed `settle` can be safely retried by re-invoking the API endpoint — step 1 is a pure read, step 2 is a no-op if the binding already points to winner (the active row check), step 3 is a no-op if the loser's group has already been merged into winner's.

---

## API endpoints

New routes under `services/backend/src/api/user/wallet/merge/`:

| Method + path | Auth | Body / query | Response |
|---|---|---|---|
| `GET /user/wallet/merge/preview` | webauthn JWT (the requester) | `?targetAuthenticatorId=...&chainId=...` (chainId optional, defaults to env) | `MergePreview` |
| `POST /user/wallet/merge/settle` | webauthn JWT (the requester) | `{ targetAuthenticatorId, chainId?, onChainTxHash }` | `{ status: "merged", winner, loser }` |

Both wired in `services/backend/src/api/user/wallet/index.ts`. Existing `POST /user/wallet/auth/email` is updated to return the target authenticator id and wallet on the conflict branch:

```ts
// AssociateEmailResponseSchema (existing) — extended conflict shape
| { status: "conflict"; targetAuthenticatorId: string; targetWallet: Address }
```

`emailRoutes.ts` already calls `AuthenticatorRepository.findByEmail` internally to detect the conflict — that result now carries the credential id and wallet, both of which feed the response directly.

---

## Frontend changes

### `packages/wallet-shared` — `sessionStore`

New methods on `sessionStore` (file `packages/wallet-shared/src/stores/sessionStore.ts`):

```ts
interface SessionStoreState {
    session: Session | null;
    sdkSession: SdkSession | null;
    previousSession: { session: Session; sdkSession: SdkSession | null } | null;  // NEW (persisted)

    pushSession: () => void;   // saves current → previousSession; nulls current
    popSession:  () => boolean; // restores previousSession; returns false if none
    // existing: setSession, setSdkSession, clearSession
}
```

Persistence: `previousSession` is included in the `persist` config so a tab refresh during the switch flow doesn't lose the restore target.

### `apps/wallet` — hooks

New files under `apps/wallet/app/module/walletMerge/hook/`:

| Hook | Purpose |
|---|---|
| `useMergePreview(targetAuthenticatorId)` | React Query wrapper around `GET /merge/preview`. Cached by `(targetAuthenticatorId, chainId)`. |
| `useProveLocalAuthenticator(targetAuthenticatorId)` | Calls `navigator.credentials.get({ publicKey: { allowCredentials: [{ id: <bytes>, type: 'public-key' }] }})` to verify the target passkey is locally usable. Returns `'available'` / `'unavailable'` / `'cancelled'`. Used as a pre-flight before kicking off the switch flow. |
| `useSwitchAuthenticator()` | Wraps `sessionStore.pushSession()` + `useLogin({ lastAuthentication: { authenticatorId, wallet } })`. On failure auto-`popSession()`. |
| `useMergeFinaliseLocal()` | Builds `encodeFunctionData({ abi: multiWebAuthNValidatorV2Abi, functionName: "addPassKey", args: [...] })`, submits via the existing smart-account send hook (`useSendTransactionAction` or equivalent), then calls `POST /merge/settle`. Returns terminal state. |

### `apps/wallet` — `AddEmail` conflict branch refactor

File: `apps/wallet/app/module/settings/component/AddEmail/index.tsx`.

The conflict branch is replaced with the merge flow:

```ts
case "conflict": {
    // 1. Fetch preview
    const { data: preview, isLoading } = useMergePreview(response.targetAuthenticatorId);

    // 2. Show recap UI: "Merging wallet X into wallet Y, you'll gain N referrals..."

    // 3. On confirm:
    if (preview.winner === currentSession.address) {
        //   A wins: sign addPasskey on current device with current passkey
        await finaliseMerge.run({ /* winner=current */ });
    } else {
        //   B wins: switch passkey first, then sign addPasskey, then optionally restore
        const probe = await proveLocalAuthenticator.run(response.targetAuthenticatorId);
        if (probe !== "available") {
            //   Local fast path unavailable — Phase 1 shows the "use other device" message
            return setFlowState({ kind: "needsOtherDevice" });
        }
        try {
            await switchAuthenticator.run({
                authenticatorId: response.targetAuthenticatorId,
                wallet: response.targetWallet,
            });
            await finaliseMerge.run({ /* winner=B (now current after switch) */ });
            sessionStore.getState().popSession();   // restore wallet A's session
        } catch (err) {
            // popSession already called by useSwitchAuthenticator on its own failure;
            // if finaliseMerge failed mid-way, we keep the B session so the user can retry.
            throw err;
        }
    }
}
```

On success the user sees the existing AddEmail success screen with copy adjusted ("Your other wallet is now part of this one"). The "Setup recovery" button stays a no-op until the recovery rework is done.

---

## Failure modes

| Scenario | Behavior |
|---|---|
| Local `useProveLocalAuthenticator` returns `unavailable` or `cancelled` | UI shows the Phase 1 "this needs your other device" placeholder. No state change. Phase 2 replaces this with the QR flow. |
| `useSwitchAuthenticator` fails (biometric cancel, mismatched credential, etc.) | `popSession()` runs in the hook's catch; user lands back on the current session with the merge form re-enabled. |
| `useMergeFinaliseLocal` userOp reverts on-chain | Hook throws; UI shows error toast. Settle endpoint is never called. No data mutated. If we switched session for this attempt, the user is still on wallet B and can retry the on-chain step; if it succeeds the merge completes; if they give up, `popSession()` restores wallet A. |
| `/merge/settle` returns 4xx (verification failure) | UI shows error toast. The on-chain `addPassKey` is now in effect (B's passkey is a co-signer of winner), but backend hasn't merged. Retry button re-calls `/merge/settle` — idempotent by design. |
| `/merge/settle` succeeds on-chain verification and libSQL repoint but PG merge crashes | Manual replay needed — for Phase 1 the simplest answer is "log error, surface in admin tooling". A retry endpoint or cron-based reconciler is deferred to Phase 2 (the cleanup logic lands there as part of the `merge_state` row work). |
| User reloads the AddEmail page mid-flow | React Query cache invalidates; preview re-fetches; flow restarts from the input state. Pending on-chain tx (if any) keeps its course — the next `/merge/settle` retry picks it up. |
| Bootstrap back-fill skips a row with NULL `smart_wallet_address` | Lazy back-fill on next login of that credential. Login latency increases by 2 INSERTs on that one request. |
| Bootstrap back-fill encounters a chain id that's not configured for this env | Logs warning, skips that chain id. Doesn't crash the Job. |

---

## What needs to change, file by file

### Backend

| File | Change |
|---|---|
| `services/backend/src/domain/auth/db/schema.ts` | Add `authenticatorWalletBindingsTable` Drizzle definition. |
| `services/backend/drizzle-libsql/00XX_authenticator_bindings.sql` | Hand-written migration: create table + three indexes. (No back-fill SQL here — that lives in the bootstrap script so it can batch and log.) |
| `services/backend/src/domain/auth/repositories/AuthenticatorRepository.ts` | Add `getActiveBindings`, `getActiveBinding`, `createBinding`, `repointBinding`, `legacyDualWriteWallet`. Adjust `getByActiveWallet`, `findByEmail`, `updateEmail`, `getEmail`, `createAuthenticator` per the table in "Repository surface". |
| `services/backend/src/domain/auth/services/AuthenticationService.ts` (or wherever `register` and `login` finalise) | On register, call `createBinding` for every configured chain id. On login, run the lazy back-fill side-effect when `getActiveBindings(credId)` returns empty. |
| `services/backend/src/orchestration/identity/IdentityMergeService.ts` | Add options bag + 3 new SQL ops (push_tokens, asset_logs.recipient_wallet pending, referral_codes migrate-with-conflict-revoke). |
| `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts` *(new)* | `preview`, `settle`. |
| `services/backend/src/infrastructure/blockchain/WebAuthNValidatorReader.ts` *(new)* | Thin wrapper around `publicClient.readContract` for `getPasskey` and `waitForTransactionReceipt`. Chain-aware. |
| `services/backend/src/api/user/wallet/merge/preview.ts` *(new)* | `GET /user/wallet/merge/preview`. |
| `services/backend/src/api/user/wallet/merge/settle.ts` *(new)* | `POST /user/wallet/merge/settle`. |
| `services/backend/src/api/user/wallet/index.ts` | Wire the new merge routes. |
| `services/backend/src/api/user/wallet/auth/email.ts` | Conflict response returns `{ targetAuthenticatorId, targetWallet }`. |
| `services/backend/src/api/schemas/authenticationSchemas.ts` | Extend `AssociateEmailResponseSchema` conflict branch. |
| `services/backend/src/jobs/` *(or env config)* | Expose the list of configured chain ids as a single source of truth used by register, login, bootstrap back-fill, and the merge orchestrator. |

### Bootstrap

| File | Change |
|---|---|
| `services/bootstrap/src/backfill-auth-bindings.ts` *(new)* | Batched idempotent back-fill (see "Back-fill via bootstrap"). |
| `services/bootstrap/src/index.ts` | Insert the new step between `runLibsqlMigrations` and `ensureBuckets`. |
| `services/bootstrap/AGENTS.md` | Add the new step to the sequential list. |
| `services/bootstrap/package.json` (if needed) | Add the libSQL client dependency if not already present via `services/backend`. |

### Frontend — `packages/wallet-shared`

| File | Change |
|---|---|
| `src/stores/sessionStore.ts` | Add `previousSession` slot + `pushSession` + `popSession`. Persist `previousSession`. |
| `src/authentication/queryKeys/auth.ts` | Add `merge.preview(targetAuthId, chainId)` query key. |

### Frontend — `apps/wallet`

| File | Change |
|---|---|
| `app/module/walletMerge/hook/useMergePreview.ts` *(new)* | React Query wrapper. |
| `app/module/walletMerge/hook/useProveLocalAuthenticator.ts` *(new)* | `navigator.credentials.get` probe. |
| `app/module/walletMerge/hook/useSwitchAuthenticator.ts` *(new)* | Push/login/restore-on-failure. |
| `app/module/walletMerge/hook/useMergeFinaliseLocal.ts` *(new)* | Build addPasskey calldata + send tx + call `/merge/settle`. |
| `app/module/settings/component/AddEmail/index.tsx` | Conflict branch refactor; uses the four new hooks. |
| `app/module/settings/component/AddEmail/index.css.ts` | Optional new styles for the preview recap; otherwise unchanged. |
| `packages/wallet-shared/src/i18n/locales/{en,fr}/translation.json` | Copy for the merge confirm + success screens. |
| `packages/wallet-shared/src/types/i18n/resources.d.ts` | Regenerate via `bun run i18n:types`. |

No new routes — the merge flow stays inside the existing `/profile/add-email` page (the `_protected-fullscreen` one the user moved earlier).

---

## Locked decisions

- Authenticator ↔ wallet ↔ chain modeled via a binding table with `unlinked_at` history.
- Email lives on the binding row, denormalised across a credential's active bindings.
- `recovery_blob` column declared but unused in Phase 1.
- Reason enum for Phase 1: `'initial'`, `'merged'`. `'recovery'` reserved for later.
- Dual-write to existing `authenticators.smart_wallet_address` and `authenticators.email` columns; drop the columns in a follow-up PR.
- Bootstrap-driven back-fill — batched, idempotent, fail-fast. Skips NULL-wallet rows; login lazy-fills those.
- Both Arbitrum mainnet and Arbitrum Sepolia bindings inserted at register time, and back-filled for every existing row.
- Same-device fast path only in Phase 1. Cross-device pairing-with-hint is Phase 2.

---

## Open questions

1. **Env source for the chain id list.** Today the backend already knows its single deployment chain. Phase 1 introduces a "both chains" requirement for register and back-fill. The cleanest answer is a single exported const in `packages/app-essentials` (or `services/backend/src/config/`) listing `[arbitrumOneId, arbitrumSepoliaId]`. Confirm where to put it.

2. **Recovery flow today.** The recovery flow currently creates a new authenticator pointing at an old wallet address via the `previousWallet` arg in register. In the dual-write window, recovery keeps writing to `authenticators.smart_wallet_address` as-is; we should also insert a binding row with `reason='recovery'`. Should we land that change now (using the reserved enum value) or strictly defer it? Recommendation: do it now — it's two extra lines in the recovery register path and avoids leaving recovery credentials behind on the lazy back-fill list.

3. **Per-chain merge UX.** Phase 1 ships with a single env-bound chain in practice. The orchestrator accepts a `chainId` but the UI never asks the user for one. Confirm we never want the user to pick a chain at merge time (the active chain is implicit from session).

4. **Manual replay endpoint.** When `/merge/settle` succeeds on-chain + libSQL but PG merge crashes, the user is in a half-merged state. Phase 1 surfaces this in logs only. Should we add a quick "admin replay" route, or wait for Phase 2's reconciler? Recommendation: log-only for Phase 1; add reconciler in Phase 2.

Once those are answered I can start implementing PR 1 (schema + repository extensions + bootstrap back-fill).
