use std::cell::RefCell;

use objc2::rc::Retained;
use objc2::{class, msg_send, runtime::AnyObject};
use tauri::WebviewWindow;

thread_local! {
    // UIKit objects: only ever touched on the main thread, where this lives.
    static LAUNCH_COVER: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
}

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

/// Lays the launch storyboard over the webview until [`remove_launch_cover`]:
/// iOS drops its launch screen on the first frame, while WKWebView is still blank white.
/// Must run in `setup`, which is on the main thread before that frame.
pub fn add_launch_cover(window: &WebviewWindow) -> tauri::Result<()> {
    window.with_webview(|webview| unsafe {
        let webview: &AnyObject = &*webview.inner().cast::<AnyObject>();
        let superview: Option<Retained<AnyObject>> = msg_send![webview, superview];
        let host = superview.as_deref().unwrap_or(webview);

        let name: Option<Retained<AnyObject>> =
            msg_send![class!(NSString), stringWithUTF8String: c"LaunchScreen".as_ptr()];
        let Some(name) = name else { return };
        let storyboard: Option<Retained<AnyObject>> = msg_send![
            class!(UIStoryboard),
            storyboardWithName: &*name,
            bundle: std::ptr::null::<AnyObject>()
        ];
        let Some(storyboard) = storyboard else { return };
        let controller: Option<Retained<AnyObject>> =
            msg_send![&*storyboard, instantiateInitialViewController];
        let Some(controller) = controller else { return };
        let cover: Retained<AnyObject> = msg_send![&*controller, view];

        let _: () = msg_send![&*cover, setTranslatesAutoresizingMaskIntoConstraints: false];
        let _: () = msg_send![host, addSubview: &*cover];
        let pairs: [(Retained<AnyObject>, Retained<AnyObject>); 4] = [
            (msg_send![&*cover, topAnchor], msg_send![host, topAnchor]),
            (
                msg_send![&*cover, bottomAnchor],
                msg_send![host, bottomAnchor],
            ),
            (
                msg_send![&*cover, leadingAnchor],
                msg_send![host, leadingAnchor],
            ),
            (
                msg_send![&*cover, trailingAnchor],
                msg_send![host, trailingAnchor],
            ),
        ];
        for (from, to) in pairs {
            let constraint: Retained<AnyObject> = msg_send![&*from, constraintEqualToAnchor: &*to];
            let _: () = msg_send![&*constraint, setActive: true];
        }

        LAUNCH_COVER.with(|slot| *slot.borrow_mut() = Some(cover));
    })
}

/// Idempotent; main thread only.
pub fn remove_launch_cover() {
    if let Some(cover) = LAUNCH_COVER.with(|slot| slot.borrow_mut().take()) {
        unsafe {
            let _: () = msg_send![&*cover, removeFromSuperview];
        }
    }
}
