const COMMANDS: &[&str] = &["get_recovery_hint", "set_recovery_hint", "clear_recovery_hint"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
