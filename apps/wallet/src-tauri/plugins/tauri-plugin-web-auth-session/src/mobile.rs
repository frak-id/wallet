use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.plugin.web_auth_session";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_web_auth_session);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    api.register_android_plugin(PLUGIN_IDENTIFIER, "WebAuthSessionPlugin")?;
    #[cfg(target_os = "ios")]
    api.register_ios_plugin(init_plugin_web_auth_session)?;
    Ok(())
}
