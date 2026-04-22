use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(mobile)]
mod mobile;

#[cfg(mobile)]
pub use mobile::FrakShare;

/// Payload forwarded to the native plugin's `shareText` method.
#[derive(Serialize)]
pub(crate) struct ShareTextPayload {
    pub(crate) text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) title: Option<String>,
}

/// Response returned by the native plugin. `shared = true` means the user
/// completed the share (or the chooser was dismissed on Android where the
/// completion state is not reported).
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ShareResponse {
    pub shared: bool,
}

/// Frontend-facing command.
///
/// Registered as `plugin:frak-share|share_text`, which maps to the permission
/// identifier `allow-share-text` (tauri-utils autogen replaces `_` with `-`
/// when producing permission files).
#[tauri::command]
async fn share_text<R: Runtime>(
    _app: AppHandle<R>,
    text: String,
    title: Option<String>,
) -> Result<ShareResponse, String> {
    if text.is_empty() {
        return Err("Missing 'text' parameter".to_string());
    }

    #[cfg(mobile)]
    {
        _app.state::<FrakShare<R>>()
            .share_text(ShareTextPayload { text, title })
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        // Desktop builds are not supported — frontend gates invocation with
        // `isIOS() || isAndroid()` from `@frak-labs/app-essentials/utils/platform`.
        let _ = (text, title);
        Err("frak-share is only available on iOS and Android".to_string())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-share")
        .invoke_handler(tauri::generate_handler![share_text])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let handle = mobile::init(app, api)?;
                app.manage(handle);
            }
            #[cfg(not(mobile))]
            {
                // `app` and `api` are only consumed on mobile builds —
                // suppress the unused-variable warning on desktop.
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}
