use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_glass);

/// Every command is handled by the Swift plugin; there is no Rust command layer.
/// Off iOS nothing is registered, so the frontend must gate on `IS_IOS`.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-glass")
        .setup(|_app, _api| {
            #[cfg(target_os = "ios")]
            _api.register_ios_plugin(init_plugin_frak_glass)?;
            Ok(())
        })
        .build()
}
