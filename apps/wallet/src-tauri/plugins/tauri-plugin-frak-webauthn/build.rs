const COMMANDS: &[&str] = &["register", "authenticate", "get_passkey_presence"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
