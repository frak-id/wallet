import UIKit
import FirebaseMessaging
import ObjectiveC.runtime
import Tauri

/// Bridge between Firebase MessagingDelegate and the FirebasePlugin.
///
/// Firebase's method swizzling (enabled by default) automatically intercepts
/// didRegisterForRemoteNotificationsWithDeviceToken and maps the APNs token
/// to an FCM registration token internally. As a defensive measure against
/// swizzle chain breakage when multiple plugins (e.g. Choochmeque) also
/// swizzle the same method, we additionally swizzle it ourselves and
/// forward the APNs token to Firebase explicitly. This assignment is
/// idempotent — harmless if Firebase's own swizzling already succeeded.
final class FrakMessagingDelegate: NSObject, MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        FirebaseTokenBridge.plugin?.handleFcmToken(token)
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
        // After method_exchangeImplementations, frak_application on the delegate
        // class points to the *original* IMP, so this forwards correctly.
        let chainSelector = #selector(
            FrakApnsForwarder.frak_application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )
        if responds(to: chainSelector) {
            frak_application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
        }
    }
}

enum FirebaseTokenBridge {
    static weak var plugin: FirebasePlugin?
    static let messagingDelegate = FrakMessagingDelegate()

    /// Whether swizzling has already been performed. Prevents double-swizzle
    /// which would undo the first exchange and break the chain.
    private static var hasSwizzled = false

    /// Swizzle didRegisterForRemoteNotificationsWithDeviceToken on the
    /// current AppDelegate to defensively forward APNs tokens to Firebase.
    ///
    /// Uses the standard alias-on-delegate-class pattern:
    /// 1. Add `frak_application` selector to the AppDelegate class
    /// 2. Exchange IMPs between `application:didRegister...` and `frak_application`
    /// After exchange, both selectors live on the delegate class, so
    /// `responds(to:)` and chain-through calls work correctly.
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

        // Check if the delegate class already has the original method
        guard let originalMethod = class_getInstanceMethod(delegateClass, originalSelector) else {
            // No existing implementation — add ours directly under the original selector.
            // No chain needed since there's nothing to forward to.
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
        // This is critical: method_exchangeImplementations only swaps IMPs,
        // not selectors. Both selectors must live on the same class for
        // responds(to:) and chain-through to work when self is the delegate.
        class_addMethod(
            delegateClass,
            swizzledSelector,
            method_getImplementation(swizzledMethod),
            method_getTypeEncoding(swizzledMethod)
        )

        // Now get the method from the delegate class (not FrakApnsForwarder)
        guard let addedMethod = class_getInstanceMethod(delegateClass, swizzledSelector) else {
            return
        }

        // Exchange: originalSelector IMP ↔ swizzledSelector IMP (both on delegateClass)
        method_exchangeImplementations(originalMethod, addedMethod)
        hasSwizzled = true
    }
}
