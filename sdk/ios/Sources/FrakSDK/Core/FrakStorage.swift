import Foundation

/// The SDK's own directory under Application Support, excluded from backup so nothing it holds
/// is cloned onto a restored device.
enum FrakStorage {
    static let directoryName = "id.frak.sdk"

    /// Throws rather than degrading, because the two callers want opposite failure policies: the
    /// event queue falls back to `tmp`, the identity store must not — `tmp` is purgeable, and an
    /// identity that silently churns reports every purge as a brand-new user.
    ///
    /// The exclusion goes on the directory, which covers the whole subtree, so a file added here
    /// later cannot forget to set it. Idempotent, so callers need no ordering between them.
    static func directory() throws -> URL {
        let manager = FileManager.default
        let support = try manager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        var directory = support.appendingPathComponent(directoryName, isDirectory: true)
        try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        return directory
    }
}
