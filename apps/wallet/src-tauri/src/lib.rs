#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_safe_area_insets::init());

  #[cfg(mobile)]
  {
    builder = builder.plugin(tauri_plugin_biometric::init());
  }

  // Android-only plugins: WebAuthn, Share, and FS
  // (iOS uses native WKWebView WebAuthn and Web Share API works natively)
  #[cfg(target_os = "android")]
  {
    builder = builder
      .plugin(tauri_plugin_webauthn::init())
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
