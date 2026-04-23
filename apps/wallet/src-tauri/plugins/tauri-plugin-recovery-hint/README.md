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

**Required entitlements** (add to `src-tauri/gen/apple/app_iOS/app_iOS.entitlements`):

```xml
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)id.frak.wallet</string>

<key>keychain-access-groups</key>
<array>
    <string>$(AppIdentifierPrefix)id.frak.wallet</string>
</array>
```

**Required Apple Developer Portal config:**

1. Enable the **iCloud** capability on the `id.frak.wallet` App ID.
2. Enable **Key-value storage** (no container needed — uses the App ID).
3. Regenerate the provisioning profile.

Storage limits: 1 MB total / 1 KB per value / 1024 keys. Our payload is
well under 256 B so we're nowhere near those caps.

### Android — Google Block Store

**Survives:** uninstall on the same device, and new-device setup when the
user restores from Google Backup. Requires Google Play Services (present
on all non-CN Android devices).

Already wired via `play-services-auth-blockstore` in the plugin's Android
`build.gradle.kts`. No manifest changes required. Entries are encrypted
by default. Cloud backup is enabled via `setShouldBackupToCloud(true)`.

Storage limits: 16 KB per entry. We write < 256 B.

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

## Suggested wiring in the wallet

In the registration and login success paths:

```ts
await recoveryHintStorage.set({
    lastAuthenticatorId: authenticatorId,
    lastWallet: wallet,
    lastLoginAt: Date.now(),
});
```

On first launch (e.g. in `usePreviousAuthenticators` or the login route),
read the hint and prefer it over an empty state — that's the reinstall
recovery path.
