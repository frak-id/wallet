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

    /// Writes a raw pre-2.7 line: every current field except `"r"`, which never existed.
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

        // The partial line is dropped from the parsed result on every read, but it also has to
        // leave the FILE. reconcile used to sweep it as a side effect of rewriting on every flush;
        // now that the rewrite is skipped when nothing changed, the read owns the sweep. Without it
        // the on-disk ceiling would bound only the valid rows and torn tails would accumulate past
        // it, one per mid-write kill.
        _ = await queue.read(now: Self.now)

        let lines =
            try String(contentsOf: fileURL, encoding: .utf8)
            .split(separator: "\n")
            .filter { !$0.allSatisfy(\.isWhitespace) }
        #expect(lines.count == 1)
        // Self-healing: having swept it, a second read finds nothing left to do.
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
        // Same idempotencyKey on purpose (2.7): a caller-suppliable key is not guaranteed
        // unique, and rowId is exactly what disambiguates two such rows from each other.
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

        // A fresh EventQueue instance over the same file simulates a process restart: there is
        // no in-memory counter to inherit, only what the last read/append left on disk.
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

        // Only the first is uploaded and reconciled away; a key-based reconcile would have
        // deleted both, or the wrong one, since they share an idempotencyKey.
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

        // Persisted, not just returned in memory: a second read (a fresh instance, so nothing
        // is cached) must see the same ids rather than re-migrating and reassigning.
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
        // one id per un-migrated row ahead of it — otherwise "new" would take id 0, the same id
        // the later migration in read() assigns to "old-a", and the newest row would carry the
        // LOWEST id instead of the highest.
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

        // Forces the atomic write in replace() to fail WITHOUT touching the readability of
        // fileURL itself: `.atomic` writes a temp file into the same directory and renames it
        // over fileURL, so a read-only PARENT directory blocks the write/rename while
        // Data(contentsOf: fileURL) still succeeds. Obstructing fileURL's own path instead (e.g.
        // replacing it with a directory) makes it unreadable, which is a DIFFERENT branch in
        // readWithOutcome (the "present but unreadable" branch, which deletes the file and
        // reports durable: true) — that would never exercise the non-durable path this test
        // exists to pin.
        // Mode bits are ignored for the superuser, so a root runner would write successfully and
        // never take the non-durable branch this test exists to pin.
        try #require(getuid() != 0, "needs a non-root runner: 0o500 does not block root's write")
        let parent = fileURL.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: parent.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path) }

        // read() must NOT signal the non-durable rewrite by returning an empty array: that would
        // be indistinguishable from "the queue is empty" to every caller, and
        // InteractionTracker.drain's bare `guard !pending.isEmpty` would then treat a genuinely
        // non-empty queue as having nothing to send. The durability signal lives out-of-band, on
        // EventQueue.reconcile alone — see the caller-path tests below.
        let migrated = await queue.read(now: Self.now)
        #expect(migrated.map(\.idempotencyKey) == ["old-a", "old-b"])

        // The ids themselves are real for this pass but not guaranteed to survive a restart: the
        // rewrite never landed, so a fresh instance re-migrates from scratch and may assign
        // different ones. Not asserted here — see "rowId survives a reload from disk" for the
        // durable-write case.
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

        // Same technique as readSurvivesAFailedMigrationRewrite above: obstruct the parent
        // directory's write permission, not fileURL itself, so the read that reconcile starts
        // from actually succeeds and the write is what fails.
        // Mode bits are ignored for the superuser, so a root runner would write successfully and
        // this test would report a false failure rather than the behaviour it pins.
        try #require(getuid() != 0, "needs a non-root runner: 0o500 does not block root's write")
        let parent = fileURL.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: parent.path)
        // defer, not a trailing restore: an #expect that throws below must not leave the temp
        // directory unwritable for the rest of the suite.
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path) }

        // The exact call InteractionTracker.drain makes after a fully-offline pass: reconcile
        // with nothing delivered.
        await queue.reconcile(delivered: [], retried: [:], now: Self.now)

        // Clearing the obstacle uncovers whatever reconcile left behind — which must be exactly
        // the original bytes, since a non-durable read must refuse to compact. Restoring
        // permissions and reading again is what proves the queue is exactly as it was: reconcile
        // must not compact against a read whose migration ids are not durable, or the very next
        // drain would silently wipe every event still on disk instead of retrying with fresh ids.
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

        // rowId lives only in QueuedEvent's own Codable envelope (the on-disk JSONL line) and
        // never in .body, which is exactly what InteractionTracker.flush sends as the POST payload.
        #expect(!stored.body.contains("\"r\":"))
    }

    @Test("bounds the file from append alone, without a read ever running (2.6)")
    func boundsTheFileFromAppendAlone() async throws {
        let (queue, fileURL) = makeQueue()
        // The cap used to be enforced only inside read(), and a drain that is backing off returns
        // before it reads. Appending is therefore the one path that must bound itself, or the file
        // grows without limit exactly while it cannot drain. No read() in this test.
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
        // Oldest dropped first: a fresh event is likelier to still matter.
        #expect(kept.last?.idempotencyKey == "e\(overflow - 1)")
        #expect(kept.count == EventQueue.maxEvents)
        // And the append-time trim must not disturb the invariant 2.7 bought: ids ascend with
        // capture order, so reconcile can key deletions on them.
        let ids = kept.compactMap(\.rowId)
        #expect(ids == ids.sorted())
    }

    @Test("reconcile leaves the file untouched when nothing was delivered or retried (4.4)")
    func reconcileSkipsTheWriteWhenNothingChanged() async throws {
        let (queue, fileURL) = makeQueue()
        await queue.append(event("a"))
        await queue.append(event("b"))
        let before = try Data(contentsOf: fileURL)
        // Backdated deliberately. A skipped rewrite and a performed one produce byte-identical
        // content here, so the modification date is the only thing that can tell them apart — and
        // comparing it against `now` makes the assertion a race with filesystem timestamp
        // granularity, which silently stopped failing once the surrounding suite got slower. An
        // hour in the past cannot be reached by a rewrite that would stamp it with `now`.
        let backdated = Date(timeIntervalSinceNow: -3600)
        try FileManager.default.setAttributes([.modificationDate: backdated], ofItemAtPath: fileURL.path)

        // The whole-file rewrite is the expensive half of a flush, and an offline pass delivers
        // nothing and retries nothing. Skipping it is safe only because read() has already
        // persisted anything it changed, so the reconciled list is byte-identical to disk.
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

        // A retry replaces a row without changing the row count, so the write-skip cannot key on
        // count alone.
        await queue.reconcile(delivered: [], retried: [rowId: queued.withFailure()], now: Self.now)

        let kept = await queue.read(now: Self.now)
        #expect(kept.first?.failures == 1)
    }

    // `.protectionKey`/`FileProtectionType` are `API_UNAVAILABLE(macos)`, and this test target
    // builds for the macOS triple on the only host this package is ever verified on (see
    // `EventQueue.applyProtection()`'s doc comment). There is nothing to assert on macOS since
    // `applyProtection()` is a no-op there.
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
