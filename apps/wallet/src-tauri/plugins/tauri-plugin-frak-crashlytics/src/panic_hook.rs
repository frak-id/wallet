//! Persists Rust panic messages to disk so the native plugin can forward
//! them to Crashlytics on the *next* launch.
//!
//! `panic = "abort"` is set on the app's release profile — that's what lets
//! the native Crashlytics signal handler capture the SIGABRT crash report
//! itself. The downside is that we can't `invoke` a native command from the
//! panic hook (the process dies before any IPC can flush). The file bridge
//! is the simplest pattern that survives the abort:
//!
//!   1. Capture `app_cache_dir()` at plugin init (the AppHandle is required
//!      to resolve it; the panic hook can't touch the AppHandle).
//!   2. On panic, write `<dir>/<PANIC_REPORT_FILENAME>` with a serialized
//!      `name`/`message`/`stack` payload (JSON) before chaining to the
//!      previous hook.
//!   3. Native plugin (Swift / Kotlin) reads + reports + deletes the file
//!      during its own init, before the user has a chance to trigger
//!      another crash.
//!
//! The cost is one launch of latency between a panic and its report. That
//! mirrors how Crashlytics handles its own native crash reports, so it's
//! the same UX the rest of the dashboard expects.

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::PANIC_REPORT_FILENAME;

/// Resolved path to the panic file. Captured once at init and read by the
/// panic hook; `OnceLock` keeps the hook closure `Send + Sync + 'static`.
static PANIC_REPORT_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Serialized panic payload — kept tiny and stable so the native side can
/// parse it with the platform's stock JSON utilities.
#[derive(Serialize)]
struct PanicReport<'a> {
    name: &'a str,
    message: String,
    stack: String,
}

pub fn install<R: Runtime>(app: &AppHandle<R>) {
    let cache_dir = match app.path().app_cache_dir() {
        Ok(dir) => dir,
        Err(err) => {
            log::warn!("frak-crashlytics: cannot resolve app_cache_dir: {err}");
            return;
        }
    };
    let path = cache_dir.join(PANIC_REPORT_FILENAME);

    // Best-effort directory creation — the cache dir is normally created by
    // the OS but isn't guaranteed to exist on first launch.
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if PANIC_REPORT_PATH.set(path).is_err() {
        // Already installed (init ran twice). Idempotent — keep the first.
        return;
    }

    // Chain rather than replace: keep tauri-plugin-log / Rust default
    // formatting intact so dev builds still print the panic to the console.
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(path) = PANIC_REPORT_PATH.get() {
            let report = PanicReport {
                name: "RustPanic",
                message: format_message(info),
                stack: format!("{}", std::backtrace::Backtrace::force_capture()),
            };
            if let Ok(json) = serde_json::to_string(&report) {
                // Best-effort. If the write fails (disk full, permission
                // denied, OS evicted parent dir) we still want the default
                // hook to run and the process to abort cleanly.
                let _ = fs::write(path, json);
            }
        }
        previous(info);
    }));
}

fn format_message(info: &std::panic::PanicHookInfo<'_>) -> String {
    let payload = info
        .payload()
        .downcast_ref::<&'static str>()
        .copied()
        .or_else(|| info.payload().downcast_ref::<String>().map(String::as_str))
        .unwrap_or("<non-string panic payload>");
    let location = info
        .location()
        .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
        .unwrap_or_else(|| "<unknown>".to_string());
    format!("{payload} (at {location})")
}
