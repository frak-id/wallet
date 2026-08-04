import Foundation

@testable import FrakSDK

/// `AppLauncher` with no `UIApplication` underneath. Records what was opened.
final class FakeAppLauncher: AppLauncher, @unchecked Sendable {
    private let lock = NSLock()
    private let openable: Set<String>
    private let opensSucceed: Bool
    private let probeAnswers: Bool
    private var seen: [String] = []

    /// - Parameters:
    ///   - openableSchemes: schemes something on the device handles. `http`/`https` always open.
    ///   - opensSucceed: whether an open succeeds at all.
    ///   - probeAnswers: whether `canOpen` is allowed to answer true. False models a merchant
    ///     who never added the wallet scheme to `LSApplicationQueriesSchemes`, where
    ///     `canOpenURL` reports false even though `open` would launch the app fine.
    init(openableSchemes: Set<String> = [], opensSucceed: Bool = true, probeAnswers: Bool = true) {
        self.openable = openableSchemes
        self.opensSucceed = opensSucceed
        self.probeAnswers = probeAnswers
    }

    var opened: [String] {
        lock.lock()
        defer { lock.unlock() }
        return seen
    }

    func canOpen(_ url: String) async -> Bool {
        // `openable` and `probeAnswers` are immutable, so no lock is needed — and `NSLock`
        // is unavailable from an async context under Swift 6.
        return probeAnswers && handles(url)
    }

    func open(_ url: String) async -> Bool {
        return record(url)
    }

    private func handles(_ url: String) -> Bool {
        if url.hasPrefix("http://") || url.hasPrefix("https://") { return true }
        return openable.contains { url.hasPrefix($0 + "://") }
    }

    /// Synchronous so the lock is taken outside any async context.
    private func record(_ url: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard opensSucceed, handles(url) else { return false }
        seen.append(url)
        return true
    }
}
