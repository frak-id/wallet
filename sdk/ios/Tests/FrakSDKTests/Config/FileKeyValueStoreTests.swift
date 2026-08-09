import Foundation
import Testing

@testable import FrakSDK

@Suite("FileKeyValueStore")
struct FileKeyValueStoreTests {
    /// A directory per test, torn down after: these touch the real filesystem, which is the
    /// point — the whole type exists for what the filesystem does to the file.
    private func withTemporaryStore(
        _ body: (FileKeyValueStore, URL) throws -> Void
    ) throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("frak-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let fileURL = directory.appendingPathComponent(FileKeyValueStore.fileName, isDirectory: false)
        try body(FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none)), fileURL)
    }

    @Test("round-trips a value through get, set, and remove")
    func roundTripsAValue() throws {
        try withTemporaryStore { store, _ in
            #expect(store.string(forKey: "k") == nil)
            store.set("v", forKey: "k")
            #expect(store.string(forKey: "k") == "v")
            store.removeValue(forKey: "k")
            #expect(store.string(forKey: "k") == nil)
        }
    }

    /// The reason this type exists at all: the value has to come back after the process that
    /// wrote it is gone, which a second instance over the same URL stands in for.
    @Test("a second store over the same file reads the value back")
    func persistsAcrossInstances() throws {
        try withTemporaryStore { store, fileURL in
            store.set("v", forKey: "k")

            let reopened = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(reopened.string(forKey: "k") == "v")
        }
    }

    @Test("keys are independent across writes")
    func keepsOtherKeys() throws {
        try withTemporaryStore { store, fileURL in
            store.set("1", forKey: "a")
            store.set("2", forKey: "b")
            store.removeValue(forKey: "a")

            let reopened = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(reopened.string(forKey: "a") == nil)
            #expect(reopened.string(forKey: "b") == "2")
        }
    }

    /// Matches `PersistedDeviceKeyStore`'s policy for material it cannot use: replace, never
    /// refuse. A store that threw here would brick an install over a truncated write.
    @Test("an unreadable file reads as empty and is replaced by the next write")
    func replacesAnUnreadableFile() throws {
        try withTemporaryStore { store, fileURL in
            try Data("not json".utf8).write(to: fileURL)

            #expect(store.string(forKey: "k") == nil)
            store.set("v", forKey: "k")

            let reopened = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(reopened.string(forKey: "k") == "v")
        }
    }

    @Test("reads survive an absent file")
    func toleratesAnAbsentFile() throws {
        try withTemporaryStore { store, fileURL in
            #expect(store.string(forKey: "k") == nil)
            #expect(!FileManager.default.fileExists(atPath: fileURL.path))
        }
    }
}

/// Separate suite: this asserts on `FrakStorage`'s real location, not an injected temporary one.
@Suite("FrakStorage")
struct FrakStorageTests {
    /// The load-bearing assertion of the whole identity-storage change. If this attribute is ever
    /// lost, a restore clones the installation's identity onto the new device (finding 3.3) and
    /// nothing else in the suite would notice.
    @Test("the SDK directory is excluded from backup")
    func directoryIsExcludedFromBackup() throws {
        let directory = try FrakStorage.directory()

        let values = try directory.resourceValues(forKeys: [.isExcludedFromBackupKey])
        #expect(values.isExcludedFromBackup == true)
    }

    /// Called from both the event queue and the identity store, in no fixed order.
    @Test("preparing the directory twice is idempotent")
    func isIdempotent() throws {
        let first = try FrakStorage.directory()
        let second = try FrakStorage.directory()

        #expect(first == second)
        #expect(try second.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
    }
}
