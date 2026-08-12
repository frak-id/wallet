import Foundation

/// A queued row: `payload` holds only kind-specific facts true at capture time and is opaque
/// JSON, not a typed model — see `RowBody.withMerchantId`.
struct QueuedRow: Codable, Sendable, Hashable {
    /// Bumped when a new `kind` is introduced; an unregistered kind is skipped by the drain, which
    /// breaks strict FIFO. A downgrade after a bump deletes rows a sweep cannot decode.
    static let currentSchemaVersion = 1

    var idempotencyKey: String
    /// A raw string, not a typed enum: adding a kind must not require touching every switch that reads a row.
    var kind: String
    var payload: String
    /// The anonymous id this was captured under; a sender's header must match it, not the current one.
    var clientId: String?
    /// Nil means "not resolved yet"; a sender resolves it at drain.
    var merchantId: String?
    var capturedAt: Date
    /// Permanent rejections so far. At the cap the row is dropped rather than blocking the queue.
    var failures: Int
    /// Local row id, never sent on the wire. Reconciliation deletes by this, not by `idempotencyKey`, which callers can supply and isn't guaranteed unique. Nil only for a row an old-format file wrote before this field existed.
    var rowId: Int64?
    /// When this row first held, ever — never cleared, so the hold budget measures total time stuck, not time since the last hold.
    var heldSince: Date?
    var schemaVersion: Int

    enum CodingKeys: String, CodingKey {
        case rowId = "r"
        case schemaVersion = "v"
        case kind
        case idempotencyKey = "k"
        case clientId = "c"
        case merchantId = "m"
        case capturedAt = "t"
        case failures = "f"
        case heldSince = "h"
        case payload
    }

    init(
        idempotencyKey: String,
        kind: String,
        payload: String,
        clientId: String?,
        merchantId: String?,
        capturedAt: Date,
        failures: Int = 0,
        rowId: Int64? = nil,
        heldSince: Date? = nil,
        schemaVersion: Int = QueuedRow.currentSchemaVersion
    ) {
        self.idempotencyKey = idempotencyKey
        self.kind = kind
        self.payload = payload
        self.clientId = clientId
        self.merchantId = merchantId
        self.capturedAt = capturedAt
        self.failures = failures
        self.rowId = rowId
        self.heldSince = heldSince
        self.schemaVersion = schemaVersion
    }

    // Explicit decode: `"r"`/`"m"`/`"h"` are absent on rows an older build wrote; decodeIfPresent
    // reads that as nil instead of failing the whole row. A `"v"` above currentSchemaVersion
    // throws, so the sweep in `EventQueue.read` drops that one line instead of misparsing it.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let version = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? Self.currentSchemaVersion
        guard version <= Self.currentSchemaVersion else {
            throw DecodingError.dataCorruptedError(
                forKey: .schemaVersion,
                in: container,
                debugDescription: "schema version \(version) is newer than \(Self.currentSchemaVersion)"
            )
        }
        schemaVersion = version
        idempotencyKey = try container.decode(String.self, forKey: .idempotencyKey)
        kind = try container.decode(String.self, forKey: .kind)
        payload = try container.decode(String.self, forKey: .payload)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        merchantId = try container.decodeIfPresent(String.self, forKey: .merchantId)
        capturedAt = try container.decode(Date.self, forKey: .capturedAt)
        failures = try container.decode(Int.self, forKey: .failures)
        rowId = try container.decodeIfPresent(Int64.self, forKey: .rowId)
        heldSince = try container.decodeIfPresent(Date.self, forKey: .heldSince)
    }

    func withFailure() -> QueuedRow {
        var copy = self
        copy.failures += 1
        return copy
    }

    /// Stamps the id after enqueue, or migrates an old-format row.
    func withRowId(_ newRowId: Int64) -> QueuedRow {
        var copy = self
        copy.rowId = newRowId
        return copy
    }

    /// A no-op if already stamped is the caller's job, not this one's.
    func withHeldSince(_ date: Date) -> QueuedRow {
        var copy = self
        copy.heldSince = date
        return copy
    }
}

/// An append-only JSONL file of events waiting to be sent, one line per event so a kill mid-write
/// only costs the torn tail. Durable rather than in-memory: iOS can suspend the host app while the
/// share sheet is up, which is exactly when a `sharing` event is in flight.
///
/// File I/O runs synchronously inside the actor — making these methods `async` would let `append`
/// interleave with `reconcile`/`read` and reopen the race they close.
actor EventQueue {
    /// Past this, an event is too old to attribute anything.
    static let maxAge: TimeInterval = 14 * 24 * 60 * 60
    /// Cap on the file; oldest rows are dropped first. Enforced by `readWithOutcome`, reached
    /// from `read` and from `append` once the file drifts `maxEventsSlack` past this.
    static let maxEvents = 1000

    /// How far past `maxEvents` the file may run before `append` trims it back, amortising the
    /// O(N) rewrite over that many appends.
    static let maxEventsSlack = maxEvents / 10

    static let fileName = "frak-events.jsonl"

    // Explicit: the default strategy encodes seconds since the Apple reference date, not Unix time.
    // sortedKeys: deterministic on-disk bytes, pinned by the golden fixtures in EventQueueTests.
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .millisecondsSince1970
        encoder.outputFormatting = .sortedKeys
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

    /// Id for a row an old-format file wrote with no `"r"` field, drawn from the low end of the
    /// block `seedRowIdIfNeeded` reserves, so migrated and fresh rows never share an id.
    private var nextMigrationRowId: Int64?

    /// Row count on disk, not rows `read` returns, so `append` can enforce `maxEvents` without
    /// reading the file. Drift costs trim timing, never a row.
    private var liveRowCount: Int?

    /// Row count at which `append` runs a trim pass, re-armed from the count the last pass
    /// actually left on disk so a failed rewrite backs off instead of retrying every append.
    private var nextTrimAt = maxEvents + maxEventsSlack

    init(fileURL: URL, logger: FrakLogger) {
        self.fileURL = fileURL
        self.logger = logger
    }

    /// The SDK's own directory under Application Support, excluded from backup so queued events
    /// never replay onto a restored device. Falls back to the temporary directory rather than
    /// failing; the identity store shares the directory but deliberately not that fallback.
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
        let events: [QueuedRow]
        let durable: Bool
    }

    /// Every event still worth sending, oldest first. Expired and over-cap rows are dropped
    /// here, not on write.
    func read(now: Date) -> [QueuedRow] {
        readWithOutcome(now: now).events
    }

    /// `read`'s body, also reached from `append` once the file passes `nextTrimAt`. The only
    /// place that trims, so seeding, migration and both bounds stay in one implementation.
    private func readWithOutcome(now: Date) -> ReadOutcome {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            liveRowCount = 0
            return ReadOutcome(events: [], durable: true)
        }
        let data: Data
        do {
            data = try Data(contentsOf: fileURL)
        } catch let error as CocoaError where error.code == .fileReadNoPermission {
            // Intact, just locked: this file carries the same protection class as the identity
            // store, so it is unreadable until the device's first unlock. Not durable, so
            // `reconcile` cannot compact against it, and emphatically not deleted — dropping a
            // backlog because the screen was locked is the loss this queue exists to prevent.
            logger.warn("The event queue is unreadable until this device is first unlocked.", error)
            return ReadOutcome(events: [], durable: false)
        } catch {
            // Present but unreadable: delete it so tracking doesn't go silently and
            // permanently inert. A failed delete leaves the count as-is; drift here only
            // delays a trim, it never loses a row.
            logger.warn("Could not read the event queue; dropping it.", error)
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
            .compactMap { try? Self.decoder.decode(QueuedRow.self, from: Data($0.utf8)) }
        seedRowIdIfNeeded(from: decoded)

        // Captured before migration runs: if the rewrite below fails, the counter rolls back
        // to this so a later pass doesn't overrun into ids already handed to a fresh append.
        let migrationStart = nextMigrationRowId
        var migratedAny = false
        let migrated = decoded.map { event -> QueuedRow in
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

    /// Appends one line; O(1) except roughly one append in `maxEventsSlack`, which also pays a
    /// trim pass. A failed append is a lost event, never a crash. The bound is enforced here and
    /// not only on `read`, or a caller that only appends could grow the file forever while a
    /// backing-off drain never reads. Trims against the event's own `capturedAt`, so there is no
    /// second clock to disagree with.
    func append(_ event: QueuedRow) {
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
    private func readExistingForSeed() -> [QueuedRow] {
        guard FileManager.default.fileExists(atPath: fileURL.path), let data = try? Data(contentsOf: fileURL) else {
            return []
        }
        return
            String(decoding: data, as: UTF8.self)
            .split(separator: "\n")
            .compactMap { try? Self.decoder.decode(QueuedRow.self, from: Data($0.utf8)) }
    }

    /// Idempotent. Reserves one id per row still awaiting migration, not just past the highest
    /// already stamped, so `append` can seed before `read` has ever run over an old-format
    /// file. `nextMigrationRowId` takes the bottom of that reservation and `nextRowId` the id
    /// above the whole block, so a fresh append never collides with a migration id and the
    /// newest row always carries the highest one.
    private func seedRowIdIfNeeded(from existing: [QueuedRow]) {
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
    func replace(_ events: [QueuedRow]) -> Bool {
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

    /// Drops `delivered`, applies `retried`, and rewrites the file in one hop: two hops would let
    /// an event appended between them be read by neither and erased by the rewrite.
    ///
    /// Keyed on `rowId`, not the caller-suppliable `idempotencyKey`. Refuses to compact when the
    /// read was not durable — writing back could drop rows that never reached disk, or empty a
    /// queue that is not empty.
    func reconcile(delivered: Set<Int64>, retried: [Int64: QueuedRow], now: Date) {
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

    /// Readable only once the device has been unlocked since boot, then stays readable: the queue
    /// must stay writable while locked (a share sheet can track from the lock screen) but never
    /// readable off a stolen, powered-off device. Best-effort — a failure here still leaves the
    /// write that just succeeded, so it never escalates past a warning.
    ///
    /// No-op on macOS, where `FileProtectionType` does not exist and nothing ships.
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
