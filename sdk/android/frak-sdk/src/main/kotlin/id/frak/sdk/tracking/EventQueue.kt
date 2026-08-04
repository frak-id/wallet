package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/** One event waiting to be sent. Request body built at capture time, so its timestamp is when the user acted. */
internal class QueuedEvent(
    /** Stamped once at enqueue, reused across retries so a lost response doesn't create a duplicate row. */
    val idempotencyKey: String,
    val path: String,
    val body: JSONObject,
    /** The anonymous id this was captured under; the header must match it, not the current one. */
    val clientId: String?,
    val capturedAtMillis: Long,
    /** Permanent rejections so far. At the cap the event is dropped rather than blocking the queue. */
    val failures: Int = 0,
    /**
     * SDK-owned, monotonically increasing, assigned once by [EventQueue] at enqueue and never
     * by a caller (2.7). Reconciliation after a flush deletes by this id, not by [idempotencyKey]:
     * a caller-suppliable [Interaction.Custom.idempotencyKey] is not guaranteed unique, so two
     * distinct queued rows could collide on it and a reconcile would then delete the wrong one,
     * or both. `rowId` is never sent on the wire — see [toJson]/[interactionBody] — so it carries
     * no backend meaning; it exists purely so this file can tell its own rows apart.
     */
    val rowId: Long,
) {
    fun withFailure(): QueuedEvent =
        QueuedEvent(idempotencyKey, path, body, clientId, capturedAtMillis, failures + 1, rowId)

    /** Used only by [EventQueue] itself, to stamp the real id after enqueue or to migrate an old-format row. */
    fun withRowId(newRowId: Long): QueuedEvent =
        QueuedEvent(idempotencyKey, path, body, clientId, capturedAtMillis, failures, newRowId)

    fun toJson(): JSONObject =
        JSONObject()
            .put("k", idempotencyKey)
            .put("p", path)
            .put("b", body)
            .put("c", clientId)
            .put("t", capturedAtMillis)
            .put("f", failures)
            .put("r", rowId)

    companion object {
        /**
         * Null for an unreadable row: a torn tail, or a field an older build wrote. Never null
         * for a missing `"r"` alone — see [EventQueue.MISSING_ROW_ID] and the migration note on
         * [EventQueue.read].
         */
        fun fromJson(line: String): QueuedEvent? =
            runCatching {
                val json = JSONObject(line)
                QueuedEvent(
                    idempotencyKey = json.getString("k"),
                    path = json.getString("p"),
                    body = json.getJSONObject("b"),
                    clientId = json.opt("c") as? String,
                    capturedAtMillis = json.getLong("t"),
                    failures = json.getInt("f"),
                    rowId = if (json.has("r")) json.getLong("r") else EventQueue.MISSING_ROW_ID,
                )
            }.getOrNull()
    }
}

/**
 * Durable event queue: append-only JSONL file, compacted on flush. Unparseable rows (torn tail
 * from a mid-write kill) are discarded on read rather than failing the whole file. [replace]
 * writes a temp file and renames over the original, so a kill mid-compaction can't lose the
 * queue. Single writer only: not safe across processes.
 *
 * Capped by count and age, oldest dropped first. Both bounds are applied by one pass ([readLocked]),
 * reached from two places: every [read], and an [append] that has taken the file [MAX_EVENTS_SLACK]
 * rows past [MAX_EVENTS]. The append-side trigger is what keeps the file bounded while a drain is
 * backing off and therefore never reading (2.6) — see [liveRowCount] and [trimIfOverflowing]. The
 * age bound needs no append-side trigger of its own: a freshly captured event cannot be too old, so
 * appending can only ever violate the count bound.
 *
 * `rowId` (2.7): every row gets an SDK-owned, monotonically increasing id, assigned here, never
 * by [InteractionTracker]. [nextRowId] is seeded lazily from the highest `rowId` this file has
 * ever held, so ids stay monotonic across a process restart without a separate counter file to
 * keep in sync with the queue itself.
 *
 * Migration: a file written before this field existed has no `"r"` key on any row.
 * [QueuedEvent.fromJson] reads a missing key as [MISSING_ROW_ID], and the first [read] of such a
 * file assigns fresh ids in on-disk (oldest-first) order and rewrites the file through [replace]
 * so the assignment is durable immediately, not deferred to the next flush. No row and no event
 * is ever dropped for predating this field.
 */
internal class EventQueue(
    private val file: File,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    /**
     * Next id to hand out to a NEWLY APPENDED row. [Long.MIN_VALUE] means "not yet seeded from
     * disk"; [seedRowIdIfNeeded] resolves that on the first [read] or [append], whichever
     * happens first for this instance. Seeded above [nextMigrationRowId]'s reserved block —
     * see [seedRowIdIfNeeded].
     */
    private val nextRowId = AtomicLong(UNSEEDED)

    /**
     * Next id to hand out to a row an old-format file wrote with no `"r"` field, drawn from the
     * BOTTOM of the block [seedRowIdIfNeeded] reserves. Migration and fresh appends must draw
     * from disjoint counters: both starting from [nextRowId] would have [seedRowIdIfNeeded]'s
     * reservation go unused and hand every migrated row an id ABOVE a row appended before the
     * file was ever read, inverting "the newest row carries the highest id".
     */
    private val nextMigrationRowId = AtomicLong(UNSEEDED)

    /**
     * Rows currently ON DISK — not rows [read] would return. Seeded alongside the id counters in
     * [seedRowIdIfNeeded] (from the same snapshot: a count taken from a different read than the one
     * that seeded the ids could trim against a file it never saw), then maintained at every site
     * that changes the file: [append], [replaceLocked], [deleteFile] and [readLocked]'s tail.
     *
     * Exists so [append] can enforce [MAX_EVENTS] without reading the file on every call (2.6/4.4).
     * If it ever drifts the cost is a mistimed trim, never a lost row — every consumer of it only
     * decides *when* to run the trim pass, never *what* the pass keeps.
     */
    private val liveRowCount = AtomicInteger(UNSEEDED_COUNT)

    /**
     * Row count at which [append] runs a trim pass. Re-armed after every pass from the count that
     * pass actually left on disk, so a trim whose rewrite failed to persist does not re-attempt the
     * same failing O(N) write on every subsequent append — it backs off by one [MAX_EVENTS_SLACK]
     * each time instead. No separate "trim failed" flag: the count is the state.
     */
    private val nextTrimAt = AtomicInteger(MAX_EVENTS + MAX_EVENTS_SLACK)

    /** Oldest first. Rows that are unreadable, expired, or beyond the cap are dropped. */
    suspend fun read(now: Long): List<QueuedEvent> = withContext(ioDispatcher) { readLocked(now).events }

    /**
     * The result of a read together with whether any rewrite it triggered actually landed on
     * disk. [durable] is `false` only when [events] reflects ids/trims that exist nowhere but
     * this call stack — [reconcile] must not compact the file against a non-durable read, since
     * an empty-looking result here does NOT mean the queue is empty; see [reconcile]'s doc.
     */
    private class ReadOutcome(
        val events: List<QueuedEvent>,
        val durable: Boolean,
    )

    /**
     * [read]'s body, without the [withContext] hop — for callers already on [ioDispatcher]: [reconcile],
     * and [append] when the file has grown past [nextTrimAt].
     *
     * This is the ONE place that trims. [append]'s bound reaches it rather than reimplementing the
     * rules, so seeding, migration, the age bound, the count bound, the single rewrite and the
     * migration-counter rollback all stay in a single implementation — an append-time trim cannot
     * drift from a read-time one because there is only one of them.
     */
    private fun readLocked(now: Long): ReadOutcome {
        if (!file.isFile) {
            liveRowCount.set(0)
            return ReadOutcome(emptyList(), durable = true)
        }

        val rows =
            try {
                file.readLines()
            } catch (failure: Exception) {
                logger.warn("Could not read the event queue; dropping it.", failure)
                // A successful delete zeroes the count; a failed one deliberately leaves it alone.
                // The file is still there and still unreadable, so its true row count is unknowable
                // here — but [trimIfOverflowing] keeps incrementing from whatever the last known
                // value was, so the drift is bounded and a trim still fires, just later. That is the
                // documented tolerance for this counter: a mistimed trim, never a lost row.
                deleteFile()
                return ReadOutcome(emptyList(), durable = true)
            }

        // Blank-line filtering must match the iOS twin's, which drops empty AND whitespace-only
        // lines: this count decides both the trim trigger and the sweep condition below, so a
        // divergence here would make the two platforms bound the same file differently.
        val present = rows.filter { it.isNotBlank() }
        val decoded = present.mapNotNull(QueuedEvent::fromJson)
        seedRowIdIfNeeded(decoded)

        // Captured before the migration map runs: if the rewrite below fails to persist, the
        // counter must roll back to exactly this value, or a second migration pass over the
        // still-un-migrated file draws from ABOVE this reservation and overruns into ids
        // [nextRowId] already handed to a fresh append — two live rows can then share one id,
        // and [reconcile] would delete whichever one it wasn't meant to.
        val migrationStart = nextMigrationRowId.get()
        var migratedAny = false
        val migrated =
            decoded.map {
                if (it.rowId == MISSING_ROW_ID) {
                    migratedAny = true
                    it.withRowId(nextMigrationRowId.getAndIncrement())
                } else {
                    it
                }
            }

        val events = migrated.filter { now - it.capturedAtMillis <= MAX_AGE_MILLIS }
        // takeLast: oldest dropped first, a fresh event is more likely to still matter.
        val bounded = if (events.size > MAX_EVENTS) events.takeLast(MAX_EVENTS) else events

        // Migration, the age/count bound and unparseable rows all want a rewrite; do it once. A
        // file with no migrated rows, nothing to trim and nothing unparseable is left untouched, so
        // a steady-state flush that calls read() without a following replace() still costs only the
        // one read.
        //
        // `decoded.size != present.size` is the sweep: a torn tail from a mid-write kill is dropped
        // from `decoded` at parse time but stays on disk, and without this it would be re-read and
        // re-discarded on every read forever. It matters more since `reconcile` stopped rewriting
        // unconditionally — that write used to sweep the garbage as a side effect, so the on-disk
        // ceiling would otherwise bound only the VALID rows and let torn tails accumulate past it.
        // Self-healing: the rewrite removes them, so the next read finds the two counts equal.
        if (migratedAny || bounded.size != decoded.size || decoded.size != present.size) {
            // A migration id is only real once it is durable. If the rewrite fails, the ids
            // just assigned exist nowhere but this call stack: a later read (after this
            // process dies, or after a second read wins a race) will never reproduce them,
            // since seedRowIdIfNeeded is idempotent and the next read starts migration over
            // from the un-rewritten file.
            //
            // This must NOT be signalled by returning an empty events list: [read] (the public
            // API) always returns `bounded` regardless, and durability is reported out-of-band
            // via [ReadOutcome.durable] so that [reconcile] — the one caller that would
            // otherwise treat "empty" as "queue is empty" and delete the file — can refuse to
            // compact on a failed rewrite instead. Overloading emptiness to mean "non-durable"
            // would make ANY routine trim whose rewrite fails (disk full, temp path occupied)
            // destroy every row on the next flush, not just the one-time migration — a write
            // failure must be strictly less bad than the bug it replaces.
            val durable = replaceLocked(bounded)
            if (!durable) nextMigrationRowId.set(migrationStart)
            // replaceLocked already set the count on success; on failure the file still holds every
            // line that was on it, valid or not, so the count must describe THAT rather than the
            // trim we failed to persist.
            if (!durable) liveRowCount.set(present.size)
            return ReadOutcome(bounded, durable)
        }

        // Nothing was rewritten, so the file still holds exactly the lines we just read. On this
        // path `present.size == decoded.size == bounded.size` — the branch above owns every case
        // where they differ — but count the lines rather than the returned events, so the counter
        // stays a description of the FILE even if that branch's condition is ever narrowed.
        liveRowCount.set(present.size)
        return ReadOutcome(bounded, durable = true)
    }

    /**
     * Appends one line. O(1) in the common case; roughly one row in [MAX_EVENTS_SLACK] also pays a
     * trim pass (2.6).
     *
     * The bound lives here rather than in the caller because [MAX_EVENTS] is the queue's own
     * invariant: enforcing it only on [read] left the file growing without limit exactly while
     * backoff was armed, since a backing-off drain returns before it reads. A caller that only ever
     * appends must not be able to grow the file forever, whoever that caller turns out to be.
     *
     * The trim pass uses the event's own [QueuedEvent.capturedAtMillis] as its `now`. [append] has
     * no clock of its own, and that value is the caller's clock stamped moments ago — close enough
     * for an age bound measured in days, and it avoids handing this class a second time source that
     * could disagree with the one [InteractionTracker] already uses.
     */
    suspend fun append(event: QueuedEvent) {
        withContext(ioDispatcher) {
            try {
                if (nextRowId.get() == UNSEEDED) seedRowIdIfNeeded(readExistingForSeed())
                val stamped = event.withRowId(nextRowId.getAndIncrement())
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
     * Re-arming from [liveRowCount] rather than from [MAX_EVENTS] is what makes a failed trim
     * self-limiting: a pass whose rewrite did not persist leaves the count high, so the next attempt
     * is one slack later instead of on the very next append. A durable pass leaves the count at
     * [MAX_EVENTS] and the next trim is a full slack away, which is the amortisation.
     */
    private fun trimIfOverflowing(now: Long) {
        if (liveRowCount.incrementAndGet() <= nextTrimAt.get()) return
        readLocked(now)
        nextTrimAt.set(maxOf(MAX_EVENTS, liveRowCount.get()) + MAX_EVENTS_SLACK)
    }

    /** Best-effort peek at the file for seeding [nextRowId] from [append], without [read]'s bounds/migration logic. */
    private fun readExistingForSeed(): List<QueuedEvent> =
        try {
            if (!file.isFile) {
                emptyList()
            } else {
                file.readLines().filter { it.isNotBlank() }.mapNotNull(QueuedEvent::fromJson)
            }
        } catch (ignored: Exception) {
            emptyList()
        }

    /**
     * Idempotent: a second caller finding [nextRowId] already seeded does nothing.
     *
     * Reserves one id per row still awaiting migration (2.7), not just past the highest already
     * stamped: [append] can seed from here before [read] has ever run over an old-format file, in
     * which case [existing] is entirely [MISSING_ROW_ID]. [nextMigrationRowId] takes the BOTTOM
     * of that reservation (`highest + 1`) and [nextRowId] the id immediately above the whole
     * block (`highest + 1 + unmigrated`) — two separate counters, so a fresh append draws from
     * strictly above every id migration will ever hand out, and the newest row is guaranteed to
     * carry the *highest* id rather than merely a non-colliding one.
     */
    private fun seedRowIdIfNeeded(existing: List<QueuedEvent>) {
        if (nextRowId.get() != UNSEEDED) return
        val highest = existing.maxOfOrNull { it.rowId }?.takeIf { it != MISSING_ROW_ID } ?: (FIRST_ROW_ID - 1)
        val unmigrated = existing.count { it.rowId == MISSING_ROW_ID }
        nextMigrationRowId.compareAndSet(UNSEEDED, highest + 1)
        nextRowId.compareAndSet(UNSEEDED, highest + 1 + unmigrated)
        // Seeded from the SAME snapshot as the ids, deliberately: a count taken from a different
        // read could arm the append-time trim against a file this instance never saw.
        liveRowCount.compareAndSet(UNSEEDED_COUNT, existing.size)
    }

    /**
     * [replace]'s body, without the [withContext] hop: [read] is already on [ioDispatcher] when
     * it calls this. Returns whether the file now genuinely holds [events] — false on any
     * failure to write or rename, so a caller relying on the write's durability (the migration
     * pass in [read], or [reconcile]) can refuse to trust ids/deletions that never made it to disk.
     */
    private fun replaceLocked(events: List<QueuedEvent>): Boolean {
        if (events.isEmpty()) {
            // Not unconditionally true: a failed delete (permissions, a locked handle on some
            // filesystem) must be reported as non-durable, the same as a failed rewrite —
            // otherwise a caller believes stale rows are gone when the file, and every row in it,
            // is still on disk.
            return !file.isFile || deleteFile()
        }
        val temp = File(file.parentFile, file.name + ".tmp")
        return try {
            file.parentFile?.mkdirs()
            temp.writeText(events.joinToString(separator = "") { it.toJson().toString() + "\n" })
            if (temp.renameTo(file)) {
                liveRowCount.set(events.size)
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
    suspend fun replace(events: List<QueuedEvent>): Boolean = withContext(ioDispatcher) { replaceLocked(events) }

    /**
     * Drops [delivered], applies [retried], and rewrites the file — in one hop.
     *
     * Not `read` then `replace` from the caller (2.7/6): those are two separate
     * [withContext] hops on a genuinely multi-threaded dispatcher, and an event appended
     * between them would be read by neither and erased by the second. That window is the one
     * place a durable queue must not have one — matches the iOS actor twin, where the
     * equivalent is free because the whole call is already one actor-isolated hop.
     *
     * Keyed on `rowId`, not `idempotencyKey`: a caller-suppliable idempotency key is not
     * guaranteed unique, so two distinct queued rows could collide on it and this would then
     * reconcile the wrong one, or both.
     *
     * Refuses to compact when the read it started from was not durable (a migration/trim
     * rewrite that failed to persist, see [readLocked]): [delivered]/[retried] are keyed on
     * ids the caller derived from that read, and writing `next` back would either drop rows
     * whose ids never made it to disk, or — the data-loss case this exists to prevent — write
     * an empty file when the true queue is not empty at all, just unreadable-with-durable-ids
     * this pass. Returns the in-memory list either way, so the caller (InteractionTracker)
     * still gets a correct picture of what is queued for logging/backoff purposes; only the
     * disk write is skipped.
     *
     * Skips the write entirely when nothing changed (4.4) — the whole-file rewrite is the
     * expensive half of a flush, and the commonest backlog pass is the one where every send
     * failed, so nothing was delivered and nothing was marked for retry.
     *
     * That shortcut is safe ONLY because [readLocked] has already persisted anything it changed
     * (migration ids, age/count trims) before returning: when `changed` is false, `next` is
     * byte-for-byte what is on disk right now. If a future edit ever lets the read return rows it
     * did not persist, this skip silently drops them — keep the two in step.
     */
    suspend fun reconcile(
        delivered: Set<Long>,
        retried: Map<Long, QueuedEvent>,
        now: Long,
    ): List<QueuedEvent> =
        withContext(ioDispatcher) {
            val outcome = readLocked(now)
            val next = outcome.events.filterNot { it.rowId in delivered }.map { retried[it.rowId] ?: it }
            // `retried` is checked separately from the size: a retry replaces a row in place, so it
            // changes the file's contents without changing its row count. Erring towards writing is
            // the safe direction — a retried id that matched no row costs one redundant rewrite.
            val changed = retried.isNotEmpty() || next.size != outcome.events.size
            if (outcome.durable && changed) replaceLocked(next)
            next
        }

    suspend fun clear() {
        withContext(ioDispatcher) { deleteFile() }
    }

    /** Unhopped delete, for callers already on [ioDispatcher]. Returns whether it landed. */
    private fun deleteFile(): Boolean =
        runCatching { file.delete() }.getOrDefault(false).also { if (it) liveRowCount.set(0) }

    companion object {
        const val MAX_AGE_MILLIS: Long = 14L * 24 * 60 * 60 * 1000
        const val MAX_EVENTS: Int = 1000

        /**
         * How far past [MAX_EVENTS] the file may run before [append] trims it back (2.6).
         *
         * This is the amortisation knob: one O(N) pass per [MAX_EVENTS_SLACK] appends, so the work
         * an append does on average is about `MAX_EVENTS / MAX_EVENTS_SLACK` rows. It scales with
         * the cap rather than being a small constant on purpose — a slack of, say, 16 would make
         * roughly every sixteenth append pay a full read-and-rewrite of a thousand rows. The price
         * of the slack is the on-disk ceiling: `MAX_EVENTS + MAX_EVENTS_SLACK` rows, not
         * [MAX_EVENTS] exactly.
         */
        const val MAX_EVENTS_SLACK: Int = MAX_EVENTS / 10

        /** [QueuedEvent.rowId] placeholder for a row an old-format file wrote before this field existed. */
        const val MISSING_ROW_ID: Long = -1L
        private const val FIRST_ROW_ID: Long = 0L
        private const val UNSEEDED: Long = Long.MIN_VALUE
        private const val UNSEEDED_COUNT: Int = -1
    }
}
