import Foundation

/// The SDK's persistence surface: three methods over string keys.
protocol KeyValueStore: Sendable {
    func string(forKey key: String) -> String?
    func set(_ value: String, forKey key: String)
    func removeValue(forKey key: String)
}

/// `KeyValueStore` backed by an SDK-owned `UserDefaults` suite, wiped on uninstall.
final class UserDefaultsStore: KeyValueStore, @unchecked Sendable {
    /// Matches the reason declared in `PrivacyInfo.xcprivacy`.
    static let suiteName = "id.frak.sdk.config"

    /// A separate suite for the identity: a corrupt write to the hot one must not take the
    /// anonymous id with it.
    static let identitySuiteName = "id.frak.sdk.identity"

    // UserDefaults is documented thread-safe; it predates the Sendable annotation.
    private let defaults: UserDefaults

    init?(suiteName: String = UserDefaultsStore.suiteName) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return nil }
        self.defaults = defaults
    }

    func string(forKey key: String) -> String? {
        defaults.string(forKey: key)
    }

    func set(_ value: String, forKey key: String) {
        defaults.set(value, forKey: key)
    }

    func removeValue(forKey key: String) {
        defaults.removeObject(forKey: key)
    }
}
