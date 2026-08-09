import Foundation

struct QueuedEvent: Codable, Sendable, Hashable {
    /// Stamped once at capture, reused across every retry; lets the backend dedupe a request sent twice.
    let idempotencyKey: String
    let path: String
    /// Built once at capture time and never rebuilt: a retry must report when the user acted, not when the network came back.
    let body: String
    /// Anonymous id the event was captured under, not necessarily the current one. Nil omits the `x-frak-client-id` header.
    let clientId: String?
    let capturedAt: Date
    /// How many times the backend has permanently rejected this event.
    let failures: Int
    /// Local row id, assigned once at enqueue, never sent on the wire. Reconciliation deletes by this, not by `idempotencyKey`, which callers can supply and isn't guaranteed unique. Nil only for a row an old-format file wrote before this field existed.
    let rowId: Int64?

    // Short keys: this file grows unboundedly on disk.
    enum CodingKeys: String, CodingKey {
        case idempotencyKey = "k"
        case path = "p"
        case body = "b"
        case clientId = "c"
        case capturedAt = "t"
        case failures = "f"
        case rowId = "r"
    }

    init(
        idempotencyKey: String,
        path: String,
        body: String,
        clientId: String?,
        capturedAt: Date,
        failures: Int = 0,
        rowId: Int64? = nil
    ) {
        self.idempotencyKey = idempotencyKey
        self.path = path
        self.body = body
        self.clientId = clientId
        self.capturedAt = capturedAt
        self.failures = failures
        self.rowId = rowId
    }

    // Explicit decode: `"r"` is absent on rows an old-format file wrote; decodeIfPresent reads
    // that as nil instead of failing the whole row.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        idempotencyKey = try container.decode(String.self, forKey: .idempotencyKey)
        path = try container.decode(String.self, forKey: .path)
        body = try container.decode(String.self, forKey: .body)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        capturedAt = try container.decode(Date.self, forKey: .capturedAt)
        failures = try container.decode(Int.self, forKey: .failures)
        rowId = try container.decodeIfPresent(Int64.self, forKey: .rowId)
    }

    func withFailure() -> QueuedEvent {
        QueuedEvent(
            idempotencyKey: idempotencyKey,
            path: path,
            body: body,
            clientId: clientId,
            capturedAt: capturedAt,
            failures: failures + 1,
            rowId: rowId
        )
    }

    /// Stamps the id after enqueue, or migrates an old-format row.
    func withRowId(_ newRowId: Int64) -> QueuedEvent {
        QueuedEvent(
            idempotencyKey: idempotencyKey,
            path: path,
            body: body,
            clientId: clientId,
            capturedAt: capturedAt,
            failures: failures,
            rowId: newRowId
        )
    }
}

/// An append-only JSONL file of events waiting to be sent, one line per event so a kill
/// mid-write only costs the torn tail.
///
/// Durable rather than in-memory: iOS can suspend the host app while the share sheet is up,
/// which is exactly when a `sharing` event is in flight.
///
/// Every row gets an SDK-owned, monotonically increasing `rowId`, assigned here and seeded
/// from the highest id already on disk so ids stay monotonic across a restart. A file written
/// before `rowId` existed gets ids assigned and persisted on first read.
///
/// File I/O runs synchronously inside the actor: making these methods `async` would let
/// `append` interleave with `reconcile`/`read` and reopen the race they close.
actor EventQueue {
    /// Past this, an event is too old to attribute anything.
    static let maxAge: TimeInterval = 14 * 24 * 60 * 60
    /// Cap on the file; oldest rows are dropped first. Enforced by `readWithOutcome`, reached
    /// from `read` and from `append` once the file drifts `maxEventsSlack` past this.
    static let maxEvents = 1000

    /// How far past `maxEvents` the file may run before `append` trims it back. Bounds the
    /// on-disk ceiling to `maxEvents + maxEventsSlack` while amortising the O(N) rewrite over
    /// that many appends.
    static let maxEventsSlack = maxEvents / 10

    static let fileName = "frak-events.jsonl"

    // Explicit: the default strategy encodes seconds since the Apple reference date, not Unix time.
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
    /// Next id for a newly appended row. Nil until `seedRowIdIfNeeded` seeds it from disk, on
    /// the first `read` or `append`.
    private var nextRowId: Int64?

    /// Next id for a row an old-format file wrote with no `"r"` field, drawn from the low end
    /// of the block `seedRowIdIfNeeded` reserves so migrated and freshly appended rows never
    /// share an id.
    private var nextMigrationRowId: Int64?

    /// Row count on disk, not rows `read` returns. Lets `append` enforce `maxEvents` without
    /// reading the file on every call; if it ever drifts, only the trim timing is affected,
    /// never a lost row.
    private var liveRowCount: Int?

    /// Row count at which `append` runs a trim pass, re-armed from the count the last pass
    /// actually left on disk so a failed rewrite backs off instead of retrying every append.
    private var nextTrimAt = maxEvents + maxEventsSlack

    init(fileURL: URL, logger: FrakLogger) {
        self.fileURL = fileURL
        self.logger = logger
    }

    /// The SDK's own directory under Application Support, excluded from backup so queued
    /// events never replay onto a restored device that is no longer the same user.
    ///
    /// Falls back to the temporary directory rather than failing: a queue that does not
    /// survive a restart still beats losing every event this session captures. The identity
    /// store shares the directory but deliberately not this fallback — see `FrakStorage`.
    static func defaultFileURL(logger: FrakLogger) -> URL {
        do {
            return try FrakStorage.directory().appendingPathComponent(fileName, isDirectory: false)
        } catch {
            logger.warn("Frak could not prepare a durable event queue; it will not survive a restart.", error)
            return FileManager.default.temporaryDirectory.appendingPathComponent(fileName, isDirectory: false)
        }
    }

    /// Result of a read plus whether any rewrite it triggered actually landed on disk.
    /// `reconcile` must not compact against a non-durable read.
    private struct ReadOutcome {
        let events: [QueuedEvent]
        let durable: Bool
    }

    /// Every event still worth sending, oldest first. Expired and over-cap rows are dropped
    /// here, not on write.
    func read(now: Date) -> [QueuedEvent] {
        readWithOutcome(now: now).events
    }

    /// `read`'s body, also reached from `append` once the file passes `nextTrimAt`. The only
    /// place that trims, so seeding, migration and both bounds stay in one implementation.
    private func readWithOutcome(now: Date) -> ReadOutcome {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            liveRowCount = 0
            return ReadOutcome(events: [], durable: true)
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            // Present but unreadable: delete it so tracking doesn't go silently and
            // permanently inert. A failed delete leaves the count as-is; drift here only
            // delays a trim, it never loses a row.
            logger.warn("Could not read the event queue; dropping it.")
            delete()
            return ReadOutcome(events: [], durable: true)
        }
        // Explicit filter: `split` keeps whitespace-only lines. This count drives both the
        // trim trigger and the sweep condition below.
        let present =
            String(decoding: data, as: UTF8.self)
            .split(separator: "\n")
            .filter { !$0.allSatisfy(\.isWhitespace) }
        let decoded =
            present
            // A truncated last line is expected after a kill, not a corruption to report.
            .compactMap { try? Self.decoder.decode(QueuedEvent.self, from: Data($0.utf8)) }
        seedRowIdIfNeeded(from: decoded)

        // Captured before migration runs: if the rewrite below fails, the counter rolls back
        // to this so a later pass doesn't overrun into ids already handed to a fresh append.
        let migrationStart = nextMigrationRowId
        var migratedAny = false
        let migrated = decoded.map { event -> QueuedEvent in
            guard event.rowId == nil else { return event }
            migratedAny = true
            return event.withRowId(takeNextMigrationRowId())
        }

        let events = migrated.filter { now.timeIntervalSince($0.capturedAt) <= Self.maxAge }
        let bounded = events.count > Self.maxEvents ? Array(events.suffix(Self.maxEvents)) : events

        // One rewrite covers migration, the age/count trim and unparseable rows; a steady-state
        // read with nothing to change costs only the read. `decoded.count != present.count`
        // catches a torn tail from a mid-write kill, which parses out of `decoded` but stays on
        // disk until swept here.
        if migratedAny || bounded.count != decoded.count || decoded.count != present.count {
            // A migration id is only real once it is durable: if the rewrite fails, the ids
            // just assigned exist nowhere but this call, and the next read starts migration
            // over from the un-rewritten file. Reported via `ReadOutcome.durable` rather than
            // an empty `events` array, so `reconcile` can refuse to compact instead of treating
            // a failed read as an empty queue.
            let durable = replace(bounded)
            if !durable { nextMigrationRowId = migrationStart }
            // On failure the file still holds whatever was on disk, valid or not, so the count
            // must describe that rather than the trim we failed to persist.
            if !durable { liveRowCount = present.count }
            return ReadOutcome(events: bounded, durable: durable)
        }

        // Nothing was rewritten, so the file still holds exactly what was read. Count the
        // lines rather than the returned events so this stays a description of the file.
        liveRowCount = present.count
        return ReadOutcome(events: bounded, durable: true)
    }

    /// A failed append is a lost event, never a crash: nothing a merchant called is failing.
    ///
    /// Appends one line; O(1) except roughly one append in `maxEventsSlack`, which also pays a
    /// trim pass. Enforced here rather than only on `read`, because a caller that only appends
    /// must not be able to grow the file forever while a backing-off drain never reads.
    ///
    /// Uses the event's own `capturedAt` as the trim's `now` rather than a fresh clock read;
    /// close enough for a day-scale age bound.
    func append(_ event: QueuedEvent) {
        do {
            if nextRowId == nil { seedRowIdIfNeeded(from: readExistingForSeed()) }
            let stamped = event.withRowId(takeNextRowId())
            try createDirectory()
            let line = try Self.encoder.encode(stamped) + Data("\n".utf8)
            let isNewFile = !FileManager.default.fileExists(atPath: fileURL.path)
            if isNewFile {
                try line.write(to: fileURL, options: .atomic)
            } else {
                let handle = try FileHandle(forWritingTo: fileURL)
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: line)
            }
            if isNewFile { applyProtection() }
            trimIfOverflowing(now: stamped.capturedAt)
        } catch {
            logger.warn("Could not enqueue an event", error)
        }
    }

    /// Runs a trim pass once the file has drifted `maxEventsSlack` past `maxEvents`, then
    /// re-arms from what that pass actually left on disk so a failed rewrite backs off instead
    /// of retrying every append.
    private func trimIfOverflowing(now: Date) {
        let count = (liveRowCount ?? 0) + 1
        liveRowCount = count
        guard count > nextTrimAt else { return }
        _ = readWithOutcome(now: now)
        nextTrimAt = max(Self.maxEvents, liveRowCount ?? Self.maxEvents) + Self.maxEventsSlack
    }

    /// Best-effort peek at the file for seeding `nextRowId` from `append`, without `read`'s bounds/migration logic.
    private func readExistingForSeed() -> [QueuedEvent] {
        guard FileManager.default.fileExists(atPath: fileURL.path), let data = try? Data(contentsOf: fileURL) else {
            return []
        }
        return
            String(decoding: data, as: UTF8.self)
            .split(separator: "\n")
            .compactMap { try? Self.decoder.decode(QueuedEvent.self, from: Data($0.utf8)) }
    }

    /// Idempotent. Reserves one id per row still awaiting migration, not just past the highest
    /// already stamped, so `append` can seed before `read` has ever run over an old-format
    /// file. `nextMigrationRowId` takes the bottom of that reservation and `nextRowId` the id
    /// above the whole block, so a fresh append never collides with a migration id and the
    /// newest row always carries the highest one.
    private func seedRowIdIfNeeded(from existing: [QueuedEvent]) {
        guard nextRowId == nil else { return }
        let highest = existing.compactMap(\.rowId).max() ?? -1
        // count(where:) needs iOS 18/macOS 15 (SwiftStdlib 6.0), above this package's iOS
        // 15/macOS 12 floor. filter(_:).count compiles on the actual floor.
        let unmigrated = existing.filter { $0.rowId == nil }.count
        nextMigrationRowId = highest + 1
        nextRowId = highest + 1 + Int64(unmigrated)
        // Same snapshot as the ids: seeding the count from a different read could arm the
        // trim against a file this instance never saw.
        if liveRowCount == nil { liveRowCount = existing.count }
    }

    /// `seedRowIdIfNeeded` must always run first on any path that reaches here; every caller does.
    private func takeNextRowId() -> Int64 {
        let id = nextRowId ?? 0
        nextRowId = id + 1
        return id
    }

    /// `seedRowIdIfNeeded` must always run first on any path that reaches here; `read` does.
    private func takeNextMigrationRowId() -> Int64 {
        let id = nextMigrationRowId ?? 0
        nextMigrationRowId = id + 1
        return id
    }

    /// Rewrites the queue to exactly `events`, atomically: a kill mid-write leaves the
    /// previous file intact rather than a half-queue.
    ///
    /// Returns whether the file now genuinely holds `events`, false on any failure, so a
    /// caller relying on durability (the migration pass in `read`) can refuse to trust ids
    /// that never made it to disk.
    @discardableResult
    func replace(_ events: [QueuedEvent]) -> Bool {
        guard !events.isEmpty else {
            // A failed delete must be reported as non-durable too, or a caller believes stale
            // rows are gone when they are still on disk.
            let stillExists = FileManager.default.fileExists(atPath: fileURL.path)
            return !stillExists || delete()
        }
        do {
            try createDirectory()
            var out = Data()
            for event in events {
                out += try Self.encoder.encode(event) + Data("\n".utf8)
            }
            try out.write(to: fileURL, options: .atomic)
            applyProtection()
            liveRowCount = events.count
            return true
        } catch {
            logger.warn("Could not compact the event queue", error)
            return false
        }
    }

    func clear() {
        delete()
    }

    /// Drops `delivered`, applies `retried`, and rewrites the file in one hop rather than
    /// `read` then `replace`: two hops would let an event appended between them be read by
    /// neither and erased by the rewrite.
    ///
    /// Keyed on `rowId`, not `idempotencyKey`, which a caller can supply and isn't guaranteed
    /// unique. Every row `read` returns has already been migrated to a non-nil `rowId`; a nil
    /// here is unreachable and is treated as "keep, unmodified".
    ///
    /// Refuses to compact when the read it started from was not durable: `delivered`/`retried`
    /// are keyed on ids from that read, and writing back could drop rows that never made it to
    /// disk, or write an empty file when the queue is not actually empty.
    ///
    /// Skips the write entirely when nothing changed, since `readWithOutcome` has already
    /// persisted anything it changed — when `changed` is false, `next` is byte-for-byte what
    /// is on disk right now.
    func reconcile(delivered: Set<Int64>, retried: [Int64: QueuedEvent], now: Date) {
        let outcome = readWithOutcome(now: now)
        guard outcome.durable else { return }
        let next =
            outcome.events
            .filter { event in
                guard let rowId = event.rowId else { return true }
                return !delivered.contains(rowId)
            }
            .map { event in
                guard let rowId = event.rowId else { return event }
                return retried[rowId] ?? event
            }
        // A retry replaces a row in place without changing the row count, so it's checked separately.
        let changed = !retried.isEmpty || next.count != outcome.events.count
        guard changed else { return }
        replace(next)
    }

    /// Returns whether the file is gone afterwards, so callers can tell a genuine removal from
    /// a swallowed failure.
    @discardableResult
    private func delete() -> Bool {
        do {
            try FileManager.default.removeItem(at: fileURL)
            liveRowCount = 0
            return true
        } catch {
            return !FileManager.default.fileExists(atPath: fileURL.path)
        }
    }

    /// `Data.write(to:)` does not create intermediate directories, and the queue is handed a
    /// path rather than making one up.
    private func createDirectory() throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
    }

    /// Readable only once the device has been unlocked at least once since boot, then stays
    /// readable: appropriate for a queue that must stay writable while the device is locked
    /// (an interaction can be tracked from a locked-screen share sheet) but must never be
    /// readable off a stolen, powered-off device. Best-effort: a failure here still leaves the
    /// write that just succeeded, so it is never escalated past a warning.
    ///
    /// `NSFileProtectionKey`/`FileProtectionType` are unavailable on macOS, which this package
    /// still builds and tests on; no-op there since there is no shipping product on that
    /// platform and no equivalent API to fall back to.
    private func applyProtection() {
        #if canImport(UIKit)
            do {
                try FileManager.default.setAttributes(
                    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                    ofItemAtPath: fileURL.path
                )
            } catch {
                logger.warn("Could not set the event queue's file protection class", error)
            }
        #endif
    }
}
