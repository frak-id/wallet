import Foundation

/// One event, exactly as it will be sent.
struct QueuedEvent: Codable, Sendable, Hashable {
    /// Stamped once at capture and reused across every retry, so the backend can dedupe
    /// what the network made us send twice.
    let idempotencyKey: String
    let path: String
    /// The serialised request body, built once at capture time and never rebuilt: a retry
    /// must report when the user acted, not when the network came back.
    let body: String
    /// The anonymous id the event was captured under, which is not necessarily the current
    /// one. Nil sends no `x-frak-client-id` header at all.
    let clientId: String?
    let capturedAt: Date
    /// How many times the backend has permanently rejected this event.
    let failures: Int

    // Short keys: this file is appended to on every interaction and is the SDK's only
    // unbounded on-disk footprint.
    enum CodingKeys: String, CodingKey {
        case idempotencyKey = "k"
        case path = "p"
        case body = "b"
        case clientId = "c"
        case capturedAt = "t"
        case failures = "f"
    }

    init(idempotencyKey: String, path: String, body: String, clientId: String?, capturedAt: Date, failures: Int = 0) {
        self.idempotencyKey = idempotencyKey
        self.path = path
        self.body = body
        self.clientId = clientId
        self.capturedAt = capturedAt
        self.failures = failures
    }

    func withFailure() -> QueuedEvent {
        QueuedEvent(
            idempotencyKey: idempotencyKey,
            path: path,
            body: body,
            clientId: clientId,
            capturedAt: capturedAt,
            failures: failures + 1
        )
    }
}

/// An append-only JSONL file of events waiting to be sent.
///
/// Durable rather than in-memory because an event recorded only on a successful response is
/// lost to every tunnel, every airplane-mode moment and every process kill — and iOS will
/// suspend a host app while the OS share sheet is up, which is exactly when a `sharing`
/// event is in flight.
///
/// One line per event so a kill mid-write costs the torn tail and nothing before it.
actor EventQueue {
    /// Past this, an event is too old to attribute anything.
    static let maxAge: TimeInterval = 14 * 24 * 60 * 60
    /// A cap on the file, enforced on read. The oldest go first.
    static let maxEvents = 1000

    static let fileName = "frak-events.jsonl"

    // Unix milliseconds, stated rather than inherited: the default would write seconds since
    // the Apple reference date, which is a private format by accident rather than by choice.
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return encoder
    }()
    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .millisecondsSince1970
        return decoder
    }()

    private let fileURL: URL
    private let logger: FrakLogger

    init(fileURL: URL, logger: FrakLogger) {
        self.fileURL = fileURL
        self.logger = logger
    }

    /// The SDK's own directory under Application Support, excluded from backup so queued
    /// events are never replayed onto a restored device that is no longer the same user.
    ///
    /// Falls back to the temporary directory rather than failing: a queue that does not
    /// survive a restart still beats losing every event this session captures.
    static func defaultFileURL(logger: FrakLogger) -> URL {
        let manager = FileManager.default
        do {
            let support = try manager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            var directory = support.appendingPathComponent("id.frak.sdk", isDirectory: true)
            try manager.createDirectory(at: directory, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try directory.setResourceValues(values)
            return directory.appendingPathComponent(fileName, isDirectory: false)
        } catch {
            logger.warn("Frak could not prepare a durable event queue; it will not survive a restart.", error)
            return manager.temporaryDirectory.appendingPathComponent(fileName, isDirectory: false)
        }
    }

    /// Every event still worth sending, oldest first. Expired and over-cap rows are dropped
    /// here rather than on write, so one pass enforces both bounds.
    func read(now: Date) -> [QueuedEvent] {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
        guard let data = try? Data(contentsOf: fileURL) else {
            // Present but unreadable. Left alone it would make tracking permanently and
            // silently inert, since every later read returns the same nothing.
            logger.warn("Could not read the event queue; dropping it.")
            delete()
            return []
        }
        let events =
            String(decoding: data, as: UTF8.self)
            .split(separator: "\n")
            // A truncated last line is expected after a kill, not a corruption to report.
            .compactMap { try? Self.decoder.decode(QueuedEvent.self, from: Data($0.utf8)) }
            .filter { now.timeIntervalSince($0.capturedAt) <= Self.maxAge }
        return events.count > Self.maxEvents ? Array(events.suffix(Self.maxEvents)) : events
    }

    /// A failed append is a lost event, never a crash: nothing a merchant called is failing.
    func append(_ event: QueuedEvent) {
        do {
            try createDirectory()
            let line = try Self.encoder.encode(event) + Data("\n".utf8)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                let handle = try FileHandle(forWritingTo: fileURL)
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: line)
            } else {
                try line.write(to: fileURL, options: .atomic)
            }
        } catch {
            logger.warn("Could not enqueue an event", error)
        }
    }

    /// Rewrites the queue to exactly `events`. Atomic: a kill mid-write leaves the previous
    /// file intact rather than a half-queue.
    func replace(_ events: [QueuedEvent]) {
        guard !events.isEmpty else {
            delete()
            return
        }
        do {
            try createDirectory()
            var out = Data()
            for event in events {
                out += try Self.encoder.encode(event) + Data("\n".utf8)
            }
            try out.write(to: fileURL, options: .atomic)
        } catch {
            logger.warn("Could not compact the event queue", error)
        }
    }

    func clear() {
        delete()
    }

    /// Drops `delivered`, applies `retried`, and rewrites the file — in one hop.
    ///
    /// Not `read` then `replace` from the caller: those are two hops, and an event appended
    /// between them would be read by neither and erased by the second. That window is the one
    /// place a durable queue must not have one.
    func reconcile(delivered: Set<String>, retried: [String: QueuedEvent], now: Date) {
        replace(
            read(now: now)
                .filter { !delivered.contains($0.idempotencyKey) }
                .map { retried[$0.idempotencyKey] ?? $0 }
        )
    }

    private func delete() {
        try? FileManager.default.removeItem(at: fileURL)
    }

    /// `Data.write(to:)` does not create intermediate directories, and the queue is handed a
    /// path rather than making one up.
    private func createDirectory() throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
    }
}
