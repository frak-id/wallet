import Foundation

@testable import FrakSDK

/// `AppLauncher` with no `UIApplication` underneath. Records what was opened, which is the
/// only observable the install handoff has.
final class FakeAppLauncher: AppLauncher, @unchecked Sendable {
    private let lock = NSLock()
    private let openable: Set<String>
    private let opensSucceed: Bool
    private let probeAnswers: Bool
    private var seen: [String] = []

    /// - Parameters:
    ///   - openableSchemes: schemes something on the device handles. `canOpen` answers true
    ///     for these, as `canOpenURL` would, and `open` succeeds for them. `http`/`https`
    ///     always open — a device always has a browser.
    ///   - opensSucceed: whether an open succeeds at all — a device with nothing willing to
    ///     handle the URL.
    ///   - probeAnswers: whether `canOpen` is allowed to answer true. False models the case
    ///     the SDK cannot control: a merchant who never added the wallet scheme to
    ///     `LSApplicationQueriesSchemes`, where `canOpenURL` reports false for an app that
    ///     is installed and that `open` launches perfectly well.
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

    /// Whether anything on this device would take the URL, independent of what the probe is
    /// permitted to admit to.
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
