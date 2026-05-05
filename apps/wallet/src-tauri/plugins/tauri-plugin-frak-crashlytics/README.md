# tauri-plugin-frak-crashlytics

Forwards native crashes, non-fatal errors, breadcrumb logs, and user / key
context to **Firebase Crashlytics** on iOS and Android. Reuses the Firebase
project already wired for FCM (`tauri-plugin-fcm`) — no extra config files
or secrets.

All commands are no-ops on web / desktop (the native bridge is only wired
under `#[cfg(mobile)]`).

## What captures what

| Crash type | Capture path | Symbols |
|---|---|---|
| iOS NSException | Crashlytics auto-handler installed by `FirebaseApp.configure()` | dSYM upload via `${PODS_ROOT}/FirebaseCrashlytics/run` post-build script |
| iOS Mach signal (Rust panic in release → SIGABRT, SIGSEGV…) | Crashlytics signal handler | Same dSYM path; Rust frames need debug info in the static lib |
| Android JVM uncaught exception | `FirebaseCrashlytics` auto-handler | ProGuard mapping uploaded automatically by `firebase-crashlytics-gradle` |
| Android NDK signal (Rust panic / segfault) | `firebase-crashlytics-ndk` SIGABRT/SIGSEGV handler | `./gradlew uploadCrashlyticsSymbolFile{Variant}` (manual / CI step) |
| Non-fatal JS / Rust error | `recordError()` command — see below | N/A |

## API

TypeScript facade lives in `packages/wallet-shared/src/common/analytics/crashlytics.ts`
and is wired into the existing `recordError(err)` pipeline so every JS error
reported via OpenPanel is also forwarded to Crashlytics on Tauri mobile.

```ts
import { crashlytics } from "@frak-labs/wallet-shared";

await crashlytics.setUserId(walletAddress);
await crashlytics.setKey("env", "gcp-production");
await crashlytics.log("user pressed pair button");

try {
    await someRiskyCall();
} catch (err) {
    await crashlytics.recordError(err);            // non-fatal
}

// Privacy / opt-out:
await crashlytics.setCollectionEnabled(false);
```

All methods are async and resolve to `void`. They are no-ops outside Tauri
mobile so call them unconditionally in shared code.

## Initialization

Registered in `apps/wallet/src-tauri/src/lib.rs` alongside the other mobile
plugins. `FirebaseApp.configure()` (iOS) / `FirebaseApp.initializeApp()`
(Android) is performed by `tauri-plugin-fcm` so this plugin only consumes
the already-initialized Crashlytics singleton.

## Native dependencies

### iOS

- **Plugin SPM** (`ios/Package.swift`) depends on
  `https://github.com/firebase/firebase-ios-sdk` and links the
  `FirebaseCrashlytics` product. This is what allows `FrakCrashlyticsPlugin.swift`
  to `import FirebaseCrashlytics` at compile time.
- **App Podfile** (`gen/apple/Podfile`) also has `pod 'FirebaseCrashlytics'`.
  This is required at app-link time so the runtime framework, the
  `${PODS_ROOT}/FirebaseCrashlytics/run` script, and the dSYM upload tooling
  are all in the standard Pods locations.
- **Run Script Phase** in `gen/apple/project.yml → app_iOS.postBuildScripts`
  uploads dSYMs to Firebase on every build. `DEBUG_INFORMATION_FORMAT` is set
  to `dwarf-with-dsym` for **both** debug and release so symbolicated reports
  show up regardless of configuration.

### Android

- **Plugin gradle** (`android/build.gradle.kts`) pulls in
  `firebase-crashlytics-ktx` (JVM crash handler + custom keys / logs) and
  `firebase-crashlytics-ndk` (native signal handler) via
  `firebase-bom:33.5.1` for version coherence with FCM.
- **Root gradle** (`gen/android/build.gradle.kts`) adds the Crashlytics
  Gradle plugin classpath: `com.google.firebase:firebase-crashlytics-gradle:3.0.2`.
- **App gradle** (`gen/android/app/build.gradle.kts`) applies
  `com.google.firebase.crashlytics`. ProGuard mappings are auto-uploaded on
  release builds (default behavior).

## Symbol upload

### iOS dSYMs (auto)

The post-build Run Script runs on every build and uploads dSYMs as part of
the Xcode build pipeline. For TestFlight / App Store builds, Xcode produces
`.xcarchive` bundles whose dSYMs are uploaded by the same script during the
archive step.

### Android NDK symbols (manual / CI)

Java/Kotlin mapping files are uploaded automatically. **Native (Rust)
symbols are not** — the Rust `.so` files include debuginfo only in dev
builds. Release builds strip symbols (`strip = true` in `Cargo.toml` →
`[profile.release]`). To get symbolicated Rust frames in production, either:

1. Disable stripping in `[profile.release]` and run, after a release build:
   ```bash
   cd src-tauri/gen/android
   ./gradlew assembleRelease
   ./gradlew uploadCrashlyticsSymbolFileRelease
   ```
2. Or keep stripping on, and configure CI to build a separate "symbol"
   variant with debuginfo retained, then run the upload task against that
   variant.

This is left as an operational TODO — initial integration prioritizes
capturing crashes over fully resolving Rust frames.

## Privacy

- Crashlytics is initialized eagerly via `FirebaseApp.configure()`. Per the
  current product decision (always-on collection in both debug and
  release), `setCrashlyticsCollectionEnabled(true)` is the default.
- A user opt-out can be wired via `crashlytics.setCollectionEnabled(false)`
  in the Settings module — the plugin already exposes the command.
- Custom keys are stored in clear on Crashlytics; treat user id (wallet
  address) as the only identifier. **Never** pass session tokens, signed
  user-ops or recovery payloads as keys / log lines.

## Threat model

- Wallet address as `userId` is public on-chain so identifying it in
  Crashlytics adds no leak surface beyond what the indexer already exposes.
- Custom keys land in an internal Google service; assume the same trust
  level as your error logging stack.
- Disabling collection takes effect on the next app start (matches the
  Firebase SDK's documented behavior).

## See also

- `tauri-plugin-fcm` — initializes Firebase + handles push notifications.
- `tauri-plugin-recovery-hint` — closest neighbor in plugin layout / style.
- Firebase Crashlytics Tauri integration is **not** an official upstream
  plugin; this is a local plugin maintained alongside the wallet shell.
