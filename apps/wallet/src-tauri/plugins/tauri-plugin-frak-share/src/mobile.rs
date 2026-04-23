use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{ShareResponse, ShareTextPayload};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "id.frak.share";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_share);

/// Typed handle to the native share plugin — held in Tauri state so the
/// `share_text` Rust command can forward to iOS or Android without the caller
/// caring which platform is running.
pub struct FrakShare<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> FrakShare<R> {
    /// Forward the payload to the Kotlin / Swift `shareText` method.
    ///
    /// Errors are mapped to `String` in the calling Rust command so the frontend
    /// sees a human-readable reason instead of the raw plugin invoke error.
    pub(crate) fn share_text(
        &self,
        payload: ShareTextPayload,
    ) -> Result<ShareResponse, tauri::plugin::mobile::PluginInvokeError> {
        self.0.run_mobile_plugin("shareText", payload)
    }
}

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<FrakShare<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "FrakSharePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_frak_share)?;
    Ok(FrakShare(handle))
}
