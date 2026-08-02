package id.frak.sdk.core

import id.frak.sdk.OpenAppResult
import id.frak.sdk.applink.FakeAppLauncher
import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.sharing.SharingLinkBuilder
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.EventQueue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Pins [DefaultFrakClient.configUpdates] conflation: a `StateFlow` conflates via
 * `equals`, so [id.frak.sdk.config.FrakResolvedConfig] must have one, or every
 * `resolveConfig()` call — including a cache hit — emits a fresh value.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DefaultFrakClientTest {
    @get:Rule
    val temporaryFolder: TemporaryFolder = TemporaryFolder()

    private val launcher = FakeAppLauncher()

    private val transport = FakeHttpTransport()
    private val store = InMemoryKeyValueStore()

    @Test
    fun `a repeat resolve with an unchanged in-memory cache does not re-emit`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig()
            advanceUntilIdle()
            client.resolveConfig() // FRESH_TTL not elapsed: served from the same in-memory Entry
            advanceUntilIdle()

            collector.cancel()
            assertEquals("a same-reference cache hit must not re-emit", listOf(null, "Acme"), emissions)
        }

    @Test
    fun `two independently-fetched but byte-identical configs conflate to one emission`() =
        runTest {
            // ConfigStore hands back the very same object reference for an
            // in-memory hit, so that path conflates even under identity equality.
            // A background-revalidated or forced refetch does not: it decodes a
            // brand new object every time, so this is the path that actually
            // depends on FrakResolvedConfig.equals. forceRefresh with an
            // unchanged body is the simplest way to force two distinct decodes.
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig(forceRefresh = true)
            advanceUntilIdle()
            client.resolveConfig(forceRefresh = true) // same body, a fresh decode, a new object
            advanceUntilIdle()

            collector.cancel()
            assertEquals(
                "two structurally-equal but distinct objects must conflate to one emission",
                listOf(null, "Acme"),
                emissions,
            )
        }

    @Test
    fun `a genuinely changed config still emits`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig()
            advanceUntilIdle()
            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            client.resolveConfig(forceRefresh = true)
            advanceUntilIdle()

            collector.cancel()
            assertEquals(listOf(null, "Acme", "Acme Renamed"), emissions)
        }

    @Test
    fun `tracks an arrival from someone else's link, and never from its own`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, """{"success":true}""")
            advanceUntilIdle()

            val posts = { transport.requests.count { it.method == "POST" } }

            val ownLink = client.buildSharingLink(SharingRequest(link = "https://acme.example/p"))!!
            val before = posts()
            assertEquals("a link this device built is still one of ours", true, client.handleReferralLink(ownLink))
            advanceUntilIdle()
            assertEquals("the self-referral guard must suppress the arrival", before, posts())

            assertEquals(true, client.handleReferralLink(foreignLink()))
            advanceUntilIdle()
            assertEquals(before + 1, posts())

            val body = org.json.JSONObject(transport.requests.last().body!!)
            assertEquals("arrival", body.getString("type"))
            assertEquals(FOREIGN_CLIENT_ID, body.getString("referrerClientId"))
        }

    @Test
    fun `ignores a link carrying no referral context`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            assertEquals(false, client.handleReferralLink("https://acme.example/p?size=XL"))
        }

    @Test
    fun `deep links to the wallet when it is installed and to the store when it is not`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            assertEquals(OpenAppResult.OpenedStore, client.openFrakApp())
            assertEquals(true, launcher.opened.single().startsWith("https://play.google.com/store/apps/details"))
            assertEquals(true, launcher.opened.single().contains("referrer=merchantId%3D$MERCHANT_ID"))

            launcher.opened.clear()
            launcher.installedPackages = setOf(FrakEnvironment.Production.walletPackageId)
            assertEquals(OpenAppResult.OpenedApp, client.openFrakApp())
            assertEquals(true, launcher.opened.single().startsWith("frakwallet://install?m=$MERCHANT_ID"))
        }

    @Test
    fun `reports failure when nothing will handle either install url`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            launcher.canOpen = false
            assertEquals(OpenAppResult.Failed, client.openFrakApp())
        }

    @Test
    fun `preloadSharing mirrors the config flag frak-sdk-ui reads it through`() =
        runTest {
            val off = newClient(testScheduler)
            assertEquals(false, off.preloadSharing)

            val on = newClient(testScheduler, config = FrakConfig(merchantId = MERCHANT_ID, preloadSharing = true))
            assertEquals(true, on.preloadSharing)
        }

    // ioDispatcher (governs DefaultFrakClient's own background scope, including
    // SingleFlight and ConfigStore's disk I/O) is Standard, not Unconfined:
    // this file's assertions rely on background
    // work (revalidation, SingleFlight's shared coroutine) landing only at an
    // explicit advanceUntilIdle(), not eagerly mid-call the way Unconfined
    // would run it. SingleFlight itself no longer has a dispatcher constraint —
    // it registers with ConcurrentHashMap.putIfAbsent rather than mutating the
    // map from inside computeIfAbsent, so it no longer risks the "Recursive
    // update" crash a completed Job's invokeOnCompletion used to cause on a
    // real multi-threaded dispatcher. The HttpClient's own dispatcher stays
    // Unconfined, matching ConfigStoreTest.
    private fun newClient(
        testScheduler: kotlinx.coroutines.test.TestCoroutineScheduler,
        config: FrakConfig = FrakConfig(merchantId = MERCHANT_ID),
    ): DefaultFrakClient =
        DefaultFrakClient(
            config = config,
            store = store,
            queue =
                EventQueue(
                    File(temporaryFolder.root, "events.jsonl"),
                    FrakLogger(FrakLogLevel.NONE),
                    UnconfinedTestDispatcher(),
                ),
            identity =
                AnonymousIdStore(
                    keyStore = FakeDeviceKeyStore(),
                    store = InMemoryKeyValueStore(),
                    logger = FrakLogger(FrakLogLevel.NONE),
                    merchantMarker = MERCHANT_ID,
                    trackingEnabled = true,
                ),
            launcher = launcher,
            logger = FrakLogger(FrakLogLevel.NONE),
            ioDispatcher = kotlinx.coroutines.test.StandardTestDispatcher(testScheduler),
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
        )

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
        const val FOREIGN_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440001"

        /** A share link from another device: same merchant, a client id this one cannot own. */
        fun foreignLink(): String =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = FrakContext.V2(MERCHANT_ID, 1_709_654_400, clientId = FOREIGN_CLIENT_ID),
                attribution = null,
                defaults = null,
            )!!
    }
}
