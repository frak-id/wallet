#[cfg(target_os = "ios")]
mod ios;

/// No-op off iOS, where WKWebView's back gesture does not exist.
#[tauri::command]
fn set_swipe_back_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        use tauri::Manager;
        let window = app
            .get_webview_window("main")
            .ok_or("main webview window not found")?;
        ios::set_swipe_back(&window, enabled).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (app, enabled);
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // IMPORTANT: tauri_plugin_frak_firebase MUST initialize FIRST on mobile so
    // Crashlytics' NSException + Mach signal handlers are armed before any
    // other plugin can crash during setup. The Rust panic hook also lives in
    // this plugin's setup, so any panic in plugins registered after this one
    // will be persisted to disk and forwarded on the next launch.
    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_frak_firebase::init());
    }

    builder = builder
        .plugin(tauri_plugin_safe_area_insets::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_biometric::init())
            // tauri_plugin_frak_firebase moved above — registered before any
            // other mobile plugin so it can capture their setup crashes.
            .plugin(tauri_plugin_app_settings::init())
            .plugin(tauri_plugin_install_referrer::init())
            .plugin(tauri_plugin_frak_webauthn::init())
            .plugin(tauri_plugin_frak_share::init())
            .plugin(tauri_plugin_clipboard_manager::init())
            .plugin(tauri_plugin_recovery_hint::init())
            .plugin(tauri_plugin_frak_updater::init())
            .plugin(tauri_plugin_frak_glass::init());
    }

    #[cfg(target_os = "android")]
    {
        builder = builder
            .plugin(tauri_plugin_share::init())
            .plugin(tauri_plugin_fs::init());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "ios")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = ios::set_swipe_back(&window, true);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_swipe_back_enabled])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
