use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

mod models;
pub use models::RecoveryHint;

#[cfg(mobile)]
mod mobile;

/// Initialize the `recovery-hint` plugin.
///
/// Commands (`get_recovery_hint`, `set_recovery_hint`, `clear_recovery_hint`)
/// are handled natively on iOS and Android via the registered mobile
/// plugins. On desktop / web the commands resolve to no-ops / empty values
/// because the plugin is only registered under `#[cfg(mobile)]`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("recovery-hint")
        .setup(|_app, _api| {
            #[cfg(mobile)]
            mobile::init(_app, _api)?;
            Ok(())
        })
        .build()
}
