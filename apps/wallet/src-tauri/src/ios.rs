use objc2::{msg_send, runtime::AnyObject};
use tauri::WebviewWindow;

/// Turns the WKWebView edge-swipe back/forward gesture on or off.
///
/// wry defaults `back_forward_navigation_gestures` to false and Tauri exposes
/// no config passthrough. The setter also stops WebKit recording navigation
/// snapshots while the gesture is off.
pub fn set_swipe_back(window: &WebviewWindow, enabled: bool) -> tauri::Result<()> {
    window.with_webview(move |webview| unsafe {
        let webview: *mut AnyObject = webview.inner().cast();
        let _: () = msg_send![&*webview, setAllowsBackForwardNavigationGestures: enabled];
    })
}
