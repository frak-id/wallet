use serde::de::DeserializeOwned;
use serde_json::json;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{
    CheckUpdateResponse, CompleteSoftUpdateResponse, OpenStoreResponse, StartSoftUpdateResponse,
};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "id.frak.updater";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_updater);

/// Typed handle to the native updater plugin — held in Tauri state so the
/// command handlers in `lib.rs` don't care which platform is active.
pub struct FrakUpdater<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> FrakUpdater<R> {
    pub(crate) fn check_update(
        &self,
    ) -> Result<CheckUpdateResponse, tauri::plugin::mobile::PluginInvokeError> {
        self.0.run_mobile_plugin("checkUpdate", json!({}))
    }

    pub(crate) fn start_soft_update(
        &self,
    ) -> Result<StartSoftUpdateResponse, tauri::plugin::mobile::PluginInvokeError> {
        self.0.run_mobile_plugin("startSoftUpdate", json!({}))
    }

    pub(crate) fn complete_soft_update(
        &self,
    ) -> Result<CompleteSoftUpdateResponse, tauri::plugin::mobile::PluginInvokeError> {
        self.0.run_mobile_plugin("completeSoftUpdate", json!({}))
    }

    pub(crate) fn open_store(
        &self,
    ) -> Result<OpenStoreResponse, tauri::plugin::mobile::PluginInvokeError> {
        self.0.run_mobile_plugin("openStore", json!({}))
    }
}

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<FrakUpdater<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "FrakUpdaterPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_frak_updater)?;
    Ok(FrakUpdater(handle))
}
