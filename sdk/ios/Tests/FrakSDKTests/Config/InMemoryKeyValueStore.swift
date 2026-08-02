@testable import FrakSDK

/// `KeyValueStore` with no platform underneath, so cache behaviour is testable at all.
final class InMemoryKeyValueStore: KeyValueStore, @unchecked Sendable {
    private var values: [String: String] = [:]

    func string(forKey key: String) -> String? {
        values[key]
    }

    func set(_ value: String, forKey key: String) {
        values[key] = value
    }

    func removeValue(forKey key: String) {
        values.removeValue(forKey: key)
    }
}
