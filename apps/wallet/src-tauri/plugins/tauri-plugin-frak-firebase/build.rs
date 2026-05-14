const COMMANDS: &[&str] = &[
    // --- FCM commands (vendored from srod/tauri-plugin-fcm) ---
    "get_token",
    "request_permissions",
    "check_permissions",
    "register",
    "delete_token",
    "create_channel",
    "send_notification",
    // --- Crashlytics commands (merged from tauri-plugin-frak-crashlytics) ---
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
