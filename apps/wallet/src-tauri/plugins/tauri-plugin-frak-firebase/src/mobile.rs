use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.plugin.frak_firebase";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_firebase);

/// Register the native FCM + Crashlytics plugin with Tauri's mobile bridge.
///
/// Once registered, Tauri routes every `invoke("plugin:frak-firebase|...")`
/// call from JS straight to the matching `@objc` (iOS) / `@Command`
/// (Android) handler on the native side — no Rust-side handler hop.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    api.register_android_plugin(PLUGIN_IDENTIFIER, "FrakFirebasePlugin")?;
    #[cfg(target_os = "ios")]
    api.register_ios_plugin(init_plugin_frak_firebase)?;
    Ok(())
}
