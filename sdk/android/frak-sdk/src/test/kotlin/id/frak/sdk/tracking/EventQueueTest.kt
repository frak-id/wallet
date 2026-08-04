package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class EventQueueTest {
    @get:Rule
    val folder: TemporaryFolder = TemporaryFolder()

    private lateinit var file: File
    private lateinit var queue: EventQueue

    private fun open() {
        file = File(folder.root, "events/frak-events.jsonl")
        // Unconfined: EventQueue now hops to its ioDispatcher, and every assertion
        // here is a read-after-write, so the hop must not defer the work.
        queue = EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher())
    }

    private fun event(
        key: String,
        capturedAt: Long = NOW,
        failures: Int = 0,
        rowId: Long = EventQueue.MISSING_ROW_ID,
    ) = QueuedEvent(
        idempotencyKey = key,
        path = "/user/track/interaction",
        body = JSONObject().put("type", "sharing").put("merchantId", MERCHANT_ID),
        clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45",
        capturedAtMillis = capturedAt,
        failures = failures,
        rowId = rowId,
    )

    /** Writes a raw pre-2.7 line: every current field except `"r"`, which never existed. */
    private fun appendPreMigrationLine(
        key: String,
        capturedAt: Long = NOW,
    ) {
        file.parentFile?.mkdirs()
        val line =
            JSONObject()
                .put("k", key)
                .put("p", "/user/track/interaction")
                .put("b", JSONObject().put("type", "sharing").put("merchantId", MERCHANT_ID))
                .put("c", "256b1be3-2745-41d1-89d4-9121cc87bc45")
                .put("t", capturedAt)
                .put("f", 0)
                .toString()
        file.appendText(line + "\n")
    }

    @Test
    fun `round-trips events in order, creating the directory it needs`() =
        runTest {
            open()
            queue.append(event("a"))
            queue.append(event("b"))

            val read = queue.read(NOW)
            assertEquals(listOf("a", "b"), read.map { it.idempotencyKey })
            assertEquals("sharing", read.first().body.getString("type"))
            assertEquals(MERCHANT_ID, read.first().body.getString("merchantId"))
        }

    @Test
    fun `survives a torn tail`() =
        runTest {
            open()
            queue.append(event("a"))
            // A kill mid-write leaves a partial line. Losing that one event is the
            // correct outcome; losing the whole queue is not.
            file.appendText("""{"k":"b","p":"/user/tra""")

            assertEquals(listOf("a"), queue.read(NOW).map { it.idempotencyKey })
        }

    @Test
    fun `drops events past the age bound`() =
        runTest {
            open()
            queue.append(event("stale", capturedAt = NOW - EventQueue.MAX_AGE_MILLIS - 1))
            queue.append(event("fresh", capturedAt = NOW))

            assertEquals(listOf("fresh"), queue.read(NOW).map { it.idempotencyKey })
        }

    @Test
    fun `drops the oldest past the count bound`() =
        runTest {
            open()
            repeat(EventQueue.MAX_EVENTS + 5) { queue.append(event("e$it")) }

            val read = queue.read(NOW)
            assertEquals(EventQueue.MAX_EVENTS, read.size)
            assertEquals("e5", read.first().idempotencyKey)
        }

    @Test
    fun `compacts atomically and leaves no temp file behind`() =
        runTest {
            open()
            queue.append(event("a"))
            queue.append(event("b"))

            queue.replace(queue.read(NOW).drop(1))

            assertEquals(listOf("b"), queue.read(NOW).map { it.idempotencyKey })
            assertFalse(File(file.parentFile, file.name + ".tmp").exists())
        }

    @Test
    fun `deletes the file when nothing is left, and reads an absent file as empty`() =
        runTest {
            open()
            queue.append(event("a"))
            queue.replace(emptyList())

            assertFalse(file.exists())
            assertTrue(queue.read(NOW).isEmpty())
        }

    @Test
    fun `preserves the failure count across a compaction`() =
        runTest {
            open()
            queue.append(event("a"))
            queue.replace(queue.read(NOW).map { it.withFailure() })

            assertEquals(1, queue.read(NOW).single().failures)
        }

    @Test
    fun `rowId increases and never repeats, even for two events sharing an idempotencyKey`() =
        runTest {
            open()
            // Same idempotencyKey on purpose (2.7): a caller-suppliable key is not guaranteed
            // unique, and rowId is exactly what disambiguates two such rows from each other.
            queue.append(event("same-key"))
            queue.append(event("same-key"))
            queue.append(event("same-key"))

            val rowIds = queue.read(NOW).map { it.rowId }
            assertEquals(rowIds, rowIds.sorted())
            assertEquals(rowIds.size, rowIds.toSet().size)
        }

    @Test
    fun `rowId survives a reload from disk, seeded past the highest id already written`() =
        runTest {
            open()
            queue.append(event("a"))
            queue.append(event("b"))
            val before = queue.read(NOW).map { it.rowId }

            // A fresh EventQueue instance over the same file simulates a process restart: there
            // is no in-memory counter to inherit, only what the last read/append left on disk.
            val reopened = EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher())
            assertEquals(before, reopened.read(NOW).map { it.rowId })

            reopened.append(event("c"))
            val afterAppend = reopened.read(NOW)
            assertTrue(
                "a rowId assigned after reopening must exceed every id written before it",
                afterAppend.last().rowId > before.max(),
            )
        }

    @Test
    fun `two events with the same idempotencyKey are reconciled independently by rowId`() =
        runTest {
            open()
            queue.append(event("dup"))
            queue.append(event("dup"))
            val (first, second) = queue.read(NOW)

            // Only the first is uploaded and reconciled away; a key-based reconcile would have
            // deleted both, or the wrong one, since they share an idempotencyKey.
            queue.replace(queue.read(NOW).filterNot { it.rowId == first.rowId })

            val remaining = queue.read(NOW)
            assertEquals(listOf(second.rowId), remaining.map { it.rowId })
            assertEquals("dup", remaining.single().idempotencyKey)
        }

    @Test
    fun `migrates a pre-2-7 file with no rowId field, assigning ids in on-disk order and persisting them`() =
        runTest {
            open()
            appendPreMigrationLine("old-a", capturedAt = NOW - 1)
            appendPreMigrationLine("old-b", capturedAt = NOW)

            val migrated = queue.read(NOW)
            assertEquals(listOf("old-a", "old-b"), migrated.map { it.idempotencyKey })
            assertEquals(listOf(0L, 1L), migrated.map { it.rowId })

            // Persisted, not just returned in memory: a second read (a fresh instance, so
            // nothing is cached) must see the same ids rather than re-migrating and reassigning.
            val reopened = EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher())
            assertEquals(listOf(0L, 1L), reopened.read(NOW).map { it.rowId })

            reopened.append(event("new"))
            assertEquals(2L, reopened.read(NOW).last().rowId)
        }

    @Test
    fun `appending to a pre-2-7 file before it is ever read keeps the newest row's id highest`() =
        runTest {
            open()
            appendPreMigrationLine("old-a", capturedAt = NOW - 1)
            appendPreMigrationLine("old-b", capturedAt = NOW)

            // No read() yet: append's own seed path (readExistingForSeed), not read's, must
            // reserve one id per un-migrated row ahead of it — otherwise "new" would take id 0,
            // the same id the later migration in read() assigns to "old-a", and the newest row
            // would carry the LOWEST id instead of the highest.
            queue.append(event("new"))

            val all = queue.read(NOW)
            val ids = all.map { it.rowId }
            assertEquals(3, ids.distinct().size)
            assertEquals(listOf("old-a", "old-b", "new"), all.map { it.idempotencyKey })
            assertEquals("new", all.maxByOrNull { it.rowId }?.idempotencyKey)
        }

    @Test
    fun `read still returns the true events when its migration rewrite fails to persist (2-7,5)`() =
        runTest {
            open()
            appendPreMigrationLine("old-a", capturedAt = NOW - 1)
            appendPreMigrationLine("old-b", capturedAt = NOW)

            // Forces replaceLocked's rename to fail: the temp file path is occupied by a
            // directory, so File.renameTo can never succeed over it.
            val tempPath = File(file.parentFile, file.name + ".tmp")
            tempPath.mkdirs()

            // read() must NOT signal the non-durable rewrite by returning an empty list: that
            // would be indistinguishable from "the queue is empty" to every caller, and
            // InteractionTracker.flush's bare compaction (`if (rows.isEmpty()) replace(emptyList())`)
            // would then delete a queue that is very much not empty. The durability signal lives
            // out-of-band, on EventQueue.reconcile alone — see the caller-path test below.
            val migrated = queue.read(NOW)
            assertEquals(listOf("old-a", "old-b"), migrated.map { it.idempotencyKey })

            // The ids themselves are real for this pass but not guaranteed to survive a
            // restart: the rewrite never landed, so a fresh instance re-migrates from scratch
            // and may assign different ones. Not asserted here — see the reopened-instance
            // shape in "rowId survives a reload from disk" for the durable-write case.
            tempPath.deleteRecursively()
            val retried = queue.read(NOW)
            assertEquals(listOf("old-a", "old-b"), retried.map { it.idempotencyKey })
        }

    @Test
    fun `reconcile refuses to compact the file when its read could not persist a migration (2-7,5)`() =
        runTest {
            open()
            appendPreMigrationLine("old-a", capturedAt = NOW - 1)
            appendPreMigrationLine("old-b", capturedAt = NOW)

            val tempPath = File(file.parentFile, file.name + ".tmp")
            tempPath.mkdirs()

            // The exact call InteractionTracker.flush makes after a drain: reconcile with
            // nothing delivered, as if every send in this pass failed before reconcile ever ran.
            val result = queue.reconcile(delivered = emptySet(), retried = emptyMap(), now = NOW)

            // The in-memory answer is still correct for this pass...
            assertEquals(listOf("old-a", "old-b"), result.map { it.idempotencyKey })

            tempPath.deleteRecursively()
            // ...and critically, the FILE was never touched: reconcile must not compact against
            // a read whose migration ids are not durable, or the very next flush would silently
            // wipe every event still on disk instead of retrying with fresh ids.
            assertEquals(listOf("old-a", "old-b"), queue.read(NOW).map { it.idempotencyKey })
        }

    @Test
    fun `the outbound wire body never contains a row id field`() =
        runTest {
            open()
            queue.append(event("wire-check"))
            val stored = queue.read(NOW).single()

            // rowId lives only in QueuedEvent.toJson() (the on-disk envelope) and never in
            // .body, which is exactly what InteractionTracker.flush sends as the POST payload.
            assertFalse(stored.body.toString().contains("\"r\""))
            assertFalse(stored.body.has("r"))
        }

    private companion object {
        const val NOW = 1_709_654_400_000
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
    }
}
