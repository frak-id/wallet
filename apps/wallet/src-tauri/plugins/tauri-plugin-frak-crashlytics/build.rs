const COMMANDS: &[&str] = &[
    "set_user_id",
    "set_key",
    "log",
    "record_error",
    "set_collection_enabled",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
