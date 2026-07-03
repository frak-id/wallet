# Device Test Plan — WebAuthn `preferImmediatelyAvailable` Silent Quick-Login

Companion to `webauthn-prefer-immediate-login.md`. Covers the parts the unit
suite cannot: real passkeys + biometrics on hardware. Web / non-Tauri is gated
off (`!IS_TAURI`) and out of scope here.

## 1. What we're actually validating

1. Auto-fire of the silent quick-login on `/login` mount (Tauri + hint only).
2. Native fail-fast mapping: no passkey → `no-credential` (iOS `.canceled` 1001
   zero-UI / Android `NoCredentialException`), not an opaque cancel.
3. Self-heal: `no-credential` wipes both hint sources + swaps to the manual
   layout with **no** error toast.
4. Reinstall headline: cloud hint (iCloud KV / Block Store) survives uninstall
   and drives auto-login.
5. No regressions to manual login / registration / cancel handling.

## 2. Device matrix (minimum)

| Platform | OS versions | Why |
|---|---|---|
| iOS | 16.x **and** 18.x (physical iPhone) | 1001-vs-1005 fail-fast assumption is OS-version-sensitive; 1006 is 18+ |
| iOS | 1× iPad (optional) | Different presentation anchor / window path |
| Android | API 33 (13) **and** API 34+ (14/15) | Credential Manager + GPS behavior varies by level |
| Android | 1× non-Pixel (Samsung) if possible | OEM credential UI differs |

Each device: screen lock + biometric enrolled, signed into iCloud / Google
account, passkey provider active (iCloud Keychain / Google Password Manager).

## 3. Build & run (dev variant `id.frak.wallet.dev` → `wallet-dev.frak.id`)

- iOS on device: `TAURI_IOS_DEVICE="<device name>" bun run tauri:ios:dev`
  (LAN-IP backend rewrite handles physical devices).
- Android on device (USB debugging): `bun run tauri:android:dev` (uses `adb reverse`).
- Standalone installable dev builds: `bun run tauri:ios:build:dev` /
  `bun run tauri:android:build:dev` — **use these for the uninstall/reinstall
  tests** (dev-server mode won't survive a reinstall cleanly).

## 4. State manipulation cheatsheet

| Need | How |
|---|---|
| Create a hint | Complete one successful login (writes zustand + cloud KV hint) |
| Stale hint (passkey gone, app kept) | After login, delete the passkey: iOS *Settings ▸ Passwords*; Android *Google Password Manager ▸ Passkeys* |
| Cloud-hint-only (local wiped) | Android: *App info ▸ Storage ▸ Clear storage*; iOS: uninstall + reinstall (zustand localStorage dies, iCloud KV/Keychain survives) |
| Fresh install / no hint | New device or new Apple/Google account with no prior Frak passkey |

## 5. Scenarios

### A. Happy path — auto quick-login

- **Precondition:** hint present + passkey present on device.
- **Steps:** launch app → navigate to `/login`.
- **Expected (both):** biometric prompt fires **automatically** on mount (no tap);
  on success → redirect to `/wallet` (or pending action). Buttons show spinner +
  are disabled during the prompt.
- **Verify:** single prompt only; spinner clears; `auth_login` → `succeeded`.

### B. Stale hint → self-heal (core new path)

- **Precondition:** hint present, passkey **deleted** from OS, app still installed.
- **Steps:** open `/login`.
- **Expected:**
  - **iOS:** `.canceled` (1001) fires **instantly, zero UI** (no sheet flash).
  - **Android:** `NoCredentialException` fires instantly, **no account picker**.
  - Both → hint cleared (primary "Use my account" disappears → manual "Use
    biometrics" layout) → **no error toast**.
- **Verify:** `webauthn_error_kind=no-credential`, `isReportable=false` (no
  Crashlytics non-fatal); no unhandled rejection; `Silent login hint cleanup
  failed` must **not** appear.

### C. Cancel behavior — platform divergence, verify both

- **Precondition:** hint present + passkey present.
- **Steps:** when the auto biometric prompt appears, **cancel/dismiss** it.
- **Expected:**
  - **Android:** `TYPE_USER_CANCELED` → `cancelled` → error toast shown, **hint
    kept** (manual "Use my account" still present).
  - **iOS:** under the flag, cancel maps to the same `no-credential` token →
    **hint is wiped**, no toast, manual layout. ⚠️ Documented trade-off — confirm
    it's acceptable product behavior. Re-login rewrites the hint.

### D. Fresh install — no hint, no surprise prompt

- **Precondition:** no hint (fresh install / new account).
- **Steps:** open `/login`.
- **Expected (both):** **no** auto biometric prompt. Manual primary "Use
  biometrics" only. Tapping it runs a normal (non-silent) ceremony.

### E. Reinstall resilience (headline feature)

- **Precondition:** log in once (writes cloud hint) → **uninstall** → **reinstall**
  (use `build:dev` artifact) → keep same iCloud/Google account + passkey.
- **Steps:** launch reinstalled app → `/login`.
- **Expected:** cloud hint restores (iOS iCloud KV/Keychain; Android Block Store)
  → auto quick-login biometric fires → success.
- **Sub-case E2:** reinstall but passkey **deleted** → auto-fire → `no-credential`
  self-heal (scenario B) instead of a dead-end.

### F. Manual paths unchanged (regression)

With hint present, verify each still works: **Use my account** (specific),
**Connect another account** (global), **Use email** → `/login/email`. Confirm the
auto-fire does not block or double-trigger these (buttons disabled only while the
silent attempt is in flight, then usable).

### G. Network failure after biometric (hint must survive)

- **Precondition:** hint + passkey present. Enable Airplane mode (or unreachable
  backend) **after** launching.
- **Steps:** open `/login` → complete the auto biometric.
- **Expected:** signature succeeds locally but `/auth/login` fails → classified as
  a non-`no-credential` error → **error toast**, and the **hint is NOT wiped**
  (still see "Use my account"). Guards against transient network errors nuking the
  fast path.

### H. No screen lock / no biometric enrolled

- **Precondition:** hint present, device biometric/PIN removed.
- **Expected:** no perma-spinner; failure surfaces as `no-screen-lock`/constraint
  handling (toast), spinner clears.

## 6. Cross-cutting checks (every scenario)

- No perma-spinner on any outcome (success/cancel/no-credential/network).
- Exactly one biometric prompt per `/login` mount; navigating away and back may
  re-fire once (per mount) — confirm that's acceptable.
- No unhandled promise rejections (JS console).
- Analytics: every auto-attempt emits an `auth_login` flow (`started` +
  `succeeded`/`failed`) — **expect the funnel to include auto-fires**; confirm no
  `auth_login_method_selected` is emitted for the auto path.
- Crash reporting: `no-credential` / `cancelled` produce **no** non-fatals.

## 7. Observability

- JS: `bun run tauri:*:dev` console; watch for `Silent login hint cleanup failed`,
  `Tauri get error`.
- iOS: Console.app / Xcode — `recovery-hint iCloud KV …`, ASAuthorization codes.
- Android: `adb logcat` — Credential Manager exceptions, `blockstore` reads/writes.

## 8. Sign-off criteria

Ship native only when, **on each OS version in the matrix**: A, B, D, E pass; C
matches the documented per-platform expectation and is product-approved; F, G show
no regression. Any perma-spinner, lost hint on network error, double prompt, or a
`no-credential` misfire on a device that *does* have a passkey is a blocker.

## 9. Execution log

| # | Scenario | iOS 16 | iOS 18 | Android 13 | Android 14+ | Notes |
|---|---|---|---|---|---|---|
| A | Happy path | ☐ | ☐ | ☐ | ☐ | |
| B | Stale hint self-heal | ☐ | ☐ | ☐ | ☐ | |
| C | Cancel (divergent) | ☐ | ☐ | ☐ | ☐ | iOS wipes hint / Android keeps |
| D | Fresh install no-hint | ☐ | ☐ | ☐ | ☐ | |
| E | Reinstall resilience | ☐ | ☐ | ☐ | ☐ | |
| E2 | Reinstall + passkey gone | ☐ | ☐ | ☐ | ☐ | |
| F | Manual paths | ☐ | ☐ | ☐ | ☐ | |
| G | Network fail post-biometric | ☐ | ☐ | ☐ | ☐ | hint must survive |
| H | No screen lock | ☐ | ☐ | ☐ | ☐ | |

---

## 10. Addendum — register self-heal gap fix (`webauthn-register-selfheal-gap.md`)

Covers only what that fix changed: the `no-credential` self-heal now also
evicts the stale wallet's **IndexedDB `authenticatorStorage` row** (the
`/register` route's primary gate signal), via `clearLastAuthenticator`. Run
alongside scenarios B / C / E2 above — don't redo the rest.

**Before the fix:** self-heal cleared zustand + cloud hint but left the IDB
row → on the "app kept, passkey deleted" path, `/register` kept redirecting
to `/login` forever. **Now:** all three surfaces are cleared together
(targeted removal — only the hint's wallet row).

### Observing IDB state (dev builds)

Attach devtools to the WebView — Android: `chrome://inspect` over USB; iOS:
Safari ▸ Develop ▸ device. *Application* tab → IndexedDB → the authenticators
store. One row per wallet.

### S1 — Core gap: app kept, passkey deleted (the fix)

Uses the **logout path**: if you're already logged in, there is no `/login`
mount — the way in is Settings ▸ Logout. That works because `useLogout` wipes
the cloud hint + session but leaves both the zustand `lastAuthenticator`
(`frak_authentication_store` isn't in its localStorage scrub list) and the
IDB row intact — exactly the stale state this fix targets.

1. Be logged in (writes all 3 surfaces — confirm the IDB row in devtools).
2. Delete the passkey in OS settings (iOS *Settings ▸ Passwords*; Android
   *Google Password Manager ▸ Passkeys*). Do **not** uninstall / clear storage.
3. In the app: **Settings ▸ Logout**.
4. **Expected sequence:** logout redirects to `/register` → register gate
   sees the surviving IDB row → bounces to `/login` → zustand hint still
   present → silent quick-login auto-fires → instant `no-credential` (no
   picker/sheet) → self-heal: no toast, manual "Use biometrics" layout (no
   "Use my account" button).
5. **New check:** the IDB row for that wallet is **gone** (pre-fix it survived).
6. Relaunch the app (or navigate to `/register`, no `?new` param).
7. **Expected:** register renders (onboarding) — **no** redirect loop back to
   `/login`. Pre-fix, step 6 bounced to `/login` forever.

Note: logout already cleared the cloud hint, so this run exercises the
zustand + IDB surfaces of the self-heal — IDB being the one this fix added.
The full three-surface run is covered by E2 (reinstall) above.

### S2 — Targeted removal preserves other wallets

1. Log in with wallet A, then wallet B on the same device (IDB has 2 rows).
2. Hint points at B (last login); delete only B's passkey.
3. Trigger the self-heal on `/login`.
4. **Expected:** only B's IDB row removed; A's row remains. `/register` still
   redirects to `/login` (A's row keeps the gate correct); A can still log in.

**Practical note — creating a real second wallet on one device usually
fails:** `useRegister` passes every IDB row as `excludeCredentials`, so the
OS refuses to create a second passkey on the same provider (Android shows a
blue "passkey already present" toast; iOS silently falls back to asserting
the existing passkey → logs into wallet A). Renaming passkeys doesn't help —
exclusion matches on credential ID, not display name. Either use a second
passkey provider (1Password / second Google account's GPM), or — simpler —
inject a fake row via devtools, which exercises the same targeted-filter
code path:

1. Logged in with wallet A (IDB has A's row). Attach devtools
   (`chrome://inspect` / Safari ▸ Develop), run in the console:

   ```js
   const req = indexedDB.open("frak-wallet");
   req.onsuccess = () => {
       const tx = req.result.transaction("authenticators", "readwrite");
       const store = tx.objectStore("authenticators");
       const get = store.get("previous-authenticators");
       get.onsuccess = () => {
           const list = get.result ?? [];
           store.put(
               [
                   ...list,
                   {
                       ...list[0],
                       wallet: "0x000000000000000000000000000000000000fake",
                       authenticatorId: "fake-authenticator-b",
                   },
               ],
               "previous-authenticators"
           );
       };
   };
   ```

2. Delete A's passkey in OS settings → **Settings ▸ Logout** (same entry
   path as S1).
3. Self-heal fires on `/login` (hint points at A) → **expected: only A's row
   removed — the fake B row survives** (devtools check).
4. Cold start → **expected: `/register` still bounces to `/login`** (B's row
   keeps the gate correct — right behavior while "another wallet" exists on
   the device).
5. Cleanup: delete the fake row (console or *Clear storage*) and log back in
   with A.

Roles are inverted vs. steps 1-4 above (the hint's wallet is removed, the
injected row survives) but it asserts the identical code path: targeted
filter, not a wipe.

> Found during this scenario (2026-07-03): `authenticatorStorage.put/remove`
> compared addresses with raw string equality, so checksummed vs lowercase
> casings of the same wallet duplicated rows and survived targeted removal.
> Fixed with `areAddressesEqual` + regression tests; next put/remove
> self-collapses existing duplicates.

### S3 — iOS cancel amplification (accepted trade-off)

1. iOS, hint + passkey both present; cancel the auto biometric prompt.
2. **Expected:** all three surfaces wiped, **including the IDB row** (new).
   No toast, manual layout.
3. Log in manually with the passkey → **Expected:** hint + IDB row fully
   restored (devtools check); auto quick-login works on next launch.
4. This is the "amplified wipe" the plan accepted — flag it if it feels wrong
   in practice.

### S4 — Android cancel keeps everything (regression)

1. Android, hint + passkey present; cancel the prompt.
2. **Expected:** toast shown, hint kept, **IDB row untouched** (the helper
   must only run on `no-credential`).

### S5 — Uninstall/reinstall path unchanged (regression of E2)

Reinstall + passkey deleted → self-heal → register reachable. Worked before
(IDB dies with uninstall) — confirm no regression.

### Cross-cutting

- No `Silent login hint cleanup failed` in console on any self-heal.
- No perma-spinner: the helper stays fire-and-forget; the zustand clear must
  flip the UI instantly even if the cloud invoke stalls (airplane mode during
  S1 step 3 is a good stress).

### Priority

**S1 on one iOS + one Android device is the sign-off gate** — it's the actual
gap. S2 and S3 next. S4 / S5 are quick regressions.

### Execution log — addendum

| # | Scenario | iOS 16 | iOS 18 | Android 13 | Android 14+ | Notes |
|---|---|---|---|---|---|---|
| S1 | App kept, passkey deleted → register reachable | ☐ | ✅ | ☐ | ✅ | sign-off gate — passed 2026-07-03 (dev build): logout → /login manual layout, IDB `previous-authenticators` = `[]`, back + cold start both land on /register (pre-fix: /login loop). Silent fail is zero-UI on both platforms, as documented. iOS: latest (26.x) |
| S2 | Targeted removal (multi-wallet) | ☐ | ✅ | ☐ | ✅ | passed 2026-07-03 via fake-row injection (see recipe above): only the hint's row evicted, injected row survived, gate still bounces to /login. Also surfaced the address-casing dedup bug (fixed) |
| S3 | iOS cancel amplified wipe + restore | ☐ | ✅ | n/a | n/a | accepted trade-off — passed 2026-07-03 on iPad (latest iOS): cancel → no toast, hint wiped (manual "Utiliser la biométrie" layout), manual re-login OK; restore proven by logout → register→/login bounce + auto-prompt (hint + IDB rewritten). Also covers the §2 iPad presentation-anchor row |
| S4 | Android cancel keeps IDB row | n/a | n/a | ☐ | ✅ | passed 2026-07-03: cancel → toast shown, hint kept ("Continuer avec mon compte" still present) — correct divergence vs iOS S3 |
| S5 | Reinstall + passkey gone (E2 regression) | ☐ | ✅ | ☐ | ✅ | passed 2026-07-03 (latest iOS + Android 14+): 1st launch → /login (surviving cloud hint — iCloud KV / Block Store — correct per safety constraint) → zero-UI no-credential self-heal; 2nd cold start → /register. Two-step convergence is by design, not a bug |
