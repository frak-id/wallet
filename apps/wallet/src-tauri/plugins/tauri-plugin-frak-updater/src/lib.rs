use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime,
};

#[cfg(mobile)]
mod mobile;

#[cfg(mobile)]
pub use mobile::FrakUpdater;

/// Soft-update availability reported by the native side.
///
/// `up_to_date`         — current bundle version matches (or exceeds) the
///                        latest store / Play release. No prompt needed.
/// `available`          — Android only. Play Core has confirmed a newer
///                        release is available; the frontend should
///                        surface a soft prompt and call `start_soft_update`.
///                        No `store_version` is exposed (Play deliberately
///                        hides the human-readable name).
/// `candidate`          — iOS only. iTunes Lookup returned a `store_version`;
///                        the frontend layer compares it against the
///                        installed bundle to decide between `available`
///                        and `up_to_date`. Lifting the comparison out of
///                        the Swift plugin keeps version semantics in a
///                        single TS source of truth.
/// `in_progress`        — Android only. A FLEXIBLE Play update has already
///                        been started in this session and is still
///                        downloading. Frontend should keep showing the
///                        progress UI rather than re-triggering the flow.
/// `downloaded`         — Android only. FLEXIBLE Play update finished
///                        downloading and is waiting on `complete_soft_update`
///                        to install + restart.
/// `unsupported`        — Native check failed (e.g. desktop, no Play Services).
///                        Frontend should fall back to the backend hard-update
///                        gate only.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case", tag = "status")]
pub enum UpdateStatus {
    UpToDate,
    Available,
    Candidate {
        store_version: String,
    },
    InProgress {
        bytes_downloaded: u64,
        total_bytes: u64,
    },
    Downloaded,
    Unsupported,
}

/// Response returned by `check_update`.
///
/// `current_version` is read from the native bundle (`CFBundleShortVersionString`
/// on iOS, `PackageInfo.versionName` on Android) — kept here so the frontend
/// can compare against the backend `minVersion` without having to invoke a
/// separate command.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckUpdateResponse {
    pub current_version: String,
    #[serde(flatten)]
    pub update: UpdateStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartSoftUpdateResponse {
    /// `true`  — Android FLEXIBLE flow successfully launched (the user saw a
    ///           consent dialog and accepted; download is now running in the
    ///           background and the frontend should listen for progress).
    /// `false` — User dismissed the consent dialog or the flow was cancelled.
    pub started: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompleteSoftUpdateResponse {
    pub completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenStoreResponse {
    pub opened: bool,
}

/// Frontend-facing command — registered as `plugin:frak-updater|check_update`.
///
/// On iOS the native side hits the iTunes Lookup endpoint and returns the
/// fetched store version as `candidate`; the JS layer compares it against
/// the installed bundle. On Android the native side asks `AppUpdateManager`
/// whether a Play release is available and emits `available` directly when
/// it is, since Play does the comparison server-side.
#[tauri::command]
async fn check_update<R: Runtime>(_app: AppHandle<R>) -> Result<CheckUpdateResponse, String> {
    #[cfg(mobile)]
    {
        _app.state::<FrakUpdater<R>>()
            .check_update()
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        Err("frak-updater is only available on iOS and Android".to_string())
    }
}

/// Triggers the platform-appropriate soft-update flow.
///
/// iOS     — opens the App Store page for the bundle ID. Returns
///           `started: true` if the system accepted the URL.
/// Android — kicks off a Play Core FLEXIBLE update. Returns `started: true`
///           when the user consents; the download then runs in the
///           background and progress is reported via subsequent
///           `check_update` calls.
#[tauri::command]
async fn start_soft_update<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<StartSoftUpdateResponse, String> {
    #[cfg(mobile)]
    {
        _app.state::<FrakUpdater<R>>()
            .start_soft_update()
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        Err("frak-updater is only available on iOS and Android".to_string())
    }
}

/// Android-only — finalises a FLEXIBLE update by calling
/// `AppUpdateManager.completeUpdate()`, which restarts the app into the
/// newly downloaded version. Resolves with `completed: false` on iOS where
/// nothing needs finalising.
#[tauri::command]
async fn complete_soft_update<R: Runtime>(
    _app: AppHandle<R>,
) -> Result<CompleteSoftUpdateResponse, String> {
    #[cfg(mobile)]
    {
        _app.state::<FrakUpdater<R>>()
            .complete_soft_update()
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        Err("frak-updater is only available on iOS and Android".to_string())
    }
}

/// Opens the platform store directly. Used by the hard-update gate where
/// we can't (or don't want to) rely on the in-app flow.
#[tauri::command]
async fn open_store<R: Runtime>(_app: AppHandle<R>) -> Result<OpenStoreResponse, String> {
    #[cfg(mobile)]
    {
        _app.state::<FrakUpdater<R>>()
            .open_store()
            .map_err(|err| err.to_string())
    }

    #[cfg(not(mobile))]
    {
        Err("frak-updater is only available on iOS and Android".to_string())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-updater")
        .invoke_handler(tauri::generate_handler![
            check_update,
            start_soft_update,
            complete_soft_update,
            open_store
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let handle = mobile::init(app, api)?;
                app.manage(handle);
            }
            #[cfg(not(mobile))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .build()
}
