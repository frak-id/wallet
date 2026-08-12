import Foundation

/// `KeyValueStore` over one SDK-owned file, for the values that must not reach a restored
/// device: the device key and the merchant marker guarding it.
///
/// `TrackingConsent` deliberately does NOT live here. A denial that evaporates on a device
/// migration silently re-enables tracking on the new phone, so the consent decision wants the
/// backup this type exists to avoid — it stays in `UserDefaultsStore`.
///
/// A file rather than another `UserDefaults` suite because a suite plist cannot be held out of a
/// backup: `cfprefsd` reallocates the inode on every flush, so an exclusion set on the plist does
/// not survive the next write. `FrakStorage` carries it on the directory instead.
final class FileKeyValueStore: KeyValueStore, @unchecked Sendable {
    static let fileName = "identity.json"

    private let fileURL: URL
    private let logger: FrakLogger

    private let lock = NSLock()
    /// Nil until the first access reads the file, matching the Kotlin twin: construction happens
    /// under `Frak.initialize`, which does no I/O.
    private var values: [String: String]?
    /// Set when the file exists but could not be read; cleared by the next successful read.
    private var unreadable = false

    var isReadable: Bool {
        lock.lock()
        defer { lock.unlock() }
        _ = loaded()
        return !unreadable
    }

    init(fileURL: URL, logger: FrakLogger) {
        self.fileURL = fileURL
        self.logger = logger
    }

    /// Nil when the SDK's directory cannot be prepared. Nil rather than an unexcluded or
    /// purgeable fallback: either would resurrect the bug this type exists to fix.
    static func makeDefault(logger: FrakLogger) -> FileKeyValueStore? {
        guard let directory = try? FrakStorage.directory() else { return nil }
        return FileKeyValueStore(
            fileURL: directory.appendingPathComponent(fileName, isDirectory: false),
            logger: logger
        )
    }

    func string(forKey key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return loaded()[key]
    }

    func set(_ value: String, forKey key: String) {
        mutate { $0[key] = value }
    }

    /// An erasure must never be the operation that silently fails: refusing it would leave the
    /// old identity on disk and hand it back at the next unlock, undoing a user's "forget me".
    /// The whole file goes when it cannot be read, which errs toward erasing more than asked —
    /// the safe direction for a request to erase, and the only one available without a readable
    /// dict to remove a single key from.
    func removeValue(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        var next = loaded()
        guard !unreadable else {
            try? FileManager.default.removeItem(at: fileURL)
            // Cleared, not marked absent: the next read re-derives both from the empty directory.
            values = nil
            return
        }
        next.removeValue(forKey: key)
        values = next
        write(next)
    }

    /// The memo keeps the change even when the write fails, so this session stays consistent with
    /// the key it is actually signing with; the next launch mints a fresh one.
    private func mutate(_ change: (inout [String: String]) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        var next = loaded()
        // A write built on an unreadable file would persist a dict missing every key it could not
        // see, replacing a healthy identity with whatever this session happened to set.
        guard !unreadable else {
            logger.warn("Frak's identity store is not readable yet; leaving it untouched.")
            return
        }
        change(&next)
        values = next
        write(next)
    }

    private func loaded() -> [String: String] {
        if let values { return values }
        let read = read()
        unreadable = read == nil
        // An unreadable file is not memoised: it becomes readable at first unlock, and this
        // session has to be able to see it then.
        guard let read else { return [:] }
        values = read
        return read
    }

    /// Nil when the file exists but cannot be read right now. A corrupt file still reads as empty,
    /// matching `PersistedDeviceKeyStore`'s policy for material it cannot use.
    private func read() -> [String: String]? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [:] }
        do {
            return try JSONDecoder().decode([String: String].self, from: Data(contentsOf: fileURL))
        } catch let error as CocoaError where error.code == .fileReadNoPermission {
            // Before first unlock the protection class holds, and the identity on disk is intact.
            // Minting over it is how a healthy install loses its anonymous id for good.
            logger.warn("Frak's identity store is unreadable until this device is first unlocked.", error)
            return nil
        } catch {
            logger.warn("Frak could not read its identity store; a fresh identity will be minted.", error)
            return [:]
        }
    }

    /// Never logs a value: one of them is a private key.
    private func write(_ values: [String: String]) {
        do {
            try JSONEncoder().encode(values).write(to: fileURL, options: .atomic)
            applyProtection()
        } catch {
            logger.error("Frak could not persist its identity store; this identity will not survive a relaunch.", error)
        }
    }

    /// Reapplied after every write because `.atomic` replaces the file rather than rewriting it,
    /// so the class does not carry over. `afterFirstUnlock`, matching the enclave key's own access
    /// control: the SDK signs from background work, with no user present and the screen possibly
    /// locked.
    ///
    /// `FileProtectionType` is unavailable on macOS, which this package still builds and tests on;
    /// no-op there, as in `EventQueue`.
    private func applyProtection() {
        #if canImport(UIKit)
            do {
                try FileManager.default.setAttributes(
                    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                    ofItemAtPath: fileURL.path
                )
            } catch {
                logger.warn("Could not set the identity store's file protection class", error)
            }
        #endif
    }
}
