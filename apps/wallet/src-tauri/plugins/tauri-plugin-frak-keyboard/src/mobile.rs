use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_keyboard);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "ios")]
    api.register_ios_plugin(init_plugin_frak_keyboard)?;
    Ok(())
}
