package id.frak.sdk.identity

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.MessageDigest
import java.security.Signature

/** Proofs are verified, not just asserted non-null: a wrong binding fails only in production. */
@OptIn(ExperimentalCoroutinesApi::class)
class IdentityMergeTest {
    private val transport = FakeHttpTransport()

    private fun subject(
        scope: TestScope,
        trackingEnabled: Boolean = true,
        keyStore: DeviceKeyStore = FakeDeviceKeyStore(),
    ): Pair<IdentityMerge, AnonymousIdStore> {
        val dispatcher = UnconfinedTestDispatcher(scope.testScheduler)
        val logger = FrakLogger(FrakLogLevel.NONE, null)
        val values = InMemoryKeyValueStore()
        val identity =
            AnonymousIdStore(
                keyStore,
                values,
                logger,
                MERCHANT_ID,
                TrackingConsent(values, trackingEnabled, logger, dispatcher),
                dispatcher,
            )
        identity.startEagerGeneration(CoroutineScope(dispatcher))
        val merge = IdentityMerge(HttpClient(FAKE_BASE_URL, dispatcher, transport::open), identity, logger)
        return merge to identity
    }

    @Test
    fun `posts the merge to the execute route with the target id`() =
        runTest {
            transport.respond(200, """{"finalGroupId":"$MERCHANT_ID","merged":true}""")
            val (merge, identity) = subject(this)
            val anonymousId = requireNotNull(identity.anonymousId())

            assertTrue(merge.execute(TOKEN, MERCHANT_ID, anonymousId))

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
            val (merge, identity) = subject(this)
            val anonymousId = requireNotNull(identity.anonymousId())
            merge.execute(TOKEN, MERCHANT_ID, anonymousId)

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
    fun `acts on a given token only once`() =
        runTest {
            transport.respond(200, "{}")
            val (merge, identity) = subject(this)
            val anonymousId = requireNotNull(identity.anonymousId())

            assertTrue(merge.execute(TOKEN, MERCHANT_ID, anonymousId))
            assertFalse(merge.execute(TOKEN, MERCHANT_ID, anonymousId))
            assertEquals(1, transport.requests.size)
        }

    @Test
    fun `sends nothing when tracking is disabled`() =
        runTest {
            val (merge, _) = subject(this, trackingEnabled = false)
            assertFalse(merge.execute(TOKEN, MERCHANT_ID, ANONYMOUS_ID))
            assertTrue(transport.requests.isEmpty())
        }

    @Test
    fun `sends nothing when the device has an id but cannot sign`() =
        runTest {
            val (merge, identity) = subject(this, keyStore = UnsignableKeyStore())
            assertEquals(36, requireNotNull(identity.anonymousId()).length)
            assertFalse(merge.execute(TOKEN, MERCHANT_ID, ANONYMOUS_ID))
            assertTrue(transport.requests.isEmpty())
        }

    @Test
    fun `reports a refusal without throwing`() =
        runTest {
            transport.respond(403, """{"code":"PROOF_INVALID"}""")
            val (merge, identity) = subject(this)
            assertFalse(merge.execute(TOKEN, MERCHANT_ID, requireNotNull(identity.anonymousId())))
        }

    @Test
    fun `reports a transport failure without throwing`() =
        runTest {
            transport.fail(IOException("offline"))
            val (merge, identity) = subject(this)
            assertFalse(merge.execute(TOKEN, MERCHANT_ID, requireNotNull(identity.anonymousId())))
        }

    @Test
    fun `reads the token out of an inbound url and ignores links without one`() {
        assertEquals(TOKEN, IdentityMerge.parseToken("https://shop.example/p?fmt=$TOKEN"))
        assertEquals(TOKEN, IdentityMerge.parseToken("https://shop.example/p?fCtx=abc&fmt=$TOKEN&utm_source=frak"))
        assertNull(IdentityMerge.parseToken("https://shop.example/p?fCtx=abc"))
        assertNull(IdentityMerge.parseToken("https://shop.example/p?fmt="))
        assertNull(IdentityMerge.parseToken("not-a-url"))
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
    }
}
