package id.frak.sdk.identity

import id.frak.sdk.config.ConfigStore
import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
import id.frak.sdk.core.frakConfig
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class MerchantIdentityTest {
    private val transport = FakeHttpTransport()

    private fun newSubject(
        config: FrakConfig,
        trackingEnabled: Boolean = true,
    ): MerchantIdentity {
        val dispatcher = UnconfinedTestDispatcher()
        val logger = FrakLogger(FrakLogLevel.NONE)
        val identityStore = InMemoryKeyValueStore()
        val consent = TrackingConsent(identityStore, trackingEnabled, logger, dispatcher)
        val identity =
            AnonymousIdStore(
                keyStore = FakeDeviceKeyStore(),
                store = identityStore,
                logger = logger,
                merchantMarker = config.merchantId ?: config.packageId.orEmpty(),
                consent = consent,
                ioDispatcher = dispatcher,
            )
        identity.startEagerGeneration(CoroutineScope(dispatcher))
        val configStore =
            ConfigStore(
                HttpClient(FAKE_BASE_URL, dispatcher, transport::open),
                InMemoryKeyValueStore(),
                logger,
                CoroutineScope(dispatcher),
                dispatcher,
            )
        return MerchantIdentity(config, identity, configStore)
    }

    @Test
    fun `merchant short-circuits on a configured id, under every policy, without a network call`() =
        runTest {
            val subject = newSubject(frakConfig(merchantId = MERCHANT_ID))

            assertEquals(MERCHANT_ID, subject.merchant(MerchantPolicy.Required))
            assertEquals(MERCHANT_ID, subject.merchant(MerchantPolicy.Optional))
            assertEquals(MERCHANT_ID, subject.merchant(MerchantPolicy.CachedOnly))
            assertEquals(0, transport.requests.size)
        }

    @Test
    fun `merchant required resolves over the network and lets a failure escape as FrakError`() =
        runTest {
            transport.respond(200, BODY)
            val resolved = newSubject(frakConfig(packageId = "com.acme.app"))
            assertEquals(MERCHANT_ID, resolved.merchant(MerchantPolicy.Required))

            transport.fail(IOException("offline"))
            val unresolved = newSubject(frakConfig(packageId = "com.acme.app"))
            assertThrows(FrakError::class.java) {
                runBlocking { unresolved.merchant(MerchantPolicy.Required) }
            }
        }

    @Test
    fun `merchant optional resolves like required, but swallows a resolve failure to null`() =
        runTest {
            transport.respond(200, BODY)
            val resolved = newSubject(frakConfig(packageId = "com.acme.app"))
            assertEquals(MERCHANT_ID, resolved.merchant(MerchantPolicy.Optional))

            transport.fail(IOException("offline"))
            val unresolved = newSubject(frakConfig(packageId = "com.acme.app"))
            assertNull(unresolved.merchant(MerchantPolicy.Optional))
        }

    @Test
    fun `merchant cachedOnly never touches the network, and serves only what was already cached`() =
        runTest {
            transport.respond(200, BODY)
            val subject = newSubject(frakConfig(packageId = "com.acme.app"))

            assertNull(subject.merchant(MerchantPolicy.CachedOnly))
            assertEquals("a cache miss must not fall back to the network", 0, transport.requests.size)

            subject.merchant(MerchantPolicy.Required)
            val requestsAfterResolve = transport.requests.size

            assertEquals(MERCHANT_ID, subject.merchant(MerchantPolicy.CachedOnly))
            assertEquals("a cache hit must not touch the network either", requestsAfterResolve, transport.requests.size)
        }

    @Test
    fun `pair checks the anonymous id first, so a withdrawn consent never resolves`() =
        runTest {
            transport.respond(200, BODY)
            val subject = newSubject(frakConfig(packageId = "com.acme.app"), trackingEnabled = false)

            assertNull(subject.pair(MerchantPolicy.Optional))
            assertEquals(0, transport.requests.size)
        }

    @Test
    fun `pair is absent when only the merchant half is missing`() =
        runTest {
            transport.fail(IOException("offline"))
            val subject = newSubject(frakConfig(packageId = "com.acme.app"))

            assertNull(subject.pair(MerchantPolicy.Optional))
        }

    @Test
    fun `pair carries both halves once both resolve`() =
        runTest {
            transport.respond(200, BODY)
            val subject = newSubject(frakConfig(packageId = "com.acme.app"))

            val pair = subject.pair(MerchantPolicy.Optional)
            assertEquals(MERCHANT_ID, pair?.first)
            assertEquals(36, pair?.second?.length)
        }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
    }
}
