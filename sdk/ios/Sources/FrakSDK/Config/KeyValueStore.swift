import Foundation

/// The SDK's persistence surface: three methods over string keys.
protocol KeyValueStore: Sendable {
    func string(forKey key: String) -> String?
    func set(_ value: String, forKey key: String)
    func removeValue(forKey key: String)

    /// False only while the backing exists but cannot be read — a file-backed store before the
    /// device's first unlock. Distinct from empty: minting over an unreadable store destroys the
    /// identity sitting in it.
    var isReadable: Bool { get }
}

extension KeyValueStore {
    var isReadable: Bool { true }
}

/// `KeyValueStore` backed by an SDK-owned `UserDefaults` suite, wiped on uninstall.
final class UserDefaultsStore: KeyValueStore, @unchecked Sendable {
    /// Matches the reason declared in `PrivacyInfo.xcprivacy`.
    static let suiteName = "id.frak.sdk.config"

    /// The consent decision, and only that: it is the one persisted value that SHOULD survive a
    /// restore, so it stays in a backed-up suite while the key material moved to
    /// `FileKeyValueStore`. Separate from the config suite because a corrupt write to that hot
    /// cache must not take the record that the user was ever asked with it.
    static let consentSuiteName = "id.frak.sdk.consent"

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
