package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

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
) {
    fun withFailure(): QueuedEvent = QueuedEvent(idempotencyKey, path, body, clientId, capturedAtMillis, failures + 1)

    fun toJson(): JSONObject =
        JSONObject()
            .put("k", idempotencyKey)
            .put("p", path)
            .put("b", body)
            .put("c", clientId)
            .put("t", capturedAtMillis)
            .put("f", failures)

    companion object {
        /** Null for an unreadable row: a torn tail, or a field an older build wrote. */
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
 */
internal class EventQueue(
    private val file: File,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    /** Oldest first. Rows that are unreadable, expired, or beyond the cap are dropped. */
    suspend fun read(now: Long): List<QueuedEvent> =
        withContext(ioDispatcher) {
            if (!file.isFile) return@withContext emptyList()

            val rows =
                try {
                    file.readLines()
                } catch (failure: Exception) {
                    logger.warn("Could not read the event queue; dropping it.", failure)
                    deleteFile()
                    return@withContext emptyList()
                }

            val events =
                rows
                    .filter { it.isNotBlank() }
                    .mapNotNull(QueuedEvent::fromJson)
                    .filter { now - it.capturedAtMillis <= MAX_AGE_MILLIS }

            // takeLast: oldest dropped first, a fresh event is more likely to still matter.
            if (events.size > MAX_EVENTS) events.takeLast(MAX_EVENTS) else events
        }

    suspend fun append(event: QueuedEvent) {
        withContext(ioDispatcher) {
            try {
                file.parentFile?.mkdirs()
                file.appendText(event.toJson().toString() + "\n")
            } catch (failure: Exception) {
                logger.warn("Could not enqueue an event", failure)
            }
        }
    }

    /** Atomically replaces the file's contents. An empty list deletes it. */
    suspend fun replace(events: List<QueuedEvent>) {
        withContext(ioDispatcher) {
            if (events.isEmpty()) {
                deleteFile()
                return@withContext
            }
            val temp = File(file.parentFile, file.name + ".tmp")
            try {
                file.parentFile?.mkdirs()
                temp.writeText(events.joinToString(separator = "") { it.toJson().toString() + "\n" })
                if (!temp.renameTo(file)) {
                    logger.warn("Could not compact the event queue; leaving it as it was.")
                    temp.delete()
                }
            } catch (failure: Exception) {
                logger.warn("Could not compact the event queue", failure)
                runCatching { temp.delete() }
            }
        }
    }

    suspend fun clear() {
        withContext(ioDispatcher) { deleteFile() }
    }

    /** Unhopped delete, for callers already on [ioDispatcher]. */
    private fun deleteFile() {
        runCatching { file.delete() }
    }

    companion object {
        const val MAX_AGE_MILLIS: Long = 14L * 24 * 60 * 60 * 1000
        const val MAX_EVENTS: Int = 1000
    }
}
