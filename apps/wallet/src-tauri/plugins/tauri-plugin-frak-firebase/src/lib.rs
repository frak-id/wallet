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
        .setup(|app, api| {
            mobile::init(app, api)?;
            panic_hook::install(app);
            Ok(())
        })
        .build()
}
