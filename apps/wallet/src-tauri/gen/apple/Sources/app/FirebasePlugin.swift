import UIKit
import WebKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

/// Manages Firebase initialization and FCM token delivery to the Tauri webview.
///
/// Communicates with JS via `evaluateJavaScript` on the WKWebView found through
/// UIKit view hierarchy traversal. This bypasses Tauri's plugin FFI system,
/// which requires a separate Rust crate to compile Swift at cargo build time.
///
/// JS side listens via `window.addEventListener("frak:fcm-token", ...)`.
final class FirebaseManager: NSObject {
    static let shared = FirebaseManager()

    private weak var webview: WKWebView?

    /// Pending token to emit once the webview becomes available
    private var pendingToken: String?

    /// Max webview resolution retries (20 × 500ms = 10s)
    private static let maxRetries = 20
    private var retryCount = 0

    private override init() {
        super.init()
    }

    /// Called from main.mm before Tauri starts.
    ///
    /// Phase 1 (synchronous): Configure Firebase — reads GoogleService-Info.plist,
    /// doesn't require UIApplication.
    ///
    /// Phase 2 (deferred): Messaging delegate, APNs swizzle, and notification
    /// registration are deferred to `didFinishLaunchingNotification` because
    /// UIApplication doesn't exist yet when `main()` runs (before UIApplicationMain).
    func start() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.didFinishLaunchingNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.onAppLaunched()
        }
    }

    /// Phase 2: Called after UIApplication is ready.
    /// Sets up Firebase messaging delegate and APNs swizzle.
    /// Does NOT request notification permission — the TS subscribe() flow
    /// handles that via the Tauri notifications plugin to control UX timing.
    private func onAppLaunched() {
        // 1. Set messaging delegate BEFORE registerForRemoteNotifications
        //    so the first token callback isn't missed (per Firebase docs).
        Messaging.messaging().delegate = FirebaseTokenBridge.messagingDelegate

        // 2. Defensive APNs token forwarding — skip on simulator where APNs
        //    doesn't exist (no push transport → swizzle would be pointless
        //    and registerForRemoteNotifications crashes some plugin versions).
        #if !targetEnvironment(simulator)
        FirebaseTokenBridge.swizzleApnsForwarding()
        #endif
    }

    /// Emit FCM token to JS via webview evaluation.
    /// If the webview isn't ready yet, stores the token and retries.
    func emitFcmToken(_ token: String) {
        guard let webview = resolveWebView() else {
            pendingToken = token
            scheduleWebViewRetry()
            return
        }

        let escaped = token
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")

        let js = """
        window.__frakFcmToken = '\(escaped)';
        window.dispatchEvent(new CustomEvent('frak:fcm-token', { detail: { token: '\(escaped)' } }));
        """
        webview.evaluateJavaScript(js) { [weak self] _, error in
            if let error = error {
                NSLog("[FirebaseManager] evaluateJavaScript failed: %@", error.localizedDescription)
                // Invalidate cached webview — it may have been replaced
                self?.webview = nil
            }
        }
    }

    // MARK: - Webview Resolution

    private func resolveWebView() -> WKWebView? {
        if let wv = webview { return wv }
        if let wv = findWebViewInHierarchy() {
            webview = wv
            return wv
        }
        return nil
    }

    private func scheduleWebViewRetry() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self, let token = self.pendingToken else { return }
            if self.resolveWebView() != nil {
                self.pendingToken = nil
                self.retryCount = 0
                self.emitFcmToken(token)
            } else {
                self.retryCount += 1
                if self.retryCount >= FirebaseManager.maxRetries {
                    NSLog("[FirebaseManager] Gave up finding WKWebView after %d retries", self.retryCount)
                    self.retryCount = 0
                    // Keep pendingToken — a future emitFcmToken call can still deliver it
                } else {
                    self.scheduleWebViewRetry()
                }
            }
        }
    }

    private func findWebViewInHierarchy() -> WKWebView? {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                if let wv = findWebView(in: window) { return wv }
            }
        }
        return nil
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let wv = view as? WKWebView { return wv }
        for subview in view.subviews {
            if let wv = findWebView(in: subview) { return wv }
        }
        return nil
    }
}

// MARK: - C entry point called from main.mm

@_cdecl("frak_init_firebase")
func frakInitFirebase() {
    FirebaseManager.shared.start()
}
