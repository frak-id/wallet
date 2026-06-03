# Recovery Setup + Storage — Implementation Plan

**Scope (this round): SETUP + STORAGE only.** The restore / perform-recovery side
(`app/module/recovery/**`, `_auth/recovery*` routes, `decrypt.ts`,
`useRecoveryLocalAccount`, `usePerformRecovery`, `RecoverySmartWallet`) is **out of
scope** and stays untouched. The encrypted-blob byte layout is the contract between
setup and restore, so restore must be re-aligned to the new format in a later round.

---

## 1. Locked decisions

- **On-chain dates**: `start → validAfter`, `end → validUntil`. Defaults
  `validAfter = now + 1 week`, `validUntil = now + 2 years`. Hard cap `validUntil ≤ now + 2y`.
- **Password test = frontend-only.** Backend never receives the password and runs
  no crypto. It is a dumb, zero-knowledge encrypted-blob store.
- **Blob = raw bytes** (no JSON): `address(20) ‖ burnerPrivKey(32)`, AES-GCM encrypted,
  wrapped in a fixed envelope, base64url-encoded.
- **Replace** the old Accordion setup UI; **rebuild** on the merge-flow pattern
  (discriminated-union local state, one screen per step).
- **Copy/paste only** for the backup (no file download).
- Backup display: masked with `*`, reveal toggle, copy button, one-time "I understand"
  gate before first copy.

## 2. Blob format spec

```
plaintext (52 bytes) = address(20) ‖ burnerPrivKey(32)
envelope  (97 bytes) = version(1)=0x01 ‖ iv(12) ‖ salt(16) ‖ AES-GCM(plaintext)+tag(16)
blob = base64url(envelope)            // ~130 chars
```

- KDF: PBKDF2-SHA512, 600k iterations (bumped from 300k — see §11), random 16-byte salt.
- Cipher: AES-GCM-256, 12-byte iv, 128-bit tag.
- Drop the old `random(16,64)` iv / `random(16,128)` salt and the `keccak256(address)`
  salt domain-binding: salt is random-per-blob and the address is GCM-authenticated inside
  the plaintext.
- Decode: slice `address = bytes[0:20]`, `key = bytes[20:52]`; guardian address derives
  from the key (`privateKeyToAddress`).

## 3. Backend changes (`services/backend`)

> Migration SQL is **db-team owned** (per AGENTS.md). Add the Drizzle table definition only;
> the table is inert until the db team generates + runs the migration. Note this in the PR.

- `src/domain/identity/db/schema.ts` — add `recoveryBlobsTable`:
  `id uuid pk`, `group_id uuid unique not null`, `blob text not null`,
  `created_at`, `updated_at`. Index on `group_id`.
- Register the table in the Drizzle schema barrel so `db.query.recoveryBlobsTable` works
  (find where `identityGroupsTable` is aggregated under `infrastructure/persistence`).
- `src/domain/identity/repositories/RecoveryRepository.ts` (new):
  `findByGroup(groupId): { blob, createdAt } | null`, `save({ groupId, blob })`
  (insert; refuse overwrite — no update this round).
- `src/domain/identity/context.ts` — add `repositories.recovery`.
- `src/api/schemas/recoverySchemas.ts` (new) + export via `src/api/schemas/index.ts`:
  - `RecoveryStatusResponseSchema = { configured: boolean, createdAt?: string }`
  - `RecoveryBlobResponseSchema = { blob: string | null }`
  - `SaveRecoveryBlobBody = { blob: string }` (bounded length)
- `src/api/user/wallet/auth/recovery.ts` (new) — mirror `auth/email.ts`
  (`sessionContext`, `withWalletAuthent: true`, webauthn-only, `wallet → group`):
  - `GET  /recovery`        → status (`{ configured, createdAt }`)
  - `GET  /recovery/blob`   → `{ blob }` (on-demand: powers frontend test-password / re-view)
  - `POST /recovery`        → store blob (404 if no group; refuse if already present)
- `src/api/user/wallet/auth/index.ts` — `.use(recoveryRoutes)`.

Frontend client types flow automatically via Eden Treaty
(`authenticatedWalletApi.auth.recovery.*`).

## 4. On-chain wiring (`apps/wallet`)

- `app/module/recovery/action/generate.ts` — `generateRecoveryData` accepts
  `{ guardianAddress, validAfter, validUntil }` and threads them into `setExecution`
  (currently hardcodes `validUntil = 0`, `validAfter = now + 1w`).
- `app/module/recovery/action/get.ts` — `getCurrentRecoveryOption` also returns
  `validAfter` / `validUntil` from the `getExecution` tuple (already available on-chain).
- `packages/wallet-shared/src/types/Recovery.ts` — extend `CurrentRecovery` with the dates;
  add a `RecoveryBlobPayload = { smartWalletAddress, burnerPrivateKey }` type (or keep internal).

## 5. Frontend — encryption util

- `app/module/recovery-setup/utils/recoveryBlob.ts` (new):
  - `encodeRecoveryBlob({ address, burnerPrivateKey, password }): Promise<string>`
  - `decodeRecoveryBlob({ blob, password }): Promise<{ address, burnerPrivateKey } | null>`
    (null on wrong password / tag failure) — used by the **frontend** test-password.
  - Reuse a shared `passToKey` using `globalThis.crypto.subtle`.
- Evolve `app/module/recovery-setup/utils/encrypt.ts` (keep `passToKey`, drop the
  private-key-only path once Step2/old flow is removed).

## 6. Frontend — hooks

- `app/module/recovery-setup/hook/useRecoveryStatus.ts` (new) — backend `GET /recovery`.
- `app/module/recovery-setup/hook/useSaveRecoveryBlob.ts` (new) — backend `POST /recovery`.
- `app/module/recovery-setup/hook/useTestRecoveryPassword.ts` (new) — `GET /recovery/blob`
  then `decodeRecoveryBlob` locally → boolean.
- Adapt `useGenerateRecoveryOptions.ts` — take `{ validAfter, validUntil }`, build the
  blob with `encodeRecoveryBlob`, return `{ setupTxData, blob, guardianAddress }`.
- Keep `useSetupRecovery.ts` (on-chain tx) and `useRecoverySetupStatus.ts`
  (extend to surface dates).

## 7. Frontend — flow components (`app/module/recovery-setup/component/SetupFlow/`)

Mirror `walletMerge/component/MergeFlow`. Local state, no `recoveryStore`:

```
type Step =
  | { kind: "password" }                                   // 1/4
  | { kind: "sign"; password; validAfter; validUntil }     // 2/4
  | { kind: "backup"; blob: string }                       // 3/4
  | { kind: "success" }                                    // terminal
```

- `SetupFlow/index.tsx` — orchestrator + `"N/4"` indicator (reuse `renderStepIndicator` idea).
- `PasswordStep` — password (reuse `Password`, add strength meter + min length) + optional
  start/end date pickers, clamp end ≤ now+2y, warnings copy.
- `SignStep` — generate burner + `setupTxData(dates)`, send `setExecution` tx (reuse
  `useGenerateRecoveryOptions` + `useSetupRecovery`), single confirmation. Pattern from
  `walletMerge/component/SignStep`.
- `BackupStep` — `POST` blob, then masked display + reveal + copy + "I understand" gate.
- `SuccessStep` — terminal, back to profile (reuse `EmailFlowResultScreen`).
- Reuse `PageLayout`, `Back`, `Title`, `Stack`, `Button`, `Text`, `Card`, `EmailFlowResultScreen`.

## 8. Frontend — profile wiring

- `app/routes/_wallet/_protected/profile.recovery.tsx` — replace Accordion body: branch
  **not configured → `SetupFlow`**, **configured → `RecoveryConfiguration`** (status + dates
  from chain + test-password). (Config view minimal this round; remove/update deferred.)
- `app/module/settings/component/ProfilePage/index.tsx` — 3-state row driven by
  `useCurrentEmail()` + on-chain status:
  - no email → keep "Add my email".
  - email + no recovery (or `validUntil − now < ~60d`) → "Set up / Refresh recovery".
  - email + recovery → "Recovery configuration".
  Re-enable `ProfileSecurityCard` (or an `InfoRow`).
- `app/module/settings/component/AddEmail/index.tsx:109` — wire `onSetupRecovery` →
  `navigate({ to: "/profile/recovery" })`.

## 9. i18n (`packages/wallet-shared/src/i18n/locales/{en,fr}/translation.json`)

New `wallet.recoverySetup.*` keys: step titles, date labels + helper copy, warnings
(see below), backup reveal/copy, success. Regen types via root `bun run i18n:types`.

Warnings:
- Password step: "Choose a strong password. We can never reset or recover it — if you forget
  it, your backup is permanently useless."
- Backup step: "Anyone who has both this backup code and your password can take full control
  of your wallet. Store them in separate places." / "Save this somewhere safe, like a
  password manager. We keep an encrypted copy, but you should keep your own."

## 10. Cleanup (safe-delete — setup-only)

Delete after rewiring:
- `app/module/recovery-setup/component/Setup/{Step1,Step2,Step3,Step4}.tsx`, `Step4.css.ts`
- `app/module/recovery-setup/component/Setup/ButtonSetupRecovery.tsx`
- `app/module/recovery-setup/hook/useDownloadRecoveryFile.ts` (+ test)
- `app/module/settings/component/Recovery/**` (dead `RecoveryLink`)
- `app/module/recovery-setup/component/CurrentSetupStatus/**` (only used by dead `RecoveryLink`)

**KEEP (shared with out-of-scope restore flow — deleting breaks the live `_auth/recovery` route):**
- `app/module/stores/recoveryStore.ts` (+ test) — used by `recovery/component/Recover/Step1-6`
- `app/module/common/component/AccordionRecoveryItem/**` — used by `Recover/Step1-6`
- `app/module/recovery/**`, `app/routes/_wallet/_auth/recovery*.tsx`, `decrypt.ts`

## 11. Risks / open decision

- **KDF strength**: blob is now server-stored, so one breach exposes all blobs to offline
  brute-force. Plan bumps PBKDF2-SHA512 to 600k iters (above OWASP floor, no new dep).
  Argon2id deferred (new wasm dep). Confirm 600k is acceptable.
- **Migration timing**: backend merges but `recovery_blobs` is inert until the db team ships
  the migration. End-to-end test blocked until then; unit-test crypto + flow in isolation.
- **Restore coupling**: format change must be mirrored in restore later (tracked, out of scope).

## 12. Task checklist

1. Backend: `recoveryBlobsTable` + schema barrel registration.
2. Backend: `RecoveryRepository` + context wiring.
3. Backend: recovery response schemas + index export.
4. Backend: `recovery.ts` routes + mount in `auth/index.ts`.
5. Frontend: `recoveryBlob.ts` encode/decode + shared `passToKey`.
6. Onchain: `generate.ts` dates + `get.ts` dates surfaced.
7. Frontend hooks: status / save / test-password; adapt `useGenerateRecoveryOptions`.
8. Frontend: `SetupFlow` + 4 step components.
9. Frontend: `RecoveryConfiguration` view.
10. Profile: `profile.recovery.tsx` branch + `ProfilePage` 3-state + AddEmail hook.
11. i18n keys (en + fr) + type regen.
12. Cleanup old setup files.
13. Tests + `bun run typecheck` / lint (code-quality skill).
