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
/// CAVEAT: only one swizzler can win per selector per app run. We use
/// `method_setImplementation` and capture the previous IMP, which chains
/// safely with other `setImplementation`-style swizzlers and with the
/// ISA-swizzle Firebase installs first. But if a future plugin uses the
/// fragile `method_exchangeImplementations` pattern on the same selectors,
/// the captured `previousIMP` could end up pointing at the exchanged stub
/// and the chain breaks. Audit any new APNs-touching plugin before adding.
enum AppDelegateSwizzler {
    static weak var plugin: FrakFirebasePlugin?

    /// Thread-local sentinel key set while our APNs-register block is on the
    /// stack. If `previousIMP` ends up chaining back to us (e.g. another
    /// plugin swapped its IMP via `method_exchangeImplementations` and we
    /// captured a stale pointer), the re-entrant invocation detects the key
    /// and bails before recursing — protects against stack overflow.
    private static let didRegisterReentryKey = "frak.firebase.swizzler.didRegister"
    private static let didFailReentryKey = "frak.firebase.swizzler.didFail"

    /// `hasSwizzled` is only mutated from the main thread (see precondition
    /// in `swizzlePushCallbacks`). No locking needed once that contract holds.
    private static var hasSwizzled = false

    /// IMP signatures for the two delegate methods we swizzle.
    private typealias APNsTokenIMP = @convention(c) (AnyObject, Selector, UIApplication, Data) -> Void
    private typealias APNsErrorIMP = @convention(c) (AnyObject, Selector, UIApplication, NSError) -> Void

    /// Call from the main thread only. `UIApplication.shared.delegate` and
    /// the ObjC runtime swizzle APIs are not documented as thread-safe; the
    /// caller in `FrakFirebasePlugin.load(webview:)` already dispatches to
    /// main before invoking us.
    static func swizzlePushCallbacks() {
        dispatchPrecondition(condition: .onQueue(.main))
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
            // Re-entry guard: if our block is somehow on the call stack
            // already (broken `previousIMP` chain from another swizzler),
            // bail out instead of recursing into stack overflow.
            let threadDict = Thread.current.threadDictionary
            if threadDict[didRegisterReentryKey] as? Bool == true { return }
            threadDict[didRegisterReentryKey] = true
            defer { threadDict.removeObject(forKey: didRegisterReentryKey) }

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
            // Re-entry guard: see comment in swizzleDidRegister above.
            let threadDict = Thread.current.threadDictionary
            if threadDict[didFailReentryKey] as? Bool == true { return }
            threadDict[didFailReentryKey] = true
            defer { threadDict.removeObject(forKey: didFailReentryKey) }

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
