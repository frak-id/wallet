package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

/**
 * One row waiting to be sent. [payload] holds only kind-specific facts true at capture time and
 * is never read or mutated by the drain — see [id.frak.sdk.tracking.RowSender].
 */
internal class QueuedRow(
    /** Stamped once at enqueue, reused across retries so a lost response doesn't create a duplicate row. */
    val idempotencyKey: String,
    /** A raw string, not a sealed type: new kinds must not require touching every `when` that reads a row. */
    val kind: String,
    val payload: JSONObject,
    /** The anonymous id this was captured under; a sender's header must match it, not the current one. */
    val clientId: String?,
    /** Null means "not resolved yet"; a sender resolves it at drain via [SendContext.resolveMerchantId]. */
    val merchantId: String?,
    val capturedAtMillis: Long,
    /** Permanent rejections so far. At the cap the event is dropped rather than blocking the queue. */
    val failures: Int = 0,
    /** Local row id, never sent on the wire. Reconciliation deletes by this, not by [idempotencyKey], which callers can supply and is not unique. */
    val rowId: Long,
    /** Envelope state, not payload: when this row first held, ever — never cleared, so the hold budget measures total time stuck, not time since the last hold. */
    val heldSince: Long? = null,
) {
    fun withFailure(): QueuedRow =
        QueuedRow(idempotencyKey, kind, payload, clientId, merchantId, capturedAtMillis, failures + 1, rowId, heldSince)

    /** Used only by [EventQueue] itself, to stamp the real id after enqueue or to migrate an old-format row. */
    fun withRowId(newRowId: Long): QueuedRow =
        QueuedRow(idempotencyKey, kind, payload, clientId, merchantId, capturedAtMillis, failures, newRowId, heldSince)

    /** Stamps [heldSince] the first time a row is held. A no-op if already stamped is the caller's job, not this one's. */
    fun withHeldSince(millis: Long): QueuedRow =
        QueuedRow(idempotencyKey, kind, payload, clientId, merchantId, capturedAtMillis, failures, rowId, millis)

    /** Attributes a row captured before any id could be minted. Only ever called on a row whose [clientId] is null. */
    fun withClientId(newClientId: String): QueuedRow =
        QueuedRow(idempotencyKey, kind, payload, newClientId, merchantId, capturedAtMillis, failures, rowId, heldSince)

    fun toJson(): JSONObject =
        JSONObject()
            .put("r", rowId)
            .put("v", SCHEMA_VERSION)
            .put("kind", kind)
            .put("k", idempotencyKey)
            .put("c", clientId)
            .put("m", merchantId)
            .put("t", capturedAtMillis)
            .put("f", failures)
            .put("h", heldSince)
            .put("payload", payload)

    companion object {
        const val SCHEMA_VERSION = 1

        /**
         * Null for an unreadable row: a torn tail, a field an older build wrote, or a `v` newer
         * than [SCHEMA_VERSION] — an older build must skip a row shaped by a future one rather
         * than misparse it. Never null for a missing `"r"` alone — see [EventQueue.MISSING_ROW_ID]
         * and the migration note on [EventQueue.read].
         */
        fun fromJson(line: String): QueuedRow? =
            runCatching {
                val json = JSONObject(line)
                if (json.optInt("v", SCHEMA_VERSION) > SCHEMA_VERSION) return null
                QueuedRow(
                    idempotencyKey = json.getString("k"),
                    kind = json.getString("kind"),
                    payload = json.getJSONObject("payload"),
                    clientId = json.opt("c") as? String,
                    merchantId = json.opt("m") as? String,
                    capturedAtMillis = json.getLong("t"),
                    failures = json.getInt("f"),
                    rowId = if (json.has("r")) json.getLong("r") else EventQueue.MISSING_ROW_ID,
                    heldSince = if (json.has("h")) json.getLong("h") else null,
                )
            }.getOrNull()
    }
}

/**
 * Durable append-only JSONL queue, compacted on flush, capped by count and age. Unparseable rows
 * are dropped on read, and [replace] renames a temp file over the original so a kill
 * mid-compaction cannot lose the queue. Every row carries a monotonic `rowId` assigned here.
 *
 * Single writer, nothing synchronised: every entry point is reached from [EventOutbox] under its
 * `queueMutex`, which is also what makes a read-then-write pair atomic.
 */
internal class EventQueue(
    fileProvider: () -> File,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    constructor(
        file: File,
        logger: FrakLogger,
        ioDispatcher: CoroutineDispatcher,
    ) : this({ file }, logger, ioDispatcher)

    /**
     * Resolved on first use, which is always inside [ioDispatcher]: `Context.getNoBackupFilesDir()`
     * stats and mkdirs on the calling thread, and `Frak.initialize` promises to do no I/O.
     */
    private val file: File by lazy(fileProvider)

    /**
     * Next id for an appended row. [UNSEEDED] means "not yet read from disk"; [seedRowIdIfNeeded]
     * resolves that above [nextMigrationRowId]'s reserved block.
     */
    private var nextRowId = UNSEEDED

    /**
     * Id for a row an old-format file wrote with no `"r"` field, drawn from the bottom of the
     * block [seedRowIdIfNeeded] reserves, so a migrated row never outranks a fresh append.
     */
    private var nextMigrationRowId = UNSEEDED

    /**
     * Rows on disk, not rows [read] would return, so [append] can enforce [MAX_EVENTS] without
     * reading the file. Drift costs a mistimed trim, never a lost row.
     */
    private var liveRowCount = UNSEEDED_COUNT

    /**
     * Row count at which [append] runs a trim pass. Re-armed from what that pass actually left on
     * disk, so a failed rewrite backs off by one [MAX_EVENTS_SLACK] instead of retrying forever.
     */
    private var nextTrimAt = MAX_EVENTS + MAX_EVENTS_SLACK

    /** Oldest first. Rows that are unreadable, expired, or beyond the cap are dropped. */
    suspend fun read(now: Long): List<QueuedRow> = withContext(ioDispatcher) { readLocked(now).events }

    /**
     * The result of a read together with whether any rewrite it triggered actually landed on
     * disk. [durable] is false only when [events] reflects ids/trims that exist nowhere but this
     * call stack; [reconcile] must not compact the file against a non-durable read.
     */
    private class ReadOutcome(
        val events: List<QueuedRow>,
        val durable: Boolean,
    )

    /**
     * [read]'s body, without the [withContext] hop, for callers already on [ioDispatcher]:
     * [reconcile], and [append] when the file has grown past [nextTrimAt].
     *
     * This is the one place that trims, so an append-time trim cannot drift from a read-time one.
     */
    private fun readLocked(now: Long): ReadOutcome {
        if (!file.isFile) {
            liveRowCount = 0
            return ReadOutcome(emptyList(), durable = true)
        }

        val rows =
            try {
                file.readLines()
            } catch (failure: Exception) {
                logger.warn("Could not read the event queue; dropping it.", failure)
                // A successful delete zeroes the count; a failed one leaves it alone, so
                // trimIfOverflowing keeps incrementing from the last known value and a trim
                // still fires, just later.
                deleteFile()
                return ReadOutcome(emptyList(), durable = true)
            }

        // Blank-line filtering drops empty and whitespace-only lines: this count decides both
        // the trim trigger and the sweep condition below.
        val present = rows.filter { it.isNotBlank() }
        val decoded = present.mapNotNull(QueuedRow::fromJson)
        seedRowIdIfNeeded(decoded)

        // Captured before the migration map runs: if the rewrite below fails to persist, the
        // counter must roll back to exactly this value, or a second pass over the
        // still-un-migrated file overruns into ids [nextRowId] already handed to a fresh append.
        val migrationStart = nextMigrationRowId
        var migratedAny = false
        val migrated =
            decoded.map {
                if (it.rowId == MISSING_ROW_ID) {
                    migratedAny = true
                    it.withRowId(nextMigrationRowId++)
                } else {
                    it
                }
            }

        val events = migrated.filter { now - it.capturedAtMillis <= MAX_AGE_MILLIS }
        // takeLast: oldest dropped first, a fresh event is more likely to still matter.
        val byCount = if (events.size > MAX_EVENTS) events.takeLast(MAX_EVENTS) else events
        // A row count is not a size: big custom payloads fill the disk long before they fill
        // 1000 rows. Real bytes, not `String.length`, which is UTF-16 units.
        val bounded = if (file.length() > MAX_BYTES) withinByteBudget(byCount) else byCount

        // Migration, the bounds and unparseable rows all want a rewrite; do it once, and leave a
        // file with nothing to change untouched.
        //
        // `decoded.size != present.size` is the sweep: a torn tail is dropped at parse time but
        // stays on disk, and would be re-read and re-discarded forever without this.
        if (migratedAny || bounded.size != decoded.size || decoded.size != present.size) {
            // A migration id is only real once it is durable: if the rewrite fails, the ids just
            // assigned exist nowhere but this call stack. Reported out-of-band via
            // [ReadOutcome.durable], never as an empty list, so [reconcile] can tell a failed
            // rewrite from an empty queue.
            val durable = replaceLocked(bounded)
            if (!durable) nextMigrationRowId = migrationStart
            // replaceLocked already set the count on success; on failure the file still holds
            // every line that was on it, so the count must describe that rather than the failed
            // trim.
            if (!durable) liveRowCount = present.size
            return ReadOutcome(bounded, durable)
        }

        // Nothing was rewritten, so the file still holds exactly the lines we just read. Count
        // the lines rather than the returned events, so the counter stays a description of the
        // file.
        liveRowCount = present.size
        return ReadOutcome(bounded, durable = true)
    }

    /** Newest first until the budget runs out, then back to oldest-first order. Always keeps at least one row. */
    private fun withinByteBudget(events: List<QueuedRow>): List<QueuedRow> {
        var remaining = MAX_BYTES
        val kept = ArrayDeque<QueuedRow>()
        for (event in events.asReversed()) {
            remaining -= event
                .toJson()
                .toString()
                .toByteArray(Charsets.UTF_8)
                .size + 1
            if (remaining < 0 && kept.isNotEmpty()) break
            kept.addFirst(event)
        }
        if (kept.size < events.size) {
            logger.warn("Trimmed ${events.size - kept.size} queued events over the ${MAX_BYTES}-byte queue budget.")
        }
        return kept
    }

    /**
     * Appends one line. O(1) in the common case; roughly one row in [MAX_EVENTS_SLACK] also pays
     * a trim pass. The bound lives here, not just in [read]: a backing-off drain returns before
     * it reads, which left the file growing without limit. The trim uses the event's own
     * [QueuedRow.capturedAtMillis], so there is no second time source to disagree with.
     */
    suspend fun append(event: QueuedRow) {
        withContext(ioDispatcher) {
            try {
                if (nextRowId == UNSEEDED) seedRowIdIfNeeded(readExistingForSeed())
                val stamped = event.withRowId(nextRowId++)
                file.parentFile?.mkdirs()
                file.appendText(stamped.toJson().toString() + "\n")
                trimIfOverflowing(stamped.capturedAtMillis)
            } catch (failure: Exception) {
                logger.warn("Could not enqueue an event", failure)
            }
        }
    }

    /**
     * Runs a trim pass once the file has grown [MAX_EVENTS_SLACK] rows past [MAX_EVENTS], then
     * re-arms from what that pass actually left behind.
     *
     * Re-arming from [liveRowCount] rather than [MAX_EVENTS] makes a failed trim self-limiting:
     * its rewrite not persisting leaves the count high, so the next attempt is one slack later
     * instead of retrying the same failing write on every append.
     */
    private fun trimIfOverflowing(now: Long) {
        // The `length()` stat is one syscall per append on [ioDispatcher], and it is what stops a
        // row count from reporting a healthy queue while the file itself has run away.
        if (++liveRowCount <= nextTrimAt && file.length() <= MAX_BYTES) return
        readLocked(now)
        nextTrimAt = maxOf(MAX_EVENTS, liveRowCount) + MAX_EVENTS_SLACK
    }

    /** Best-effort peek at the file for seeding [nextRowId] from [append], without [read]'s bounds/migration logic. */
    private fun readExistingForSeed(): List<QueuedRow> =
        try {
            if (!file.isFile) {
                emptyList()
            } else {
                file.readLines().filter { it.isNotBlank() }.mapNotNull(QueuedRow::fromJson)
            }
        } catch (ignored: Exception) {
            emptyList()
        }

    /**
     * Idempotent. Reserves one id per row still awaiting migration, not just past the highest
     * already stamped, because [append] can seed here before [read] has run over an old-format
     * file. Migration draws from the bottom of that block and [nextRowId] from above it, so a
     * fresh append always outranks any migrated row.
     */
    private fun seedRowIdIfNeeded(existing: List<QueuedRow>) {
        if (nextRowId != UNSEEDED) return
        val highest = existing.maxOfOrNull { it.rowId }?.takeIf { it != MISSING_ROW_ID } ?: (FIRST_ROW_ID - 1)
        val unmigrated = existing.count { it.rowId == MISSING_ROW_ID }
        nextMigrationRowId = highest + 1
        nextRowId = highest + 1 + unmigrated
        // Seeded from the same snapshot as the ids: a count from a different read could arm the
        // append-time trim against a file this instance never saw.
        if (liveRowCount == UNSEEDED_COUNT) liveRowCount = existing.size
    }

    /**
     * [replace]'s body, without the [withContext] hop, for callers already on [ioDispatcher].
     * Returns whether the file now genuinely holds [events]: false on any failure to write or
     * rename, so a caller can refuse to trust ids/deletions that never made it to disk.
     */
    private fun replaceLocked(events: List<QueuedRow>): Boolean {
        if (events.isEmpty()) {
            // A failed delete must be reported as non-durable, same as a failed rewrite, or a
            // caller believes stale rows are gone when the file is still on disk.
            return !file.isFile || deleteFile()
        }
        val temp = File(file.parentFile, file.name + ".tmp")
        return try {
            file.parentFile?.mkdirs()
            temp.writeText(events.joinToString(separator = "") { it.toJson().toString() + "\n" })
            if (temp.renameTo(file)) {
                liveRowCount = events.size
                true
            } else {
                logger.warn("Could not compact the event queue; leaving it as it was.")
                temp.delete()
                false
            }
        } catch (failure: Exception) {
            logger.warn("Could not compact the event queue", failure)
            runCatching { temp.delete() }
            false
        }
    }

    /** Atomically replaces the file's contents. An empty list deletes it. Returns whether it landed. */
    suspend fun replace(events: List<QueuedRow>): Boolean = withContext(ioDispatcher) { replaceLocked(events) }

    /**
     * Drops [delivered], applies [retried], and rewrites the file in one hop. Not `read` then
     * `replace` from the caller: an event appended between those two hops would be read by
     * neither and erased by the second. Keyed on `rowId` — `idempotencyKey` is caller-suppliable
     * and can collide. Refuses to compact when the read was not durable (see [readLocked]), since
     * writing back could erase rows whose ids never reached disk.
     */
    suspend fun reconcile(
        delivered: Set<Long>,
        retried: Map<Long, QueuedRow>,
        now: Long,
    ): List<QueuedRow> =
        withContext(ioDispatcher) {
            val outcome = readLocked(now)
            val next = outcome.events.filterNot { it.rowId in delivered }.map { retried[it.rowId] ?: it }
            // `retried` is checked separately from the size: a retry replaces a row in place
            // without changing the row count. Erring towards writing is the safe direction.
            val changed = retried.isNotEmpty() || next.size != outcome.events.size
            if (outcome.durable && changed) replaceLocked(next)
            next
        }

    suspend fun clear() {
        withContext(ioDispatcher) { deleteFile() }
    }

    /** Unhopped delete, for callers already on [ioDispatcher]. Returns whether it landed. */
    private fun deleteFile(): Boolean =
        runCatching { file.delete() }.getOrDefault(false).also { if (it) liveRowCount = 0 }

    companion object {
        const val MAX_AGE_MILLIS: Long = 14L * 24 * 60 * 60 * 1000
        const val MAX_EVENTS: Int = 1000

        /** Second cap, on bytes: [MAX_EVENTS] alone bounds nothing when the rows carry custom payloads. */
        const val MAX_BYTES: Long = 2L * 1024 * 1024

        /**
         * How far past [MAX_EVENTS] the file may run before [append] trims it back: one O(N) pass
         * per [MAX_EVENTS_SLACK] appends, scaled to the cap so no single append rewrites the file.
         */
        const val MAX_EVENTS_SLACK: Int = MAX_EVENTS / 10

        /** [QueuedRow.rowId] placeholder for a row an old-format file wrote before this field existed. */
        const val MISSING_ROW_ID: Long = -1L
        private const val FIRST_ROW_ID: Long = 0L
        private const val UNSEEDED: Long = Long.MIN_VALUE
        private const val UNSEEDED_COUNT: Int = -1
    }
}
