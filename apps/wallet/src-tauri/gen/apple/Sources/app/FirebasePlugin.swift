import UIKit
import WebKit
import Tauri
import FirebaseCore
import FirebaseMessaging

/// Tauri plugin that initializes Firebase and exposes FCM registration tokens to JS.
///
/// On load, configures Firebase and sets up the MessagingDelegate.
/// When an FCM token is received (or refreshed), emits a "fcm-token" event
/// that the TS notification adapter can listen to via addPluginListener("firebase", "fcm-token", ...).
class FirebasePlugin: Plugin {
    override init() {
        super.init()
    }

    public override func load(webview: WKWebView) {
        super.load(webview: webview)

        // Store plugin ref for delegate callbacks
        FirebaseTokenBridge.plugin = self

        // Configure Firebase — reads GoogleService-Info.plist from bundle
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }

        // Set FCM messaging delegate to receive token updates
        Messaging.messaging().delegate = FirebaseTokenBridge.messagingDelegate
    }

    /// Called by FirebaseTokenBridge when FCM token is received or refreshed
    func handleFcmToken(_ token: String) {
        try? trigger("fcm-token", data: ["token": token])
    }

    /// JS-callable command: explicitly fetch the current FCM token
    @objc public func getFcmToken(_ invoke: Invoke) {
        Messaging.messaging().token { token, error in
            if let error = error {
                invoke.reject(error.localizedDescription)
            } else if let token = token {
                invoke.resolve(["token": token])
            } else {
                invoke.reject("No FCM token available")
            }
        }
    }
}

// MARK: - Tauri plugin entry point

@_cdecl("init_plugin_firebase")
func initPlugin() -> Plugin {
    return FirebasePlugin()
}
