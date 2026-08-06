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

    /**
     * The egress gate: consent is withdrawn once N events have reached the wire. Keyed off the
     * transport rather than a call counter, so this stays reachable mid-drain, unlike
     * `DefaultFrakClientTest`, where the drain only ever holds the single event that started it.
     */
    private var denyTrackingAfterRequests = Int.MAX_VALUE

    private suspend fun trackingAllowed(): Boolean = transport.requests.size < denyTrackingAfterRequests

    private lateinit var file: File
    private lateinit var queue: EventQueue

    /**
     * A [TestScope] extension so the tracker's detached drains share this test's scheduler and
     * run eagerly under [UnconfinedTestDispatcher]; `track` does not await its own flush.
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
            trackingAllowed = { trackingAllowed() },
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
            tracker().track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

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
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

            val queued = queue.read(now).single()
            assertEquals("key-0", queued.idempotencyKey)

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
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.custom("first"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.custom("second"))

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
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())
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
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.custom("poison"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.custom("healthy"))

            repeat(3) {
                now += Backoff.MAX_DELAY_MILLIS
                tracker.flush()
            }

            assertEquals(listOf("healthy"), queue.read(now).map { it.body.getString("customType") })
        }

    @Test
    fun `drops events captured under an id that has since been replaced`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

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
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

            now += EventQueue.MAX_AGE_MILLIS + 1
            tracker.flush()

            assertFalse("the bound must hold on disk, not only on read", file.exists())
        }

    @Test
    fun `purge leaves nothing to emit under a dead id`() =
        runTest {
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

            tracker.purge()
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `flush survives a failed migration rewrite instead of wiping the queue (2-7,critical)`() =
        runTest {
            val tracker = tracker()

            // A pre-migration file: every current field except "r", which never existed. Written
            // directly, bypassing append/track, exactly like an install upgrading in place.
            file.parentFile?.mkdirs()
            listOf("old-a" to now - 1, "old-b" to now).forEach { (key, capturedAt) ->
                file.appendText(
                    JSONObject()
                        .put("k", key)
                        .put("p", "/user/track/interaction")
                        .put("b", JSONObject().put("type", "sharing").put("merchantId", MERCHANT_ID))
                        .put("c", CLIENT_ID)
                        .put("t", capturedAt)
                        .put("f", 0)
                        .toString() + "\n",
                )
            }

            // Forces EventQueue.replaceLocked's write to fail during the migration read inside
            // flush: the temp path is occupied by a directory, so temp.writeText throws.
            // The directory must be non-empty: replaceLocked's failure path runs
            // runCatching { temp.delete() }, and File.delete() succeeds on an empty directory,
            // which would clear the obstruction before the second rewrite and hide the regression.
            val tempPath = File(file.parentFile, file.name + ".tmp")
            tempPath.mkdirs()
            File(tempPath, "occupied").writeText("x")

            transport.respond(200, """{"success":true}""")
            tracker.flush()

            tempPath.deleteRecursively()
            assertEquals(listOf("old-a", "old-b"), queue.read(now).map { it.idempotencyKey })
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
                Interaction.arrival(
                    referrerWallet = null,
                    referrerClientId = CLIENT_ID,
                    referrerMerchantId = null,
                    referralTimestamp = 1_709_654_000,
                ),
            )

            val body = bodyOf(0)
            assertEquals("arrival", body.getString("type"))
            assertEquals(CLIENT_ID, body.getString("referrerClientId"))
            assertTrue("an absent wallet must not reach the wire", body.isNull("referrerWallet"))
        }

    /**
     * A drain reads the whole backlog under [EventQueue]'s lock, then POSTs it one event at a
     * time outside that lock, so a consent withdrawal landing mid-drain must be caught at the
     * point of egress; purging the file cannot reach events the drain already holds in memory.
     * Withdrawal also nulls `currentClientId`, which disables the stale-id guard rather than
     * tightening it.
     *
     * The queue is seeded directly rather than through [InteractionTracker.track]: routed through
     * it, each drain would hold exactly one event under `UnconfinedTestDispatcher`, and the
     * mid-drain window would not exist to test.
     */
    @Test
    fun `stops mid-drain when consent is withdrawn, and keeps the unsent events`() =
        runTest {
            transport.respond(200, "{}")
            val tracker = tracker()
            queue.append(seeded("key-first", "first"))
            queue.append(seeded("key-second", "second"))
            // Withdrawn the instant the first event lands on the wire, i.e. between the two POSTs.
            denyTrackingAfterRequests = 1

            tracker.flush()

            assertEquals("only the event before the withdrawal may reach the wire", 1, transport.requests.size)
            assertEquals("first", bodyOf(0).getString("interactionType"))
            // Reconciled, not abandoned: the delivered event is removed so a stalled purge cannot
            // re-send it — an `arrival` carries no idempotency key, so a re-send would be
            // a duplicated referral payout. The undelivered one survives: withdrawal is a pause,
            // not an erasure.
            val remaining = queue.read(now)
            assertEquals(1, remaining.size)
            assertTrue(
                "the undelivered event must survive",
                remaining
                    .single()
                    .body
                    .toString()
                    .contains("second"),
            )
        }

    private fun seeded(
        key: String,
        interactionType: String,
    ) = QueuedEvent(
        idempotencyKey = key,
        path = "/user/track/interaction",
        body =
            JSONObject()
                .put("type", "custom")
                .put("interactionType", interactionType)
                .put("merchantId", MERCHANT_ID),
        clientId = CLIENT_ID,
        capturedAtMillis = now,
        rowId = EventQueue.MISSING_ROW_ID,
    )

    private companion object {
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    }
}
