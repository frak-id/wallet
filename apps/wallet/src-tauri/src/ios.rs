use objc2::{msg_send, runtime::AnyObject};
use tauri::WebviewWindow;

/// Enables the WKWebView edge-swipe back/forward gesture.
///
/// wry defaults `back_forward_navigation_gestures` to false and Tauri exposes
/// no config passthrough, so the gesture only exists if set here. TanStack
/// pushState entries land in the back-forward list, so same-document routes
/// respond to it.
pub fn enable_swipe_back(window: &WebviewWindow) {
    let _ = window.with_webview(|webview| unsafe {
        let webview: *mut AnyObject = webview.inner().cast();
        let _: () = msg_send![&*webview, setAllowsBackForwardNavigationGestures: true];
    });
}
