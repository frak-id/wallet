import Foundation

@testable import FrakSDK

/// `AppLauncher` with no `UIApplication` underneath. Records what was opened, which is the
/// only observable the install handoff has.
final class FakeAppLauncher: AppLauncher, @unchecked Sendable {
    private let lock = NSLock()
    private let openable: Set<String>
    private let opensSucceed: Bool
    private var seen: [String] = []

    /// - Parameters:
    ///   - openableSchemes: schemes `canOpen` answers true for, as `canOpenURL` would.
    ///   - opensSucceed: whether an open succeeds at all — a device with nothing willing to
    ///     handle the URL.
    init(openableSchemes: Set<String> = [], opensSucceed: Bool = true) {
        self.openable = openableSchemes
        self.opensSucceed = opensSucceed
    }

    var opened: [String] {
        lock.lock()
        defer { lock.unlock() }
        return seen
    }

    func canOpen(_ url: String) async -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return openable.contains { url.hasPrefix($0 + "://") }
    }

    func open(_ url: String) async -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard opensSucceed else { return false }
        seen.append(url)
        return true
    }
}
