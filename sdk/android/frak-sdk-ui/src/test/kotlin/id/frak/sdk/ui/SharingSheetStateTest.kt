package id.frak.sdk.ui

import android.app.Application
import android.content.ClipboardManager
import android.content.Context
import android.os.Looper.getMainLooper
import android.webkit.WebView
import androidx.test.core.app.ApplicationProvider
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError
import id.frak.sdk.rewards.BestReward
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.IOException
import kotlin.coroutines.EmptyCoroutineContext

/** Robolectric because the sheet reaches `Intent.createChooser`/`startActivity`. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
@OptIn(ExperimentalCoroutinesApi::class)
class SharingSheetStateTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    @Before
    fun initializeFrak() {
        // `prepare` only checks Frak.isInitialized; the real client is never used.
        Frak.initialize(context, frakConfig(merchantId = "b7c2e1a4-1111-4111-8111-111111111111"))
    }

    private fun TestScope.newState(
        client: FakeSharingClient,
        activationBaseUrl: String? = null,
        onFinished: (SharingResult) -> Unit = {},
    ) = SharingSheetState(
        scope = this,
        context = context,
        sessionId = "test-session",
        onFinished = onFinished,
        // Keeps build() on the TestScope scheduler, so advanceUntilIdle covers it.
        workContext = EmptyCoroutineContext,
        activationBaseUrl = activationBaseUrl,
        dependencies = client,
    )

    @Test
    fun `a resolved config produces a session with a page to show`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()

            val session = state.session
            assertNotNull("expected a session", session)
            assertTrue("a resolved config must yield a page", session!!.hasPage)
            assertNull(state.failure)
        }

    @Test
    fun `attaching after the session resolved navigates to its page`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(sharingRequest())
            advanceUntilIdle()

            val view = WebView(context)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            assertEquals(
                "the sheet must land on the session's own page",
                state.session?.url(confirmed = false),
                shadowOf(view).lastLoadedUrl,
            )
        }

    @Test
    fun `attaching before the session resolves still navigates once it does`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            val view = WebView(context)
            state.attach(view)
            assertNull("nothing to navigate to yet", shadowOf(view).lastLoadedUrl)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            shadowOf(getMainLooper()).idle()

            assertEquals(
                "the build completing must issue the navigation itself",
                state.session?.url(confirmed = false),
                shadowOf(view).lastLoadedUrl,
            )
        }

    @Test
    fun `the session page is navigated to once, not once per trigger`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            val view = WebView(context)

            state.attach(view)
            state.prepare(sharingRequest())
            advanceUntilIdle()
            shadowOf(getMainLooper()).idle()

            // The marker stands in for the page having navigated on its own.
            view.loadUrl(MARKER_URL)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            assertEquals(
                "re-attaching must not restart a load already issued",
                MARKER_URL,
                shadowOf(view).lastLoadedUrl,
            )
        }

    @Test
    fun `product scope fields reach the page url alongside the display fields`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                sharingRequest(
                    products =
                        listOf(
                            sharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details =
                                    productDetails(
                                        sku = "SHOE-42",
                                        quantity = 2.0,
                                        unitPrice = 79.9,
                                    ),
                            ),
                        ),
                ),
            )
            advanceUntilIdle()

            val url = requireNotNull(state.session?.url(confirmed = false))
            assertTrue("was: $url", url.contains("sku%22%3A%22SHOE-42%22"))
            assertTrue("was: $url", url.contains("quantity%22%3A2"))
            assertTrue("was: $url", url.contains("unitPrice%22%3A79.9"))
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
        }

    @Test
    fun `a product with no scope details omits the six scope keys but keeps the display fields`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                sharingRequest(
                    products = listOf(sharingProduct(title = "Kettle", link = "https://acme.example/kettle")),
                ),
            )
            advanceUntilIdle()

            val url = requireNotNull(state.session?.url(confirmed = false))
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
            assertTrue("no scope details supplied, was: $url", !url.contains("sku"))
            assertTrue("no scope details supplied, was: $url", !url.contains("quantity"))
        }

    @Test
    fun `a non-finite price is dropped instead of throwing out of the sheet`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                sharingRequest(
                    products =
                        listOf(
                            sharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details =
                                    productDetails(
                                        quantity = Double.NaN,
                                        unitPrice = Double.POSITIVE_INFINITY,
                                        totalPrice = 12.5,
                                    ),
                            ),
                        ),
                ),
            )
            advanceUntilIdle()

            val url = requireNotNull(state.session?.url(confirmed = false))
            assertTrue("was: $url", !url.contains("quantity"))
            assertTrue("was: $url", !url.contains("unitPrice"))
            assertTrue("was: $url", url.contains("totalPrice%22%3A12.5"))
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
        }

    @Test
    fun `the seeded reward call is scoped to the request's product details`() =
        runTest {
            val client = FakeSharingClient()
            client.bestReward =
                BestReward(
                    formatted = "5\u00a0\u20ac",
                    payoutType = "fixed",
                    minPurchaseAmount = null,
                    minPurchaseValue = null,
                    lockupDurationDays = null,
                    isProductScoped = false,
                    matchedProducts = null,
                )
            val state = newState(client)

            state.prepare(
                sharingRequest(
                    products =
                        listOf(
                            sharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details = productDetails(sku = "SHOE-42"),
                            ),
                            sharingProduct(title = "Mug", link = "https://acme.example/mug"),
                        ),
                ),
            )
            advanceUntilIdle()

            val passed = requireNotNull(client.lastBestRewardProducts)
            assertEquals(1, passed.size)
            assertEquals("SHOE-42", passed.first().sku)
        }

    @Test
    fun `the seeded reward call passes null products when nothing carries scope details`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                sharingRequest(
                    products = listOf(sharingProduct(title = "Kettle", link = "https://acme.example/kettle")),
                ),
            )
            advanceUntilIdle()

            assertNull(client.lastBestRewardProducts)
        }

    @Test
    fun `a failed config resolve still shares, from the local link`() =
        runTest {
            val client = FakeSharingClient()
            client.resolveFailure = FrakError.Network(IOException("offline"))
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            assertNull("a resolve failure is not a sheet failure", state.failure)
            assertNull("a page-less session must not reach the composable", state.session)
            assertTrue("expected the native share to have fired", result is SharingResult.Shared)
            assertEquals("the share must be attributed exactly once", 1, client.trackCount)
        }

    @Test
    fun `no link means Failed, not a silent tier 3`() =
        runTest {
            val client = FakeSharingClient()
            client.link = null
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            assertNull(state.session)
            assertTrue(state.failure is FrakError.MerchantResolutionFailed)
            assertEquals(0, client.trackCount)
            assertTrue("was: $result", result is SharingResult.Failed)
            assertTrue((result as SharingResult.Failed).error is FrakError.MerchantResolutionFailed)
        }

    @Test
    fun `a fast build followed by a page that never loads still hits the deadline`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            advanceUntilIdle()
            assertTrue("precondition: build succeeded with a page", state.session?.hasPage == true)

            val gate = launchDeadline(state) // Page is now "loading" and never calls onPageReady.
            advanceUntilIdle()

            assertTrue("the budget must bound the page load too", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    @Test
    fun `a build slower than the budget falls back once it finally returns`() =
        runTest {
            val client = FakeSharingClient()
            val resolveGate = CompletableDeferred<Unit>()
            client.resolveGate = resolveGate
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            val gate = launchDeadline(state)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS + 1)

            assertNull(state.session)
            assertNull(result)

            resolveGate.complete(Unit)
            advanceUntilIdle()

            assertTrue("a late build must land on tier 3", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    @Test
    fun `a page that loads in time is left alone`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            val gate = launchDeadline(state)
            // runCurrent, not advanceUntilIdle: the latter would also fire the deadline under test.
            runCurrent()
            state.onPageReady()

            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            advanceUntilIdle()

            assertNull("the budget was met; nothing should have fired", result)
            assertEquals("a page that loaded is not a share", 0, client.trackCount)
            gate.join()
        }

    @Test
    fun `a share from an activated page settles the budget instead of racing it`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            // Activated by fragment: a same-document navigation fires no onPageFinished, so
            // pageLoaded stays false while the user is already looking at a live, warm page.
            val state = newState(client, activationBaseUrl = NORMALISED_WARM_URL) { results += it }

            state.prepare(sharingRequest())
            val gate = launchDeadline(state)
            // runCurrent, not advanceUntilIdle: the latter would also fire the deadline under test.
            runCurrent()
            state.onPageAction(SharingPageAction.Share)
            advanceUntilIdle()

            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            advanceUntilIdle()

            assertFalse("the fragment activation never finished a document", state.pageLoaded)
            assertEquals("the deadline must not raise a second chooser", 1, client.trackCount)
            // Still open on its confirmation screen: a deadline that fired would have shared,
            // reported and closed the sheet under the chooser the user is looking at.
            assertTrue("the sheet must outlive the budget it already met", results.isEmpty())

            state.dismiss()
            advanceUntilIdle()
            assertEquals(1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Shared)
            gate.join()
        }

    @Test
    fun `the deadline and a page error together still fall back only once`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.onLoadDeadline()
            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals("exactly one attribution per share", 1, client.trackCount)
            assertEquals("exactly one outcome reported", 1, finishedCount)
        }

    @Test
    fun `only the most significant outcome is reported, once`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.share()
            advanceUntilIdle()
            state.dismiss()
            state.dismiss()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("a completed share outranks the dismissal that follows it", results[0] is SharingResult.Shared)
        }

    @Test
    fun `the install action keeps the sheet open on the wallet's install page`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            val view = WebView(context)
            state.attach(view)

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(
                "the sheet must land on the url the client minted",
                client.installPage,
                shadowOf(view).lastLoadedUrl,
            )
            assertEquals("the sheet must not hand off to the store", 0, client.openFrakAppCount)
            assertEquals("the install page must be asked for", 1, client.installPageUrlCount)
            assertEquals(
                "the sheet stays open until the user leaves it",
                null,
                result,
            )
        }

    @Test
    fun `a code from the install page reaches the clipboard`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client) {}

            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.onPageAction(SharingPageAction.Code("ABC234", 1_700_000_000L))
            advanceUntilIdle()

            val clipboard = context.getSystemService(ClipboardManager::class.java)
            assertEquals(
                "the SDK owns the clipboard write, because the page cannot mark it sensitive",
                "ABC234",
                clipboard.primaryClip
                    ?.getItemAt(0)
                    ?.text
                    ?.toString(),
            )
        }

    @Test
    fun `the install page is asked for with this session's return channel`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client) {}

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            val args = client.installPageArgs
            assertNotNull("the return channel must reach the client", args)
            assertEquals(SharingPageUrl.returnScheme(context.packageName), args?.first)
            assertEquals("test-session", args?.second)
        }

    @Test
    fun `an install with no identity still falls back to the store`() =
        runTest {
            val client = FakeSharingClient()
            client.installPage = null
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(1, client.openFrakAppCount)
            assertEquals(SharingResult.InstallStarted, result)
        }

    @Test
    fun `a second install tap does not fetch a second install page`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client) {}

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            // The page's footer stays tappable across the whole native round trip, so both taps
            // land before the first fetch returns.
            state.onPageAction(SharingPageAction.Install)
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals("two taps must not race two install pages", 1, client.installPageUrlCount)
        }

    @Test
    fun `share again reopens the install guard`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client) {}

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()
            state.onPageAction(SharingPageAction.ShareAgain)
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(
                "the user is back on a page that offers Install again",
                2,
                client.installPageUrlCount,
            )
        }

    @Test
    fun `a renderer crash after the page loaded does not raise a chooser`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.onPageReady()

            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals("no attribution for a share the user did not make", 0, client.trackCount)
            assertEquals("nothing reported", 0, finishedCount)
        }

    @Test
    fun `only http external urls leave the sheet`() =
        runTest {
            val app = ApplicationProvider.getApplicationContext<Application>()
            val state = newState(FakeSharingClient())

            state.openExternally("intent://scan/#Intent;scheme=zxing;end")
            assertNull("a vendor scheme reaches whatever activity registered it", shadowOf(app).nextStartedActivity)

            state.openExternally("https://merchant.example/product")
            assertNotNull("an ordinary link still opens", shadowOf(app).nextStartedActivity)
        }

    @Test
    fun `the wallet's own store listing goes through the app handoff instead of Play`() =
        runTest {
            val app = ApplicationProvider.getApplicationContext<Application>()
            val client = FakeSharingClient()
            val state = newState(client)

            state.openExternally(
                "https://play.google.com/store/apps/details?id=id.frak.wallet&referrer=merchantId%3Dm",
            )
            advanceUntilIdle()

            assertEquals("the deep link must be tried first", 1, client.openFrakAppCount)
            assertNull("Play must not be opened over the handoff", shadowOf(app).nextStartedActivity)
        }

    @Test
    fun `another app's store listing still opens Play`() =
        runTest {
            val app = ApplicationProvider.getApplicationContext<Application>()
            val client = FakeSharingClient()
            val state = newState(client)

            state.openExternally("https://play.google.com/store/apps/details?id=com.merchant.app")
            advanceUntilIdle()

            assertEquals("not the wallet, so no handoff", 0, client.openFrakAppCount)
            assertNotNull("a merchant's own listing still opens", shadowOf(app).nextStartedActivity)
        }

    @Test
    fun `a share moves the page to its confirmation screen`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)

            state.share()
            advanceUntilIdle()

            assertEquals(
                "the share must land the page on its confirmation screen",
                true,
                shadowOf(view).lastLoadedUrl?.contains("view=confirmation"),
            )

            state.onPageAction(SharingPageAction.ShareAgain)
            advanceUntilIdle()

            assertEquals(
                "share again must take the page back off it",
                false,
                shadowOf(view).lastLoadedUrl?.contains("view=confirmation"),
            )
        }

    @Test
    fun `the page's own share button raises the chooser and pays out`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Share)
            advanceUntilIdle()
            state.dismiss()
            advanceUntilIdle()

            assertEquals("the share must be attributed", 1, client.trackCount)
            assertEquals(1, results.size)
            assertTrue(
                "a page-driven share is the same outcome as a native one",
                results[0] is SharingResult.Shared,
            )
        }

    @Test
    fun `the page's own copy button writes the clipboard and pays out`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Copy)
            advanceUntilIdle()

            assertEquals("the copy must be attributed", 1, client.trackCount)
            val clipboard = context.getSystemService(ClipboardManager::class.java)
            assertEquals(
                "the link must reach the clipboard",
                client.link,
                clipboard.primaryClip
                    ?.getItemAt(0)
                    ?.text
                    ?.toString(),
            )
        }

    @Test
    fun `a copy does not reload the page out from under its own toast`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)
            val beforeCopy = shadowOf(view).lastLoadedUrl

            state.onPageAction(SharingPageAction.Copy)
            advanceUntilIdle()

            assertEquals("the copy must be attributed", 1, client.trackCount)
            assertEquals(
                "a copy must not navigate the page at all",
                beforeCopy,
                shadowOf(view).lastLoadedUrl,
            )
        }

    @Test
    fun `two taps on the page's share button raise one chooser and bill one interaction`() =
        runTest {
            val app = ApplicationProvider.getApplicationContext<Application>()
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Share)
            state.onPageAction(SharingPageAction.Share)
            advanceUntilIdle()

            assertEquals("one share must bill one interaction", 1, client.trackCount)
            assertNotNull("the chooser must have been raised", shadowOf(app).nextStartedActivity)
            assertNull("and only once", shadowOf(app).nextStartedActivity)
        }

    @Test
    fun `two taps on the page's copy button bill one interaction`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Copy)
            state.onPageAction(SharingPageAction.Copy)
            advanceUntilIdle()

            assertEquals("one copy must bill one interaction", 1, client.trackCount)
        }

    @Test
    fun `a failed install page falls back to the confirmation screen, not a dead sheet`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(sharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)
            state.onPageReady()

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()
            assertEquals(client.installPage, shadowOf(view).lastLoadedUrl)

            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals(
                "the user must land somewhere with controls on it",
                true,
                shadowOf(view).lastLoadedUrl?.contains("view=confirmation"),
            )
            assertEquals("no chooser, and no premature outcome", 0, finishedCount)
        }

    @Test
    fun `the page reporting ready uncovers it, without ending the session`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client, onFinished = { finishedCount++ })
            state.prepare(sharingRequest())
            advanceUntilIdle()

            assertFalse("covered until the page says otherwise", state.pageVisible)

            state.onPageAction(SharingPageAction.Ready)

            assertTrue("ready is what drops the skeleton", state.pageVisible)
            assertTrue("and settles the load, since a fragment nav may never finish a document", state.pageLoaded)
            assertEquals("ready must not finish the session", 0, finishedCount)
        }

    @Test
    fun `a session on a matching warm page navigates by fragment only`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(sharingRequest())
            advanceUntilIdle()
            val warmBase = requireNotNull(state.session?.warmBaseUrl)

            val activated = newState(client, activationBaseUrl = warmBase)
            activated.prepare(sharingRequest(link = "https://acme.example/kettle"))
            advanceUntilIdle()
            val view = WebView(context)
            view.loadUrl(NORMALISED_WARM_URL)
            activated.attach(view)
            shadowOf(getMainLooper()).idle()

            val loaded = requireNotNull(shadowOf(view).lastLoadedUrl)
            assertTrue(
                "must hang off the URL the document actually settled on, not ours: $loaded",
                loaded.startsWith("$NORMALISED_WARM_URL#"),
            )
            assertTrue("the per-tap link still has to arrive", loaded.contains("link="))
            assertTrue("and the flag that turns a preload into a view", loaded.contains("state=live"))
        }

    @Test
    fun `a session whose warm page is not the one loaded does a full navigation`() =
        runTest {
            val client = FakeSharingClient()
            val state =
                newState(
                    client,
                    activationBaseUrl = "https://wallet.frak.id/sharing?embed=native&state=warm&merchantId=other",
                )
            state.prepare(sharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            val loaded = requireNotNull(shadowOf(view).lastLoadedUrl)
            assertFalse("must not activate on a page it was not warmed against", loaded.contains("#"))
            assertEquals(state.session?.url(confirmed = false), loaded)
        }

    @Test
    fun `the confirmation step stays same-document once activated`() =
        runTest {
            val client = FakeSharingClient()
            val probe = newState(client)
            probe.prepare(sharingRequest())
            advanceUntilIdle()
            val warmBase = requireNotNull(probe.session?.warmBaseUrl)

            val state = newState(client, activationBaseUrl = warmBase)
            state.prepare(sharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            view.loadUrl(NORMALISED_WARM_URL)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            state.share()
            advanceUntilIdle()

            val loaded = requireNotNull(shadowOf(view).lastLoadedUrl)
            assertTrue(
                "confirmation must stay on the same document: $loaded",
                loaded.startsWith("$NORMALISED_WARM_URL#"),
            )
            assertTrue(loaded.contains("view=confirmation"))
        }

    @Test
    fun `a page that reports ready is not overtaken by the tier-3 deadline`() =
        runTest {
            val client = FakeSharingClient()
            var finished: SharingResult? = null
            val state = newState(client, onFinished = { finished = it })
            state.prepare(sharingRequest())
            advanceUntilIdle()
            launchDeadline(state)

            state.onPageAction(SharingPageAction.Ready)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            advanceUntilIdle()

            assertNull("a painted page must not be abandoned", finished)
        }

    @Test
    fun `the session and warm urls carry no presentation params`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(sharingRequest())
            advanceUntilIdle()

            val session = requireNotNull(state.session)
            val page = requireNotNull(session.url(confirmed = false))
            val warm = requireNotNull(session.warmBaseUrl)
            assertFalse("presentation must not ride the URL: $page", page.contains("cornerRadius"))
            assertFalse("presentation must not ride the URL: $warm", warm.contains("cornerRadius"))
        }

    @Test
    fun `abandoning an untouched sheet reports a dismissal`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.abandon()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Dismissed)
        }

    @Test
    fun `abandoning after a share still reports the share`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.copy()
            advanceUntilIdle()
            assertTrue("copy must not report on its own", results.isEmpty())

            state.abandon()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("a copy outranks a dismissal: ${results.first()}", results.first() is SharingResult.Copied)
        }

    @Test
    fun `abandoning an already dismissed sheet reports nothing further`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.dismiss()
            state.abandon()
            advanceUntilIdle()

            assertEquals("exactly one callback per session", 1, results.size)
        }

    @Test
    fun `a build that never returns still reports, on its own budget`() =
        runTest {
            val client = FakeSharingClient()
            // Never completed: a resolve that hangs rather than failing.
            client.resolveGate = CompletableDeferred()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(sharingRequest())
            launchDeadline(state)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            runCurrent()
            assertTrue("the page deadline alone cannot rescue a hung build", results.isEmpty())

            advanceTimeBy(BUILD_DEADLINE_MILLIS)
            advanceUntilIdle()

            assertEquals("the merchant has to hear something", 1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Failed)
        }

    @Test
    fun `a client call refused mid-share reports instead of propagating`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            client.clientFailure = FrakError.NotInitialized()
            state.share()
            advanceUntilIdle()

            state.abandon()
            advanceUntilIdle()

            assertEquals("the share still happened; only its attribution was refused", 1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Shared)
        }

    @Test
    fun `abandoning while an outcome is still resolving waits for it`() =
        runTest {
            val client = FakeSharingClient()
            // Suspends `track()`, which share() awaits before it records anything.
            val gate = CompletableDeferred<Unit>()
            val results = mutableListOf<SharingResult>()
            client.trackGate = gate
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            state.share()
            runCurrent()

            state.abandon()
            runCurrent()
            assertTrue("nothing may be reported while the share is still resolving", results.isEmpty())

            gate.complete(Unit)
            advanceUntilIdle()

            assertEquals("exactly one, once the share has landed", 1, results.size)
            assertTrue(
                "a dismissal reported over a completed share is the bug: ${results.first()}",
                results.first() is SharingResult.Shared,
            )
        }

    @Test
    fun `a renderer crash after paint marks the content lost so the sheet stays opaque`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()
            state.onPageReady()
            state.onPageVisible()

            assertFalse("nothing lost yet", state.contentLost)

            state.onPageUnavailable()
            advanceUntilIdle()

            assertTrue("the sheet has to know to paint its own surface", state.contentLost)
            assertTrue("and must not raise a chooser over a sheet in use", results.isEmpty())
        }

    @Test
    fun `a client call refused during the install handoff reports instead of propagating`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(sharingRequest())
            advanceUntilIdle()

            client.clientFailure = FrakError.NotInitialized()
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.InstallStarted)
        }

    @Test
    fun `an activated sheet stays covered until the page paints`() =
        runTest {
            val client = FakeSharingClient()

            // A warm view has never been in a window, so its finished document has drawn nothing.
            val activated = newState(client, activationBaseUrl = NORMALISED_WARM_URL)
            assertFalse("a warm document is not a painted one", activated.pageVisible)

            val cold = newState(client)
            assertFalse("a cold view really is blank, and must stay covered", cold.pageVisible)

            activated.onPageAction(SharingPageAction.Ready)
            assertTrue("the activation's own ready is what uncovers it", activated.pageVisible)
        }

    @Test
    fun `a page action is a paint signal, except a refusal to render`() =
        runTest {
            val client = FakeSharingClient()

            // The skeleton has no max-hold timer any more: a user driving the document is the
            // evidence that replaced it.
            val driven = newState(client)
            driven.onPageAction(SharingPageAction.Copy)
            assertTrue("a user cannot tap a page that is not on screen", driven.pageVisible)

            val refused = newState(client)
            refused.onPageAction(SharingPageAction.Error)
            assertFalse("the page saying it rendered nothing must not uncover it", refused.pageVisible)
        }

    private fun TestScope.launchDeadline(state: SharingSheetState) =
        launch { state.awaitLoadDeadline(SHEET_LOAD_DEADLINE_MILLIS) }

    private companion object {
        const val MARKER_URL = "https://acme.example/marker"

        /** The URL a warmed page settles on; the router reorders its own search params. */
        const val NORMALISED_WARM_URL =
            "https://wallet.frak.id/sharing?embed=native&state=warm&view=share"

        /** Mirrors `SharingPresentation`'s own constant. */
        const val SHEET_LOAD_DEADLINE_MILLIS = 1_500L

        /** Mirrors `SharingSessionBuilder`'s own private constant. */
        const val BUILD_DEADLINE_MILLIS = 8_000L
    }
}
