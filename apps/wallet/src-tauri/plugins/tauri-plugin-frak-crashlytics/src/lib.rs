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

/// Initialize the `frak-crashlytics` plugin.
///
/// Native iOS/Android Crashlytics SDKs install their own uncaught-exception
/// handlers as soon as `FirebaseApp.configure()` runs (which happens during
/// `tauri-plugin-fcm` initialization), so most crashes are captured without
/// any code from this plugin. The commands exposed here add **context** to
/// those reports: user id, custom keys, breadcrumb logs, and explicit
/// non-fatal errors.
///
/// On desktop / web the commands are wired but resolve to no-ops because the
/// native bridge is only registered under `#[cfg(mobile)]`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-crashlytics")
        .setup(|_app, _api| {
            #[cfg(mobile)]
            mobile::init(_app, _api)?;
            Ok(())
        })
        .build()
}
