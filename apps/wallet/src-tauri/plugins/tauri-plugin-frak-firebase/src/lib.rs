//! Combined Firebase Cloud Messaging (FCM) + Crashlytics plugin.
//!
//! Vendored from `srod/tauri-plugin-fcm` (commit `b9d4d186`) and merged with
//! the previous `tauri-plugin-frak-crashlytics`. Owns the single
//! `firebase-ios-sdk` SwiftPM dependency and the single Android Firebase
//! BoM, so:
//!   - One SPM clone instead of two (CI build time win, smaller cache surface)
//!   - One `FirebaseApp.configure()` on iOS (eliminates the previous
//!     nil-guarded double-call from FCM `load()` and Crashlytics `init()`)
//!   - One Android BoM pin to bump on Firebase upgrades
//!
//! Crashlytics handlers are armed before the Tauri WebView attaches (Swift
//! `init()` rather than `load()`), matching the rationale in commit
//! `04019eb03`.
//!
//! All commands are no-ops on web / desktop (the native bridge is only
//! wired under `#[cfg(mobile)]`).

#![cfg(mobile)]

mod commands;
mod error;
mod mobile;
mod models;
mod panic_hook;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use error::{Error, Result};
pub use models::*;

pub type FrakFirebase<R> = mobile::FrakFirebase<R>;

pub trait FrakFirebaseExt<R: Runtime> {
    fn frak_firebase(&self) -> &FrakFirebase<R>;
}

impl<R: Runtime, T: Manager<R>> FrakFirebaseExt<R> for T {
    fn frak_firebase(&self) -> &FrakFirebase<R> {
        self.state::<FrakFirebase<R>>().inner()
    }
}

/// Filename used by the Rust ↔ native bridge to surface panics across
/// process restarts. Native plugin reads this file at init, forwards its
/// content to Crashlytics as a non-fatal error, then deletes it. Lives in
/// `app_cache_dir()` so the OS may evict it under storage pressure (which
/// is fine — the worst case is losing one panic message).
pub(crate) const PANIC_REPORT_FILENAME: &str = "frak.wallet.last_rust_panic.txt";

/// Initialize the `frak-firebase` plugin.
///
/// Firebase SDK auto-handlers (NSException on iOS, JVM uncaught + NDK signal
/// on Android) are wired by the native side as soon as `FirebaseApp` is
/// initialized. The commands exposed here cover both halves:
///
///   * **FCM**: `getToken`, `register`, `requestPermissions`,
///     `checkPermissions`, `deleteToken`, `createChannel`,
///     `sendNotification`, plus the `token-refresh` and `push-error` events.
///   * **Crashlytics**: `setUserId`, `setKey`, `log`, `recordError`,
///     `setCollectionEnabled`.
///
/// On mobile a Rust panic hook is also installed that persists the panic
/// message + location to disk; the native plugin forwards it to Crashlytics
/// on the next launch (`panic = "abort"` in the release profile means the
/// process dies before we can call native code directly from the hook).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-firebase")
        .invoke_handler(tauri::generate_handler![
            commands::get_token,
            commands::request_permissions,
            commands::check_permissions,
            commands::register,
            commands::delete_token,
            commands::create_channel,
            commands::send_notification,
        ])
        .setup(|app, api| {
            let handle = mobile::init(app, api)?;
            app.manage(handle);
            panic_hook::install(app);
            Ok(())
        })
        .build()
}
