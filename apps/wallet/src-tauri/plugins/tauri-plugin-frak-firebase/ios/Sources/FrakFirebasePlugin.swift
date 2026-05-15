import FirebaseCore
import FirebaseCrashlytics
import FirebaseMessaging
import FrakObjCExceptionCatcher
import SwiftRs
import FirebaseCrashlytics
import FirebaseMessaging
import SwiftRs
import Tauri
import UIKit
import UserNotifications
import WebKit

// MARK: - Command Arguments (FCM)

struct CreateChannelArgs: Decodable {
    let id: String
    let name: String
    let importance: UInt32
}

struct SendNotificationArgs: Decodable {
    let title: String
    let body: String?
    let icon: String?
    let id: Int?
    let channelId: String?
}

// MARK: - Command Arguments (Crashlytics)

struct SetUserIdArgs: Decodable {
    let userId: String
}

struct SetKeyArgs: Decodable {
    let key: String
    let value: String
}

struct LogArgs: Decodable {
    let message: String
}

struct RecordErrorArgs: Decodable {
    let name: String
    let message: String
    let stack: String?
}

struct SetCollectionEnabledArgs: Decodable {
    let enabled: Bool
}

/// Combined FCM + Crashlytics plugin.
///
/// Owns the single `FirebaseApp.configure()` call so:
///   * Crashlytics' NSException + Mach signal handlers arm in `init()`, before
///     the Tauri WebView is attached (matches commit 04019eb03's intent).
///   * The FCM plugin no longer needs its own nil-guarded `FirebaseApp.configure()`
///     in `load()` — same Firebase app instance is shared.
///
/// Vendored from `srod/tauri-plugin-fcm` (commit b9d4d186) and merged with
/// the previous `FrakCrashlyticsPlugin`. The FCM half keeps the `MessagingDelegate`
/// and `UNUserNotificationCenterDelegate` conformances; the Crashlytics half adds
/// the five context commands (setUserId, setKey, log, recordError, setCollectionEnabled)
/// and the persisted-Rust-panic forwarder.
class FrakFirebasePlugin: Plugin, MessagingDelegate, UNUserNotificationCenterDelegate {

    // MARK: - Crashlytics state

    /// Filename written by the Rust panic hook (see `panic_hook.rs`).
    /// Must stay in sync with `PANIC_REPORT_FILENAME` on the Rust side.
    private let panicReportFilename = "frak.wallet.last_rust_panic.txt"

    /// `true` once `FirebaseApp.configure()` returned without raising and
    /// `FirebaseApp.app()` reports a non-nil default app. Crashlytics commands
    /// gate on this flag so a JS call that races ahead of `load(webview:)`
    /// doesn't trip the "No default FirebaseApp" NSException raised by
    /// `Crashlytics.crashlytics()`.
    private var isFirebaseReady = false
    private var crashlytics: Crashlytics { Crashlytics.crashlytics() }

    // MARK: - FCM state

    private let tokenBuffer = TokenBuffer()
    let errorBuffer = RegistrationErrorBuffer()
    /// Tracks the prior `UNUserNotificationCenter.delegate` so we forward
    /// presentation + response callbacks back to whoever was set before us.
    ///
    /// CAVEAT: weak reference + single-pass capture. If another plugin or app
    /// code reassigns `.delegate` *after* our `load()` runs, our forwarding
    /// silently breaks. Currently nothing else in this app touches the
    /// delegate, so plugin registration order in `src-tauri/src/lib.rs` is
    /// the de-facto contract — keep us above any future delegate-touching
    /// plugins.
    private weak var previousNotificationDelegate: UNUserNotificationCenterDelegate?

    // MARK: - Lifecycle

    override init() {
        super.init()
        // Keep init() minimal. Tauri's Plugin base class is not fully wired
        // until load(webview:) is called — doing heavy work here (Firebase
        // configure, NSException-throwing APIs) means any failure unwinds
        // through the @_cdecl entry point with no chance for Crashlytics to
        // catch it. The diagnostic NSLog is cheap and runs unconditionally
        // so the bundle id is in the system log even if load() never fires.
        let bundleId = Bundle.main.bundleIdentifier ?? "<unknown>"
        NSLog("[frak-firebase] init — bundle id: \(bundleId)")
    }

    override func load(webview: WKWebView) {
        // All work below touches UIKit, UNUserNotificationCenter, Messaging
        // delegates, and method swizzling — none of which are documented as
        // thread-safe. Tauri calls `load(webview:)` from `on_webview_created`,
        // which is *usually* main but not contractually so. Dispatch on main
        // ourselves to make the threading invariants explicit.
        if Thread.isMainThread {
            configureAndWireFirebase()
        } else {
            DispatchQueue.main.sync { [weak self] in
                self?.configureAndWireFirebase()
            }
        }
    }

    private func configureAndWireFirebase() {
        dispatchPrecondition(condition: .onQueue(.main))

        #if DEBUG
        // Verbose Firebase logging surfaces configure() errors (missing or
        // invalid GoogleService-Info.plist, bundle-id mismatch) and shows
        // Crashlytics' own init logs that are normally suppressed.
        FirebaseConfiguration.shared.setLoggerLevel(.debug)
        #endif

        // Idempotent: WebView teardown + recreation on memory pressure can
        // trigger a second `load(webview:)`. `FirebaseApp.configure()` raises
        // an *uncatchable* `NSException` on double-configure, so bail before
        // ever calling it again.
        if FirebaseApp.app() != nil {
            NSLog("[frak-firebase] FirebaseApp already configured — skipping configure")
            isFirebaseReady = true
            return
        }

        // Wrap configure() in an ObjC `@try/@catch` shim. `NSException`
        // (missing plist, bundle-id mismatch, malformed plist) bypasses
        // Swift's `do/catch` and would otherwise unwind through the
        // `@_cdecl` entry point, killing the process *before* Crashlytics'
        // signal handlers are armed — invisible to the dashboard.
        if let err = FrakObjCExceptionCatcher.catchException({ FirebaseApp.configure() }) {
            NSLog("[frak-firebase] FirebaseApp.configure threw NSException: \(err.localizedDescription) — continuing without Firebase. App will run; crash reporting + FCM disabled this session.")
            return
        }

        guard let app = FirebaseApp.app() else {
            NSLog("[frak-firebase] FirebaseApp.configure returned but FirebaseApp.app() is nil. Check that GoogleService-Info.plist is present in the app bundle and matches the running bundle id.")
            return
        }
        NSLog("[frak-firebase] FirebaseApp.configure OK — name=\(app.name) googleAppID=\(app.options.googleAppID) bundleId=\(app.options.bundleID ?? "<nil>")")

        isFirebaseReady = true

        // Force Crashlytics SDK initialization. `FirebaseApp.configure()`
        // only *registers* the Crashlytics provider with the Firebase
        // component container; the SDK (including SIGABRT / NSException /
        // Mach exception handler installation) is constructed on first
        // access. Touch the singleton here so the handlers arm immediately,
        // NOT lazily on the first JS call to setUserId / log / recordError.
        // Without this line, a crash that fires before any Crashlytics JS
        // command is silently lost — the signal handler was never installed.
        let crashlytics = Crashlytics.crashlytics()
        NSLog("[frak-firebase] Crashlytics init — collectionEnabled=\(crashlytics.isCrashlyticsCollectionEnabled()) didCrashLastRun=\(crashlytics.didCrashDuringPreviousExecution())")

        // Forward any persisted Rust panic from a previous session as a
        // non-fatal `RustPanic` issue (in addition to whatever native fatal
        // report Crashlytics' own handler may have queued for the abort).
        forwardPersistedRustPanic()

        // Force-flush any queued reports so the smoke-test feedback loop
        // (tap button → app dies → relaunch → check dashboard) doesn't
        // wait on Crashlytics' default upload window.
        crashlytics.sendUnsentReports()

        // FCM-side wiring. Runs after Firebase is configured above so
        // Messaging.messaging() returns the same FirebaseApp instance. All
        // delegate assignments must run on main (we already are).
        Messaging.messaging().delegate = self
        previousNotificationDelegate = UNUserNotificationCenter.current().delegate
        UNUserNotificationCenter.current().delegate = self

        AppDelegateSwizzler.plugin = self
        AppDelegateSwizzler.swizzlePushCallbacks()

        #if !targetEnvironment(simulator)
            UIApplication.shared.registerForRemoteNotifications()
        #else
            // Defer so JS event listeners have time to attach after plugin init.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                self?.trigger("push-error", data: ["error": "Push notifications not available on simulator"])
            }
        #endif
    }

    // MARK: - Crashlytics: persisted Rust panic forwarder

    /// Look for a Rust panic report left over from the previous session
    /// and surface it as a non-fatal Crashlytics issue. Idempotent — the
    /// file is deleted after a successful read regardless of whether the
    /// recording itself succeeded so we don't flood the dashboard on
    /// repeat launches.
    private func forwardPersistedRustPanic() {
        guard let cachesDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return
        }
        let url = cachesDir.appendingPathComponent(panicReportFilename)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        defer { try? FileManager.default.removeItem(at: url) }
        guard
            let data = try? Data(contentsOf: url),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }
        let name = (json["name"] as? String) ?? "RustPanic"
        let message = (json["message"] as? String) ?? ""
        let stack = (json["stack"] as? String) ?? ""
        if !stack.isEmpty {
            crashlytics.log("[rust panic backtrace from previous session]\n\(stack)")
        }
        let nsError = NSError(
            domain: name,
            code: 0,
            userInfo: [
                NSLocalizedDescriptionKey: message,
                "stack": stack,
            ]
        )
        crashlytics.record(error: nsError)
    }

    // MARK: - FCM commands

    @objc public func getToken(_ invoke: Invoke) throws {
        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                if let buffered = self?.tokenBuffer.consume() {
                    invoke.resolve(["token": buffered])
                } else if let apnsError = self?.errorBuffer.consume() {
                    // Surface the APNs registration error (e.g. missing entitlement,
                    // cert mismatch) instead of the generic Firebase error.
                    invoke.reject(apnsError)
                } else {
                    invoke.reject(error.localizedDescription)
                }
                return
            }

            if let token = token {
                invoke.resolve(["token": token])
            } else if let buffered = self?.tokenBuffer.consume() {
                invoke.resolve(["token": buffered])
            } else if let apnsError = self?.errorBuffer.consume() {
                invoke.reject(apnsError)
            } else {
                invoke.reject("FCM token not available")
            }
        }
    }

    @objc public override func requestPermissions(_ invoke: Invoke) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.sound, .badge, .alert]) { granted, error in
            if let error = error {
                invoke.reject(error.localizedDescription)
                return
            }

            if granted {
                #if !targetEnvironment(simulator)
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                #endif
            }

            invoke.resolve(["notification": granted ? "granted" : "denied"])
        }
    }

    @objc public override func checkPermissions(_ invoke: Invoke) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let status: String

            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                status = "granted"
            case .denied:
                status = "denied"
            case .notDetermined:
                status = "prompt"
            @unknown default:
                status = "prompt"
            }

            invoke.resolve(["notification": status])
        }
    }

    @objc public func register(_ invoke: Invoke) throws {
        #if !targetEnvironment(simulator)
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
            invoke.resolve()
        #else
            // Reject directly so callers get an immediate error without needing
            // a separate onPushError listener. The load()-time push-error event
            // still fires as a diagnostic for listeners attached at startup.
            invoke.reject("Push notifications not available on simulator")
        #endif
    }

    @objc public func deleteToken(_ invoke: Invoke) throws {
        Messaging.messaging().deleteToken { error in
            if let error = error {
                invoke.reject(error.localizedDescription)
                return
            }

            invoke.resolve()
        }
    }

    @objc public func createChannel(_ invoke: Invoke) throws {
        let _ = try invoke.parseArgs(CreateChannelArgs.self)
        // No-op on iOS — channels are an Android concept.
        invoke.resolve()
    }

    @objc public func sendNotification(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SendNotificationArgs.self)

        let content = UNMutableNotificationContent()
        content.title = args.title
        content.body = args.body ?? ""
        content.sound = .default

        let identifier = args.id.map { String($0) } ?? String(Int.random(in: 0..<Int.max))
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                invoke.reject(error.localizedDescription)
            } else {
                invoke.resolve()
            }
        }
    }

    // MARK: - Crashlytics commands

    @objc public func setUserId(_ invoke: Invoke) {
        guard isFirebaseReady else {
            invoke.reject("Firebase not configured")
            return
        }
        do {
            let args = try invoke.parseArgs(SetUserIdArgs.self)
            crashlytics.setUserID(args.userId)
            invoke.resolve()
        } catch {
            invoke.reject("setUserId failed: \(error.localizedDescription)")
        }
    }

    /// CAVEAT: the JS facade in `crashlytics.ts` always stringifies values
    /// before calling this. The Crashlytics native API would happily accept
    /// numeric / boolean primitives, but we trade that for cross-platform
    /// uniformity (Android `FirebaseCrashlytics.setCustomKey` overloads vs.
    /// iOS `setCustomValue` produce subtly different dashboard formatting
    /// for the same input). The dashboard ends up showing every value as a
    /// quoted string — if a numeric-valued key needs to be query-filtered
    /// in BigQuery later, plan for that on the consumer side.
    @objc public func setKey(_ invoke: Invoke) {
        guard isFirebaseReady else {
            invoke.reject("Firebase not configured")
            return
        }
        do {
            let args = try invoke.parseArgs(SetKeyArgs.self)
            // Crashlytics on iOS accepts heterogeneous values; the JS facade
            // pre-stringifies so we always pass a String here for consistency
            // with the Android side.
            crashlytics.setCustomValue(args.value, forKey: args.key)
            invoke.resolve()
        } catch {
            invoke.reject("setKey failed: \(error.localizedDescription)")
        }
    }

    @objc public func log(_ invoke: Invoke) {
        guard isFirebaseReady else {
            invoke.reject("Firebase not configured")
            return
        }
        do {
            let args = try invoke.parseArgs(LogArgs.self)
            crashlytics.log(args.message)
            invoke.resolve()
        } catch {
            invoke.reject("log failed: \(error.localizedDescription)")
        }
    }

    /// CAVEAT (iOS specifics): we synthesize an `NSError` per call so the
    /// Crashlytics dashboard groups issues by the JS error `name` (which we
    /// map to `NSError.domain`). That gives reasonable per-error-class
    /// grouping. The Android side has *coarser* grouping — every non-fatal
    /// there is wrapped in the same `NonFatalReportedError` subclass, so
    /// all Android non-fatals end up in a single dashboard issue. Plan
    /// queries / alerts accordingly.
    @objc public func recordError(_ invoke: Invoke) {
        guard isFirebaseReady else {
            invoke.reject("Firebase not configured")
            return
        }
        do {
            let args = try invoke.parseArgs(RecordErrorArgs.self)
            // We synthesize an NSError to record. Domain/code use the JS
            // error name so the Crashlytics dashboard groups by error class;
            // the original message lands in `userInfo` as the failure reason.
            let domain = args.name.isEmpty ? "Error" : args.name
            var userInfo: [String: Any] = [
                NSLocalizedDescriptionKey: args.message,
            ]
            if let stack = args.stack, !stack.isEmpty {
                // Attach the JS stack as a breadcrumb on the next report so
                // it shows up in the issue's logs section.
                crashlytics.log("[non-fatal stack] \(stack)")
                userInfo["stack"] = stack
            }
            let nsError = NSError(domain: domain, code: 0, userInfo: userInfo)
            crashlytics.record(error: nsError)
            invoke.resolve()
        } catch {
            invoke.reject("recordError failed: \(error.localizedDescription)")
        }
    }

    @objc public func setCollectionEnabled(_ invoke: Invoke) {
        guard isFirebaseReady else {
            invoke.reject("Firebase not configured")
            return
        }
        do {
            let args = try invoke.parseArgs(SetCollectionEnabledArgs.self)
            crashlytics.setCrashlyticsCollectionEnabled(args.enabled)
            invoke.resolve()
        } catch {
            invoke.reject("setCollectionEnabled failed: \(error.localizedDescription)")
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if let previous = previousNotificationDelegate,
           previous.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            previous.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            if #available(iOS 14.0, *) {
                completionHandler([.banner, .sound])
            } else {
                completionHandler([.alert, .sound])
            }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let previous = previousNotificationDelegate,
           previous.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            previous.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    // MARK: - MessagingDelegate

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {
            return
        }

        // Successful token delivery supersedes any previous APNs error.
        errorBuffer.clear()
        tokenBuffer.store(token: token)
        trigger("token-refresh", data: ["token": token])
    }
}

// MARK: - Plugin Entry Point

@_cdecl("init_plugin_frak_firebase")
func initPlugin() -> Plugin {
    return FrakFirebasePlugin()
}
