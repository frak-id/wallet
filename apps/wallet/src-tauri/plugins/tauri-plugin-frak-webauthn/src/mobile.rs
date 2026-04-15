use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "id.frak.webauthn";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_webauthn);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    api.register_android_plugin(PLUGIN_IDENTIFIER, "FrakWebauthnPlugin")?;
    #[cfg(target_os = "ios")]
    api.register_ios_plugin(init_plugin_frak_webauthn)?;
    Ok(())
}
