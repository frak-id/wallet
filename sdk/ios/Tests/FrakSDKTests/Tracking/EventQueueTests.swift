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
