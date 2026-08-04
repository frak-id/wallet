import Foundation
import Testing

@testable import FrakSDK

@Suite("EventQueue")
struct EventQueueTests {
    private static let now = Date(timeIntervalSince1970: 1_709_654_400)

    /// A queue in a directory that does not exist yet, so creating it is part of the test.
    private func makeQueue() -> (queue: EventQueue, fileURL: URL) {
        let fileURL =
            FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent("events", isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        return (EventQueue(fileURL: fileURL, logger: FrakLogger(level: .none)), fileURL)
    }

    private func event(_ key: String, capturedAt: Date = EventQueueTests.now) -> QueuedEvent {
        QueuedEvent(
            idempotencyKey: key,
            path: "/user/track/interaction",
            body: #"{"type":"sharing"}"#,
            clientId: "client",
            capturedAt: capturedAt
        )
    }

    /// Writes a raw pre-migration line: every current field except `"r"`, which never existed.
    private func appendPreMigrationLine(_ key: String, to fileURL: URL, capturedAt: Date = EventQueueTests.now) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let millis = Int64((capturedAt.timeIntervalSince1970 * 1000).rounded())
        let object: [String: Any] = [
            "k": key,
            "p": "/user/track/interaction",
            "b": #"{"type":"sharing"}"#,
            "c": "client",
            "t": millis,
            "f": 0,
        ]
        let line = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) + Data("\n".utf8)
        if FileManager.default.fileExists(atPath: fileURL.path) {
            let handle = try FileHandle(forWritingTo: fileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: line)
        } else {
            try line.write(to: fileURL, options: .atomic)
        }
    }

    @Test("round-trips events in order, creating the directory it needs")
    func roundTripsInOrder() async {
        let (queue, _) = makeQueue()
        await queue.append(event("a"))
        await queue.append(event("b"))

        let read = await queue.read(now: Self.now)
        #expect(read.map(\.idempotencyKey) == ["a", "b"])
        #expect(read.first?.body == #"{"type":"sharing"}"#)
    }

    @Test("survives a torn tail")
    func survivesATornTail() async throws {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        let handle = try FileHandle(forWritingTo: fileURL)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data(#"{"k":"b","p":"/user/tra"#.utf8))
        try handle.close()

        let read = await queue.read(now: Self.now)
        #expect(read.map(\.idempotencyKey) == ["a"])
    }

    @Test("sweeps a torn tail off disk instead of re-reading it forever")
    func sweepsATornTail() async throws {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        let handle = try FileHandle(forWritingTo: fileURL)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data(#"{"k":"b","p":"/user/tra"#.utf8))
        try handle.close()

        _ = await queue.read(now: Self.now)

        let lines =
            try String(contentsOf: fileURL, encoding: .utf8)
            .split(separator: "\n")
            .filter { !$0.allSatisfy(\.isWhitespace) }
        #expect(lines.count == 1)
        let second = await queue.read(now: Self.now)
        #expect(second.map(\.idempotencyKey) == ["a"])
    }

    @Test("drops events past the age bound")
    func dropsExpiredEvents() async {
        let (queue, _) = makeQueue()
        await queue.append(event("stale", capturedAt: Self.now.addingTimeInterval(-EventQueue.maxAge - 1)))
        await queue.append(event("fresh"))

        let read = await queue.read(now: Self.now)
        #expect(read.map(\.idempotencyKey) == ["fresh"])
    }

    @Test("drops the oldest past the count bound")
    func dropsTheOldestPastTheCountBound() async {
        let (queue, _) = makeQueue()
        for index in 0..<(EventQueue.maxEvents + 5) {
            await queue.append(event("e\(index)"))
        }

        let read = await queue.read(now: Self.now)
        #expect(read.count == EventQueue.maxEvents)
        #expect(read.first?.idempotencyKey == "e5")
    }

    @Test("compacts to exactly what it was handed")
    func compactsToWhatItWasHanded() async {
        let (queue, _) = makeQueue()
        await queue.append(event("a"))
        await queue.append(event("b"))

        let kept = Array(await queue.read(now: Self.now).dropFirst())
        await queue.replace(kept)

        let read = await queue.read(now: Self.now)
        #expect(read.map(\.idempotencyKey) == ["b"])
    }

    @Test("deletes the file when nothing is left, and reads an absent file as empty")
    func deletesTheFileWhenEmpty() async {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        await queue.replace([])

        #expect(!FileManager.default.fileExists(atPath: fileURL.path))
        let read = await queue.read(now: Self.now)
        #expect(read.isEmpty)
    }

    @Test("preserves the failure count across a compaction")
    func preservesTheFailureCount() async {
        let (queue, _) = makeQueue()
        await queue.append(event("a"))

        await queue.replace(await queue.read(now: Self.now).map { $0.withFailure() })

        let read = await queue.read(now: Self.now)
        #expect(read.count == 1)
        #expect(read.first?.failures == 1)
    }

    @Test("rowId increases and never repeats, even for two events sharing an idempotencyKey")
    func rowIdIsMonotonicAndUnique() async {
        let (queue, _) = makeQueue()
        // Same idempotencyKey on purpose: it is not guaranteed unique, so rowId is what
        // disambiguates two such rows from each other.
        await queue.append(event("same-key"))
        await queue.append(event("same-key"))
        await queue.append(event("same-key"))

        let rowIds = await queue.read(now: Self.now).compactMap(\.rowId)
        #expect(rowIds == rowIds.sorted())
        #expect(Set(rowIds).count == rowIds.count)
    }

    @Test("rowId survives a reload from disk, seeded past the highest id already written")
    func rowIdSurvivesAReload() async throws {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        await queue.append(event("b"))
        let before = try #require(await queue.read(now: Self.now).compactMap(\.rowId).max())

        // A fresh instance simulates a process restart: no in-memory counter to inherit,
        // only what the last read/append left on disk.
        let reopened = EventQueue(fileURL: fileURL, logger: FrakLogger(level: .none))
        let reread = await reopened.read(now: Self.now).compactMap(\.rowId)
        #expect(reread == [0, 1])

        await reopened.append(event("c"))
        let afterAppend = await reopened.read(now: Self.now)
        let newRowId = try #require(afterAppend.last?.rowId)
        #expect(newRowId > before)
    }

    @Test("two events with the same idempotencyKey are reconciled independently by rowId")
    func reconcilesByRowIdNotByIdempotencyKey() async throws {
        let (queue, _) = makeQueue()
        await queue.append(event("dup"))
        await queue.append(event("dup"))
        let pending = await queue.read(now: Self.now)
        let first = try #require(pending.first?.rowId)
        let second = try #require(pending.last?.rowId)

        await queue.reconcile(delivered: [first], retried: [:], now: Self.now)

        let remaining = await queue.read(now: Self.now)
        #expect(remaining.compactMap(\.rowId) == [second])
        #expect(remaining.first?.idempotencyKey == "dup")
    }

    @Test("migrates a pre-2-7 file with no rowId field, assigning ids in on-disk order and persisting them")
    func migratesAPreExistingFileWithNoRowId() async throws {
        let (queue, fileURL) = makeQueue()
        try appendPreMigrationLine("old-a", to: fileURL, capturedAt: Self.now.addingTimeInterval(-1))
        try appendPreMigrationLine("old-b", to: fileURL, capturedAt: Self.now)

        let migrated = await queue.read(now: Self.now)
        #expect(migrated.map(\.idempotencyKey) == ["old-a", "old-b"])
        #expect(migrated.compactMap(\.rowId) == [0, 1])

        // A fresh instance, so nothing is cached: a second read must see the same
        // persisted ids rather than re-migrating and reassigning.
        let reopened = EventQueue(fileURL: fileURL, logger: FrakLogger(level: .none))
        let reread = await reopened.read(now: Self.now)
        #expect(reread.compactMap(\.rowId) == [0, 1])

        await reopened.append(event("new"))
        let afterAppend = await reopened.read(now: Self.now)
        #expect(afterAppend.last?.rowId == 2)
    }

    @Test("appending to a pre-2-7 file before it is ever read keeps the newest row's id highest")
    func appendBeforeFirstReadKeepsNewestHighest() async throws {
        let (queue, fileURL) = makeQueue()
        try appendPreMigrationLine("old-a", to: fileURL, capturedAt: Self.now.addingTimeInterval(-1))
        try appendPreMigrationLine("old-b", to: fileURL, capturedAt: Self.now)

        // No read() yet: append's own seed path (readExistingForSeed), not read's, must reserve
        // one id per un-migrated row ahead of it, or "new" would take id 0, the same id the
        // later migration in read() assigns to "old-a", making the newest row the lowest id.
        await queue.append(event("new"))

        let all = await queue.read(now: Self.now)
        let ids = all.compactMap(\.rowId)
        #expect(Set(ids).count == 3)
        #expect(all.map(\.idempotencyKey) == ["old-a", "old-b", "new"])
        #expect(all.max(by: { ($0.rowId ?? -1) < ($1.rowId ?? -1) })?.idempotencyKey == "new")
    }

    @Test("read still returns the true events when its migration rewrite fails to persist (2-7,5)")
    func readSurvivesAFailedMigrationRewrite() async throws {
        let (queue, fileURL) = makeQueue()
        try appendPreMigrationLine("old-a", to: fileURL, capturedAt: Self.now.addingTimeInterval(-1))
        try appendPreMigrationLine("old-b", to: fileURL, capturedAt: Self.now)

        // Obstructs the parent directory, not fileURL: `.atomic` writes a temp file into the
        // directory and renames it over fileURL, so a read-only parent blocks the write while
        // Data(contentsOf: fileURL) still succeeds. Obstructing fileURL itself instead would hit
        // a different branch (present but unreadable) than the non-durable path this test pins.
        try #require(getuid() != 0, "needs a non-root runner: 0o500 does not block root's write")
        let parent = fileURL.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: parent.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path) }

        // read() must not signal the failure via an empty array: that is indistinguishable from
        // "the queue is empty", and InteractionTracker.drain's bare `guard !pending.isEmpty`
        // would then treat a non-empty queue as having nothing to send. The durability signal
        // lives on EventQueue.reconcile instead.
        let migrated = await queue.read(now: Self.now)
        #expect(migrated.map(\.idempotencyKey) == ["old-a", "old-b"])

        // Ids are valid for this pass only: the rewrite never landed, so a fresh instance would
        // re-migrate from scratch and may assign different ones.
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path)
        let retried = await queue.read(now: Self.now)
        #expect(retried.map(\.idempotencyKey) == ["old-a", "old-b"])
    }

    @Test("reconcile refuses to compact the file when its read could not persist a migration (2-7,5)")
    func reconcileRefusesToCompactOnANonDurableRead() async throws {
        let (queue, fileURL) = makeQueue()
        try appendPreMigrationLine("old-a", to: fileURL, capturedAt: Self.now.addingTimeInterval(-1))
        try appendPreMigrationLine("old-b", to: fileURL, capturedAt: Self.now)
        // Preserved before the obstacle destroys the original: proves reconcile left the file
        // byte-for-byte alone rather than merely leaving *some* file with the same two keys.
        let original = try Data(contentsOf: fileURL)

        // Obstruct the parent directory's write permission, not fileURL itself, so the read
        // reconcile starts from succeeds and only the write fails.
        try #require(getuid() != 0, "needs a non-root runner: 0o500 does not block root's write")
        let parent = fileURL.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: parent.path)
        // defer, not a trailing restore: a throwing #expect below must not leave the temp
        // directory unwritable for the rest of the suite.
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path) }

        await queue.reconcile(delivered: [], retried: [:], now: Self.now)

        // Must equal the original bytes: a non-durable read must refuse to compact, or the
        // next drain would wipe events whose migration ids never persisted.
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path)
        let onDisk = try Data(contentsOf: fileURL)
        #expect(onDisk == original)
        let read = await queue.read(now: Self.now)
        #expect(read.map(\.idempotencyKey) == ["old-a", "old-b"])
    }

    @Test("the outbound wire body never contains a row id field")
    func wireBodyNeverContainsRowId() async throws {
        let (queue, _) = makeQueue()
        await queue.append(event("wire-check"))
        let stored = try #require(await queue.read(now: Self.now).first)

        #expect(!stored.body.contains("\"r\":"))
    }

    @Test("bounds the file from append alone, without a read ever running (2.6)")
    func boundsTheFileFromAppendAlone() async throws {
        let (queue, fileURL) = makeQueue()
        // No read() call in this test: append alone must bound the file, since a backing-off
        // drain returns before it ever reads.
        let overflow = EventQueue.maxEvents + EventQueue.maxEventsSlack + 1
        for index in 0..<overflow {
            await queue.append(event("e\(index)"))
        }

        let onDisk =
            try String(contentsOf: fileURL, encoding: .utf8)
            .split(separator: "\n")
            .count
        #expect(onDisk <= EventQueue.maxEvents + EventQueue.maxEventsSlack)
    }

    @Test("the trim keeps the newest events and their id order")
    func trimKeepsTheNewestEvents() async throws {
        let (queue, _) = makeQueue()
        let overflow = EventQueue.maxEvents + EventQueue.maxEventsSlack + 1
        for index in 0..<overflow {
            await queue.append(event("e\(index)"))
        }

        let kept = await queue.read(now: Self.now)
        #expect(kept.last?.idempotencyKey == "e\(overflow - 1)")
        #expect(kept.count == EventQueue.maxEvents)
        // The append-time trim must not disturb id ordering: ids ascend with capture order so
        // reconcile can key deletions on them.
        let ids = kept.compactMap(\.rowId)
        #expect(ids == ids.sorted())
    }

    @Test("reconcile leaves the file untouched when nothing was delivered or retried (4.4)")
    func reconcileSkipsTheWriteWhenNothingChanged() async throws {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        await queue.append(event("b"))
        let before = try Data(contentsOf: fileURL)
        // Backdated by an hour: a skipped rewrite and a performed one produce byte-identical
        // content, so only the modification date can tell them apart, and backdating avoids a
        // race against filesystem timestamp granularity that comparing against `now` would have.
        let backdated = Date(timeIntervalSinceNow: -3600)
        try FileManager.default.setAttributes([.modificationDate: backdated], ofItemAtPath: fileURL.path)

        // Skipping the rewrite is safe because read() has already persisted anything it changed.
        await queue.reconcile(delivered: [], retried: [:], now: Self.now)

        #expect(try Data(contentsOf: fileURL) == before)
        let stamped =
            try FileManager.default
            .attributesOfItem(atPath: fileURL.path)[.modificationDate] as? Date
        #expect(stamped?.timeIntervalSince1970 == backdated.timeIntervalSince1970)
        let kept = await queue.read(now: Self.now)
        #expect(kept.map(\.idempotencyKey) == ["a", "b"])
    }

    @Test("reconcile still rewrites when a row was retried in place")
    func reconcileWritesWhenARowWasRetried() async throws {
        let (queue, _) = makeQueue()
        await queue.append(event("a"))
        let queued = try #require(await queue.read(now: Self.now).first)
        let rowId = try #require(queued.rowId)

        // A retry replaces a row without changing the row count, so the write-skip cannot key
        // on count alone.
        await queue.reconcile(delivered: [], retried: [rowId: queued.withFailure()], now: Self.now)

        let kept = await queue.read(now: Self.now)
        #expect(kept.first?.failures == 1)
    }

    // FileProtectionType is unavailable on macOS, the only host this target is verified on;
    // applyProtection() is a no-op there, so there is nothing to assert.
    #if canImport(UIKit)
        @Test("protects the file so it is unreadable before first unlock (S3)")
        func protectsTheFile() async throws {
            let (queue, fileURL) = makeQueue()
            await queue.append(event("a"))

            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            #expect(attributes[.protectionKey] as? FileProtectionType == .completeUntilFirstUserAuthentication)
        }

        @Test("keeps the file protected after a compaction")
        func protectsTheFileAfterCompaction() async throws {
            let (queue, fileURL) = makeQueue()
            await queue.append(event("a"))
            await queue.append(event("b"))
            await queue.replace(await queue.read(now: Self.now))

            let attributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
            #expect(attributes[.protectionKey] as? FileProtectionType == .completeUntilFirstUserAuthentication)
        }
    #endif
}
