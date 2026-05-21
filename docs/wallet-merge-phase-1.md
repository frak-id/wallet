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
- New `authenticator_wallet_bindings` table; legacy `authenticators.smart_wallet_address` column kept (dual-write through `repointBinding`) until the rollout has run cleanly in prod.
- Email moves out of libSQL entirely and becomes a postgres `identity_nodes` row of type `email` attached to the wallet's identity group. The legacy `authenticators.email` column is read-only from this point and only consumed once by the bootstrap migration; it gets dropped in a follow-up PR.
- Bootstrap-driven back-fill of existing rows (idempotent batched job, dual-client libSQL + postgres).

Out of Phase 1 (covered later):
- Cross-device pairing-with-hint flow (Phase 2).
- Recovery flow refactor onto the binding model (kept as-is for now; new `reason = 'recovery'` value reserved but unused).
- Recovery blob column (declared on the binding table, unused).
- `setPrimaryPassKey` UX, on-chain fund sweep, multi-chain UX (Phase 3+).
- Dropping the legacy `authenticators.smart_wallet_address` and `authenticators.email` columns (deferred to a follow-up PR once back-fill has run cleanly in every env).

---

## Schema changes

### `authenticators` (libSQL — existing, kept during the rollout window)

```
authenticators:
  id                     TEXT PRIMARY KEY,    -- WebAuthn credentialId
  smart_wallet_address   TEXT,                -- legacy, kept; written through `repointBinding`
  email                  TEXT,                -- legacy, read-only after rollout; drop after back-fill stabilises
  user_agent             TEXT NOT NULL,
  public_key_x           TEXT NOT NULL,
  public_key_y           TEXT NOT NULL,
  credential_public_key  TEXT NOT NULL,
  counter                INTEGER NOT NULL,
  credential_device_type TEXT NOT NULL,
  credential_backed_up   INTEGER NOT NULL,
  transports             TEXT
```

The `authenticators_email_lower_idx` expression index stays in place so the bootstrap back-fill can resolve the legacy email rows in bulk. Index + column both get dropped together in the follow-up PR.

### `authenticator_wallet_bindings` (new, libSQL)

```
authenticator_wallet_bindings:
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  authenticator_id     TEXT NOT NULL REFERENCES authenticators(id),
  chain_id             INTEGER NOT NULL,
  smart_wallet_address TEXT NOT NULL,
  recovery_blob        TEXT,                 -- nullable, declared for Phase 3+; never read or written in Phase 1
  created_at           INTEGER NOT NULL,     -- unix ts
  unlinked_at          INTEGER,              -- null = currently active
  reason               TEXT NOT NULL         -- 'initial' | 'merged' (Phase 1 only)

-- One active binding per (authenticator, chain)
CREATE UNIQUE INDEX awb_active_idx
  ON authenticator_wallet_bindings(authenticator_id, chain_id)
  WHERE unlinked_at IS NULL;

-- Fast lookup of "which credentials currently bind to this wallet on this chain"
CREATE INDEX awb_wallet_chain_idx
  ON authenticator_wallet_bindings(smart_wallet_address, chain_id)
  WHERE unlinked_at IS NULL;
```

Email is **not** on this table. It lives on the wallet's identity group (`identity_nodes`, see below). This is the deliberate design change: email is environment-scoped (the same wallet on dev and prod can legitimately carry different emails) and is a piece of identity, not a property of the authentication credential. The `authenticator_wallet_bindings` row remains chain-scoped and stays clean of identity data.

### `identity_nodes` (existing, postgres) — now also the source of truth for email

```
identity_nodes:
  id              UUID PRIMARY KEY,
  group_id        UUID NOT NULL REFERENCES identity_groups(id),
  identity_type   TEXT NOT NULL,           -- 'wallet' | 'anonymous_fingerprint' | 'email'
  identity_value  TEXT NOT NULL,           -- normalised: wallet/email lowercased
  merchant_id     UUID,                    -- null for wallet + email rows
  validation_data JSONB,
  created_at      TIMESTAMP DEFAULT NOW(),
  unlinked_at     TIMESTAMP                -- soft-unlink marker, used by loser wallet nodes post-merge

-- Existing uniqueness: one identity value per merchant scope, globally
UNIQUE (identity_type, identity_value, merchant_id) NULLS NOT DISTINCT
```

The `email` identity-type entry was added in this phase. Resolution is `wallet → identity group → email identity node` via `IdentityRepository.findEmailForGroup(groupId)`. The same global unique index that keeps wallets unambiguous now also enforces that the same email cannot belong to two different identity groups simultaneously — which is what powers the merge-on-conflict flow.

### Binding semantics

- **One credential, two bindings.** Each authenticator gets one active binding per chain. On register, two rows are inserted (Arb mainnet + Arb Sepolia) with the same `smart_wallet_address` (derivation is deterministic — same passkey ⇒ same address across chains given matching factory addresses).
- **`unlinked_at` is set on merge.** A new row with `reason = 'merged'` and the winner's wallet address gets inserted; the previous row gets `unlinked_at` stamped. The credential keeps every prior wallet binding visible for audit.
- **`recovery_blob` is reserved.** The column exists but Phase 1 never writes it. The recovery flow refactor lands later.

### Email semantics

- **One email per identity group, normally.** Adding an email through `POST /user/wallet/auth/email` refuses to overwrite when the group already has one. The user has to clear it first (out of Phase 1) or go through the merge flow.
- **Multiple emails per group post-merge are allowed.** A wallet merge moves the loser's identity nodes — email included — onto the winner's group. If both sides had a different email attached, the winner ends up holding both. `findEmailForGroup` orders by `created_at ASC` so the oldest active email wins deterministically (the surviving credential's, since the loser's email is, by definition, the newer one at this point).
- **Same-email merge is impossible.** The global unique on `(identity_type, identity_value, merchant_id)` prevents two groups from holding the same email value, which is precisely what triggers the merge flow in the first place — there is never a constraint conflict at merge time.

### History pattern (matches the brief)

| id | auth_id | chain | wallet | created_at | unlinked_at | reason |
|---|---|---|---|---|---|---|
| 1 | A | 42161 | XX | t0 | **t1** | `initial` |
| 2 | A | 42161 | YY | **t1** | NULL | `merged` |
| 3 | A | 421614 | XX | t0 | NULL | `initial` |

In this example credential A had its Arbitrum-mainnet binding merged at t1; the Sepolia binding is untouched and still points at the original deterministic wallet. The user's email is unaffected by the binding repoint — it sits on the postgres identity group and follows whichever wallet absorbs the other during the PG merge step.

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

The job is dual-DB. It connects a Drizzle libSQL client (for the authenticator + binding tables) and a Drizzle postgres client (for the identity-node migration of the legacy email column). Both schemas are imported from `services/backend/src/domain/*/db/schema.ts` so the back-fill stays in lockstep with the runtime types — no parallel SQL strings to drift.

Per batch (`BATCH_SIZE = 500`):

1. `SELECT id, smart_wallet_address, email FROM authenticators ORDER BY id LIMIT 500 OFFSET ?` (libSQL).
2. **Seed bindings:** for every row with a non-null `smart_wallet_address`, push one binding per configured chain id. Bulk `INSERT ... ON CONFLICT DO NOTHING` against the partial unique `awb_active_idx` skips rows that already have an active binding. Rows with `smart_wallet_address IS NULL` are counted under `skippedNullWallet`; bindings for those wallets land on the next login through `AuthenticatorRepository.ensureActiveBindings`.
3. **Migrate emails:** for every row carrying a non-null email, walk the postgres side:
    - Look up the wallet's active `identity_nodes` row of type `wallet` to find the identity group id. If none exists yet (the wallet has never produced an identity-bearing event in postgres on this env), the email is skipped (`skippedEmailNoGroup`) — the legacy column keeps the data, and the next bootstrap run after the group exists will migrate it.
    - Check whether the group already holds an active email node. If yes, skip (`skippedEmailAlreadyOnGroup`) — the running application owns the truth past the first migration and we must not silently overwrite with a possibly-stale value.
    - Otherwise insert a new `(group_id, identity_type='email', identity_value=<lowercased>)` row with `ON CONFLICT DO NOTHING` as a belt-and-braces against the global unique.

Both sides are idempotent and the script can be re-run safely after a crash. Logging emits one summary line: `scanned`, `bindingsInserted`, `emailNodesInserted`, `skippedNullWallet`, `skippedEmailNoGroup`, `skippedEmailAlreadyOnGroup`.

### Lazy back-fill on login (binding rows only)

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
            reason: "initial",
        });
    }
    // If the authenticators column was null too (very old row), also write it back.
    if (!credential.smartWalletAddress) {
        await authRepo.legacyDualWriteWallet(credId, wallet);
    }
}
```

This guarantees every active credential has its binding within one user session even if bootstrap skipped it. The side-effect is O(2 inserts) on first login post-cutover, then becomes a no-op.

Email is **not** lazy-loaded on login — it lives in postgres and is per-env, while the login path itself has no way to introduce a fresh email value (the credential row's email is per-credential, env-shared, exactly the wrong key for the new placement). Any legacy email that bootstrap couldn't migrate on its first run lands on a subsequent run once the identity group catches up.

---

## Repository surface

All changes are in `services/backend/src/domain/auth/repositories/AuthenticatorRepository.ts`. Existing method names are kept where their semantics are unchanged; new methods are added alongside.

All email-related methods (`findByEmail`, `updateEmail`, `getEmail`) are **removed** — email no longer lives in libSQL, so the lookups don't belong on this repository anymore. Email reads route through `IdentityRepository.findEmailForGroup`; the "credential currently bound to this email" lookup is handled by the new `AuthenticatorLookupOrchestrator` (see below) since it crosses the identity ↔ auth boundary.

### Unchanged signatures

| Method | Behavior |
|---|---|
| `getByCredentialId(id)` | Returns the row from `authenticators`. Pure credential lookup, no wallet info. |

### Modified / new signatures

| Method | New shape | Notes |
|---|---|---|
| `getBySmartWalletAddress(addr)` | `getByActiveWallet({ chainId, smartWalletAddress })` | Joins `authenticator_wallet_bindings` filtered to active. Falls back to `authenticators.smart_wallet_address` if no binding exists yet (legacy row pre back-fill). |
| `createAuthenticator({...})` | `createAuthenticator(credentialFields)` + chained `seedInitialBindings({ credentialId, smartWalletAddress, chainIds })` | Register handler calls both inside a transaction; one row in `authenticators`, two rows in `authenticator_wallet_bindings` (one per configured chain). |
| `getActiveBindings(credentialId)` | *(new)* | All currently-active binding rows for a credential (across chains). |
| `getActiveBinding({ credentialId, chainId })` | *(new)* | Single active row or null. |
| `createBinding({ credentialId, chainId, smartWalletAddress, reason })` | *(new)* | Insert a binding. Used by register, by lazy back-fill, and by the merge orchestrator. |
| `repointBinding({ credentialId, chainId, toSmartWalletAddress, reason })` | *(new)* | Inside a single libSQL transaction: stamp `unlinked_at` on the active row, insert a new active row pointing at `toSmartWalletAddress`. Also updates the legacy `authenticators.smart_wallet_address` column. No `emailPolicy` argument — email is owned by the identity domain and flows with the PG merge step. |
| `ensureActiveBindings(credentialId, smartWalletAddress)` | *(new)* | Lazy back-fill hook called from login when `getActiveBindings` returns empty. Idempotent. |
| `legacyDualWriteWallet(credentialId, smartWalletAddress)` | *(new)* | Used only by the lazy back-fill path to fix rows where the legacy column itself was NULL. |

`repointBinding` is the only place that mutates an existing binding row. Every binding mutation goes through it so the legacy column write and history-insert can't drift out of sync.

### Identity-side helpers

`IdentityRepository` (postgres) gains one helper:

| Method | Purpose |
|---|---|
| `findEmailForGroup(groupId)` | Returns the active email attached to a group, or `null`. Orders by `created_at ASC` so the oldest active email wins deterministically when a group holds several (post-merge case). |

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
        private webAuthNService: WebAuthNService,           // verifies loser consent
        private webAuthNValidatorReader: ContractReader,    // wraps publicClient.readContract
    ) {}

    async preview({ requesterWallet, targetAuthenticatorId }): Promise<MergePreview> {
        const target = await this.authRepo.getActiveBinding({
            credentialId: targetAuthenticatorId,
            chainId: currentChainId,    // env-shared, never on the wire
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
            requesterWallet,
            targetWallet: target.smartWalletAddress,
            winner: winner.wallet,
            loser:  loser.wallet,
            loserAuthenticatorId: /* the credential id whose binding points to loser */,
            loserPublicKey:       /* { x, y } from authenticators table */,
            requesterWeight,      /* assets/referrals/interactions counts */
            targetWeight,         /* same shape */
        };
    }
}
```

The `chainId` is **not** part of the wire shape — it's derived server-side from `currentChainId` (env-shared with the frontend through `@frak-labs/app-essentials/blockchain`). Both `/merge/preview` and `/merge/settle` operate on the active chain implicitly; the binding repository methods take a `chainId` argument internally so the multi-chain back-fill and recovery paths can stay chain-explicit.

### Loser consent signature

`addPassKey` on its own only proves the **winner-side** owner approved the change — they signed the on-chain userOp with their own passkey. Nothing in that flow proves the **loser-side** owner consented to having their identity absorbed. Without an explicit consent check, a malicious wallet owner could craft an `addPasskey` userOp on their own account using a victim's publicly-readable credential id + pubkey (both visible from `multiWebAuthNValidatorV2.getPasskey` once the victim has registered), then call `/merge/settle` against that victim's wallet without the victim ever interacting. The backend would observe a valid on-chain state, repoint the binding, and hand the victim's identity graph over to the attacker.

To close that gap, `/merge/settle` requires a WebAuthn assertion from the **loser's** credential over a backend-deterministic challenge string:

```
frak-merge-consent:{YYYY-MM-DDTHH}:{winner_wallet_lowercased}:{loser_authenticator_id}
```

- `YYYY-MM-DDTHH` is the current UTC hour slot.
- `winner_wallet_lowercased` is the lowercased hex address of the winner (matches the normalisation used elsewhere in the identity-node store).
- `loser_authenticator_id` is the base64url credential id of the credential being repointed.

To tolerate clock skew between the device clock and the backend, and to absorb slow user flows that straddle an hour boundary, the backend accepts a signature over **three candidate challenges**: the current hour, one hour earlier, and one hour later. Each candidate is recomputed server-side from the preview (`winner` + `loserAuthenticatorId`); nothing is persisted in a DB and there is no cleanup cron.

Why this shape:

- The challenge is **deterministic from public values**, so no `merge_consent_challenges` table, no nonce issuance step, no expiry cron.
- The replay window is bounded to roughly three hours, but a captured signature alone cannot complete a merge — the attacker still needs the **winner-side biometric** to submit the on-chain `addPasskey` userOp. The consent signature is one half of an AND-gate (loser consent + winner userOp), not a sole gating factor. That dual-biometric requirement is what makes a replayable challenge design acceptable here; on a single-factor flow we would have to issue and persist short-lived nonces instead.
- Including the **loser authenticator id** in the challenge prevents cross-victim replay — a signature collected for a merge into victim X cannot be replayed against victim Y on the same UTC day.
- The static `frak-merge-consent:` prefix prevents cross-protocol replay — a WebAuthn assertion captured from a login, pairing, or any other flow cannot be passed off as merge consent.
- The three-slot window (`current`, `current - 1h`, `current + 1h`) prevents flaky failures around hour boundaries without meaningfully widening the replay window.

Verification at settle time:

1. Build all three candidate challenge strings from the preview (`winner`, `loserAuthenticatorId`).
2. Call `webAuthNService.verifyConsentSignature({ compressedSignature, expectedAuthenticatorId: preview.loserAuthenticatorId, expectedChallenges })`.
3. Inside that helper: parse the compressed assertion, confirm `result.id === expectedAuthenticatorId` (so a signature from an unrelated credential can't be substituted), look up the loser credential's pubkey via `AuthenticatorRepository.getByCredentialId`, and verify against the candidate challenge bytes using `ox/WebAuthnP256.verify`. Any matching candidate counts as success.
4. Reject **before** any on-chain reads or DB writes — this is a cheap rejection of unauthenticated attempts. The new error code is `MERGE_INVALID_CONSENT` → HTTP 401.

The challenge-building helper is reusable: it lives in `packages/app-essentials/src/webauthn/` so the frontend computes the exact same string before calling `navigator.credentials.get({ challenge: stringToBytes(buildMergeConsentChallenge(...)) })`. Backend and frontend share one source of truth for the challenge format.

The updated `settle()` pseudo-code:

```ts
async settle({ requesterWallet, requesterAuthenticatorId, targetAuthenticatorId, onChainTxHash, loserConsentSignature }): Promise<MergeSettleResponse> {
    // Recompute preview deterministically (no stored snapshot in Phase 1)
    const preview = await this.preview({ requesterWallet, targetAuthenticatorId });

    // 0. Verify loser consent — cheap, runs before any on-chain or DB work
    const expectedChallenges = buildMergeConsentChallengeSlots({
        winner: preview.winner,
        loserAuthenticatorId: preview.loserAuthenticatorId,
    });
    const consentOk = await this.webAuthNService.verifyConsentSignature({
        compressedSignature: loserConsentSignature,
        expectedAuthenticatorId: preview.loserAuthenticatorId,
        expectedChallenges,
    });
    if (!consentOk) throw new MergeError("MERGE_INVALID_CONSENT");

    // 1. Verify the userOp landed and produced the expected on-chain state
    const receipt = await this.webAuthNValidatorReader.waitForReceipt({ txHash: onChainTxHash });
    if (receipt.status !== "success") throw new MergeError("user-op-reverted");

    const onChainPubkey = await this.webAuthNValidatorReader.getPasskey({
        smartWallet: preview.winner,
        authenticatorId: preview.loserAuthenticatorId,
    });
    if (
        onChainPubkey.x !== BigInt(preview.loserPublicKey.x) ||
        onChainPubkey.y !== BigInt(preview.loserPublicKey.y)
    ) throw new MergeError("on-chain-passkey-mismatch");

    // 2. libSQL repoint (atomic in libSQL tx)
    await this.authRepo.repointBinding({
        credentialId: preview.loserAuthenticatorId,
        chainId: currentChainId,
        toSmartWalletAddress: preview.winner,
        reason: "merged",
    });

    // 3. PG identity merge (atomic in PG tx). The loser group's
    //    `identity_nodes` rows — including the email — are bulk-moved onto
    //    the winner group as part of `mergeGroups`. If both sides had a
    //    different email, the winner ends up with two active email nodes;
    //    `findEmailForGroup` returns the oldest (the winner's original).
    await this.identityMergeSvc.mergeGroupsByWallet({
        winnerWallet: preview.winner,
        loserWallet:  preview.loser,
    });

    // 4. Mint a fresh wallet session for the requester when they
    //    authenticated with the loser credential. The credential's binding
    //    now points at the winner wallet, so the requester's previous JWT
    //    references a stale `address`. The frontend applies the returned
    //    session directly (`setSession`) — no separate `/login` round-trip,
    //    no second biometric prompt. The consent assertion verified at
    //    step 0 is the security-equivalent proof of credential ownership.
    //
    //    Omitted when the requester is the winner (their existing JWT
    //    already resolves correctly via the unchanged binding for their
    //    credential).
    const requesterIsLoser = requesterAuthenticatorId === preview.loserAuthenticatorId;
    const session = requesterIsLoser
        ? await this.walletSessionSvc.mintForCredential({
              authenticatorId: preview.loserAuthenticatorId,
              walletAddress:   preview.winner,
              publicKey:       /* loserCredential.publicKey */,
              transports:      /* loserCredential.transports */,
          })
        : undefined;

    return {
        status: "merged",
        winner: preview.winner,
        loser:  preview.loser,
        session,    // optional, see above
    };
}
```

Cross-DB safety: each step is independently idempotent (verified in D.3 of the Phase 2 doc, same shape). A crashed `settle` can be safely retried by re-invoking the API endpoint — step 0 is a pure read + crypto check, step 1 is a pure read, step 2 is a no-op if the binding already points to winner (the active row check), step 3 is a no-op if the loser's group has already been merged into winner's.

---

## API endpoints

New routes under `services/backend/src/api/user/wallet/merge/`:

| Method + path | Auth | Body / query | Response |
|---|---|---|---|
| `GET /user/wallet/merge/preview` | webauthn JWT (the requester) | `?targetAuthenticatorId=...` | `MergePreview` |
| `POST /user/wallet/merge/settle` | webauthn JWT (the requester) | `{ targetAuthenticatorId, onChainTxHash, loserConsentSignature }` | `{ status: "merged", winner, loser, session? }` |

`chainId` is never on the wire — it's env-shared between front and back via `@frak-labs/app-essentials/blockchain` (`currentChainId`). Adding it as a query/body param would just duplicate state the client already knows. The orchestrator reads `currentChainId` to scope binding lookups and writes; binding repository methods take `chainId` explicitly to keep the multi-chain back-fill paths chain-explicit.

`session` is included on the settle response only when the requester authenticated with the loser credential — see the orchestrator's step 4 above. Shape mirrors `WalletAuthResponseDto` (the login response). Frontend applies it via `sessionStore.setSession` + `setSdkSession`; this kills the post-merge "stuck on the stale loser session" path that the earlier draft worked around with `popSession`/`discardPreviousSession` dance.

Both wired in `services/backend/src/api/user/wallet/index.ts`. Existing `POST /user/wallet/auth/email` is updated to return the target authenticator id and wallet on the conflict branch:

```ts
// AssociateEmailResponseSchema (existing) — extended conflict shape
| { status: "conflict"; authenticatorId?: string; wallet?: Address }
```

Both `POST /user/wallet/auth/email` (conflict branch) and `POST /user/wallet/auth/emailStatus` (pre-registration check) go through the new `AuthenticatorLookupOrchestrator.findByEmail` to resolve `email → identity group → active wallet node → current-chain credential`. The orchestrator lives at `services/backend/src/orchestration/identity/AuthenticatorLookupOrchestrator.ts` because the lookup spans the identity (postgres) and auth (libSQL) domains — same placement rationale as `WalletMergeOrchestrator`.

---

## Frontend changes

### `packages/wallet-shared` — `sessionStore`

New methods on `sessionStore` (file `packages/wallet-shared/src/stores/sessionStore.ts`):

```ts
interface SessionStoreState {
    session: Session | null;
    sdkSession: SdkSession | null;
    previousSession: { session: Session; sdkSession: SdkSession | null } | null;  // NEW (persisted)

    parkSession: (snapshot) => boolean;          // store the pre-swap snapshot, leave live slot alone
    popSession:  () => boolean;                  // restore the snapshot into the live slot
    discardPreviousSession: () => boolean;       // drop the snapshot without restoring
    // existing: setSession, setSdkSession, clearSession
}
```

The triple is what the swap dance needs:

- `parkSession({ session, sdkSession })` is called **after** `useLogin` has overwritten the live slot with the winner — the snapshot is the loser session, held only briefly in a JS variable before this call. There is no observable null window for components gated on `session?.authenticatorId`.
- `popSession()` is the rollback used by every non-success exit path in `MergeFlow` (abort, unmount, orphan cleanup on next mount).
- `discardPreviousSession()` is called by `useMergeSettle` on success — combined with `setSession(response.session)`, it cleanly transitions the requester from the loser snapshot to the freshly minted post-merge session without ever restoring the now-stale loser JWT.

Persistence: `previousSession` is included in the `persist` config so a tab refresh during the in-flight switch doesn't lose the restore target.

### `apps/wallet` — hooks

New files under `apps/wallet/app/module/walletMerge/hook/`:

| Hook | Purpose |
|---|---|
| `useMergePreview(targetAuthenticatorId)` | React Query wrapper around `GET /merge/preview`. Cached by `targetAuthenticatorId`. |
| `useLoserConsent()` | Mutation. Triggers `navigator.credentials.get` against the loser passkey with the deterministic merge-consent challenge; returns the base64 assertion ready for `/merge/settle`. Doubles as the local-availability probe — if the OS keychain doesn't surface the loser credential, the prompt fails fast and the UI can fall back to a "use your other device" placeholder. |
| `useSwitchAuthenticator()` | Mutation. Snapshots the live session in a local JS variable, awaits `useLogin({ lastAuthentication })` to overwrite the live slot with the winner, then calls `parkSession(snapshot)`. Atomic from observers' POV. Rollback on `login()` throw is implicit (nothing was written). Skips the `parkSession` call on retry when a snapshot is already parked. |
| `useSendAddPassKeyTx()` | Mutation. Builds `encodeFunctionData({ abi: multiWebAuthNValidatorV2Abi, functionName: "addPassKey", args: [...] })` and submits via wagmi's smart-account aware `useSendTransaction`. Returns the on-chain tx hash. Signed by whichever credential the SwitchStep has placed in the live session. |
| `useMergeSettle()` | Mutation. POSTs `{ targetAuthenticatorId, onChainTxHash, loserConsentSignature }` to `/merge/settle`. On success: if `response.session` is present, applies it via `setSession` + `setSdkSession`; then unconditionally calls `discardPreviousSession`. |

### `apps/wallet` — step components

`MergeFlow` (`apps/wallet/app/module/walletMerge/component/MergeFlow/index.tsx`) drives a 7-step state machine. Each step owns at most one webauthn prompt so the three biometric ceremonies are explicitly sequenced — never fired back-to-back from a single screen:

| Step | Webauthn prompt | Purpose |
|---|---|---|
| `preview` | — | Recap UI: which wallet stays primary, what counts move. |
| `assets` | — | "Move your funds first" speed bump (Phase 1 has no automatic sweep). |
| `consent` | loser passkey | Collects the deterministic merge-consent assertion. |
| `switch` *(only when `needsSwitch`)* | winner passkey | User-initiated session swap to the winner so wagmi signs the userOp from the winner's smart-account context. |
| `sign` | winner passkey | User-initiated `addPassKey` userOp submit. |
| `settling` | — | Auto-POST `/merge/settle`. Spinner + retry on error. |
| `success` | — | Terminal screen. |

`switch` is skipped entirely when the requester is the winner — no session swap is needed. The `consent → sign` transition runs directly.

### `apps/wallet` — `AddEmail` conflict branch refactor

File: `apps/wallet/app/module/settings/component/AddEmail/index.tsx`.

The conflict branch captures `currentAuthenticatorId` from the live session at flow entry and snapshots it onto the `merging` flow state. `MergeFlow` reads that snapshot for the lifetime of the flow rather than the live session — the SwitchStep temporarily swaps the live session and gating the parent on it would flicker back to `ConflictStep` mid-flow.

On success the user sees the existing AddEmail success screen with copy adjusted ("Your other wallet is now part of this one"). The "Setup recovery" button stays a no-op until the recovery rework is done.

---

## Failure modes

| Scenario | Behavior |
|---|---|
| Local `useProveLocalAuthenticator` returns `unavailable` or `cancelled` | UI shows the Phase 1 "this needs your other device" placeholder. No state change. Phase 2 replaces this with the QR flow. |
| `useSwitchAuthenticator` fails (biometric cancel, mismatched credential, etc.) | `popSession()` runs in the hook's catch; user lands back on the current session with the merge form re-enabled. |
| `useMergeFinaliseLocal` userOp reverts on-chain | Hook throws; UI shows error toast. Settle endpoint is never called. No data mutated. If we switched session for this attempt, the user is still on wallet B and can retry the on-chain step; if it succeeds the merge completes; if they give up, `popSession()` restores wallet A. |
| `/merge/settle` called without a valid `loserConsentSignature` | 401 with `MERGE_INVALID_CONSENT`. No state mutated (rejection happens before any on-chain read or DB write). UI re-prompts the loser passkey and retries. |
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
| `services/backend/src/domain/auth/db/schema.ts` | Add `authenticatorWalletBindingsTable` Drizzle definition (no email column). |
| `services/backend/drizzle-libsql/00XX_authenticator_bindings.sql` | Hand-written migration: create table + two indexes (`awb_active_idx`, `awb_wallet_chain_idx`). |
| `services/backend/src/domain/identity/db/schema.ts` | Define `IdentityType = 'wallet' \| 'anonymous_fingerprint' \| 'email'` directly on the schema file so environments that don't pull in the backend's TypeBox helpers (notably the bootstrap migration job) can import the table cleanly. `schemas/index.ts` re-exports the type and adds a compile-time drift guard against the TypeBox union. |
| `services/backend/src/domain/auth/repositories/AuthenticatorRepository.ts` | Add `getActiveBindings`, `getActiveBinding`, `createBinding`, `repointBinding`, `ensureActiveBindings`, `legacyDualWriteWallet`. Adjust `getByActiveWallet`, `createAuthenticator` per the table in "Repository surface". **Remove** `findByEmail`, `updateEmail`, `getEmail`, `RepointEmailPolicy`. |
| `services/backend/src/domain/identity/repositories/IdentityRepository.ts` | Add `findEmailForGroup(groupId)` with `ORDER BY created_at ASC`. Update `normalizeValue` to also normalise email values (trim + lowercase). |
| `services/backend/src/orchestration/identity/AuthenticatorLookupOrchestrator.ts` *(new)* | Cross-domain helper: `findByEmail(email) → { groupId, wallet?, authenticatorId? } \| null`. |
| `services/backend/src/orchestration/identity/IdentityOrchestrator.ts` | `linkWalletToFingerprint` gains an optional `email` argument: on register, attach an email identity node to the wallet's group unless that exact email already belongs to a different group (in which case log + skip — collisions are owned by the explicit merge flow). |
| `services/backend/src/api/user/wallet/auth/register.ts` | Wire the optional `email` parameter through `linkWalletToFingerprint`. |
| `services/backend/src/api/user/wallet/auth/email.ts` | Conflict branch routes through `AuthenticatorLookupOrchestrator.findByEmail`. Email read/write hit `IdentityRepository.findEmailForGroup` + `addNode` directly. |
| `services/backend/src/api/user/wallet/auth/emailStatus.ts` | Same lookup orchestrator. |
| `services/backend/src/orchestration/identity/IdentityMergeService.ts` | Add options bag + 3 new SQL ops (push_tokens, asset_logs.recipient_wallet pending, referral_codes migrate-with-conflict-revoke). No special handling required for the email identity node — it migrates as part of the existing bulk node move. |
| `services/backend/src/orchestration/identity/WalletMergeOrchestrator.ts` *(new)* | `preview`, `settle`. Constructor gains a `WebAuthNService` dependency; `settle()` accepts a required `loserConsentSignature` and verifies it first, before any on-chain read or DB write. |
| `services/backend/src/domain/auth/services/WebAuthNService.ts` | New `verifyConsentSignature({ compressedSignature, expectedAuthenticatorId, expectedChallenges })` method. Parses the compressed assertion, asserts `result.id === expectedAuthenticatorId`, loads the credential pubkey via `AuthenticatorRepository.getByCredentialId`, verifies against the candidate challenge bytes using `ox/WebAuthnP256.verify`, returns `boolean`. |
| `services/backend/src/infrastructure/blockchain/WebAuthNValidatorReader.ts` *(new)* | Thin wrapper around `publicClient.readContract` for `getPasskey` and `waitForTransactionReceipt`. Chain-aware. |
| `services/backend/src/api/user/wallet/merge/preview.ts` *(new)* | `GET /user/wallet/merge/preview`. |
| `services/backend/src/api/user/wallet/merge/settle.ts` *(new)* | `POST /user/wallet/merge/settle`. |
| `services/backend/src/api/user/wallet/index.ts` | Wire the new merge routes. |
| `services/backend/src/api/schemas/authenticationSchemas.ts` | Extend `AssociateEmailResponseSchema` conflict branch with optional `authenticatorId`, `wallet`. Drop the email property from `AuthenticatorDocument`. `MergeSettleBodySchema` gains a required `loserConsentSignature: t.String()`. |
| `services/backend/src/orchestration/context.ts` | Wire `authenticatorLookupOrchestrator`. Wire `webAuthNService` into the `walletMergeOrchestrator` constructor so it can verify the loser consent signature. |
| `services/backend/src/jobs/` *(or env config)* | Expose the list of configured chain ids as a single source of truth used by register, login, bootstrap back-fill, and the merge orchestrator. |

### Bootstrap

| File | Change |
|---|---|
| `services/bootstrap/src/backfill-auth-bindings.ts` *(new)* | Dual-client (libSQL + postgres) Drizzle back-fill (see "Back-fill via bootstrap"). Split into `processAllBatches` / `seedBindingsForBatch` / `migrateEmailForRow` helpers to stay under the biome cognitive-complexity ceiling. |
| `services/bootstrap/src/index.ts` | Insert the new step between `runLibsqlMigrations` and `ensureBuckets`. |
| `services/bootstrap/AGENTS.md` | Add the new step to the sequential list. |
| `services/bootstrap/package.json` (if needed) | Add the libSQL client dependency if not already present. |

### Shared — `packages/app-essentials`

| File | Change |
|---|---|
| `packages/app-essentials/src/webauthn/mergeConsent.ts` *(new)* | Exports `buildMergeConsentChallenge({ winner, loserAuthenticatorId, hourSlot })`, `buildMergeConsentChallengeSlots({ winner, loserAuthenticatorId, now? })` (returns the three candidate strings — current hour, ±1h), and `formatMergeConsentHourSlot(date)` (`YYYY-MM-DDTHH` UTC formatter). Pure functions, no I/O, shared by backend verification and frontend signing. |
| `packages/app-essentials/src/webauthn/index.ts` | Re-export the new helpers — either on the existing `WebAuthN` namespace or as a sibling `MergeConsent` namespace (match whichever the implementer chose). Backend imports them via `services/backend`'s usual `@frak-labs/app-essentials` path; frontend imports them in the merge hooks before calling `navigator.credentials.get({ challenge: stringToBytes(buildMergeConsentChallenge(...)) })`. |

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
- **Email lives as a postgres `identity_nodes` row of type `email`**, attached to the wallet's identity group. Authoritative source for any email read. Env-scoped (postgres schema-per-env) and identity-aligned. Removed from the libSQL binding table entirely.
- `recovery_blob` column declared on the binding table but unused in Phase 1.
- Reason enum for Phase 1: `'initial'`, `'merged'`. `'recovery'` reserved for later.
- Legacy `authenticators.smart_wallet_address` written through `repointBinding` for backwards-compatible reads. Legacy `authenticators.email` is read-only post-cutover — consumed once by the bootstrap migration; drop in a follow-up PR once every env has migrated cleanly.
- Bootstrap-driven back-fill is dual-DB: seeds binding rows in libSQL and migrates legacy emails into postgres identity nodes. Batched, idempotent, fail-fast. Skips NULL-wallet rows (login lazy-fills binding); skips emails when the identity group doesn't exist yet on this env (re-run on next bootstrap once the group catches up).
- Multiple emails per identity group are tolerated post-merge. `findEmailForGroup` returns the oldest active one deterministically.
- Both Arbitrum mainnet and Arbitrum Sepolia bindings inserted at register time, and back-filled for every existing row.
- Same-device fast path only in Phase 1. Cross-device pairing-with-hint is Phase 2.
- Loser consent is collected as a WebAuthn assertion at `/merge/settle` over a backend-deterministic challenge string (`frak-merge-consent:{UTC hour}:{winner}:{loser authid}`). Three slots are accepted (current ±1h) for clock skew and slow user flows. No DB storage — the dual-biometric AND-gate (loser consent + winner userOp) makes a replayable challenge acceptable for the threat model. Rejection happens before any on-chain read or DB write; failure surfaces as `MERGE_INVALID_CONSENT` (HTTP 401).

---

## Open questions

1. **Env source for the chain id list.** Today the backend already knows its single deployment chain. Phase 1 introduces a "both chains" requirement for register and back-fill. The cleanest answer is a single exported const in `packages/app-essentials` (or `services/backend/src/config/`) listing `[arbitrumOneId, arbitrumSepoliaId]`. Confirm where to put it.

2. **Recovery flow today.** The recovery flow currently creates a new authenticator pointing at an old wallet address via the `previousWallet` arg in register. In the dual-write window, recovery keeps writing to `authenticators.smart_wallet_address` as-is; we should also insert a binding row with `reason='recovery'`. Should we land that change now (using the reserved enum value) or strictly defer it? Recommendation: do it now — it's two extra lines in the recovery register path and avoids leaving recovery credentials behind on the lazy back-fill list.

3. **Per-chain merge UX.** Phase 1 ships with a single env-bound chain in practice. The orchestrator accepts a `chainId` but the UI never asks the user for one. Confirm we never want the user to pick a chain at merge time (the active chain is implicit from session).

4. **Manual replay endpoint.** When `/merge/settle` succeeds on-chain + libSQL but PG merge crashes, the user is in a half-merged state. Phase 1 surfaces this in logs only. Should we add a quick "admin replay" route, or wait for Phase 2's reconciler? Recommendation: log-only for Phase 1; add reconciler in Phase 2.

5. **Loser-email policy on merge.** Today the loser group's email identity node migrates into the winner's group as part of the bulk node move, and `findEmailForGroup` resolves the oldest active row (the winner's original). This means the loser's email survives as historical context attached to the merged group, never surfaced through normal reads. Two alternatives if we change our minds later: (a) soft-unlink the loser's email node with `unlinked_at` at merge time, mirroring the wallet-node treatment; (b) hard-delete it. Both are additive — the current behavior is the conservative default and doesn't lock us out.

Once those are answered I can start implementing PR 1 (schema + repository extensions + bootstrap back-fill).
