package id.frak.sdk.core

import id.frak.sdk.OpenAppResult
import id.frak.sdk.applink.FakeAppLauncher
import id.frak.sdk.config.ConfigStore
import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import id.frak.sdk.sharing.SharingLinkBuilder
import id.frak.sdk.sharing.frakContextV2
import id.frak.sdk.sharing.sharingRequest
import id.frak.sdk.tracking.EventQueue
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class DefaultFrakClientTest {
    @get:Rule
    val temporaryFolder: TemporaryFolder = TemporaryFolder()

    private val launcher = FakeAppLauncher()

    private val transport = FakeHttpTransport()
    private val store = InMemoryKeyValueStore()

    @Test
    fun `campaigns forceRefresh also forces the config resolve, not just the rewards fetch (D6)`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            client.campaigns(forceRefresh = false)
            val resolvesAfterFirst = transport.requests.count { it.url.path == ConfigStore.RESOLVE_PATH }

            // The forced call's rewards fetch fails to decode BODY; only the resolve count matters.
            runCatching { client.campaigns(forceRefresh = true) }
            val resolvesAfterForced = transport.requests.count { it.url.path == ConfigStore.RESOLVE_PATH }

            assertEquals("the first call should resolve once", 1, resolvesAfterFirst)
            assertEquals(
                "forceRefresh = true must bypass the config cache too, not just the rewards cache",
                2,
                resolvesAfterForced,
            )
        }

    @Test
    fun `the config resolves eagerly at init, with nobody asking`() =
        runTest {
            transport.respond(200, BODY)

            newClient(testScheduler)
            advanceUntilIdle()

            // The warm cache is what lets a referral arrival on a cold start answer without
            // blocking, and what lets the backend's merchant id win over a configured one.
            assertEquals(
                1,
                transport.requests.count { it.url.path == ConfigStore.RESOLVE_PATH },
            )
        }

    @Test
    fun `tracks an arrival from someone else's link, and never from its own`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, """{"success":true}""")
            advanceUntilIdle()

            val posts = { transport.requests.count { it.method == "POST" } }

            val ownLink = client.buildSharingLink(sharingRequest(link = "https://acme.example/p"))!!
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
    fun `ignores a v2 arrival minted for a different merchant`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, """{"success":true}""")
            advanceUntilIdle()

            val posts = { transport.requests.count { it.method == "POST" } }
            val before = posts()

            assertEquals(true, client.handleReferralLink(foreignMerchantLink()))
            advanceUntilIdle()
            assertEquals("a foreign-merchant context must not be tracked as this merchant's arrival", before, posts())
        }

    @Test
    fun `tracks a v2 arrival when only the configured merchant id's case or whitespace differs`() =
        runTest {
            // FrakContextCodec requires a canonical lowercase UUID, so only FrakConfig.merchantId can differ.
            val client = newClient(testScheduler, config = frakConfig(merchantId = " ${MERCHANT_ID.uppercase()} "))
            transport.respond(200, """{"success":true}""")
            advanceUntilIdle()

            val posts = { transport.requests.count { it.method == "POST" } }
            val before = posts()

            assertEquals(true, client.handleReferralLink(foreignLink()))
            advanceUntilIdle()
            assertEquals(
                "a case/whitespace difference in the merchant id must not be mistaken for a foreign merchant",
                before + 1,
                posts(),
            )
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
    fun `a tracking failure never escapes handleReferralLink, mirroring the Swift twin`() =
        runTest {
            // No merchantId configured, so the arrival resolves one over the network — made to fail below.
            val client =
                newClient(testScheduler, config = frakConfig(packageId = "com.acme.app"))
            transport.fail(java.io.IOException("network down"))

            assertEquals(
                "a tracking/network failure must not throw out of handleReferral",
                true,
                client.handleReferralLink(foreignLink()),
            )
        }

    @Test
    fun `deep links to the wallet when something handles the scheme, and to the store when nothing does`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            assertEquals(OpenAppResult.OpenedStore, client.openFrakApp())
            assertEquals(true, launcher.opened.single().startsWith("https://play.google.com/store/apps/details"))
            assertEquals(true, launcher.opened.single().contains("referrer=merchantId%3D$MERCHANT_ID"))

            launcher.opened.clear()
            launcher.openableSchemes = setOf(FrakEnvironment.Production.walletScheme)
            assertEquals(OpenAppResult.OpenedApp, client.openFrakApp())
            assertEquals(true, launcher.opened.single().startsWith("frakwallet://install?m=$MERCHANT_ID"))
            // substringAfter needs its empty default, or a missing `&p=` returns the whole URL.
            assertEquals(
                true,
                launcher.opened
                    .single()
                    .substringAfter("&p=", "")
                    .isNotEmpty(),
            )
        }

    @Test
    fun `opens the wallet on a launch that works even when the probe says it is absent`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            launcher.installedPackages = emptySet()
            launcher.openableSchemes = setOf(FrakEnvironment.Production.walletScheme)

            assertEquals(false, client.isFrakAppInstalled())
            assertEquals(OpenAppResult.OpenedApp, client.openFrakApp())
            assertEquals(true, launcher.opened.single().startsWith("frakwallet://install?m=$MERCHANT_ID"))
        }

    @Test
    fun `the install page url carries the identity and a proof, with the proof in the fragment`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)
            advanceUntilIdle()

            val page = client.installPageUrl(RETURN_SCHEME, SESSION_ID)
            val anonymousId = client.anonymousId()

            assertEquals(
                true,
                page?.startsWith(
                    "https://wallet.frak.id/install?embed=native&m=$MERCHANT_ID&a=$anonymousId" +
                        "&returnScheme=frak-com.acme.app&sid=session-1",
                ),
            )
            assertEquals(true, (page?.substringAfter("#p=")?.length ?: 0) > 0)
            assertEquals(false, page?.contains("&p="))
        }

    @Test
    fun `the install page url needs an identity, like every other install link`() =
        runTest {
            val client =
                newClient(
                    testScheduler,
                    config = frakConfig(merchantId = MERCHANT_ID, trackingEnabled = false),
                )
            advanceUntilIdle()

            // Throws rather than answering null: a caller refused an install page needs to know it
            // was refused, not receive the same answer as "there was nothing to link to".
            val refused =
                assertThrows(FrakError::class.java) {
                    runBlocking { client.installPageUrl(RETURN_SCHEME, SESSION_ID) }
                }
            assertEquals(FrakError.Kind.TRACKING_DISABLED, refused.kind)
        }

    @Test
    fun `a share link refused for want of identity throws, where nothing to link to is still null`() =
        runTest {
            val disabled =
                newClient(
                    testScheduler,
                    config = frakConfig(merchantId = MERCHANT_ID, trackingEnabled = false),
                )
            advanceUntilIdle()

            val refused =
                assertThrows(FrakError::class.java) {
                    runBlocking { disabled.buildSharingLink(sharingRequest(link = "https://acme.example/p")) }
                }
            assertEquals(FrakError.Kind.TRACKING_DISABLED, refused.kind)

            // The other channel, unchanged: tracking is on and the merchant resolves, but the request
            // carries no link and no homepage is configured, so there is genuinely nothing to build on.
            val enabled = newClient(testScheduler, config = frakConfig(merchantId = MERCHANT_ID))
            advanceUntilIdle()
            assertNull(enabled.buildSharingLink(sharingRequest()))
        }

    @Test
    fun `track reports TrackingDisabled, a fresh instance each time, without a network call (A8)`() =
        runTest {
            val client =
                newClient(
                    testScheduler,
                    config = frakConfig(merchantId = MERCHANT_ID, trackingEnabled = false),
                )

            val first = client.track(Interaction.custom("first"))
            val second = client.track(Interaction.custom("second"))

            val firstError = (first as FrakResult.Failure).error
            val secondError = (second as FrakResult.Failure).error
            assertTrue("expected TrackingDisabled, got $firstError", firstError is FrakError.TrackingDisabled)
            assertTrue("expected TrackingDisabled, got $secondError", secondError is FrakError.TrackingDisabled)
            assertTrue(
                "each TrackingDisabled must be its own instance, not a shared singleton",
                firstError !== secondError,
            )
            assertEquals("no request should have been made", 0, transport.requests.size)
        }

    @Test
    fun `resolveConfig still works with tracking off, and sends no client id`() =
        runTest {
            transport.respond(200, BODY)
            val client =
                newClient(
                    testScheduler,
                    config = frakConfig(merchantId = MERCHANT_ID, trackingEnabled = false),
                )

            val resolved = client.resolveConfig()
            advanceUntilIdle()

            assertEquals(MERCHANT_ID, resolved.merchantId)
            assertEquals(1, transport.requests.size)
            assertNull(transport.requests.first().headers["x-frak-client-id"])
        }

    @Test
    fun `setTrackingEnabled flips tracking at runtime, both ways`() =
        runTest {
            val client = newClient(testScheduler)
            advanceUntilIdle()

            assertTrue(client.isTrackingEnabled())

            client.setTrackingEnabled(false)
            advanceUntilIdle()
            assertFalse(client.isTrackingEnabled())
            val refused = client.track(Interaction.custom("after-withdrawal"))
            assertTrue(
                "expected TrackingDisabled once consent was withdrawn, got $refused",
                (refused as FrakResult.Failure).error is FrakError.TrackingDisabled,
            )

            client.setTrackingEnabled(true)
            advanceUntilIdle()
            assertTrue(client.isTrackingEnabled())
        }

    @Test
    fun `setTrackingEnabled true cannot lift a compile-time trackingEnabled false`() =
        runTest {
            val client =
                newClient(
                    testScheduler,
                    config = frakConfig(merchantId = MERCHANT_ID, trackingEnabled = false),
                )

            client.setTrackingEnabled(true)
            advanceUntilIdle()

            assertFalse(client.isTrackingEnabled())
            assertNull(client.anonymousId())
        }

    @Test
    fun `setTrackingEnabled false does not destroy the identity`() =
        runTest {
            val client = newClient(testScheduler)
            advanceUntilIdle()
            val before = client.anonymousId()

            client.setTrackingEnabled(false)
            advanceUntilIdle()
            assertNull("tracking off must report no id", client.anonymousId())

            client.setTrackingEnabled(true)
            advanceUntilIdle()
            assertEquals("the same identity must come back on re-consent", before, client.anonymousId())
        }

    @Test
    fun `the documented withdrawal recipe stops tracking and drops what was queued`() =
        runTest {
            // A failing transport leaves the event queued on disk.
            transport.fail(java.io.IOException("offline"))
            val client = newClient(testScheduler)
            advanceUntilIdle()
            client.track(Interaction.custom("before-withdrawal"))
            advanceUntilIdle()

            val queueFile = File(temporaryFolder.root, "events.jsonl")
            assertTrue("precondition: the event must still be on disk", queueFile.length() > 0)

            client.setTrackingEnabled(false)
            advanceUntilIdle()

            assertEquals(
                "withdrawal must leave nothing captured under the old decision on disk",
                0L,
                if (queueFile.exists()) queueFile.length() else 0L,
            )

            assertTrue(
                "the recipe's second half must report a real erasure",
                client.resetAnonymousId(),
            )
            advanceUntilIdle()
        }

    @Test
    fun `a runtime withdrawal reaches the identity store, not only the network gate`() =
        runTest {
            val client = newClient(testScheduler)
            advanceUntilIdle()
            assertNotNull("the fixture must start with a real identity", client.anonymousId())

            client.setTrackingEnabled(false)
            advanceUntilIdle()

            assertNull("a captured Boolean would still report the old identity here", client.anonymousId())
        }

    @Test
    fun `shutdown is idempotent and stops the background scope`() =
        runTest {
            transport.respond(200, BODY)
            val client = newClient(testScheduler)
            advanceUntilIdle()

            client.shutdown()
            client.shutdown()

            val before = transport.requests.size
            client.track(Interaction.custom("after-shutdown"))
            advanceUntilIdle()

            assertEquals("a shut-down client must run no background work", before, transport.requests.size)
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

    // ioDispatcher is Standard, not Unconfined: background work lands only at an explicit advanceUntilIdle().
    private fun newClient(
        testScheduler: kotlinx.coroutines.test.TestCoroutineScheduler,
        config: FrakConfig = frakConfig(merchantId = MERCHANT_ID),
        identityStore: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        // Injected because the production default reaches Looper.getMainLooper(), absent from the stub jar.
        mainDispatcher: kotlinx.coroutines.CoroutineDispatcher = UnconfinedTestDispatcher(testScheduler),
    ): DefaultFrakClient {
        val logger = FrakLogger(FrakLogLevel.NONE)
        val ioDispatcher = kotlinx.coroutines.test.StandardTestDispatcher(testScheduler)
        // One instance shared with the identity store, as `Frak.initialize` wires it; two would drift.
        val consent = TrackingConsent(identityStore, config.trackingEnabled, logger, ioDispatcher)
        return DefaultFrakClient(
            settings = config,
            store = store,
            queue =
                EventQueue(
                    File(temporaryFolder.root, "events.jsonl"),
                    logger,
                    UnconfinedTestDispatcher(),
                ),
            identity =
                AnonymousIdStore(
                    keyStore = FakeDeviceKeyStore(),
                    store = identityStore,
                    logger = logger,
                    merchantMarker = MERCHANT_ID,
                    consent = consent,
                    ioDispatcher = ioDispatcher,
                ),
            consent = consent,
            launcher = launcher,
            logger = logger,
            ioDispatcher = ioDispatcher,
            mainDispatcher = mainDispatcher,
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
        )
    }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val RETURN_SCHEME = "frak-com.acme.app"
        const val SESSION_ID = "session-1"
        const val BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
        const val FOREIGN_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440001"
        const val FOREIGN_MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440002"

        /** A share link from another device: same merchant, a client id this one cannot own. */
        fun foreignLink(): String =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = frakContextV2(MERCHANT_ID, 1_709_654_400, clientId = FOREIGN_CLIENT_ID),
                attribution = null,
                defaults = null,
            )!!

        /** A share link minted for a different merchant entirely (a v2 context). */
        fun foreignMerchantLink(): String =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = frakContextV2(FOREIGN_MERCHANT_ID, 1_709_654_400, clientId = FOREIGN_CLIENT_ID),
                attribution = null,
                defaults = null,
            )!!
    }
}
