# Plan — Close the `register` Self-Heal Gap (WebAuthn Quick-Login)

Follow-up to `webauthn-prefer-immediate-login.md`. The `/login` silent
quick-login self-heals a stale hint on `no-credential`, but only clears **2 of
the 3** "last authenticator" surfaces — leaving the `register` route's primary
gate signal stale. This plan closes that gap.

> **Status (2026-07-06): IMPLEMENTED & shipped** (TestFlight-verified).
> `clearLastAuthenticator(wallet)` clears all three surfaces and is wired into
> `AuthActions.handleSilentError` — Phase 1 is done.
>
> **Correction:** the self-heal is now **Android-only** (`if (!IS_ANDROID)
> return`). iOS auto-fires a **non-silent full-sheet** login (see parent plan),
> which surfaces a real credential rather than a false `no-credential`, so the
> **"iOS-cancel amplification" trade-off below no longer applies** — iOS never
> wipes on a failed/cancelled auto-fire. Phase 2 (Android `has_passkey` register
> gate) remains deferred and is tracked in Linear.
>
> **Original decisions (locked):** Scope = **Phase 1 only** (no native changes;
> Phase 2 deferred to a separate ticket).

## Background — the three authenticator surfaces

A successful login writes three stores (`addLastAuthentication` in
`packages/wallet-shared/src/stores/authenticationStore.ts` + the hint write in
`packages/wallet-shared/src/authentication/hook/useLogin.ts:150`):

| Surface | Store | Wiped on uninstall? | Read by |
|---|---|---|---|
| `authenticationStore.lastAuthenticator` | zustand / localStorage | yes | `/login` hint (`useLastAuthenticatorHint.ts:25`) |
| `recoveryHintStorage` | iCloud KV / Block Store | **no** | `/login` hint + `register` gate (`register.tsx:83`) |
| `authenticatorStorage` | IndexedDB | yes | **`register` gate (`register.tsx:71`, first signal)** + `useRegister` excludeCredentials (`useRegister.ts:44,67`) |

The current self-heal (`apps/wallet/app/module/authentication/component/AuthActions.tsx:72-85`)
clears **only the first two**. It never touches `authenticatorStorage`
(IndexedDB) — which is exactly `register.tsx`'s **primary** gate signal.

## The gap

`register.tsx` beforeLoad (`apps/wallet/app/routes/_wallet/_auth/register.tsx:66-90`)
redirects to `/login` when `authenticatorStorage.getAll().length > 0` OR a cloud
hint exists. Because the self-heal doesn't clear the IndexedDB list:

- **Uninstall/reinstall path** (IDB already wiped): self-heal is sufficient —
  the register gate falls through to the cloud hint, which *is* cleared. ✓
- **App-kept, passkey-deleted path** (IDB survives): the stale IDB entry
  remains → `register.tsx:72` still sees `length > 0` → keeps redirecting to
  `/login`, and the local list stays stale until a real login rewrites it. ✗
  **This is the gap.**

## Key safety constraint

A user with a stale hint but a **real existing wallet** (passkey merely missing
on this device) must **not** be funneled into creating a *new* wallet — they
recover via email or QR pairing. So `/login` is the correct destination and the
register→`/login` redirect is *right*. **The fix is state consistency, not
redirect-to-onboarding.** We do not bounce the user back to register/onboarding
on `no-credential`.

## Phase 1 — complete the self-heal (recommended)

### 1. Shared helper in `wallet-shared`

Add `clearLastAuthenticator(wallet?: Address)` to
`packages/wallet-shared/src/stores/authenticationStore.ts`, symmetric to
`addLastAuthentication` / `applyMergeSession`. It clears all three write
surfaces atomically:

- `authenticationStore.getState().setLastAuthenticator(null)`
- `await recoveryHintStorage.clear()`
- `if (wallet) await authenticatorStorage.remove(wallet)` (targeted — only the
  stale wallet's row, preserving any other valid entries)

Export it from the package barrel (`packages/wallet-shared/src/index.ts`).

### 2. Call it from the self-heal

In `AuthActions.handleSilentError`
(`apps/wallet/app/module/authentication/component/AuthActions.tsx:66-88`),
replace the inline zustand + cloud clears with a single
`clearLastAuthenticator(hint.wallet)` call. Keep the
`queryClient.invalidateQueries({ queryKey: authKey.recoveryHint })` in the app
layer (the helper stays queryClient-free), chained after the helper resolves.
Preserve the existing "not async / best-effort background cleanup" shape so the
button spinners still flip synchronously.

### Net effect

After one `/login` no-credential self-heal, all three surfaces agree there is no
local authenticator, so the register gate no longer misfires — fully delivering
the audit's "self-healing register redirect" for the app-kept path too.

### Files

- `packages/wallet-shared/src/stores/authenticationStore.ts` (new helper)
- `packages/wallet-shared/src/index.ts` (barrel export)
- `apps/wallet/app/module/authentication/component/AuthActions.tsx` (use helper)

### Tests

- Unit-test `clearLastAuthenticator` clears all three surfaces (extend the
  `authenticationStore` unit tests; assert `authenticatorStorage.remove` called
  with the passed wallet, cloud `clear` called, zustand nulled).
- `AuthActions.test.tsx`: on `no-credential`, assert `authenticatorStorage.remove`
  (or the helper) is invoked with `hint.wallet`; keep the existing "non-
  no-credential error keeps the hint" test and extend it to assert IDB is **not**
  cleared.

## Tradeoffs / decision points

- **iOS-cancel amplification.** iOS maps *cancel-with-passkey-present* under the
  `preferImmediatelyAvailable` flag to `no-credential` (the already-accepted
  trade-off from the parent plan). With Phase 1, a cancel now also drops the
  **IndexedDB** row + excludeCredentials entry, not just the hint. Fully
  recoverable on the next successful login, but it widens the existing
  trade-off. Consistent with the three surfaces being written together.
  **Decided:** accept the amplified wipe — clear all three surfaces together for
  consistency; re-login restores everything.
- **excludeCredentials edge.** Removing a (falsely) stale row means a subsequent
  deliberate `new=1` registration won't exclude that credential. Low risk —
  the `new=1` path is an explicit new-wallet action.

## Phase 2 — real OS answer for the register gate (optional, separate ticket)

Replace the register gate heuristic with a real "does a passkey exist?" answer:

- **Android:** new `has_passkey` plugin command using `prepareGetCredential` →
  `hasCredentialResults(TYPE_PUBLIC_KEY_CREDENTIAL)`. Requires API 34+ (runtime
  gate; minSdk is 28), the `CREDENTIAL_MANAGER_QUERY_CANDIDATE_CREDENTIALS`
  manifest permission, and a capability grant. Truly silent (no UI).
- **iOS:** no truly-silent equivalent — `preferImmediatelyAvailableCredentials`
  prompts Face ID when a passkey exists, which is unacceptable in a route
  `beforeLoad`. iOS keeps the heuristic + the Phase 1 self-heal.

Asymmetric and higher-cost (native + manifest + capability, Android-only).
Recommend deferring; Phase 1 already resolves the observed gap.

## Known residual gap (web)

The silent quick-login — and therefore this self-heal — only fires under
`IS_TAURI` (`AuthActions.tsx:113-115`); on web the `preferImmediatelyAvailable`
flag is inert, so there is no silent attempt to fail as `no-credential`. A
stale IDB entry on web will keep the register→`/login` redirect firing with no
self-heal until a real login rewrites the stores. Accepted: the parent plan
scoped silent login to Tauri, and the redirect destination is still correct
(safety constraint above) — the user just isn't offered register until state
is refreshed by a successful login.

## Out of scope

- Redirecting `no-credential` users to onboarding (violates the safety
  constraint above).
- Changing the `/login` manual layout offered after self-heal (email + QR remain
  the correct recovery paths).

## Recommendation

Ship **Phase 1** now (small, no native changes, closes the gap on both paths),
accepting the amplified-wipe trade-off. File **Phase 2** as a separate
Android-only enhancement ticket.

## Decision log

- **Scope:** Phase 1 only — approved. Phase 2 deferred to a separate ticket.
- **iOS-cancel amplification:** accept the amplified wipe (all three surfaces
  cleared together) — approved.
- **Implementation:** DONE (2026-07-06) — `clearLastAuthenticator` clears all
  three surfaces, wired into the self-heal; the self-heal is gated to Android
  (`IS_ANDROID`), so the iOS-cancel amplification no longer occurs. Phase 2
  deferred → Linear.
