package id.frak.sdk.tracking

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.identity.IdentityMerge
import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.ServerClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.CopyOnWriteArrayList

@OptIn(ExperimentalCoroutinesApi::class)
class MergeClockSelfHealTest {
    @get:Rule
    val folder: TemporaryFolder = TemporaryFolder()

    private class MergeAttempt(
        val proofSeconds: Long,
        val status: Int,
    )

    private val merges = CopyOnWriteArrayList<MergeAttempt>()

    private val server: HttpServer =
        HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0).apply {
            createContext(IdentityMerge.MERGE_EXECUTE_PATH, ::handleMerge)
            start()
        }

    @After
    fun stopServer() = server.stop(0)

    private fun handleMerge(exchange: HttpExchange) {
        val body = JSONObject(exchange.requestBody.readBytes().toString(Charsets.UTF_8))
        val proofSeconds = proofSeconds(body.getString("proof"))
        val tooFarAhead = proofSeconds > serverNowSeconds() + PROOF_FUTURE_LIMIT_SECONDS
        val status = if (tooFarAhead) 403 else 200
        merges += MergeAttempt(proofSeconds, status)

        val reply =
            if (tooFarAhead) {
                """{"code":"PROOF_INVALID"}"""
            } else {
                """{"finalGroupId":"$MERCHANT_ID","merged":true}"""
            }.toByteArray()
        exchange.sendResponseHeaders(status, reply.size.toLong())
        exchange.responseBody.use { it.write(reply) }
    }

    // The JDK server stamps every response with a `Date` of the real time, so that is the server's clock.
    private fun serverNowSeconds(): Long = System.currentTimeMillis() / 1000

    /** Bytes 66..74 of the envelope: `v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)`. */
    private fun proofSeconds(proof: String): Long {
        val envelope = requireNotNull(Base64Url.decodeOrNull(proof))
        return (66 until 74).fold(0L) { value, index -> (value shl 8) or (envelope[index].toLong() and 0xFF) }
    }

    private fun deviceNowMillis(): Long = System.currentTimeMillis() + DEVICE_AHEAD_MILLIS

    private lateinit var queue: EventQueue

    private fun TestScope.outbox(): Pair<EventOutbox, AnonymousIdStore> {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val logger = FrakLogger(FrakLogLevel.NONE, null)
        val clock = ServerClock(wallClock = ::deviceNowMillis)
        val values = InMemoryKeyValueStore()
        val identity =
            AnonymousIdStore(
                FakeDeviceKeyStore(),
                values,
                logger,
                MERCHANT_ID,
                TrackingConsent(values, true, logger, dispatcher),
                dispatcher,
                clock,
            )
        identity.startEagerGeneration(CoroutineScope(dispatcher))
        queue = EventQueue(File(folder.root, "frak-events.jsonl"), logger, dispatcher)
        val outbox =
            EventOutbox(
                queue = queue,
                http = HttpClient("http://127.0.0.1:${server.address.port}", dispatcher, serverClock = clock),
                logger = logger,
                scope = CoroutineScope(backgroundScope.coroutineContext + dispatcher),
                currentClientId = { identity.anonymousId() },
                signProof = { op, merchantId, binding -> identity.signProof(op, merchantId, binding) },
                senders = RowSenders.default(logger),
                now = System::currentTimeMillis,
            )
        return outbox to identity
    }

    @Test
    fun `a merge rejected for a fast device clock succeeds on the next drain, re-signed with the server's time`() =
        runTest {
            val (outbox, identity) = outbox()
            outbox.trackMerge(MERCHANT_ID, requireNotNull(identity.anonymousId()), MERGE_TOKEN)

            val rejected = merges.single()
            assertEquals(403, rejected.status)
            assertEquals((deviceNowMillis() / 1000).toDouble(), rejected.proofSeconds.toDouble(), 2.0)
            assertEquals("a rejected merge must stay queued", 1, queue.read(System.currentTimeMillis()).size)

            outbox.flush()

            assertEquals(2, merges.size)
            val retried = merges.last()
            assertEquals(200, retried.status)
            assertEquals(serverNowSeconds().toDouble(), retried.proofSeconds.toDouble(), 2.0)
            assertTrue("an accepted merge must leave the queue", queue.read(System.currentTimeMillis()).isEmpty())
        }

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
        const val MERGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"
        const val DEVICE_AHEAD_MILLIS = 120_000L
        const val PROOF_FUTURE_LIMIT_SECONDS = 60L
    }
}
