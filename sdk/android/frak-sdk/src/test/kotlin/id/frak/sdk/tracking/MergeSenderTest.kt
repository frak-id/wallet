package id.frak.sdk.tracking

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.DeviceKey
import id.frak.sdk.identity.DeviceKeyStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.identity.IdentityMerge
import id.frak.sdk.identity.JcaDeviceKey
import id.frak.sdk.identity.ProofCodec
import id.frak.sdk.identity.ProofOp
import id.frak.sdk.identity.TestKeys
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
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.GeneralSecurityException
import java.security.MessageDigest
import java.security.Signature

/**
 * Proofs are verified, not just asserted non-null: a wrong binding fails only in production.
 * Cases already pinned, more strongly, by [EventOutboxTest]'s merge tests (queue state and
 * failure counts, not just the outcome type) live there instead of here.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MergeSenderTest {
    private val transport = FakeHttpTransport()
    private val sender = MergeSender(FrakLogger(FrakLogLevel.NONE, null))

    private fun TestScope.context(
        identity: AnonymousIdStore,
        resolveMerchantId: suspend () -> String? = { MERCHANT_ID },
    ): SendContext =
        SendContext(
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
            resolveMerchantId = resolveMerchantId,
            signProof = { op, merchantId, binding -> identity.signProof(op, merchantId, binding) },
        )

    private fun TestScope.identity(
        keyStore: DeviceKeyStore = FakeDeviceKeyStore(),
        trackingEnabled: Boolean = true,
    ): AnonymousIdStore {
        val dispatcher = UnconfinedTestDispatcher(testScheduler)
        val values = InMemoryKeyValueStore()
        val store =
            AnonymousIdStore(
                keyStore,
                values,
                FrakLogger(FrakLogLevel.NONE, null),
                MERCHANT_ID,
                TrackingConsent(values, trackingEnabled, FrakLogger(FrakLogLevel.NONE, null), dispatcher),
                dispatcher,
            )
        store.startEagerGeneration(CoroutineScope(dispatcher))
        return store
    }

    private fun row(
        anonymousId: String?,
        merchantId: String? = MERCHANT_ID,
    ) = QueuedRow(
        idempotencyKey = TOKEN,
        kind = MergeSender.KIND,
        payload = JSONObject(),
        clientId = anonymousId,
        merchantId = merchantId,
        capturedAtMillis = NOW,
        rowId = 0,
    )

    @Test
    fun `posts the merge to the execute route with the target id`() =
        runTest {
            transport.respond(200, """{"finalGroupId":"$MERCHANT_ID","merged":true}""")
            val identity = identity()
            val anonymousId = requireNotNull(identity.anonymousId())

            assertEquals(DeliveryOutcome.Delivered, sender.deliver(row(anonymousId), context(identity)))

            val request = transport.requests.single()
            assertEquals("POST", request.method)
            assertEquals("$FAKE_BASE_URL${IdentityMerge.MERGE_EXECUTE_PATH}", request.url.toString())
            val body = JSONObject(requireNotNull(request.body))
            assertEquals(TOKEN, body.getString("mergeToken"))
            assertEquals(anonymousId, body.getString("targetAnonymousId"))
            assertEquals(MERCHANT_ID, body.getString("merchantId"))
        }

    @Test
    fun `signs the proof over the merge token binding`() =
        runTest {
            transport.respond(200, "{}")
            val identity = identity()
            val anonymousId = requireNotNull(identity.anonymousId())
            sender.deliver(row(anonymousId), context(identity))

            val proof = JSONObject(requireNotNull(transport.requests.single().body)).getString("proof")
            val envelope = requireNotNull(Base64Url.decodeOrNull(proof))
            assertEquals(138, envelope.size)

            val expected =
                ProofCodec.buildMessage(
                    op = ProofOp.Merge,
                    merchantId = MERCHANT_ID,
                    anonymousId = anonymousId,
                    binding = MessageDigest.getInstance("SHA-256").digest(TOKEN.toByteArray(Charsets.UTF_8)),
                    ts = readTimestamp(envelope),
                )

            val verifier = Signature.getInstance(JcaDeviceKey.SIGNATURE_ALGORITHM)
            verifier.initVerify(TestKeys.publicKeyFromUncompressed(envelope.copyOfRange(1, 66)))
            verifier.update(expected)
            assertTrue(
                "proof does not verify against the canonical merge message",
                verifier.verify(TestKeys.rawToDerSignature(envelope.copyOfRange(74, 138))),
            )
        }

    @Test
    fun `holds when tracking is disabled, since no proof can be minted`() =
        runTest {
            val identity = identity(trackingEnabled = false)
            assertEquals(DeliveryOutcome.Hold, sender.deliver(row(ANONYMOUS_ID), context(identity)))
            assertTrue(transport.requests.isEmpty())
        }

    @Test
    fun `holds when the device has an id but cannot sign, and never spends the failure cap`() =
        runTest {
            val identity = identity(keyStore = UnsignableKeyStore())
            assertEquals(36, requireNotNull(identity.anonymousId()).length)
            assertEquals(DeliveryOutcome.Hold, sender.deliver(row(ANONYMOUS_ID), context(identity)))
            assertTrue(transport.requests.isEmpty())
        }

    @Test
    fun `reports a refusal without throwing`() =
        runTest {
            transport.respond(403, """{"code":"PROOF_INVALID"}""")
            val identity = identity()
            assertEquals(
                DeliveryOutcome.Rejected,
                sender.deliver(row(requireNotNull(identity.anonymousId())), context(identity)),
            )
        }

    @Test
    fun `drops a row that carries no anonymous id, without a request`() =
        runTest {
            val identity = identity()
            val outcome = sender.deliver(row(anonymousId = null), context(identity))
            assertEquals(DeliveryOutcome.Dropped, outcome)
            assertTrue(transport.requests.isEmpty())
        }

    /** Bytes 66..74 of the envelope: `v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)`. */
    private fun readTimestamp(envelope: ByteArray): Long {
        var value = 0L
        for (index in 66 until 74) value = (value shl 8) or (envelope[index].toLong() and 0xFF)
        return value
    }

    /** Derives an id fine, refuses every signature — a device locked before first unlock. */
    private class UnsignableKeyStore : DeviceKeyStore {
        private val real = TestKeys.generate()

        override fun loadOrCreate(): DeviceKey =
            object : DeviceKey {
                override val publicKeyUncompressed: ByteArray = real.publicKeyUncompressed

                override fun sign(message: ByteArray): ByteArray = throw GeneralSecurityException("refused")
            }

        override fun delete() = Unit
    }

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
        const val ANONYMOUS_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
        const val TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"
        const val NOW = 1_709_654_400_000L
    }
}
