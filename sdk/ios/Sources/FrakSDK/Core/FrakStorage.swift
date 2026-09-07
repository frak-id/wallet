import Foundation

/// The SDK's own directory under Application Support, excluded from backup so nothing it holds
/// is cloned onto a restored device.
enum FrakStorage {
    static let directoryName = "id.frak.sdk"

    private static let lock = NSLock()
    nonisolated(unsafe) private static var prepared: URL?

    /// Throws rather than degrading: the event queue falls back to `tmp`, the identity store must
    /// not — `tmp` is purgeable, and an identity that churns reports every purge as a new user.
    ///
    /// The exclusion goes on the directory, so a file added later cannot forget it. Memoised:
    /// both callers run inside `Frak.initialize`, and three syscalls each is not free there.
    static func directory() throws -> URL {
        lock.lock()
        defer { lock.unlock() }
        if let prepared { return prepared }
        let directory = try prepare()
        prepared = directory
        return directory
    }

    private static func prepare() throws -> URL {
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
