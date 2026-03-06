import UIKit
import FirebaseMessaging
import ObjectiveC.runtime

/// MessagingDelegate that forwards FCM tokens to FirebaseManager.
final class FrakMessagingDelegate: NSObject, MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        FirebaseManager.shared.emitFcmToken(token)
    }
}

/// Swizzled AppDelegate forwarder that defensively passes the APNs device
/// token to Firebase, protecting against multi-plugin swizzle chain failures.
///
/// After swizzling, the `frak_application` selector is added to the AppDelegate
/// class and its IMP is exchanged with the original. When called:
/// - `self` is the AppDelegate instance (which now has both selectors)
/// - calling `frak_application(...)` invokes the *original* IMP (swizzle chain)
final class FrakApnsForwarder: NSObject {
    @objc func frak_application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Defensive: set APNs token explicitly even with Firebase swizzling enabled.
        // Idempotent — no harm if Firebase already received it via its own swizzle.
        Messaging.messaging().apnsToken = deviceToken

        // Call through to the previous implementation (swizzle chain).
        let chainSelector = #selector(
            FrakApnsForwarder.frak_application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )
        if responds(to: chainSelector) {
            frak_application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
        }
    }
}

enum FirebaseTokenBridge {
    static let messagingDelegate = FrakMessagingDelegate()

    /// Whether swizzling has already been performed.
    private static var hasSwizzled = false

    /// Swizzle didRegisterForRemoteNotificationsWithDeviceToken on the
    /// current AppDelegate to defensively forward APNs tokens to Firebase.
    static func swizzleApnsForwarding() {
        guard !hasSwizzled else { return }
        guard let delegate = UIApplication.shared.delegate else { return }
        let delegateClass: AnyClass = type(of: delegate)

        let originalSelector = #selector(
            UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )
        let swizzledSelector = #selector(
            FrakApnsForwarder.frak_application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )

        guard let swizzledMethod = class_getInstanceMethod(FrakApnsForwarder.self, swizzledSelector) else {
            return
        }

        guard let originalMethod = class_getInstanceMethod(delegateClass, originalSelector) else {
            // No existing implementation — add ours directly under the original selector.
            class_addMethod(
                delegateClass,
                originalSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )
            hasSwizzled = true
            return
        }

        // Add the swizzled method to the delegate class under its own selector.
        class_addMethod(
            delegateClass,
            swizzledSelector,
            method_getImplementation(swizzledMethod),
            method_getTypeEncoding(swizzledMethod)
        )

        guard let addedMethod = class_getInstanceMethod(delegateClass, swizzledSelector) else {
            return
        }

        // Exchange: originalSelector IMP ↔ swizzledSelector IMP
        method_exchangeImplementations(originalMethod, addedMethod)
        hasSwizzled = true
    }
}
