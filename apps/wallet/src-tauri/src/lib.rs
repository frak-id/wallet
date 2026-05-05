#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_safe_area_insets::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_biometric::init())
            .plugin(tauri_plugin_fcm::init())
            .plugin(tauri_plugin_app_settings::init())
            .plugin(tauri_plugin_install_referrer::init())
            .plugin(tauri_plugin_frak_webauthn::init())
            .plugin(tauri_plugin_frak_share::init())
            .plugin(tauri_plugin_clipboard_manager::init())
            .plugin(tauri_plugin_recovery_hint::init())
            .plugin(tauri_plugin_frak_crashlytics::init());
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
