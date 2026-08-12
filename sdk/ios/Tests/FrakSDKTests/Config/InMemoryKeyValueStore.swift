import Foundation

@testable import FrakSDK

/// `KeyValueStore` with no platform underneath, so cache behaviour is testable at all.
///
/// Lock-protected: `AnonymousIdStore` mints identity on a `Task.detached` background thread, so
/// a test racing `startEagerGeneration()` against a direct `anonymousId()` call can reach this
/// from two threads at once.
final class InMemoryKeyValueStore: KeyValueStore, @unchecked Sendable {
    private let lock = NSLock()
    private var values: [String: String] = [:]
    /// Stands in for a file-backed store before a device's first unlock.
    private var readable: Bool

    init(readable: Bool = true) {
        self.readable = readable
    }

    var isReadable: Bool {
        lock.lock()
        defer { lock.unlock() }
        return readable
    }

    func string(forKey key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return values[key]
    }

    func set(_ value: String, forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        values[key] = value
    }

    func removeValue(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        values.removeValue(forKey: key)
    }
}
