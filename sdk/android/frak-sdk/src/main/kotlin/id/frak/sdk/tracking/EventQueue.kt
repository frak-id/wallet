package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
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
 * queue. Capped by count and age, oldest dropped first. Single writer only: not safe across
 * processes.
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

    /** [read]'s body, without the [withContext] hop — for callers already on [ioDispatcher], namely [reconcile]. */
    private fun readLocked(now: Long): ReadOutcome {
        if (!file.isFile) return ReadOutcome(emptyList(), durable = true)

        val rows =
            try {
                file.readLines()
            } catch (failure: Exception) {
                logger.warn("Could not read the event queue; dropping it.", failure)
                deleteFile()
                return ReadOutcome(emptyList(), durable = true)
            }

        val decoded = rows.filter { it.isNotBlank() }.mapNotNull(QueuedEvent::fromJson)
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

        // Migration and the age/count bound both want a rewrite; do it once. A file with no
        // migrated rows and nothing to trim is left untouched, so a steady-state flush that
        // calls read() without a following replace() still costs only the one read.
        if (migratedAny || bounded.size != decoded.size) {
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
            return ReadOutcome(bounded, durable)
        }

        return ReadOutcome(bounded, durable = true)
    }

    suspend fun append(event: QueuedEvent) {
        withContext(ioDispatcher) {
            try {
                if (nextRowId.get() == UNSEEDED) seedRowIdIfNeeded(readExistingForSeed())
                val stamped = event.withRowId(nextRowId.getAndIncrement())
                file.parentFile?.mkdirs()
                file.appendText(stamped.toJson().toString() + "\n")
            } catch (failure: Exception) {
                logger.warn("Could not enqueue an event", failure)
            }
        }
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
     */
    suspend fun reconcile(
        delivered: Set<Long>,
        retried: Map<Long, QueuedEvent>,
        now: Long,
    ): List<QueuedEvent> =
        withContext(ioDispatcher) {
            val outcome = readLocked(now)
            val next = outcome.events.filterNot { it.rowId in delivered }.map { retried[it.rowId] ?: it }
            if (outcome.durable) replaceLocked(next)
            next
        }

    suspend fun clear() {
        withContext(ioDispatcher) { deleteFile() }
    }

    /** Unhopped delete, for callers already on [ioDispatcher]. Returns whether it landed. */
    private fun deleteFile(): Boolean = runCatching { file.delete() }.getOrDefault(false)

    companion object {
        const val MAX_AGE_MILLIS: Long = 14L * 24 * 60 * 60 * 1000
        const val MAX_EVENTS: Int = 1000

        /** [QueuedEvent.rowId] placeholder for a row an old-format file wrote before this field existed. */
        const val MISSING_ROW_ID: Long = -1L
        private const val FIRST_ROW_ID: Long = 0L
        private const val UNSEEDED: Long = Long.MIN_VALUE
    }
}
