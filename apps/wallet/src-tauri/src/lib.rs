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
            .plugin(tauri_plugin_frak_updater::init());
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
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
