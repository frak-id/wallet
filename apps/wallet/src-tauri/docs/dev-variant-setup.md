# Setting up the **Frak Wallet Dev** variant

This document covers the one-off external setup required to ship the dev wallet variant
(`id.frak.wallet.dev`) alongside the production app (`id.frak.wallet`). The repository changes
that drive the split are already in place — this guide is purely for the manual portal /
console / DNS work.

| Variant | Bundle ID | App name | URL scheme | Wallet domain | Stage |
|---|---|---|---|---|---|
| **Prod** (existing) | `id.frak.wallet` | Frak Wallet | `frakwallet://` | wallet.frak.id | `prod` |
| **Dev** (new) | `id.frak.wallet.dev` | Frak Wallet Dev | `frakwallet-dev://` | wallet-dev.frak.id | `dev` |

Both apps share the **same** Apple Team ID (`57DZ6Z2235`), Android upload keystore,
and (recommended) Firebase project. Existing production TestFlight/Play store entries
are untouched — the dev app is purely additive.

---

## 1. Apple Developer Portal — `developer.apple.com/account`

> **Identifiers** → **App IDs** → **+** (top-left)

1. **Type**: App → Continue
2. **Description**: `Frak Wallet Dev`
3. **Bundle ID**: Explicit → `id.frak.wallet.dev`
4. **Capabilities** — tick these (must match the prod app):
   - ☑ Associated Domains
   - ☑ iCloud — click **Configure** → enable **Key-value storage** (no container needed; uses the App ID)
   - ☑ Keychain Sharing
   - ☑ Push Notifications
5. **Continue** → **Register**

> **Profiles** → **+**

6. iOS → **App Store** distribution → Continue
7. App ID: select `id.frak.wallet.dev`
8. Certificate: pick your existing Apple Distribution cert (same one as prod)
9. **Profile Name**: `Frak Wallet Dev — App Store`
10. **Generate** → **Download**
    (You don't need it locally; CI signs via the App Store Connect API key.)

## 2. App Store Connect — `appstoreconnect.apple.com/apps`

> **My Apps** → **+** → **New App**

1. **Platforms**: iOS
2. **Name**: `Frak Wallet Dev` (App Store listing name; ≤ 30 chars)
3. **Primary Language**: English
4. **Bundle ID**: select `id.frak.wallet.dev` (the one you just created)
5. **SKU**: `frak-wallet-dev`
6. **User Access**: Full Access
7. **Create**

> Inside the new app

8. **TestFlight** tab → add internal testers (your team)
9. (Optional) Skip the App Information / pricing forms — they're only needed for public release.
   TestFlight builds upload regardless.

## 3. Google Play Console — `play.google.com/console`

> **All apps** → **Create app**

1. **App name**: `Frak Wallet Dev`
2. **Default language**: English (United States)
3. **App or game**: App
4. **Free or paid**: Free
5. ☑ All required declarations → **Create app**

> Inside the new app

6. **Setup** → **App signing** → leave on **Play App Signing** *(default)*
7. **Test and release** → **Internal testing** → **Create new release**
8. Upload key: same upload keystore as prod
   (the `ANDROID_KEYSTORE_BASE64` SST secret already covers this — same SHA-256 hash,
   so no `assetlinks.json` change needed for cert hash)
9. Add internal testers list (email-by-email or a Google Group)

## 4. Firebase — `console.firebase.google.com`

> Same Firebase project as prod (recommended for unified analytics)

1. ⚙ **Project settings** → **General** → **Your apps** → **Add app** → **iOS**
   - Bundle ID: `id.frak.wallet.dev`
   - App nickname: `Frak Wallet Dev iOS`
   - App Store ID: leave blank for now
   - **Register app**
   - Download `GoogleService-Info.plist`

2. **Add app** → **Android**
   - Package name: `id.frak.wallet.dev`
   - App nickname: `Frak Wallet Dev Android`
   - **SHA-1**: paste the same SHA-1 you used for prod (since we're reusing the upload keystore)
   - **Register app**
   - Download `google-services.json`

3. **Cloud Messaging** is enabled automatically — no extra setup.

## 5. SST secrets — push the new Firebase configs to the dev stage

```bash
# iOS
base64 -i ~/Downloads/GoogleService-Info.plist | tr -d '\n' \
    | bunx sst secret set --stage dev FIREBASE_IOS_CONFIG_BASE64

# Android
base64 -i ~/Downloads/google-services.json | tr -d '\n' \
    | bunx sst secret set --stage dev FIREBASE_ANDROID_CONFIG_BASE64
```

> The CI workflow (`tauri-mobile-release.yml`) already pulls these per-stage. No workflow change needed.

## 6. Server — `wallet-dev.frak.id` `.well-known` updates

Edit the files served at `https://wallet-dev.frak.id/.well-known/`:

### `apple-app-site-association`

Add the new appID (Team ID `57DZ6Z2235` + bundle ID):

```jsonc
{
    "applinks": {
        "details": [
            {
                "appID": "57DZ6Z2235.id.frak.wallet.dev",
                "paths": ["*"]
            }
        ]
    },
    "webcredentials": {
        "apps": ["57DZ6Z2235.id.frak.wallet.dev"]
    }
}
```

### `assetlinks.json`

Add the new package (the SHA-256 stays the same since the upload keystore is shared with prod):

```jsonc
[
    {
        "relation": [
            "delegate_permission/common.handle_all_urls",
            "delegate_permission/common.get_login_creds"
        ],
        "target": {
            "namespace": "android_app",
            "package_name": "id.frak.wallet.dev",
            "sha256_cert_fingerprints": ["<same SHA-256 as the prod entry>"]
        }
    }
]
```

> Optionally **remove** `id.frak.wallet` from `wallet-dev.frak.id`'s well-known files (and
> `id.frak.wallet.dev` from `wallet.frak.id`'s) to enforce strict domain scoping. Not blocking
> for the rollout; do it later for cleanliness.

## 7. Trigger the first dev release

```bash
gh workflow run "🚀 Release Mobile App" \
    --field version=1.0.32 \
    --field stage=dev
```

The workflow will:

1. Open a release PR titled `chore(mobile): release 1.0.32 (dev)` with label `release:mobile:dev`.
2. On merge → patch the iOS shell, build with the dev overlay → upload to the **Frak Wallet Dev** TestFlight.
3. Build Android with `appVariant=dev` → upload to the **Frak Wallet Dev** Play Store internal track.
4. Tag the merge commit and create a GitHub pre-release.

## 8. Verify on a device

- [ ] Install **Frak Wallet Dev** from TestFlight / Play internal track.
- [ ] Confirm the app icon and label show "Frak Wallet Dev".
- [ ] Confirm WebAuthn registration works (DAL/AASA propagation: ~24h after step 6 unless forced fresh install).
- [ ] Confirm push notifications fire (uses dev Firebase project).
- [ ] Open `https://wallet-dev.frak.id/...` from a browser → should offer to open in the dev app.
- [ ] Tap a `frakwallet-dev://` URL → routes deterministically to the dev app, even if prod is also installed.
- [ ] Optionally install **Frak Wallet** prod alongside the dev app → both icons present, distinct keychains, distinct iCloud KV stores.
