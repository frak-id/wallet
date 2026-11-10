const COMMANDS: &[&str] = &[
    "check_update",
    "start_soft_update",
    "complete_soft_update",
    "open_store",
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
