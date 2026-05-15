//! Combined Firebase Cloud Messaging (FCM) + Crashlytics plugin.
//!
//! Vendored from `srod/tauri-plugin-fcm` (commit `b9d4d186`) and merged with
//! the previous `tauri-plugin-frak-crashlytics`. Owns the single
//! `firebase-ios-sdk` SwiftPM dependency and the single Android Firebase BoM,
//! so:
//!   - One SPM clone instead of two (CI build time win, smaller cache surface)
//!   - One `FirebaseApp.configure()` on iOS (eliminates the previous
//!     nil-guarded double-call from FCM `load()` and Crashlytics `init()`)
//!   - One Android BoM pin to bump on Firebase upgrades
//!
//! Commands are routed straight from JS to the native side — no Rust hop,
//! matching the in-repo `tauri-plugin-recovery-hint` convention. The command
//! surface, events and caveats live in `README.md`.
//!
//! All commands are no-ops on web / desktop (the native bridge is only
//! wired under `#[cfg(mobile)]`).

#![cfg(mobile)]

mod mobile;
mod panic_hook;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

/// Filename used by the Rust ↔ native bridge to surface panics across
/// process restarts. Native plugin reads this file at init, forwards its
/// content to Crashlytics as a non-fatal error, then deletes it. Lives in
/// `app_cache_dir()` so the OS may evict it under storage pressure (which
/// is fine — the worst case is losing one panic message).
pub(crate) const PANIC_REPORT_FILENAME: &str = "frak.wallet.last_rust_panic.txt";

/// Initialize the `frak-firebase` plugin.
///
/// Registers the native iOS + Android plugins (which carry the actual FCM
/// and Crashlytics command implementations) and installs the Rust panic
/// hook so panics from the `panic = "abort"` release profile are forwarded
/// to Crashlytics on the *next* launch.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-firebase")
        .invoke_handler(tauri::generate_handler![test_rust_panic])
        .setup(|app, api| {
            // Install the Rust panic hook BEFORE registering the native
            // plugin so any panic during `mobile::init` (e.g. swift-rs
            // bridge failure, Swift `init()` raising) is persisted to disk
            // and forwarded on the next launch. With `panic = "abort"` the
            // process dies immediately on panic, so missing the hook means
            // missing the report.
            panic_hook::install(app);
            mobile::init(app, api)?;
            Ok(())
        })
        .build()
}

/// Smoke-test command — deliberately panics so the Rust → disk → next-launch
/// pipeline can be verified end-to-end.
///
/// Flow on iOS (release profile, `panic = "abort"`):
///   1. JS calls `invoke("plugin:frak-firebase|test_rust_panic")`.
///   2. This function runs `panic!()`. The panic hook installed at plugin
///      setup writes a JSON payload to `app_cache_dir/last_rust_panic.txt`
///      with `name`/`message`/`stack`.
///   3. `panic = "abort"` raises `SIGABRT`. Crashlytics' signal handler (armed
///      in the Swift `load(webview:)` once `FirebaseApp.configure()` succeeds)
///      captures it and queues a fatal native report.
///   4. App relaunches. The native plugin's `forwardPersistedRustPanic()` reads
///      the JSON file, records it as a non-fatal `RustPanic` issue, and
///      deletes the file.
///
/// On dev builds (default profile, `panic = "unwind"`) the panic is caught by
/// Tauri's command runtime and surfaces as a JS-side rejection — but the panic
/// hook still fires, so the next launch still shows the non-fatal in the
/// dashboard. Useful sanity check that the persistence path works.
#[tauri::command]
fn test_rust_panic() {
    panic!("frak-firebase: synthetic test_rust_panic from JS smoke-test");
}
