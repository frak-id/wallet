import UIKit
import FirebaseMessaging
import Tauri

/// Bridge between Firebase MessagingDelegate and the FirebasePlugin.
///
/// Firebase's method swizzling (enabled by default) automatically intercepts
/// didRegisterForRemoteNotificationsWithDeviceToken and maps the APNs token
/// to an FCM registration token internally. This delegate receives the
/// resulting FCM token and forwards it to the Tauri plugin for JS emission.
final class FrakMessagingDelegate: NSObject, MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        FirebaseTokenBridge.plugin?.handleFcmToken(token)
    }
}

enum FirebaseTokenBridge {
    static weak var plugin: FirebasePlugin?
    static let messagingDelegate = FrakMessagingDelegate()
}
