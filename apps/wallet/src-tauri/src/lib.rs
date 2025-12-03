#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_safe_area_insets::init());

  // WebAuthn plugin is Android-only (iOS uses native WKWebView WebAuthn)
  #[cfg(target_os = "android")]
  let builder = builder.plugin(tauri_plugin_webauthn::init());

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
