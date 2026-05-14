import UIKit
import Tauri
import FirebaseMessaging
import ObjectiveC.runtime

/// Insert our APNs-to-Firebase forwarder and error handler into the delegate
/// method chain using `method_setImplementation` + captured previous IMP.
///
/// This avoids `method_exchangeImplementations` entirely, which is fragile when
/// multiple swizzlers operate on the same selector (Firebase ISA swizzle, our
/// forwarder, and other plugins like tauri-plugin-notification). The exchange
/// pattern can leave selectors pointing at the wrong IMP, causing either
/// infinite recursion or a broken chain.
///
/// By capturing the previous IMP as a function pointer and calling it directly,
/// we guarantee: (1) our code runs, (2) the previous handler runs, and
/// (3) no selector-based dispatch can loop back to us.
///
/// Vendored from `srod/tauri-plugin-fcm` (commit b9d4d186) with the plugin
/// reference renamed from `FcmPlugin` to `FrakFirebasePlugin` to reflect the
/// merged FCM + Crashlytics surface.
enum AppDelegateSwizzler {
    static weak var plugin: FrakFirebasePlugin?

    private static var hasSwizzled = false

    /// IMP signatures for the two delegate methods we swizzle.
    private typealias APNsTokenIMP = @convention(c) (AnyObject, Selector, UIApplication, Data) -> Void
    private typealias APNsErrorIMP = @convention(c) (AnyObject, Selector, UIApplication, NSError) -> Void

    static func swizzlePushCallbacks() {
        guard !hasSwizzled else { return }
        guard let delegate = UIApplication.shared.delegate else { return }
        let delegateClass: AnyClass = type(of: delegate)

        swizzleDidRegister(delegateClass)
        swizzleDidFail(delegateClass)

        hasSwizzled = true
    }

    // MARK: - didRegisterForRemoteNotificationsWithDeviceToken

    private static func swizzleDidRegister(_ cls: AnyClass) {
        let sel = #selector(
            UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )

        // Capture the previous IMP (another plugin's, Firebase's, or nil).
        let previousIMP: IMP? = {
            if let method = class_getInstanceMethod(cls, sel) {
                return method_getImplementation(method)
            }
            return nil
        }()

        let block: @convention(block) (AnyObject, UIApplication, Data) -> Void = {
            selfObj, app, token in
            // Defensive: set APNs token explicitly so Firebase can exchange APNs → FCM.
            // Idempotent — no harm if Firebase already received it via its own swizzle.
            Messaging.messaging().apnsToken = token

            // Chain to the previous handler.
            if let prev = previousIMP {
                let fn = unsafeBitCast(prev, to: APNsTokenIMP.self)
                fn(selfObj, sel, app, token)
            }
        }

        let newIMP = imp_implementationWithBlock(block)

        if let existingMethod = class_getInstanceMethod(cls, sel) {
            method_setImplementation(existingMethod, newIMP)
        } else {
            // No existing implementation — add directly.
            // Type encoding: v=void @=id(self) :=SEL @=id(UIApplication) @=id(Data)
            class_addMethod(cls, sel, newIMP, "v@:@@")
        }
    }

    // MARK: - didFailToRegisterForRemoteNotificationsWithError

    private static func swizzleDidFail(_ cls: AnyClass) {
        let sel = #selector(
            UIApplicationDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)
        )

        let previousIMP: IMP? = {
            if let method = class_getInstanceMethod(cls, sel) {
                return method_getImplementation(method)
            }
            return nil
        }()

        let block: @convention(block) (AnyObject, UIApplication, NSError) -> Void = {
            selfObj, app, error in
            let description = error.localizedDescription

            // Buffer the error so getToken() can surface it directly instead
            // of returning a generic "FCM token not available" rejection.
            AppDelegateSwizzler.plugin?.errorBuffer.store(error: description)

            try? AppDelegateSwizzler.plugin?.trigger(
                "push-error",
                data: ["error": description]
            )

            // Chain to the previous handler.
            if let prev = previousIMP {
                let fn = unsafeBitCast(prev, to: APNsErrorIMP.self)
                fn(selfObj, sel, app, error)
            }
        }

        let newIMP = imp_implementationWithBlock(block)

        if let existingMethod = class_getInstanceMethod(cls, sel) {
            method_setImplementation(existingMethod, newIMP)
        } else {
            // v=void @=id(self) :=SEL @=id(UIApplication) @=id(NSError)
            class_addMethod(cls, sel, newIMP, "v@:@@")
        }
    }
}
