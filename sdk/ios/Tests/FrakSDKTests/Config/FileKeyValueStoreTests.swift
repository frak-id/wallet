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

    /// Matches `PersistedDeviceKeyStore`: replace material it cannot use, never refuse.
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

    /// Before first unlock the file is intact but unreadable; reading it as empty mints over it.
    @Test("an unreadable file is never overwritten, and reports itself unreadable")
    func unreadableFileIsLeftIntact() throws {
        try withTemporaryStore { store, fileURL in
            store.set("real-key-material", forKey: "device-key")
            try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: fileURL.path)
            defer {
                try? FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: fileURL.path)
            }

            let locked = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(locked.isReadable == false)
            // The write that would destroy it: a dict rebuilt from an empty read, missing the key.
            locked.set("marker", forKey: "merchant-marker")

            try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: fileURL.path)
            let unlocked = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(unlocked.string(forKey: "device-key") == "real-key-material")
            #expect(unlocked.string(forKey: "merchant-marker") == nil)
        }
    }

    /// Memoised, a session that started locked stays blind to the identity for its whole life.
    @Test("a store that was unreadable sees the file once it becomes readable")
    func unreadableIsNotMemoised() throws {
        try withTemporaryStore { store, fileURL in
            store.set("v", forKey: "k")
            try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: fileURL.path)

            let reopened = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(reopened.string(forKey: "k") == nil)

            try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: fileURL.path)
            #expect(reopened.string(forKey: "k") == "v")
        }
    }

    /// An absent file is a first launch, not a locked device: minting must still happen.
    @Test("an absent file reads as readable, so a first launch still mints")
    func absentFileIsReadable() throws {
        try withTemporaryStore { store, _ in
            #expect(store.isReadable)
        }
    }

    /// Refusing the write would leave a dead identity on disk to hand back at first unlock.
    @Test("an erasure still erases while the file is unreadable")
    func removalErasesEvenWhenUnreadable() throws {
        try withTemporaryStore { store, fileURL in
            store.set("real-key-material", forKey: "device-key")
            try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: fileURL.path)
            defer {
                try? FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: fileURL.path)
            }

            let locked = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            locked.removeValue(forKey: "device-key")

            #expect(FileManager.default.fileExists(atPath: fileURL.path) == false)
            let reopened = FileKeyValueStore(fileURL: fileURL, logger: FrakLogger(level: .none))
            #expect(reopened.string(forKey: "device-key") == nil)
        }
    }

}

/// Separate suite: this asserts on `FrakStorage`'s real location, not an injected temporary one.
@Suite("FrakStorage")
struct FrakStorageTests {
    /// Lose this attribute and a restore clones the installation's identity onto the new device.
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
