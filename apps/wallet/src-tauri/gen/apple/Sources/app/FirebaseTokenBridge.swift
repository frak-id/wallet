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

enum FirebaseTokenBridge {
    static let messagingDelegate = FrakMessagingDelegate()

    /// Whether swizzling has already been performed.
    private static var hasSwizzled = false

    /// IMP signature for application:didRegisterForRemoteNotificationsWithDeviceToken:
    private typealias APNsTokenIMP = @convention(c) (AnyObject, Selector, UIApplication, Data) -> Void

    /// Insert our APNs-to-Firebase forwarder into the delegate method chain using
    /// `method_setImplementation` + captured previous IMP.
    ///
    /// This avoids `method_exchangeImplementations` entirely, which is fragile when
    /// three swizzlers operate on the same selector (Firebase ISA swizzle, our
    /// forwarder, and Choochmeque's push-token handler). The exchange pattern can
    /// leave selectors pointing at the wrong IMP, causing either infinite recursion
    /// or a broken chain where Choochmeque's invoke never resolves.
    ///
    /// By capturing the previous IMP as a function pointer and calling it directly,
    /// we guarantee: (1) our code runs, (2) the previous handler (Choochmeque) runs,
    /// and (3) no selector-based dispatch can loop back to us.
    static func swizzleApnsForwarding() {
        guard !hasSwizzled else { return }
        guard let delegate = UIApplication.shared.delegate else { return }
        let delegateClass: AnyClass = type(of: delegate)

        let sel = #selector(
            UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )

        // Capture the previous IMP (Choochmeque's, Firebase's, or nil).
        let previousIMP: IMP? = {
            if let method = class_getInstanceMethod(delegateClass, sel) {
                return method_getImplementation(method)
            }
            return nil
        }()

        // Block-based IMP: sets the APNs token in Firebase, then chains to previous.
        // imp_implementationWithBlock signature: (self, method_args...) → return_type
        let block: @convention(block) (AnyObject, UIApplication, Data) -> Void = {
            selfObj, app, token in
            // Defensive: set APNs token explicitly so Firebase can exchange APNs→FCM.
            // Idempotent — no harm if Firebase already received it via its own swizzle.
            Messaging.messaging().apnsToken = token

            // Chain to the previous handler (typically Choochmeque's PushForwarder,
            // which resolves the registerForPushNotifications invoke).
            if let prev = previousIMP {
                let fn = unsafeBitCast(prev, to: APNsTokenIMP.self)
                fn(selfObj, sel, app, token)
            }
        }

        let newIMP = imp_implementationWithBlock(block)

        if let existingMethod = class_getInstanceMethod(delegateClass, sel) {
            method_setImplementation(existingMethod, newIMP)
        } else {
            // No existing implementation — add directly.
            // Type encoding: v=void @=id(self) :=SEL @=id(UIApplication) @=id(Data)
            class_addMethod(delegateClass, sel, newIMP, "v@:@@")
        }

        hasSwizzled = true
    }
}
