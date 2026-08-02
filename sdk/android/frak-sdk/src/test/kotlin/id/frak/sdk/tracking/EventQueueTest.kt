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
    ) = QueuedEvent(
        idempotencyKey = key,
        path = "/user/track/interaction",
        body = JSONObject().put("type", "sharing").put("merchantId", MERCHANT_ID),
        clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45",
        capturedAtMillis = capturedAt,
        failures = failures,
    )

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

    private companion object {
        const val NOW = 1_709_654_400_000
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
    }
}
