# tauri-plugin-frak-firebase

Combined **Firebase Cloud Messaging (FCM)** + **Crashlytics** Tauri 2 plugin
for the Frak Wallet mobile shell.

Vendored from [`srod/tauri-plugin-fcm`](https://github.com/srod/tauri-plugin-fcm)
(commit `b9d4d186`) and merged with the previous in-tree
`tauri-plugin-frak-crashlytics`. Owns the single `firebase-ios-sdk` SwiftPM
dependency and the single Android Firebase BoM — bumping Firebase is one
coordinate change instead of two.

All commands are no-ops on web / desktop (the native bridge is only wired
under `#[cfg(mobile)]`).

## Why merge?

Before this plugin existed, the wallet shell ran two independent Firebase
consumers:

1. `tauri-plugin-fcm` (external crates.io `^0.2.0`) — push notifications.
2. `tauri-plugin-frak-crashlytics` (in-tree) — crash reporting.

Both pulled `firebase-ios-sdk` via SwiftPM independently. Both called
`FirebaseApp.configure()` with nil-guards to avoid double-init crashes. Both
required matching version pins to avoid two copies of Firebase being linked
into the iOS binary (which silently broke Crashlytics' signal-handler
registration — see commit `04019eb03`).

Merging into a single plugin:

- **Halves SPM resolution work.** One `firebase-ios-sdk` clone, one cache slot
  in the CI SwiftPM artifact cache, one pre-warm pass.
- **Eliminates the `FirebaseApp.configure()` nil-guard.** Single owner means
  the guard is dead code; the merged plugin calls `configure()` exactly once
  from `init()` (before the Tauri WebView attaches — Crashlytics' NSException
  + Mach signal handlers arm before any user code runs).
- **One Android Firebase BoM** to bump on upgrades.
- **One CI dSYM upload glob** to maintain.

## Surface

### FCM (vendored from srod/tauri-plugin-fcm)

| Command | Description |
|---|---|
| `getToken` | Returns the current FCM registration token (or rejects with the buffered APNs error if registration failed). |
| `requestPermissions` | Requests notification authorisation (iOS) / `POST_NOTIFICATIONS` (Android 13+). |
| `checkPermissions` | Returns current permission state without prompting. |
| `register` | Triggers `UIApplication.registerForRemoteNotifications()` on iOS; no-op on Android (auto-registers). |
| `deleteToken` | Revokes the current FCM token. |
| `createChannel` | Creates an Android `NotificationChannel`; no-op on iOS. |
| `sendNotification` | Posts a local notification. |

**Events:** `token-refresh` (`{ token: string }`), `push-error` (`{ error: string }`).

### Crashlytics (merged from tauri-plugin-frak-crashlytics)

| Command | Description |
|---|---|
| `setUserId` | Identify the current user (wallet address). |
| `setKey` | Attach a custom key/value to subsequent crash reports (max 64 keys). |
| `log` | Append a breadcrumb log entry (last ~64 KB shipped with each report). |
| `recordError` | Record a non-fatal error captured from JS / Rust. |
| `setCollectionEnabled` | Toggle Crashlytics collection at runtime. |

Native auto-capture (iOS NSException + Mach signals; Android JVM uncaught
exceptions + NDK signals) is wired by the Firebase SDK itself once
`FirebaseApp` is initialized — no application code required.

Rust panics in `panic = "abort"` builds are captured by a panic hook that
persists the message + backtrace to `app_cache_dir()/frak.wallet.last_rust_panic.txt`.
The native plugin reads, reports, and deletes that file on the next launch.

## Native dependencies

### iOS

`ios/Package.swift` depends on `firebase-ios-sdk` from `12.13.0` (single
source) and links:

- `FirebaseCore` — owned by this plugin (sole caller of `FirebaseApp.configure()`).
- `FirebaseMessaging` — FCM push notifications.
- `FirebaseCrashlytics` — crash reporting + non-fatal recording.

**The host `gen/apple/Podfile` is deliberately empty of Firebase pods.**
Linking Firebase via both SPM and CocoaPods produces duplicate symbols and
silently breaks Crashlytics' crash-handler registration.

**dSYM upload** runs in CI (`.github/workflows/tauri-mobile-release.yml`)
after `tauri ios build` produces the xcarchive. `DEBUG_INFORMATION_FORMAT`
is set to `dwarf-with-dsym` for both debug and release in
`gen/apple/project.yml` so dSYMs are produced regardless of configuration.

### Android

`android/build.gradle.kts` pulls `firebase-bom:33.5.1` and links:

- `firebase-messaging-ktx` — FCM.
- `firebase-crashlytics-ktx` — JVM crash handler + custom keys / logs / recordError.
- `firebase-crashlytics-ndk` — native (Rust / C / C++) signal handler.

Root `gen/android/build.gradle.kts` adds the Crashlytics Gradle plugin
classpath; `gen/android/app/build.gradle.kts` applies
`com.google.firebase.crashlytics` and sets `nativeSymbolUploadEnabled = true`.

ProGuard mappings are auto-uploaded on release builds. NDK symbols are
uploaded by a separate CI step (`uploadCrashlyticsSymbolFileUniversalRelease`).

## JS surface

The plugin has **no typed JS bindings package**. Both halves are consumed via
raw `invoke("plugin:frak-firebase|<command>", ...)` calls:

- **Crashlytics**: `packages/wallet-shared/src/common/analytics/crashlytics.ts`
  wraps the five Crashlytics commands behind a no-op-when-not-Tauri facade.
- **FCM**: `apps/wallet/app/module/notification/adapter/tauriAdapter.ts`
  wraps the FCM surface (token retrieval, permission flow, channel creation).

Permission-state and FCM-token types are declared inline in the adapter to
avoid a workspace package boundary for a five-symbol surface.

## See also

- Parent: `apps/wallet/src-tauri/README.md`
- Sibling plugins: `tauri-plugin-frak-share`, `tauri-plugin-frak-webauthn`,
  `tauri-plugin-recovery-hint`, etc.
- Upstream: https://github.com/srod/tauri-plugin-fcm
- License notice + attribution: `NOTICE`

## License

Dual-licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

…at your option, matching the upstream `tauri-plugin-fcm` license.
