use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

mod models;
pub use models::{
    LogArgs, RecordErrorArgs, SetCollectionEnabledArgs, SetKeyArgs, SetUserIdArgs,
};

#[cfg(mobile)]
mod mobile;

#[cfg(mobile)]
mod panic_hook;

/// Filename used by the Rust ↔ native bridge to surface panics across
/// process restarts. Native plugin reads this file at init, forwards its
/// content to Crashlytics as a non-fatal error, then deletes it. Lives in
/// `app_cache_dir()` so the OS may evict it under storage pressure (which
/// is fine — the worst case is losing one panic message).
#[cfg(mobile)]
pub(crate) const PANIC_REPORT_FILENAME: &str = "frak.wallet.last_rust_panic.txt";

/// Initialize the `frak-crashlytics` plugin.
///
/// Native iOS/Android Crashlytics SDKs install their own uncaught-exception
/// handlers as soon as `FirebaseApp.configure()` runs (which happens during
/// `tauri-plugin-fcm` initialization), so most crashes are captured without
/// any code from this plugin. The commands exposed here add **context** to
/// those reports: user id, custom keys, breadcrumb logs, and explicit
/// non-fatal errors.
///
/// On mobile we additionally install a panic hook that persists the
/// panic message + location to disk so the native plugin can forward it
/// to Crashlytics on the next launch — `panic = "abort"` (set in the app
/// Cargo profile) means the process dies before we can call native code
/// directly.
///
/// On desktop / web the commands are wired but resolve to no-ops because
/// the native bridge is only registered under `#[cfg(mobile)]`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-crashlytics")
        .setup(|_app, _api| {
            #[cfg(mobile)]
            mobile::init(_app, _api)?;
            #[cfg(mobile)]
            panic_hook::install(_app);
            Ok(())
        })
        .build()
}
