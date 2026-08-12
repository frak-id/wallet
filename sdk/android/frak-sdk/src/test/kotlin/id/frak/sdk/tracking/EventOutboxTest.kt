package id.frak.sdk.tracking

import id.frak.sdk.config.Backoff
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.identity.ProofOp
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
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
class EventOutboxTest {
    @get:Rule
    val folder: TemporaryFolder = TemporaryFolder()

    private val transport = FakeHttpTransport()
    private var now = 1_709_654_400_000L
    private var keys = 0
    private var currentClientId: String? = CLIENT_ID

    /** Consent is withdrawn once N events have reached the wire; keyed off the transport, not a call count. */
    private var denyTrackingAfterRequests = Int.MAX_VALUE

    private suspend fun trackingAllowed(): Boolean = transport.requests.size < denyTrackingAfterRequests

    /** What a deferred row resolves to at drain. Null models a cold start that still cannot resolve. */
    private var resolvableMerchantId: String? = null
    private var merchantResolves = 0

    private suspend fun resolveMerchantId(): String? {
        merchantResolves++
        return resolvableMerchantId
    }

    /** Null models a keystore that refuses to sign, e.g. a locked device — see the merge Hold tests. */
    private var signProofResult: String? = "test-proof"

    private lateinit var file: File
    private lateinit var queue: EventQueue

    /** Exposed so a test can read the shared drain backoff directly, without a second flush() re-checking (and thereby clearing) it. */
    private var backoff: Backoff? = null

    private fun senders(): Map<String, RowSender> = RowSenders.default(FrakLogger(FrakLogLevel.NONE, null))

    /** A [TestScope] extension so the tracker's detached drains share this test's scheduler. */
    private fun TestScope.tracker(): EventOutbox {
        file = File(folder.root, "frak-events.jsonl")
        queue = EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher(testScheduler))
        return newTracker(queue)
    }

    private fun TestScope.newTracker(queue: EventQueue): EventOutbox =
        EventOutbox(
            queue = queue,
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
            logger = FrakLogger(FrakLogLevel.NONE, null),
            // Parented to backgroundScope so runTest cancels any drain still in flight.
            scope = CoroutineScope(backgroundScope.coroutineContext + UnconfinedTestDispatcher(testScheduler)),
            currentClientId = { currentClientId },
            trackingAllowed = { trackingAllowed() },
            resolveMerchantId = { resolveMerchantId() },
            signProof = { op, merchantId, binding -> signProof(op, merchantId, binding) },
            senders = senders(),
            now = { now },
            newKey = { "key-${keys++}" },
            // Seeded, so the jitter cannot make a test flaky.
            backoff = Backoff({ now }, Random(1)).also { backoff = it },
        )

    private suspend fun signProof(
        op: ProofOp,
        merchantId: String,
        binding: ByteArray,
    ): String? = signProofResult

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
            assertEquals(listOf("second"), queue.read(now).map { it.payload.getString("customType") })
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

            assertEquals(listOf("healthy"), queue.read(now).map { it.payload.getString("customType") })
        }

    @Test
    fun `transient failures never spend the failure cap, for an interaction`() =
        runTest {
            val tracker = tracker()
            transport.respond(503, "")
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

            repeat(5) {
                now += Backoff.MAX_DELAY_MILLIS
                tracker.flush()
            }

            assertEquals(0, queue.read(now).single().failures)
        }

    @Test
    fun `transient failures never spend the failure cap, for a merge`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            val subject = tracker()
            transport.fail(IOException("offline"))
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)

            repeat(5) {
                now += Backoff.MAX_DELAY_MILLIS
                subject.flush()
            }

            assertEquals(0, queue.read(now).single().failures)
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
    fun `purge clears rows of all three kinds`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            val tracker = tracker()
            transport.fail(IOException("offline"))
            tracker.track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())
            tracker.trackPurchase(MERCHANT_ID, CLIENT_ID, "cust-1", "order-1", "tok-1")
            tracker.trackMerge(MERCHANT_ID, CLIENT_ID, MERGE_TOKEN)
            assertEquals(3, queue.read(now).size)

            tracker.purge()
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `flush survives a failed migration rewrite instead of wiping the queue (2-7,critical)`() =
        runTest {
            val tracker = tracker()

            // A pre-migration file (no "r" field), written directly like an install upgrading in place.
            file.parentFile?.mkdirs()
            listOf("old-a" to now - 1, "old-b" to now).forEach { (key, capturedAt) ->
                file.appendText(
                    JSONObject()
                        .put("kind", InteractionSender.KIND)
                        .put("k", key)
                        .put("payload", JSONObject().put("type", "sharing"))
                        .put("c", CLIENT_ID)
                        .put("m", MERCHANT_ID)
                        .put("t", capturedAt)
                        .put("f", 0)
                        .toString() + "\n",
                )
            }

            // Occupies EventQueue.replaceLocked's temp path with a directory, so temp.writeText throws.
            // Non-empty, or its failure path's temp.delete() would clear it before the second rewrite.
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

    // Seeded directly: through `track`, each drain holds one event and the window would not exist.
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
            // re-send it; the undelivered one survives, since withdrawal is a pause, not an erasure.
            val remaining = queue.read(now)
            assertEquals(1, remaining.size)
            assertTrue(
                "the undelivered event must survive",
                remaining
                    .single()
                    .payload
                    .toString()
                    .contains("second"),
            )
        }

    @Test
    fun `holds an event captured with no merchant until one resolves`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            resolvableMerchantId = null

            val subject = tracker()
            subject.track(merchantId = null, clientId = CLIENT_ID, interaction = arrival())

            assertTrue("nothing may reach the wire without a merchant", transport.requests.isEmpty())
            val held = queue.read(now)
            assertEquals(1, held.size)
            assertFalse(
                "the row must stay deferred so a later drain resolves it",
                held.single().merchantId != null,
            )

            // The config finally resolved; the drain the SDK runs on that publish sends the row.
            resolvableMerchantId = MERCHANT_ID
            subject.flush()

            assertEquals(MERCHANT_ID, bodyOf(0).getString("merchantId"))
            assertEquals("arrival", bodyOf(0).getString("type"))
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `survives a process restart while still deferred`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            resolvableMerchantId = null
            tracker().track(merchantId = null, clientId = CLIENT_ID, interaction = arrival())

            // A second tracker over the same file is what a cold start after a kill actually is.
            resolvableMerchantId = MERCHANT_ID
            newTracker(
                EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher(testScheduler)),
            ).flush()

            assertEquals(MERCHANT_ID, bodyOf(0).getString("merchantId"))
        }

    @Test
    fun `resolves the merchant once per drain, however many rows are deferred`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            resolvableMerchantId = MERCHANT_ID

            val subject = tracker()
            subject.track(null, CLIENT_ID, Interaction.custom("first"))
            subject.track(null, CLIENT_ID, Interaction.custom("second"))
            subject.flush()

            assertEquals(2, transport.requests.size)
            // One per drain, not one per row: track() launches its own drain, so the bound that
            // matters is that no drain resolves twice.
            assertTrue("resolved $merchantResolves times for 2 rows", merchantResolves <= 3)
        }

    @Test
    fun `never resolves a merchant when every row already carries one`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            tracker().track(MERCHANT_ID, CLIENT_ID, Interaction.sharing())

            assertEquals(0, merchantResolves)
        }

    @Test
    fun `drops an arrival whose referrer belongs to another merchant`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            resolvableMerchantId = MERCHANT_ID

            val subject = tracker()
            // Captured on a cold start, where the guard has no own merchant to compare against
            // and lets it through; the drain is the first place that can catch it.
            subject.track(merchantId = null, clientId = CLIENT_ID, interaction = arrival(OTHER_MERCHANT_ID))
            subject.flush()

            assertTrue("a foreign-merchant arrival must never reach the wire", transport.requests.isEmpty())
            assertTrue("and it must not be held forever either", queue.read(now).isEmpty())
        }

    @Test
    fun `keeps an arrival whose referrer is this merchant, whatever the casing`() =
        runTest {
            transport.respond(200, """{"success":true}""")
            resolvableMerchantId = MERCHANT_ID
            tracker().track(null, CLIENT_ID, arrival(MERCHANT_ID.uppercase()))

            assertEquals(1, transport.requests.size)
        }

    @Test
    fun `a row of an unknown kind is skipped, never posted, and does not block the row queued behind it`() =
        runTest {
            val tracker = tracker()
            transport.respond(200, """{"success":true}""")

            queue.append(
                QueuedRow(
                    idempotencyKey = "mystery-1",
                    kind = "not-a-real-kind-yet",
                    payload = JSONObject(),
                    clientId = CLIENT_ID,
                    merchantId = MERCHANT_ID,
                    capturedAtMillis = now,
                    rowId = EventQueue.MISSING_ROW_ID,
                ),
            )
            queue.append(seeded("key-known", "known"))

            tracker.flush()

            assertEquals("only the known row may reach the wire", 1, transport.requests.size)
            assertEquals("known", bodyOf(0).getString("interactionType"))

            val remaining = queue.read(now)
            assertEquals("the unknown-kind row is left untouched, not dropped", 1, remaining.size)
            assertEquals("not-a-real-kind-yet", remaining.single().kind)
        }

    @Test
    fun `holds an inbound merge until a merchant resolves, then delivers it`() =
        runTest {
            resolvableMerchantId = null
            val subject = tracker()
            subject.trackMerge(merchantId = null, anonymousId = CLIENT_ID, mergeToken = MERGE_TOKEN)

            assertTrue("a merge must not be attempted without a merchant", transport.requests.isEmpty())
            assertEquals(1, queue.read(now).size)

            resolvableMerchantId = MERCHANT_ID
            transport.respond(200, """{"success":true}""")
            subject.flush()

            val body = bodyOf(0)
            assertEquals(MERCHANT_ID, body.getString("merchantId"))
            assertEquals(CLIENT_ID, body.getString("targetAnonymousId"))
            assertEquals(MERGE_TOKEN, body.getString("mergeToken"))
            assertTrue("a delivered merge must leave the queue", queue.read(now).isEmpty())
        }

    @Test
    fun `keeps an inbound merge across a process restart`() =
        runTest {
            resolvableMerchantId = null
            tracker().trackMerge(null, CLIENT_ID, MERGE_TOKEN)

            resolvableMerchantId = MERCHANT_ID
            transport.respond(200, """{"success":true}""")
            newTracker(
                EventQueue(file, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher(testScheduler)),
            ).flush()

            assertEquals(MERGE_TOKEN, bodyOf(0).getString("mergeToken"))
        }

    @Test
    fun `does not queue a merge token that is already queued`() =
        runTest {
            resolvableMerchantId = null
            val subject = tracker()
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)
            // What a cold start on a replayed intent looks like: the in-memory claim died with
            // the process, so only the queue can tell this is the same token.
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)

            assertEquals(1, queue.read(now).size)
        }

    @Test
    fun `gives up on a merge the backend keeps refusing`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            transport.respond(422, """{"success":false}""")
            val subject = tracker()
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)
            repeat(3) { subject.flush() }

            // Bounded by MAX_FAILURES, or a token the backend will never accept blocks every
            // interaction queued behind it forever.
            assertTrue("dropped after the failure cap", queue.read(now).isEmpty())
        }

    @Test
    fun `never gives up on a merge that only failed to reach the backend`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            transport.fail(IOException("offline"))
            val subject = tracker()
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)

            // Well past MAX_FAILURES. A transient outage must not spend the failure budget: a
            // single deep-link tap already runs two drains, and the next cold start runs a third,
            // so counting these would destroy the token inside one offline session.
            repeat(6) {
                now += BACKOFF_SETTLE_MILLIS
                subject.flush()
            }

            assertTrue("an unreachable backend must never drop a merge token", queue.read(now).isNotEmpty())

            transport.respond(200, """{"success":true}""")
            now += BACKOFF_SETTLE_MILLIS
            subject.flush()
            assertTrue("and it must still deliver once the network returns", queue.read(now).isEmpty())
        }

    @Test
    fun `never attempts a merge once tracking is withdrawn`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            denyTrackingAfterRequests = 0
            val subject = tracker()
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)
            subject.flush()

            assertTrue(transport.requests.isEmpty())
        }

    @Test
    fun `a proof that cannot be minted holds the merge row, which delivers once signing works`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            signProofResult = null
            val subject = tracker()
            subject.trackMerge(null, CLIENT_ID, MERGE_TOKEN)

            // Hold never arms the backoff, so a bare flush() (no time advance) must still hold —
            // and it must cost no request, and no failure, however many times it recurs.
            repeat(5) { subject.flush() }
            assertTrue("a locked keystore must never reach the wire", transport.requests.isEmpty())
            val held = queue.read(now)
            assertEquals(1, held.size)
            assertEquals(0, held.single().failures)

            signProofResult = "test-proof"
            transport.respond(200, """{"success":true}""")
            subject.flush()

            assertEquals(MERGE_TOKEN, bodyOf(0).getString("mergeToken"))
            assertTrue(queue.read(now).isEmpty())
        }

    @Test
    fun `a first Hold stamps heldSince on disk and does not send anything`() =
        runTest {
            resolvableMerchantId = null
            tracker().track(merchantId = null, clientId = CLIENT_ID, interaction = arrival())

            assertTrue("a held row must not reach the wire", transport.requests.isEmpty())
            val held = queue.read(now).single()
            assertEquals(now, held.heldSince)
        }

    @Test
    fun `a second Hold within the budget does not rewrite the file`() =
        runTest {
            resolvableMerchantId = null
            val tracker = tracker()
            tracker.track(merchantId = null, clientId = CLIENT_ID, interaction = arrival())
            val stampedAt = queue.read(now).single().heldSince

            val before = file.readBytes()
            now += 60 * 60 * 1000L
            val backdated = System.currentTimeMillis() - 3_600_000
            assertTrue("could not backdate the fixture", file.setLastModified(backdated))

            tracker.flush()

            assertArrayEquals("a still-budgeted Hold must not rewrite the file", before, file.readBytes())
            assertEquals(backdated, file.lastModified())
            assertEquals(
                "heldSince must stay the first stamp, not the later now()",
                stampedAt,
                queue.read(now).single().heldSince,
            )
        }

    @Test
    fun `a row held past its budget is dropped, and the row queued behind it is delivered in the same drain`() =
        runTest {
            resolvableMerchantId = null
            val tracker = tracker()
            tracker.track(merchantId = null, clientId = CLIENT_ID, interaction = Interaction.custom("stuck"))
            tracker.track(merchantId = MERCHANT_ID, clientId = CLIENT_ID, interaction = Interaction.custom("behind"))
            assertTrue("nothing may reach the wire while the head of the queue is held", transport.requests.isEmpty())

            now += DEFAULT_HOLD_TIMEOUT_MILLIS + 1
            transport.respond(200, """{"success":true}""")
            tracker.flush()

            assertEquals("only the row behind the dropped one may reach the wire", 1, transport.requests.size)
            assertEquals("behind", bodyOf(0).getString("customType"))
            assertTrue("the exhausted hold and the delivered row must both leave the queue", queue.read(now).isEmpty())
        }

    @Test
    fun `a merge row's hold budget is one hour, so two hours held drops it`() =
        runTest {
            resolvableMerchantId = null
            val subject = tracker()
            queue.append(
                QueuedRow(
                    idempotencyKey = MERGE_TOKEN,
                    kind = MergeSender.KIND,
                    payload = JSONObject(),
                    clientId = CLIENT_ID,
                    merchantId = null,
                    capturedAtMillis = now,
                    rowId = EventQueue.MISSING_ROW_ID,
                    heldSince = now,
                ),
            )

            now += 2 * 60 * 60 * 1000L
            subject.flush()

            assertTrue("a merge held past its one-hour budget must be dropped", queue.read(now).isEmpty())
        }

    @Test
    fun `an interaction row's hold budget is a day, so two hours held leaves it in place`() =
        runTest {
            resolvableMerchantId = null
            val subject = tracker()
            queue.append(
                QueuedRow(
                    idempotencyKey = "key-held",
                    kind = InteractionSender.KIND,
                    payload =
                        JSONObject()
                            .put("type", "custom")
                            .put("customType", "held")
                            .put("idempotencyKey", "key-held"),
                    clientId = CLIENT_ID,
                    merchantId = null,
                    capturedAtMillis = now,
                    rowId = EventQueue.MISSING_ROW_ID,
                    heldSince = now,
                ),
            )

            now += 2 * 60 * 60 * 1000L
            subject.flush()

            assertEquals("two hours is inside the interaction's one-day budget", 1, queue.read(now).size)
        }

    @Test
    fun `a row that holds and later becomes deliverable is delivered, never dropped`() =
        runTest {
            resolvableMerchantId = null
            val tracker = tracker()
            tracker.track(merchantId = null, clientId = CLIENT_ID, interaction = arrival())
            assertTrue(transport.requests.isEmpty())

            // Well inside every sender's hold budget: this must resolve, not expire.
            now += 60 * 60 * 1000L
            resolvableMerchantId = MERCHANT_ID
            transport.respond(200, """{"success":true}""")
            tracker.flush()

            assertEquals(MERCHANT_ID, bodyOf(0).getString("merchantId"))
            assertTrue(queue.read(now).isEmpty())
        }

    // Only the arming direction is testable: an expired entry is dropped before [flush] reaches a row.
    @Test
    fun `a dropped row does not arm the backoff, so the failure behind it gets a fresh window`() =
        runTest {
            resolvableMerchantId = MERCHANT_ID
            val tracker = tracker()
            transport.fail(IOException("offline"))
            queue.append(
                QueuedRow(
                    idempotencyKey = "key-drop",
                    kind = InteractionSender.KIND,
                    payload =
                        JSONObject()
                            .put("type", "arrival")
                            .put("referrerWallet", JSONObject.NULL)
                            .put("referrerClientId", "e8f1c0de-0000-4000-8000-000000000001")
                            .put("referrerMerchantId", OTHER_MERCHANT_ID)
                            .put("referralTimestamp", 1_709_654_000L),
                    clientId = CLIENT_ID,
                    merchantId = null,
                    capturedAtMillis = now,
                    rowId = EventQueue.MISSING_ROW_ID,
                ),
            )
            queue.append(seeded("key-retry", "will-fail"))

            tracker.flush()

            // A fresh, single-failure window: MIN_DELAY_MILLIS jittered to [500, 1000]. A Dropped
            // row that also armed the backoff would stack a second failure onto this one, at least
            // doubling it.
            val remaining = requireNotNull(backoff).remainingMillis(TRACK_BACKOFF_KEY)
            assertTrue("expected a single-failure window, got ${remaining}ms", remaining in 500L..1000L)
        }

    private fun arrival(referrerMerchantId: String? = null) =
        Interaction.arrival(
            referrerWallet = null,
            referrerClientId = "e8f1c0de-0000-4000-8000-000000000001",
            referrerMerchantId = referrerMerchantId,
            referralTimestamp = 1_709_654_000L,
        )

    private fun seeded(
        key: String,
        interactionType: String,
    ) = QueuedRow(
        idempotencyKey = key,
        kind = InteractionSender.KIND,
        payload =
            JSONObject()
                .put("type", "custom")
                .put("interactionType", interactionType),
        clientId = CLIENT_ID,
        merchantId = MERCHANT_ID,
        capturedAtMillis = now,
        rowId = EventQueue.MISSING_ROW_ID,
    )

    private companion object {
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
        const val OTHER_MERCHANT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
        const val MERGE_TOKEN = "fmt-token-0001"

        /** Mirrors EventOutbox's own private key; the test observes it from the outside via the injected [Backoff]. */
        const val TRACK_BACKOFF_KEY = "track"

        /** Past [Backoff.MAX_DELAY_MILLIS], so a test that wants the next drain to run gets it. */
        const val BACKOFF_SETTLE_MILLIS = 61_000L
    }
}
