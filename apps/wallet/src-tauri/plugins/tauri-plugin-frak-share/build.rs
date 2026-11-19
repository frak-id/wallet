const COMMANDS: &[&str] = &["share_text", "open_in_app"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
