// No JS-invokable commands: the plugin's only job runs in the iOS
// `Plugin.load(webview:)` lifecycle hook, so the command list is empty.
const COMMANDS: &[&str] = &[];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        // iOS-only spike. No `android_path` — the Android keyboard/inset fix
        // lives in `MainActivity.kt` via a WindowInsets listener (Track A1).
        .ios_path("ios")
        .build();
}
