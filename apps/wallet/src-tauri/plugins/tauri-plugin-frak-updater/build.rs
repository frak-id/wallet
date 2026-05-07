const COMMANDS: &[&str] = &[
    "check_update",
    "start_soft_update",
    "complete_soft_update",
    "open_store",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
