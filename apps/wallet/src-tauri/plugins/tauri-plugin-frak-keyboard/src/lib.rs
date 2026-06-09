use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(mobile)]
mod mobile;

/// Native iOS keyboard avoidance.
///
/// Registers a Tauri plugin whose only job is the iOS `Plugin.load(webview:)`
/// hook: it shrinks the `WKWebView` from the bottom by the keyboard overlap on
/// the system keyboard curve, so the web layout (`100dvh` / `visualViewport`)
/// reacts to the keyboard natively. This makes the JS workaround in
/// `apps/wallet/app/utils/keyboardInset.ts` a no-op (it already short-circuits
/// when the native shell resizes the WebView).
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-keyboard")
        .setup(|app, api| {
            #[cfg(mobile)]
            mobile::init(app, api)?;
            Ok(())
        })
        .build()
}
