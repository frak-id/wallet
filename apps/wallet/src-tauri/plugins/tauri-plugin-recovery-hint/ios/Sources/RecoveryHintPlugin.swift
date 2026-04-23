import SwiftRs
import Tauri
import UIKit
import Security

/// Persistent recovery hint storage that survives an app uninstall.
///
/// Storage strategy:
///   1. `NSUbiquitousKeyValueStore` (iCloud KV) — primary store.
///      Survives uninstall and syncs across the user's devices.
///      Requires the iCloud Key-Value Storage entitlement
///      (`com.apple.developer.ubiquity-kvstore-identifier`).
///   2. Keychain with `kSecAttrSynchronizable = true` — fallback used when
///      iCloud is unavailable. iCloud Keychain items also survive uninstall
///      and sync when the user has iCloud Keychain enabled.
///
/// The payload is tiny (< 256 bytes typical) so we stay well under Apple's
/// 1 KB per-value cap on iCloud KV.
class RecoveryHintPlugin: Plugin {
    private let kvStore = NSUbiquitousKeyValueStore.default
    private let storageKey = "frak.wallet.recovery_hint.v1"
    private let keychainService = "id.frak.wallet.recovery-hint"

    // MARK: - Tauri commands
    // Method names map to snake_case commands in build.rs:
    //   getRecoveryHint   ↔ get_recovery_hint
    //   setRecoveryHint   ↔ set_recovery_hint
    //   clearRecoveryHint ↔ clear_recovery_hint

    @objc public func getRecoveryHint(_ invoke: Invoke) {
        let hint: JsonObject = readFromICloudKV() ?? readFromKeychain() ?? [:]
        invoke.resolve(hint)
    }

    @objc public func setRecoveryHint(_ invoke: Invoke) {
        do {
            let args = try invoke.parseArgs(RecoveryHintArgs.self)
            let dict = args.toDictionary()
            writeToICloudKV(dict)
            writeToKeychain(dict)
            invoke.resolve()
        } catch {
            invoke.reject("Failed to set recovery hint: \(error.localizedDescription)")
        }
    }

    @objc public func clearRecoveryHint(_ invoke: Invoke) {
        kvStore.removeObject(forKey: storageKey)
        kvStore.synchronize()
        deleteFromKeychain()
        invoke.resolve()
    }

    // MARK: - iCloud KV

    private func readFromICloudKV() -> [String: Any]? {
        // Force a sync so we see the latest value after reinstall.
        kvStore.synchronize()
        guard let data = kvStore.data(forKey: storageKey) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func writeToICloudKV(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        kvStore.set(data, forKey: storageKey)
        kvStore.synchronize()
    }

    // MARK: - Keychain (iCloud-synced fallback)

    private func keychainBaseQuery() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: storageKey,
            kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        ]
    }

    private func readFromKeychain() -> [String: Any]? {
        var query = keychainBaseQuery()
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private func writeToKeychain(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        let query = keychainBaseQuery()
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            // Accessible after first unlock so we can write on app launch.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery.merge(attrs) { _, new in new }
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    private func deleteFromKeychain() {
        SecItemDelete(keychainBaseQuery() as CFDictionary)
    }
}

// MARK: - Args

struct RecoveryHintArgs: Decodable {
    let lastAuthenticatorId: String?
    let lastWallet: String?
    let lastLoginAt: Int64?

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let v = lastAuthenticatorId { dict["lastAuthenticatorId"] = v }
        if let v = lastWallet { dict["lastWallet"] = v }
        if let v = lastLoginAt { dict["lastLoginAt"] = v }
        return dict
    }
}

@_cdecl("init_plugin_recovery_hint")
func initPlugin() -> Plugin {
    return RecoveryHintPlugin()
}
