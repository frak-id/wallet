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
///
/// `#[serde(rename_all = "camelCase")]` is required so the JSON forwarded to
/// the native plugins exposes `imageUrl` (not `image_url`) — the Kotlin and
/// Swift handlers read fields by their camelCase names from `invoke.getArgs()`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShareTextPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) image_url: Option<String>,
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
///
/// Tauri converts camelCase JS arguments to snake_case Rust params, so the
/// frontend `imageUrl` field deserializes into `image_url` here. We then
/// re-serialize via `ShareTextPayload` (camelCase) so the native plugins
/// receive `imageUrl` again.
#[tauri::command]
async fn share_text<R: Runtime>(
    _app: AppHandle<R>,
    url: Option<String>,
    text: Option<String>,
    title: Option<String>,
    image_url: Option<String>,
) -> Result<ShareResponse, String> {
    // Mirror the native plugins' validation: at least one of `url` or `text`
    // must be present so the share sheet has something to offer.
    let has_url = url.as_deref().map_or(false, |s| !s.is_empty());
    let has_text = text.as_deref().map_or(false, |s| !s.is_empty());
    if !has_url && !has_text {
        return Err("Missing 'url' or 'text' parameter".to_string());
    }

    #[cfg(mobile)]
    {
        _app.state::<FrakShare<R>>()
            .share_text(ShareTextPayload {
                url,
                text,
                title,
                image_url,
            })
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        // Desktop builds are not supported — frontend gates invocation with
        // `isIOS() || isAndroid()` from `@frak-labs/app-essentials/utils/platform`.
        let _ = (url, text, title, image_url);
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
