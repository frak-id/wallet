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
    /// SDK-owned, monotonically increasing, assigned once by `EventQueue` at enqueue and never
    /// by a caller (2.7). Reconciliation after a flush deletes by this id, not by
    /// `idempotencyKey`: a caller-suppliable `Interaction.custom(idempotencyKey:)` is not
    /// guaranteed unique, so two distinct queued rows could collide on it and a reconcile would
    /// then delete the wrong one, or both. `rowId` is never sent on the wire — see
    /// `InteractionTracker.interactionBody` — so it carries no backend meaning; it exists purely
    /// so this file can tell its own rows apart. `nil` only for a row an old-format file wrote
    /// before this field existed; see `EventQueue`'s migration note.
    let rowId: Int64?

    // Short keys: this file is appended to on every interaction and is the SDK's only
    // unbounded on-disk footprint.
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

    // Explicit rather than the synthesised memberwise decode: `"r"` is absent on every row an
    // old-format file wrote, and `decodeIfPresent` is how that reads as `nil` instead of failing
    // the whole row (which `mapCompact`-ing `try? decoder.decode` in `EventQueue.read` would turn
    // into silently dropping a pre-migration event rather than migrating it).
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

    /// Used only by `EventQueue`, to stamp the real id after enqueue or to migrate an old-format row.
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

/// An append-only JSONL file of events waiting to be sent.
///
/// Durable rather than in-memory because an event recorded only on a successful response is
/// lost to every tunnel, every airplane-mode moment and every process kill — and iOS will
/// suspend a host app while the OS share sheet is up, which is exactly when a `sharing`
/// event is in flight.
///
/// One line per event so a kill mid-write costs the torn tail and nothing before it.
///
/// `rowId` (2.7): every row gets an SDK-owned, monotonically increasing id, assigned here, never
/// by `InteractionTracker`. `nextRowId` is seeded lazily from the highest `rowId` this file has
/// ever held, so ids stay monotonic across a process restart without a separate counter file to
/// keep in sync with the queue itself.
///
/// Migration: a file written before this field existed has no `"r"` key on any row.
/// `QueuedEvent`'s decoder reads a missing key as `nil`, and the first `read` of such a file
/// assigns fresh ids in on-disk (oldest-first) order and rewrites the file through `replace` so
/// the assignment is durable immediately, not deferred to the next flush. No row and no event is
/// ever dropped for predating this field.
///
/// **The file I/O here is deliberately synchronous inside the actor (4.2).** It therefore runs on a
/// cooperative thread rather than being handed to a dedicated queue, which is a recorded, accepted
/// cost rather than an oversight:
///
/// - Making these methods `async` is not an option. An `await` anywhere inside `reconcile` or
///   `readWithOutcome` is an actor suspension point, and `InteractionTracker` calls `append` from a
///   separate task — that reopens byte-for-byte the interleaving window 2.7 closed, where an event
///   appended mid-reconcile is read by neither half and erased by the write.
/// - A `DispatchQueue`-backed `SerialExecutor` does compile at this package's iOS 15 floor, but only
///   through the *deprecated* `enqueue(_: UnownedJob)` requirement: `ExecutorJob` is iOS 17+. Taking
///   a deprecated concurrency-runtime conformance into a package that no CI builds, to remove a few
///   milliseconds of bounded I/O, is the worse trade.
/// - What is actually blocked is bounded and short: one `Data(contentsOf:)` of at most
///   `maxEvents + maxEventsSlack` short lines, and a write only when something changed. No lock, no
///   socket, no unbounded wait — a latency cost, not a liveness hazard.
///
/// When the deployment floor reaches iOS 17 this becomes three lines (`nonisolated var
/// unownedExecutor` over a `DispatchSerialQueue`) with no ABI impact, so deferring costs nothing.
///
/// Android does not share this trade-off: Kotlin's twin gets off-thread I/O for free from
/// `withContext(ioDispatcher)`. This is a genuine platform divergence, not a port omission.
actor EventQueue {
    /// Past this, an event is too old to attribute anything.
    static let maxAge: TimeInterval = 14 * 24 * 60 * 60
    /// A cap on the file. The oldest go first.
    ///
    /// Applied by one pass (`readWithOutcome`), reached from two places: every `read`, and an
    /// `append` that has taken the file `maxEventsSlack` rows past this. The append-side trigger is
    /// what keeps the file bounded while a drain is backing off and therefore never reading (2.6).
    static let maxEvents = 1000

    /// How far past `maxEvents` the file may run before `append` trims it back (2.6).
    ///
    /// The amortisation knob: one O(N) pass per `maxEventsSlack` appends, so an average append does
    /// about `maxEvents / maxEventsSlack` rows of work. It scales with the cap rather than being a
    /// small constant on purpose — a slack of, say, 16 would make roughly every sixteenth append pay
    /// a full read-and-rewrite of a thousand rows. The price is the on-disk ceiling:
    /// `maxEvents + maxEventsSlack` rows, not `maxEvents` exactly.
    static let maxEventsSlack = maxEvents / 10

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
    /// Next id to hand out to a NEWLY APPENDED row. `nil` means "not yet seeded from disk";
    /// `seedRowIdIfNeeded` resolves that on the first `read` or `append`, whichever happens
    /// first for this instance. Seeded above `nextMigrationRowId`'s reserved block — see
    /// `seedRowIdIfNeeded`.
    private var nextRowId: Int64?

    /// Next id to hand out to a row an old-format file wrote with no `"r"` field, drawn from the
    /// BOTTOM of the block `seedRowIdIfNeeded` reserves. Migration and fresh appends must draw
    /// from disjoint counters: both starting from `nextRowId` would have `seedRowIdIfNeeded`'s
    /// reservation go unused and hand every migrated row an id ABOVE a row appended before the
    /// file was ever read, inverting "the newest row carries the highest id".
    private var nextMigrationRowId: Int64?

    /// Rows currently ON DISK — not rows `read` would return. Seeded alongside the id counters in
    /// `seedRowIdIfNeeded` (from the same snapshot: a count taken from a different read than the one
    /// that seeded the ids could trim against a file it never saw), then maintained at every site
    /// that changes the file: `append`, `replace`, `delete` and `readWithOutcome`'s tail.
    ///
    /// Exists so `append` can enforce `maxEvents` without reading the file on every call (2.6/4.4).
    /// If it ever drifts the cost is a mistimed trim, never a lost row — every consumer of it only
    /// decides *when* to run the trim pass, never *what* the pass keeps.
    private var liveRowCount: Int?

    /// Row count at which `append` runs a trim pass. Re-armed after every pass from the count that
    /// pass actually left on disk, so a trim whose rewrite failed to persist does not re-attempt the
    /// same failing O(N) write on every subsequent append — it backs off by one `maxEventsSlack`
    /// each time instead. No separate "trim failed" flag: the count is the state.
    private var nextTrimAt = maxEvents + maxEventsSlack

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

    /// The result of a read together with whether any rewrite it triggered actually landed on
    /// disk. `durable == false` only when `events` reflects ids/trims that exist nowhere but
    /// this call — `reconcile` must not compact the file against a non-durable read, since an
    /// empty-looking result would NOT mean the queue is empty; see `reconcile`'s doc.
    private struct ReadOutcome {
        let events: [QueuedEvent]
        let durable: Bool
    }

    /// Every event still worth sending, oldest first. Expired and over-cap rows are dropped
    /// here rather than on write, so one pass enforces both bounds.
    func read(now: Date) -> [QueuedEvent] {
        readWithOutcome(now: now).events
    }

    /// `read`'s body, also reached from `append` when the file has grown past `nextTrimAt`.
    ///
    /// This is the ONE place that trims. `append`'s bound reaches it rather than reimplementing the
    /// rules, so seeding, migration, the age bound, the count bound, the single rewrite and the
    /// migration-counter rollback all stay in a single implementation — an append-time trim cannot
    /// drift from a read-time one because there is only one of them.
    private func readWithOutcome(now: Date) -> ReadOutcome {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            liveRowCount = 0
            return ReadOutcome(events: [], durable: true)
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            // Present but unreadable. Left alone it would make tracking permanently and
            // silently inert, since every later read returns the same nothing.
            //
            // A successful delete zeroes the count; a failed one deliberately leaves it alone. The
            // file is still there and still unreadable, so its true row count is unknowable here —
            // but `trimIfOverflowing` keeps incrementing from whatever the last known value was, so
            // the drift is bounded and a trim still fires, just later. That is the documented
            // tolerance for this counter: a mistimed trim, never a lost row.
            logger.warn("Could not read the event queue; dropping it.")
            delete()
            return ReadOutcome(events: [], durable: true)
        }
        // `split` already omits empty subsequences but keeps whitespace-only ones; the explicit
        // filter matches the Kotlin twin's `isNotBlank()`. This count decides both the trim trigger
        // and the sweep condition below, so a divergence here would make the two platforms bound
        // the same file differently.
        let present =
            String(decoding: data, as: UTF8.self)
            .split(separator: "\n")
            .filter { !$0.allSatisfy(\.isWhitespace) }
        let decoded =
            present
            // A truncated last line is expected after a kill, not a corruption to report.
            .compactMap { try? Self.decoder.decode(QueuedEvent.self, from: Data($0.utf8)) }
        seedRowIdIfNeeded(from: decoded)

        // Captured before the migration map runs: if the rewrite below fails to persist, the
        // counter must roll back to exactly this value, or a second migration pass over the
        // still-un-migrated file draws from ABOVE this reservation and overruns into ids
        // `nextRowId` already handed to a fresh append — two live rows can then share one id,
        // and `reconcile` would delete whichever one it wasn't meant to.
        let migrationStart = nextMigrationRowId
        var migratedAny = false
        let migrated = decoded.map { event -> QueuedEvent in
            guard event.rowId == nil else { return event }
            migratedAny = true
            return event.withRowId(takeNextMigrationRowId())
        }

        let events = migrated.filter { now.timeIntervalSince($0.capturedAt) <= Self.maxAge }
        let bounded = events.count > Self.maxEvents ? Array(events.suffix(Self.maxEvents)) : events

        // Migration, the age/count bound and unparseable rows all want a rewrite; do it once. A
        // file with no migrated rows, nothing to trim and nothing unparseable is left untouched, so
        // a steady-state flush that calls read() without a following replace() still costs only the
        // one read.
        //
        // `decoded.count != present.count` is the sweep: a torn tail from a mid-write kill is
        // dropped from `decoded` at parse time but stays on disk, and without this it would be
        // re-read and re-discarded on every read forever. It matters more since `reconcile` stopped
        // rewriting unconditionally — that write used to sweep the garbage as a side effect, so the
        // on-disk ceiling would otherwise bound only the VALID rows and let torn tails accumulate
        // past it. Self-healing: the rewrite removes them, so the next read finds the counts equal.
        if migratedAny || bounded.count != decoded.count || decoded.count != present.count {
            // A migration id is only real once it is durable. If the rewrite fails, the ids just
            // assigned exist nowhere but this call — a later read (after a process restart, or a
            // second read winning a race) will never reproduce them, since seedRowIdIfNeeded is
            // idempotent and the next read starts migration over from the un-rewritten file.
            //
            // This must NOT be signalled by returning an empty events array: `read` (the public
            // API) always returns `bounded` regardless, and durability is reported out-of-band
            // via `ReadOutcome.durable` so that `reconcile` — the one caller that would
            // otherwise treat "empty" as "queue is empty" and delete the file — can refuse to
            // compact on a failed rewrite instead. Overloading emptiness to mean "non-durable"
            // would make ANY routine trim whose rewrite fails destroy every row on the next
            // flush, not just the one-time migration — a write failure must be strictly less
            // bad than the bug it replaces.
            let durable = replace(bounded)
            if !durable { nextMigrationRowId = migrationStart }
            // `replace` already set the count on success; on failure the file still holds every
            // line that was on it, valid or not, so the count must describe THAT rather than the
            // trim we failed to persist.
            if !durable { liveRowCount = present.count }
            return ReadOutcome(events: bounded, durable: durable)
        }

        // Nothing was rewritten, so the file still holds exactly the lines we just read. On this
        // path `present.count == decoded.count == bounded.count` — the branch above owns every case
        // where they differ — but count the lines rather than the returned events, so the counter
        // stays a description of the FILE even if that branch's condition is ever narrowed.
        liveRowCount = present.count
        return ReadOutcome(events: bounded, durable: true)
    }

    /// A failed append is a lost event, never a crash: nothing a merchant called is failing.
    ///
    /// Appends one line. O(1) in the common case; roughly one row in `maxEventsSlack` also pays a
    /// trim pass (2.6).
    ///
    /// The bound lives here rather than in the caller because `maxEvents` is the queue's own
    /// invariant: enforcing it only on `read` left the file growing without limit exactly while
    /// backoff was armed, since a backing-off drain returns before it reads. A caller that only ever
    /// appends must not be able to grow the file forever, whoever that caller turns out to be.
    ///
    /// The trim pass uses the event's own `capturedAt` as its `now`. `append` has no clock of its
    /// own, and that value is the caller's clock stamped moments ago — close enough for an age bound
    /// measured in days, and it avoids handing this actor a second time source that could disagree
    /// with the one `InteractionTracker` already uses.
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

    /// Runs a trim pass once the file has grown `maxEventsSlack` rows past `maxEvents`, then re-arms
    /// from what that pass actually left behind.
    ///
    /// Re-arming from `liveRowCount` rather than from `maxEvents` is what makes a failed trim
    /// self-limiting: a pass whose rewrite did not persist leaves the count high, so the next attempt
    /// is one slack later instead of on the very next append. A durable pass leaves the count at
    /// `maxEvents` and the next trim is a full slack away, which is the amortisation.
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

    /// Idempotent: a second caller finding `nextRowId` already seeded does nothing.
    ///
    /// Reserves one id per row still awaiting migration (2.7), not just past the highest already
    /// stamped: `append` can seed from here before `read` has ever run over an old-format file,
    /// in which case every row in `existing` is nil. `nextMigrationRowId` takes the BOTTOM of
    /// that reservation (`highest + 1`) and `nextRowId` the id immediately above the whole block
    /// (`highest + 1 + unmigrated`) — two separate counters, so a fresh append draws from
    /// strictly above every id migration will ever hand out, and the newest row is guaranteed to
    /// carry the *highest* id rather than merely a non-colliding one.
    private func seedRowIdIfNeeded(from existing: [QueuedEvent]) {
        guard nextRowId == nil else { return }
        let highest = existing.compactMap(\.rowId).max() ?? -1
        // count(where:) is @available(SwiftStdlib 6.0) — iOS 18/macOS 15, above this package's
        // iOS 15/macOS 12 floor (Package.swift). filter(_:).count compiles on the actual floor.
        let unmigrated = existing.filter { $0.rowId == nil }.count
        nextMigrationRowId = highest + 1
        nextRowId = highest + 1 + Int64(unmigrated)
        // Seeded from the SAME snapshot as the ids, deliberately: a count taken from a different
        // read could arm the append-time trim against a file this instance never saw.
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

    /// Rewrites the queue to exactly `events`. Atomic: a kill mid-write leaves the previous
    /// file intact rather than a half-queue.
    /// Returns whether the file now genuinely holds `events` — false on any failure to write, so
    /// a caller relying on the write's durability (the migration pass in `read`) can refuse to
    /// trust ids that never made it to disk.
    @discardableResult
    func replace(_ events: [QueuedEvent]) -> Bool {
        guard !events.isEmpty else {
            // Not unconditionally true: a failed delete (permissions, a locked handle) must be
            // reported as non-durable, the same as a failed rewrite — otherwise a caller believes
            // stale rows are gone when the file, and every row in it, is still on disk.
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

    /// Drops `delivered`, applies `retried`, and rewrites the file — in one hop.
    ///
    /// Not `read` then `replace` from the caller: those are two hops, and an event appended
    /// between them would be read by neither and erased by the second. That window is the one
    /// place a durable queue must not have one.
    ///
    /// Keyed on `rowId`, not `idempotencyKey` (2.7): a caller-suppliable idempotency key is not
    /// guaranteed unique, so two distinct queued rows could collide on it and this would then
    /// reconcile the wrong one, or both. Every row `read` returns has already been migrated to a
    /// non-nil `rowId`; a `nil` here is unreachable, and is treated as "keep, unmodified" rather
    /// than trusted to match a `delivered`/`retried` entry it cannot actually correspond to.
    ///
    /// Refuses to compact when the read it started from was not durable (a migration/trim
    /// rewrite that failed to persist, see `readWithOutcome`): `delivered`/`retried` are keyed
    /// on ids the caller derived from that read, and writing back would either drop rows whose
    /// ids never made it to disk, or — the data-loss case this exists to prevent — write an
    /// empty file when the true queue is not empty at all, just unreadable-with-durable-ids this
    /// pass.
    ///
    /// Skips the write entirely when nothing changed (4.4) — the whole-file rewrite is the expensive
    /// half of a flush, and the commonest backlog pass is the one where every send failed, so
    /// nothing was delivered and nothing was marked for retry.
    ///
    /// That shortcut is safe ONLY because `readWithOutcome` has already persisted anything it
    /// changed (migration ids, age/count trims) before returning: when `changed` is false, `next` is
    /// byte-for-byte what is on disk right now. If a future edit ever lets the read return rows it
    /// did not persist, this skip silently drops them — keep the two in step.
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
        // `retried` is checked separately from the count: a retry replaces a row in place, so it
        // changes the file's contents without changing its row count. Erring towards writing is the
        // safe direction — a retried id that matched no row costs one redundant rewrite.
        let changed = !retried.isEmpty || next.count != outcome.events.count
        guard changed else { return }
        replace(next)
    }

    /// Returns whether the file is gone afterwards, so callers relying on delete's durability
    /// (`replace`'s empty-events path) can tell a genuine removal from a swallowed failure.
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
    /// readable — appropriate for a background queue that must be writable while the device is
    /// locked (an interaction can be tracked from a locked-screen share sheet) but must never be
    /// readable straight off a stolen, powered-off device. Best-effort: a failure here still
    /// leaves the write that just succeeded, so it is never escalated past a warning.
    ///
    /// `NSFileProtectionKey`/`FileProtectionType` are `API_UNAVAILABLE(macos)` — this package
    /// declares `.macOS(.v12)` as a genuine shipping platform (see `Package.swift`), and
    /// `swift build`/`swift test` on a Mac builds that triple, so an unconditional reference
    /// here fails the only build this package gets. No-op on macOS: there is no shipping
    /// product on that platform (see `Package.swift`'s header comment) and no equivalent
    /// protection-class API to fall back to, so there is nothing to do instead.
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
