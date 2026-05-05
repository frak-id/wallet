import FirebaseCrashlytics
import SwiftRs
import Tauri
import UIKit

/// Bridges Tauri commands to the Crashlytics singleton.
///
/// Auto-capture (NSException + Mach signal handler) is wired by the
/// Crashlytics SDK as soon as `FirebaseApp.configure()` runs (handled by
/// tauri-plugin-fcm). This class only adds the **context** surface: user id,
/// custom keys, breadcrumb logs, and explicit non-fatal errors recorded
/// from the JS / Rust side.
class FrakCrashlyticsPlugin: Plugin {
    /// Filename written by the Rust panic hook (see `panic_hook.rs`).
    /// Must stay in sync with `PANIC_REPORT_FILENAME` on the Rust side.
    private let panicReportFilename = "frak.wallet.last_rust_panic.txt"
    private var crashlytics: Crashlytics { Crashlytics.crashlytics() }

    override init() {
        super.init()
        forwardPersistedRustPanic()
    }

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

    // MARK: - Tauri commands
    // Method names map to snake_case commands in build.rs:
    //   setUserId               ↔ set_user_id
    //   setKey                  ↔ set_key
    //   log                     ↔ log
    //   recordError             ↔ record_error
    //   setCollectionEnabled    ↔ set_collection_enabled

    @objc public func setUserId(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(SetUserIdArgs.self)
            crashlytics.setUserID(args.userId)
            invoke.resolve()
        } catch {
            invoke.reject("setUserId failed: \(error.localizedDescription)")
        }
    }

    @objc public func setKey(_ invoke: Invoke) {
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
        do {
            let args = try invoke.parseArgs(LogArgs.self)
            crashlytics.log(args.message)
            invoke.resolve()
        } catch {
            invoke.reject("log failed: \(error.localizedDescription)")
        }
    }

    @objc public func recordError(_ invoke: Invoke) {
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
        do {
            let args = try invoke.parseArgs(SetCollectionEnabledArgs.self)
            crashlytics.setCrashlyticsCollectionEnabled(args.enabled)
            invoke.resolve()
        } catch {
            invoke.reject("setCollectionEnabled failed: \(error.localizedDescription)")
        }
    }
}

// MARK: - Args

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

@_cdecl("init_plugin_frak_crashlytics")
func initPlugin() -> Plugin {
    return FrakCrashlyticsPlugin()
}
