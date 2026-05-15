import ObjCExceptionCatcher
import Security
import SwiftRs
import Tauri
import UIKit

/// Persistent recovery hint storage that survives an app uninstall.
///
/// Storage strategy (write to both, read from either):
///   1. `NSUbiquitousKeyValueStore` (iCloud KV) — primary store.
///      Survives uninstall and syncs across the user's devices.
///      Requires the iCloud Key-Value Storage entitlement
///      (`com.apple.developer.ubiquity-kvstore-identifier`).
///      Silently falls back to an on-disk cache when the user is signed out
///      of iCloud, so writes never throw.
///   2. Keychain with `kSecAttrSynchronizable = true` — fallback used when
///      iCloud KV is empty. iCloud Keychain items also survive uninstall
///      and sync when the user has iCloud Keychain enabled.
///
/// The payload is tiny (< 256 bytes typical) so we stay well under Apple's
/// 1 MB / 1024-keys cap on iCloud KV.
class RecoveryHintPlugin: Plugin {
    private let kvStore = NSUbiquitousKeyValueStore.default
    private let storageKey = "frak.wallet.recovery_hint.v1"
    private let keychainService = "id.frak.wallet.recovery-hint"

    override init() {
        super.init()
        // Observe external iCloud changes so we can log propagation events.
        // We don't cache locally — `getRecoveryHint` re-reads every time —
        // but this is useful for debugging sync behavior in TestFlight logs.
        //
        // Wrapped in ObjCExceptionCatcher: under stale entitlements / iCloud
        // daemon issues, NSUbiquitousKeyValueStore can raise NSException at
        // observer registration or synchronize() time, which would crash the
        // app at construction with no chance to recover. Downgrading those
        // to a logged soft failure keeps the wallet usable — the recovery
        // hint is a UX convenience, not a correctness requirement.
        safelyInvoke("addObserver") { [weak self] in
            guard let self = self else { return }
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.onICloudKVChangedExternally(_:)),
                name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                object: self.kvStore
            )
        }
        // Prime the cache so the next read picks up the latest synced copy.
        _ = safelyInvoke("synchronize@init", default: false) { [weak self] in
            self?.kvStore.synchronize() ?? false
        }
    }

    deinit {
        // `removeObserver` is documented as safe to call without a matching
        // `addObserver`, so we don't need to track whether registration
        // succeeded above.
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func onICloudKVChangedExternally(_ notification: Notification) {
        let reason = (notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int) ?? -1
        Logger.info("recovery-hint iCloud KV changed externally reason=\(reason)")
    }

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
            // Reject empty payloads so a caller that accidentally sends
            // `{}` doesn't clobber a previously-persisted hint.
            guard !dict.isEmpty else {
                invoke.reject("Refusing to persist an empty recovery hint")
                return
            }
            let kvOk = writeToICloudKV(dict)
            let kcOk = writeToKeychain(dict)
            if !kvOk && !kcOk {
                invoke.reject("Failed to persist recovery hint to any backing store")
                return
            }
            if !kvOk {
                Logger.error("recovery-hint iCloud KV write failed; keychain-only")
            }
            if !kcOk {
                Logger.error("recovery-hint keychain write failed; iCloud KV-only")
            }
            invoke.resolve()
        } catch {
            invoke.reject("Failed to set recovery hint: \(error.localizedDescription)")
        }
    }

    @objc public func clearRecoveryHint(_ invoke: Invoke) {
        safelyInvoke("clear:removeObject") { [weak self] in
            guard let self = self else { return }
            self.kvStore.removeObject(forKey: self.storageKey)
        }
        _ = safelyInvoke("clear:synchronize", default: false) { [weak self] in
            self?.kvStore.synchronize() ?? false
        }
        deleteFromKeychain()
        invoke.resolve()
    }

    // MARK: - iCloud KV

    private func readFromICloudKV() -> [String: Any]? {
        // Force a sync so we see the latest value after reinstall.
        _ = safelyInvoke("read:synchronize", default: false) { [weak self] in
            self?.kvStore.synchronize() ?? false
        }
        let data: Data? = safelyInvoke("read:data(forKey:)", default: nil) { [weak self] in
            return self?.kvStore.data(forKey: self?.storageKey ?? "")
        }
        guard let data = data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// Returns `true` when the payload was serialized and handed off to iCloud
    /// KV. iCloud KV silently falls back to local storage when the user is
    /// signed out of iCloud — that's still a win (survives same-device
    /// uninstall when the backup agent restores app data), so we treat it
    /// as a success.
    @discardableResult
    private func writeToICloudKV(_ dict: [String: Any]) -> Bool {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else {
            return false
        }
        safelyInvoke("write:set(forKey:)") { [weak self] in
            guard let self = self else { return }
            self.kvStore.set(data, forKey: self.storageKey)
        }
        return safelyInvoke("write:synchronize", default: false) { [weak self] in
            self?.kvStore.synchronize() ?? false
        }
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

    @discardableResult
    private func writeToKeychain(_ dict: [String: Any]) -> Bool {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else {
            return false
        }
        let query = keychainBaseQuery()
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            // Accessible after first unlock so we can write on app launch.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecSuccess {
            return true
        }
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery.merge(attrs) { _, new in new }
            return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
        }
        return false
    }

    private func deleteFromKeychain() {
        SecItemDelete(keychainBaseQuery() as CFDictionary)
    }

    // MARK: - NSException helpers

    /// Run `block` and log + swallow any Objective-C NSException it raises.
    /// Use for Foundation calls (`NSUbiquitousKeyValueStore` here) that can
    /// raise NSException under stale-entitlement / iCloud-daemon-misbehaving
    /// conditions — Swift's `do/catch` doesn't catch those, so without this
    /// shim they tear down the app.
    private func safelyInvoke(_ context: String, _ block: () -> Void) {
        if let error = ObjCExceptionCatcher.catchException(block) {
            Logger.error("recovery-hint NSException caught at \(context): \(error.localizedDescription)")
        }
    }

    /// Value-returning variant. Returns `defaultValue` if the block raises.
    private func safelyInvoke<T>(
        _ context: String,
        default defaultValue: T,
        _ block: () -> T
    ) -> T {
        var result = defaultValue
        if let error = ObjCExceptionCatcher.catchException({ result = block() }) {
            Logger.error("recovery-hint NSException caught at \(context): \(error.localizedDescription)")
            return defaultValue
        }
        return result
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
