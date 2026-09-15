# tauri-plugin-recovery-hint

Persists a tiny recovery hint (last authenticator credential id, wallet
address, last login timestamp) that **survives an app uninstall** so the
wallet can offer a smoother reinstall / device-migration UX.

## API

TypeScript facade lives in `packages/wallet-shared/src/common/storage/recoveryHint.ts`:

```ts
import { recoveryHintStorage } from "@frak-labs/wallet-shared";

await recoveryHintStorage.set({
    lastAuthenticatorId: credential.id,
    lastWallet: wallet,
    lastLoginAt: Date.now(),
});

const hint = await recoveryHintStorage.get();
// { lastAuthenticatorId, lastWallet, lastLoginAt } or {} when empty / non-Tauri

await recoveryHintStorage.clear();
```

All calls are no-ops on web / desktop (only wired on `#[cfg(mobile)]`).

## Platform backends

### iOS — `NSUbiquitousKeyValueStore` (iCloud KV) + iCloud Keychain fallback

**Survives:** uninstall on the same device, and new-device setup when the
user is signed into iCloud.

**Required entitlements and Apple Developer Portal setup** are documented once, in
`apps/wallet/src-tauri/README.md` → "iCloud Key-Value Storage (recovery hint)".
The keys are templated on Xcode build variables so the prod and dev App IDs share
one entitlements file — do not hardcode a bundle id here.

Storage limits: 1 MB total per app / 1024 keys max (per-value cap is
implicit via the total quota). Our payload is well under 256 B so we're
nowhere near those caps.

### Android — Google Block Store (+ SharedPreferences fallback)

**Primary backend:** Block Store. Survives uninstall on the same device,
and new-device setup when the user restores from Google Backup. Requires
Google Play Services.

Already wired via `play-services-auth-blockstore` in the plugin's Android
`build.gradle.kts`. Entries are encrypted by default. Cloud backup is
gated on `isEndToEndEncryptionAvailable()` (Android 9+ with a screen lock)
so we never ship the hint to Google without end-to-end encryption — the
hint is non-sensitive but there's no reason to relax that.

Storage limits: 16 entries max / 4 KB per entry. We write < 256 B.

**Fallback:** plain SharedPreferences, written to `frak.wallet.recovery_hint`
and opted into **Android Auto Backup** + **Device-to-Device transfer** via
`android:allowBackup="true"` plus `res/xml/backup_rules.xml` and
`res/xml/data_extraction_rules.xml` in the app shell. This gives
uninstall-survival on devices without Google Play Services (Huawei,
Amazon Fire, custom ROMs) and complements Block Store's own restore path
on the primary code path.

The plugin detects Block Store availability at init via
`GoogleApiAvailability.isGooglePlayServicesAvailable()` and transparently
falls back when the service is missing or needs an update.

## Security notes

- The hint is intentionally **non-sensitive**: credential ids are public
  WebAuthn artifacts (the server knows them) and the wallet address is
  public on-chain. No private keys, no session tokens.
- Both backends encrypt at rest (iCloud KV → APNs-encrypted; Block Store
  → Android Keystore-wrapped).
- Call `recoveryHintStorage.clear()` on explicit logout if you want the
  hint to disappear from the user's cloud account.

## Threat model

- A user who signs into the same Apple ID / Google account on a new device
  *will* see their previous authenticator id. That's the whole point — it
  lets the wallet offer "Welcome back, resume recovery" instead of forcing
  a cold start. WebAuthn credentials themselves are still device-bound,
  so knowing the id alone doesn't grant access.
- A user sharing their Apple ID / Google account with someone else will
  leak the hint. Same trust model as any other iCloud KV / Block Store
  data; document this in the privacy policy.

## Wiring in the wallet

`packages/wallet-shared/src/common/storage/recoveryHint.ts` wraps the plugin;
`src/stores/authenticationStore.ts` writes the hint on authentication success
and clears it on logout. Tests: `src/stores/authenticationStore.test.ts`.
