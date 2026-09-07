fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().plugin(
        "app-settings",
        tauri_build::InlinedPlugin::new().commands(&["open_notification_settings"]),
    ))
    .expect("failed to run tauri-build");
}
