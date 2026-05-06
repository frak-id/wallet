# Tauri Mobile App Development

This directory contains the Tauri configuration and native code for building Frak Wallet as a mobile app (iOS and Android).

## Overview

The Frak Wallet mobile app is built using [Tauri 2.x](https://tauri.app/), which allows us to build native mobile applications using web technologies (React/TypeScript) with a Rust backend. The app supports both iOS and Android platforms.

## Prerequisites

### General Requirements

- **Bun**: Package manager (required, do not use npm/pnpm/yarn)
- **Rust**: Version 1.77.2 or later
- **Node.js**: For building the frontend
- **SST**: For development environment and environment variables

### iOS Development

- **macOS**: Required for iOS development
- **Xcode**: Latest version with iOS SDK
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Account**: For code signing (Team ID: `57DZ6Z2235`)
- **iOS Simulator**: Available devices can be listed with `xcrun simctl list devices`

### Android Development

- **Android Studio**: Latest version
- **Android SDK**: API level 28 (minimum), 36 (target)
- **Java Development Kit (JDK)**: Version 8 or later
- **Android NDK**: Required for Rust compilation
- **Environment Variables**:
  - `ANDROID_HOME`: Path to Android SDK
  - `JAVA_HOME`: Path to JDK

## Project Structure

```
src-tauri/
├── src/              # Rust source code
│   ├── main.rs       # Entry point
│   └── lib.rs        # Main application logic
├── Cargo.toml        # Rust dependencies
├── tauri.conf.json   # Tauri configuration
├── capabilities/     # Tauri capability files
├── icons/            # App icons
└── gen/              # Generated platform-specific code (gitignored)
```

## Development Workflow

### Starting Development

1. **Start SST Dev Environment** (required for backend connectivity):
   ```bash
   bun dev
   ```

2. **Run iOS Development**:
   ```bash
   cd apps/wallet
   bun run tauri:ios:dev
   ```
   Or use the SST dev command:
   ```bash
   # In SST dev UI, run "wallet:tauri-ios"
   ```

3. **Run Android Development**:
   ```bash
   cd apps/wallet
   bun run tauri:android:dev
   ```
   Or use the SST dev command:
   ```bash
   # In SST dev UI, run "wallet:tauri-android"
   ```

### Building for Production

1. **Build iOS**:
   ```bash
   cd apps/wallet
   bun run tauri:ios:build
   ```

2. **Build Android**:
   ```bash
   cd apps/wallet
   bun run tauri:android:build
   ```

## Platform-Specific Notes

### iOS

#### WebAuthn

iOS uses **native WKWebView WebAuthn** support, which means:
- No Tauri plugin required for WebAuthn
- Uses the standard browser WebAuthn API
- Works seamlessly with the existing `ox` WebAuthn library

#### Associated Domains

The app is configured with Associated Domains for WebAuthn:
- **Development**: `webcredentials:wallet-dev.frak.id`
- Configured in: `gen/apple/app_iOS/app_iOS.entitlements`

This allows the app to share WebAuthn credentials with the web domain.

#### iCloud Key-Value Storage (recovery hint)

The app uses `NSUbiquitousKeyValueStore` via `tauri-plugin-recovery-hint` to persist a tiny hint (last authenticator id, wallet, login timestamp) that survives uninstall and syncs across the user's Apple devices.

Required entitlements in `gen/apple/app_iOS/app_iOS.entitlements`:

```xml
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)id.frak.wallet</string>

<key>keychain-access-groups</key>
<array>
    <string>$(AppIdentifierPrefix)id.frak.wallet</string>
</array>
```

Required Apple Developer Portal configuration on the `id.frak.wallet` App ID:
1. Enable the **iCloud** capability.
2. Enable **Key-value storage** (no container needed — uses the App ID).
3. Regenerate and re-download the provisioning profile.

#### Code Signing

- **Bundle ID**: `id.frak.wallet`
- **Development Team**: `57DZ6Z2235`
- Configured in: `tauri.conf.json`

### Android

#### WebAuthn

Android uses the **Tauri WebAuthn plugin** (`tauri-plugin-webauthn`) which provides:
- Native Android Credential Manager integration
- Better UX than browser WebAuthn on Android
- Custom bridge implementation in `packages/wallet-shared/src/authentication/webauthn/tauriBridge.ts`

#### Digital Asset Links

The app is configured with Digital Asset Links for WebAuthn verification:
- **Host**: `wallet-dev.frak.id`
- **APK Key Hash**: `J5BkkRNeQIjYwltCaq5W4EKI5Bj4X9pA8rxuepD24SQ`
  - ⚠️ **Important**: This hash must match your APK signing key. Update it in `packages/app-essentials/src/webauthn/index.ts` if the signing key changes.
- Configured in: `gen/android/app/src/main/AndroidManifest.xml`

#### Additional Plugins

Android-specific Tauri plugins:
- `tauri-plugin-webauthn`: Native WebAuthn support
- `tauri-plugin-share`: File sharing (used for recovery file downloads)
- `tauri-plugin-fs`: File system access
- `tauri-plugin-recovery-hint`: Persistent recovery hint via Block Store (survives uninstall)

#### Build Configuration

- **Min SDK**: 28 (Android 9.0)
- **Target SDK**: 36
- **Package**: `id.frak.wallet`

## Deep Linking

The app supports deep linking via a custom URL scheme.

### URL Schemes

**Custom URL Scheme:**
- `frakwallet://wallet` - Open wallet home
- `frakwallet://send?to=0x...` - Pre-filled send screen
- `frakwallet://receive` - Receive screen
- `frakwallet://settings` - Settings
- `frakwallet://recovery` - Recovery settings
- `frakwallet://notifications` - Notifications
- `frakwallet://history` - Transaction history
- `frakwallet://pair?id=<id>&mode=embedded` - Pairing confirmation (iframe flow)

### Configuration Files

- **iOS URL Scheme**: `gen/apple/app_iOS/Info.plist` (CFBundleURLTypes)
- **Android Intent Filters**: `gen/android/app/src/main/AndroidManifest.xml`
- **Frontend Handler**: `app/utils/deepLink.ts`

## Environment Configuration

### Development

When running in development mode via SST:
- Backend URL is automatically configured to use local IP (`http://<local-ip>:3030`)
- This allows Android/iOS emulators and physical devices to connect to the local backend
- Environment variables are injected via SST dev commands

### Production

Production builds use:
- **Backend URL**: Configured via environment variables
- **RP ID**: `frak.id` (production) or `wallet-dev.frak.id` (staging)
- **RP Origin**: `https://wallet.frak.id` (production) or `https://wallet-dev.frak.id` (staging)

## WebAuthn Configuration

The WebAuthn configuration is centralized in `packages/app-essentials/src/webauthn/index.ts`:

- **RP ID**: Determined by environment (prod/dev/local)
- **RP Origins**: Includes web origin + mobile app origins
- **Android Origin**: APK signing key hash format
- **iOS Origin**: `tauri://localhost`

## Troubleshooting

### iOS

**Issue**: Build fails with code signing errors
- **Solution**: Ensure Xcode is properly configured with your Apple Developer account
- Check Team ID in `tauri.conf.json` matches your account

**Issue**: Simulator not found
- **Solution**: List available simulators: `xcrun simctl list devices`
- Update the device name in `infra/gcp/wallet.ts` if needed

**Issue**: Associated Domains not working
- **Solution**: Verify the domain is configured in Apple Developer Portal
- Check `gen/apple/app_iOS/app_iOS.entitlements` matches your domain

### Android

**Issue**: Build fails with NDK errors
- **Solution**: Ensure Android NDK is installed and `ANDROID_NDK_HOME` is set

**Issue**: WebAuthn not working
- **Solution**: Verify APK key hash matches your signing key
- Check Digital Asset Links are properly configured on the server

**Issue**: Backend connection fails
- **Solution**: Ensure SST dev is running and backend is accessible
- Check that `BACKEND_URL` uses local IP (not localhost) for emulators

## Testing

### Unit Tests

Run unit tests for Tauri bridge:
```bash
cd packages/wallet-shared
bun run test
```

### Manual Testing Checklist

- [ ] WebAuthn registration works on iOS
- [ ] WebAuthn authentication works on iOS
- [ ] WebAuthn registration works on Android
- [ ] WebAuthn authentication works on Android
- [ ] Recovery file download works (Android share plugin)
- [ ] Safe area insets are respected
- [ ] App icons display correctly
- [ ] Backend connectivity works in dev mode

## Version Management

Version is synced across 4 files via a single command:

```bash
bun run tauri:version 0.0.33
```

This updates:
- `apps/wallet/package.json`
- `apps/wallet/src-tauri/Cargo.toml`
- `apps/wallet/src-tauri/tauri.conf.json`
- `apps/wallet/src-tauri/gen/apple/project.yml`

Script: `apps/wallet/scripts/sync-version.sh`

## Icon Regeneration

All platform icons (macOS/Windows/Linux/iOS/Android) are regenerated from the SVG/PNG masters in `apps/wallet/src-tauri/icons/sources/` via a single command:

```bash
bun run tauri:icons
```

This runs `bun tauri icon` for the base assets, then overrides the 5 Android adaptive `ic_launcher_foreground.png` densities with a safe-zone-padded white F so the logo renders correctly under any launcher mask.

Script: `apps/wallet/src-tauri/icons/sources/regenerate.sh`

## Security Considerations

- **CSP (Content Security Policy)**: Configured in `tauri.conf.json` → `app.security.csp`
  - **Current policy**: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.frak.id https://*.drpc.org https://*.pimlico.io wss://*.frak.id`
  - **Rationale**: Restricts content sources while allowing necessary connections for WebAuthn, blockchain RPCs, and WebSocket communication
  - **Note**: Update CSP if adding new external resources or third-party integrations
- **Code Signing**: Required for both iOS and Android production builds
- **WebAuthn Origins**: Properly validated on backend to prevent origin spoofing
- **Associated Domains**: Required for iOS WebAuthn credential sharing

## Additional Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Tauri Mobile Guide](https://tauri.app/v2/guides/mobile/)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [iOS Associated Domains](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Android Digital Asset Links](https://developers.google.com/digital-asset-links)
