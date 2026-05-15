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
    // --- Crashlytics smoke-test commands ---
    // Wired through the JS facade in
    // `packages/wallet-shared/src/common/analytics/crashlytics.ts` for the
    // dashboard end-to-end verification flow:
    //   1. Tap a button bound to `crashlytics.testCrashNative()`
    //      → Swift calls `Crashlytics.crashlytics().crash()` → fatal SIGABRT
    //      → next launch, Crashlytics ships the report.
    //   2. Tap a button bound to `crashlytics.testRustPanic()`
    //      → Rust `panic!()` (release profile aborts; the panic hook also
    //      persists a JSON payload to `app_cache_dir/last_rust_panic.txt`)
    //      → next launch, the native plugin reads + reports it as a
    //      non-fatal `RustPanic` issue.
    // Both are intentionally always-available (not `#[cfg(debug)]`-gated) so
    // they can be exercised on TestFlight + Play Internal builds where the
    // signing identity matches the one that uploads dSYMs / mappings.
    "test_crash_native",
    "test_rust_panic",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
