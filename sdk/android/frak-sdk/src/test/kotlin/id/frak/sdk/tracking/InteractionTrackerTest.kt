package id.frak.sdk.tracking

import id.frak.sdk.config.Backoff
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
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
import java.io.IOException
import kotlin.random.Random

@OptIn(ExperimentalCoroutinesApi::class)
class InteractionTrackerTest {
    @get:Rule
    val folder: TemporaryFolder = TemporaryFolder()

    private val transport = FakeHttpTransport()
    private var now = 1_709_654_400_000L
    private var keys = 0
    private var currentClientId: String? = CLIENT_ID

    private lateinit var file: File
    private lateinit var queue: EventQueue

    /**
     * A [TestScope] extension so the tracker's detached drains share this test's scheduler and
     * run eagerly under [UnconfinedTestDispatcher] — `track` no longer awaits its own flush.
     */
    private fun TestScope.tracker(): InteractionTracker {
        file = File(folder.root, "frak-events.jsonl")
        queue = EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher(testScheduler))
        return InteractionTracker(
            queue = queue,
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
            logger = FrakLogger(FrakLogLevel.NONE, null),
            // Parented to backgroundScope so runTest cancels any drain still in flight at the end
            // of a test instead of leaking it; Unconfined so the drain runs before track returns.
            scope = CoroutineScope(backgroundScope.coroutineContext + UnconfinedTestDispatcher(testScheduler)),
            currentClientId = { currentClientId },
            now = { now },
            newKey = { "key-${keys++}" },
            // Seeded, so the jitter cannot make a test flaky.
            backoff = Backoff({ now }, Random(1)),
        )
    }

    private fun bodyOf(index: Int) = JSONObject(transport.requests[index].body!!)

    @Test
    fun `posts a sharing interaction with the client id header and drains the queue`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            tracker().track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())

            val request = transport.requests.single()
            assertEquals("POST", request.method)
            assertEquals("$FAKE_BASE_URL/user/track/interaction", request.url.toString())
            assertEquals(CLIENT_ID, request.headers["x-frak-client-id"])

            val body = bodyOf(0)
            assertEquals("sharing", body.getString("type"))
            assertEquals(MERCHANT_ID, body.getString("merchantId"))
            assertEquals(now / 1000, body.getLong("sharingTimestamp"))
            assertEquals("key-0", body.getString("idempotencyKey"))
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `keeps the capture timestamp and the idempotency key across a retry`() =
        runTest {
            transport.fail(IOException("offline"))
            val tracker = tracker()
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())

            val queued = queue.read(now).single()
            assertEquals("key-0", queued.idempotencyKey)

            // Hours later, back online: the timestamp is when the user shared,
            // not when the network came back, or the event lands in the wrong
            // attribution window.
            val sharedAt = now / 1000
            now += 6 * 60 * 60 * 1000
            transport.respond(200, "{}")
            tracker.flush()

            val body = bodyOf(transport.requests.lastIndex)
            assertEquals(sharedAt, body.getLong("sharingTimestamp"))
            assertEquals("key-0", body.getString("idempotencyKey"))
        }

    @Test
    fun `sends oldest first and stops at the first failure`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Custom("first"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Custom("second"))

            // First goes through, second is refused: the queue must keep the
            // second rather than skipping past it.
            now += Backoff.MAX_DELAY_MILLIS
            transport.respondEach(200, 503)
            tracker.flush()

            assertEquals("first", bodyOf(transport.requests.lastIndex - 1).getString("customType"))
            assertEquals(listOf("second"), queue.read(now).map { it.body.getString("customType") })
        }

    @Test
    fun `backs off after a failure instead of retrying immediately`() =
        runTest {
            val tracker = tracker()
            transport.respond(503, "")
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())
            val attempts = transport.requests.size

            tracker.flush()
            assertEquals("a flush inside the backoff window must not dial", attempts, transport.requests.size)

            now += Backoff.MAX_DELAY_MILLIS
            transport.respond(200, "{}")
            tracker.flush()
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `drops an event the backend keeps rejecting rather than blocking the queue`() =
        runTest {
            val tracker = tracker()
            transport.respond(422, """{"success":false,"code":"BAD"}""")
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Custom("poison"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Custom("healthy"))

            repeat(3) {
                now += Backoff.MAX_DELAY_MILLIS
                tracker.flush()
            }

            // The poison event is gone and the one behind it is reachable again.
            assertEquals(listOf("healthy"), queue.read(now).map { it.body.getString("customType") })
        }

    @Test
    fun `drops events captured under an id that has since been replaced`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())

            // The purge and an in-flight drain can race, so the guarantee has to
            // hold without it: the event carries the id it was captured under.
            currentClientId = "550e8400-e29b-41d4-a716-446655440009"
            now += Backoff.MAX_DELAY_MILLIS
            transport.respond(200, "{}")
            val before = transport.requests.size
            tracker.flush()

            assertEquals("a dead id's event must never reach the wire", before, transport.requests.size)
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `compacts expired rows off disk even with nothing to send`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())

            now += EventQueue.MAX_AGE_MILLIS + 1
            tracker.flush()

            assertFalse("the bound must hold on disk, not only on read", file.exists())
        }

    @Test
    fun `purge leaves nothing to emit under a dead id`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.Sharing())

            tracker.purge()
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `posts a purchase with the merchant and checkout token`() =
        runTest {
            transport.respond(200, """{"success":true,"identityGroupId":"g"}""")
            tracker().trackPurchase(MERCHANT_ID, CLIENT_ID, "cust-1", "order-1", "tok-1")

            val request = transport.requests.single()
            assertEquals("$FAKE_BASE_URL/user/track/purchase", request.url.toString())
            val body = bodyOf(0)
            assertEquals(MERCHANT_ID, body.getString("merchantId"))
            assertEquals("cust-1", body.getString("customerId"))
            assertEquals("order-1", body.getString("orderId"))
            assertEquals("tok-1", body.getString("token"))
        }

    @Test
    fun `omits absent arrival fields rather than sending them null`() =
        runTest {
            transport.respond(200, "{}")
            tracker().track(
                MERCHANT_ID,
                CLIENT_ID,
                Interaction.Arrival(referrerClientId = CLIENT_ID, referralTimestamp = 1_709_654_000),
            )

            val body = bodyOf(0)
            assertEquals("arrival", body.getString("type"))
            assertEquals(CLIENT_ID, body.getString("referrerClientId"))
            assertTrue("an absent wallet must not reach the wire", body.isNull("referrerWallet"))
        }

    private companion object {
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    }
}
