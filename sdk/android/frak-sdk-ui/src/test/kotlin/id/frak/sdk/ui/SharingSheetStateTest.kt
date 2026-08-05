package id.frak.sdk.ui

import android.app.Application
import android.content.ClipboardManager
import android.content.Context
import android.os.Looper.getMainLooper
import android.webkit.WebView
import androidx.test.core.app.ApplicationProvider
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
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

/**
 * The sheet's sequencing rules. Robolectric because [SharingSheetState] reaches
 * `Intent.createChooser`/`startActivity`, which throw on the plain `android.jar` stub.
 * `TestScope` so the 1.5s budget is exercised via virtual time, not sleeping.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
@OptIn(ExperimentalCoroutinesApi::class)
class SharingSheetStateTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    @Before
    fun initializeFrak() {
        // `prepare` guards on Frak.isInitialized; only that boolean is used, the real client isn't.
        Frak.initialize(context, FrakConfig(merchantId = "b7c2e1a4-1111-4111-8111-111111111111"))
    }

    private fun TestScope.newState(
        client: FakeSharingClient,
        // Before `onFinished` so a trailing lambda still binds to it, as most tests here rely on.
        activationBaseUrl: String? = null,
        onFinished: (SharingResult) -> Unit = {},
    ) = SharingSheetState(
        scope = this,
        context = context,
        sessionId = "test-session",
        onFinished = onFinished,
        // Keeps build() on the TestScope's scheduler; the production default (Dispatchers.Default)
        // would run it on a real thread pool and make advanceUntilIdle meaningless.
        workContext = EmptyCoroutineContext,
        activationBaseUrl = activationBaseUrl,
        buildSharingLink = client::buildSharingLink,
        anonymousId = { client.anonymousId },
        environment = { client.environment },
        resolveConfig = client::resolveConfig,
        bestReward = client::bestReward,
        track = client::track,
        installPageUrl = client::installPageUrl,
        openFrakApp = client::openFrakApp,
    )

    @Test
    fun `a resolved config produces a session with a page to show`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(SharingRequest())
            advanceUntilIdle()

            val session = state.session
            assertNotNull("expected a session", session)
            assertTrue("a resolved config must yield a page", session!!.hasPage)
            assertNull(state.failure)
        }

    /**
     * The session's own navigation, which now leaves via `View.post` rather than a Compose
     * effect — so it is invisible to a test that never idles the main looper. These three pin it:
     * without them the sheet could navigate nowhere and the rest of this suite would stay green,
     * since every other `lastLoadedUrl` assertion here is about a *later* load (`view=confirmation`,
     * the install page) that still goes out directly.
     */
    @Test
    fun `attaching after the session resolved navigates to its page`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(SharingRequest())
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

            // Production order: SharingPresentation.start attaches the pooled view first, so the
            // view is ready well before build() can be.
            val view = WebView(context)
            state.attach(view)
            assertNull("nothing to navigate to yet", shadowOf(view).lastLoadedUrl)

            state.prepare(SharingRequest())
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
            state.prepare(SharingRequest())
            advanceUntilIdle()
            shadowOf(getMainLooper()).idle()

            // A marker stands in for the page having moved on under its own steam. Re-attaching
            // the same view is what a recomposition looks like, and it must not rewind that.
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
                SharingRequest(
                    products =
                        listOf(
                            SharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details =
                                    ProductDetails(
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
            // The wallet route forwards this same `products=` value straight into reward
            // selection (rewardProductsForSelection -> selectBestReward): a product-scoped
            // campaign is only ranked correctly if these fields actually reach the wire.
            assertTrue("was: $url", url.contains("sku%22%3A%22SHOE-42%22"))
            assertTrue("was: $url", url.contains("quantity%22%3A2"))
            assertTrue("was: $url", url.contains("unitPrice%22%3A79.9"))
            // Display fields must still be present alongside the scope fields.
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
        }

    @Test
    fun `a product with no scope details omits the six scope keys but keeps the display fields`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                SharingRequest(
                    products = listOf(SharingProduct(title = "Kettle", link = "https://acme.example/kettle")),
                ),
            )
            advanceUntilIdle()

            val url = requireNotNull(state.session?.url(confirmed = false))
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
            assertTrue("no scope details supplied, was: $url", !url.contains("sku"))
            assertTrue("no scope details supplied, was: $url", !url.contains("quantity"))
        }

    /**
     * `JSONObject.put` throws outright on a non-finite number ("JSON does not allow non-finite
     * numbers"), and this runs inside the sheet's `launch`, so the throw would surface as a crash
     * rather than a missing product card. A price that is not a number carries no scope meaning.
     */
    @Test
    fun `a non-finite price is dropped instead of throwing out of the sheet`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(
                SharingRequest(
                    products =
                        listOf(
                            SharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details =
                                    ProductDetails(
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
            // The usable field on the same product survives, as does the card itself.
            assertTrue("was: $url", url.contains("totalPrice%22%3A12.5"))
            assertTrue("was: $url", url.contains("title%22%3A%22Kettle%22"))
        }

    @Test
    fun `the seeded reward call is scoped to the request's product details`() =
        runTest {
            val client = FakeSharingClient()
            client.bestReward = BestReward(formatted = "5\u00a0\u20ac", payoutType = "fixed", null, null, null)
            val state = newState(client)

            state.prepare(
                SharingRequest(
                    products =
                        listOf(
                            SharingProduct(
                                title = "Kettle",
                                link = "https://acme.example/kettle",
                                details = ProductDetails(sku = "SHOE-42"),
                            ),
                            // No details: the seed must drop this one, not pass a null entry through.
                            SharingProduct(title = "Mug", link = "https://acme.example/mug"),
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
                SharingRequest(
                    products = listOf(SharingProduct(title = "Kettle", link = "https://acme.example/kettle")),
                ),
            )
            advanceUntilIdle()

            assertNull(client.lastBestRewardProducts)
        }

    /** Regression: a failed config resolve must not discard the local link. */
    @Test
    fun `a failed config resolve still shares, from the local link`() =
        runTest {
            val client = FakeSharingClient()
            client.resolveFailure = FrakError.Network(IOException("offline"))
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            assertNull("a resolve failure is not a sheet failure", state.failure)
            assertNull("a page-less session must not reach the composable", state.session)
            assertTrue("expected the native share to have fired", result is SharingResult.Shared)
            assertEquals("the share must be attributed exactly once", 1, client.trackCount)
        }

    /** The one case tier 3 genuinely cannot rescue: there was never a link. */
    @Test
    fun `no link means Failed, not a silent tier 3`() =
        runTest {
            val client = FakeSharingClient()
            client.link = null
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            assertNull(state.session)
            assertTrue(state.failure is FrakError.MerchantResolutionFailed)
            assertEquals(0, client.trackCount)
            // Reported here rather than left for the sheet's `LaunchedEffect(state.failure)` to
            // notice. Same outcome, one frame earlier, and no longer conditional on a composable
            // being alive to observe a state change — which a torn-down sheet is not.
            assertTrue("was: $result", result is SharingResult.Failed)
            assertTrue((result as SharingResult.Failed).error is FrakError.MerchantResolutionFailed)
        }

    /** Regression: budget must still fire when build was fast and the page itself hangs. */
    @Test
    fun `a fast build followed by a page that never loads still hits the deadline`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()
            assertTrue("precondition: build succeeded with a page", state.session?.hasPage == true)

            val gate = launchDeadline(state) // page is now "loading" and never calls onPageReady
            advanceUntilIdle()

            assertTrue("the budget must bound the page load too", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    /** The other half: a build slow enough to blow the budget before a session exists. */
    @Test
    fun `a build slower than the budget falls back once it finally returns`() =
        runTest {
            val client = FakeSharingClient()
            val resolveGate = CompletableDeferred<Unit>()
            client.resolveGate = resolveGate
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            val gate = launchDeadline(state)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS + 1)

            // Deadline passed with no session yet.
            assertNull(state.session)
            assertNull(result)

            resolveGate.complete(Unit) // must not publish a session the deadline already gave up on
            advanceUntilIdle()

            assertTrue("a late build must land on tier 3", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    /** A page that arrives inside the budget must not be pre-empted by it. */
    @Test
    fun `a page that loads in time is left alone`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
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

    /** Offline, the deadline and the page's own main-frame error both fire; must fall back once. */
    @Test
    fun `the deadline and a page error together still fall back only once`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.onLoadDeadline()
            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals("exactly one attribution per share", 1, client.trackCount)
            assertEquals("exactly one outcome reported", 1, finishedCount)
        }

    /** `onFinished` is the merchant's callback: it fires once, with the best outcome. */
    @Test
    fun `only the most significant outcome is reported, once`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.share()
            advanceUntilIdle()
            state.dismiss()
            state.dismiss()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("a completed share outranks the dismissal that follows it", results[0] is SharingResult.Shared)
        }

    /** The install action is the SDK's own step; the merchant hears about it once it ran. */
    @Test
    fun `the install action keeps the sheet open on the wallet's install page`() =
        runTest {
            val client = FakeSharingClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            // Attached so the navigation itself is observable: without it the assertion below
            // passes for an implementation that asks for the URL and then drops it, which is
            // the whole behaviour under test.
            val view = WebView(context)
            state.attach(view)

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(
                "the sheet must land on the url the client minted",
                client.installPage,
                shadowOf(view).lastLoadedUrl,
            )
            // The store handoff is what this replaces: the install page owns that decision now.
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

            state.prepare(SharingRequest())
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

            state.prepare(SharingRequest())
            advanceUntilIdle()
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            // Without these the page has nowhere to send the code back to, and the pasteboard
            // write never happens.
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

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            // Nothing to hand the install page, so the old handoff is the honest answer.
            assertEquals(1, client.openFrakAppCount)
            assertEquals(SharingResult.InstallStarted, result)
        }

    @Test
    fun `a renderer crash after the page loaded does not raise a chooser`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(SharingRequest())
            advanceUntilIdle()
            state.onPageReady()

            // The user is mid-interaction. A chooser now would be a share they never asked for.
            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals("no attribution for a share the user did not make", 0, client.trackCount)
            assertEquals("nothing reported", 0, finishedCount)
        }

    /** Paired deliberately: a guard that blocks everything would pass the negative case alone. */
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

    /** Without this, a user who already has the wallet installed would land on its Play listing instead of in it. */
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

    /** Paired with the above: the interception is for the wallet's listing, not for Play at large. */
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

            state.prepare(SharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)

            state.share()
            advanceUntilIdle()

            // `&view=confirmation` is what puts the page on its own post-share screen: under `native`
            // it will not confirm itself, since only this sheet knows a chooser came up.
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

    /** The page draws both buttons and this sheet performs them, over the same navigation channel as every other page action. */
    @Test
    fun `the page's own share button raises the chooser and pays out`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(SharingRequest())
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

            state.prepare(SharingRequest())
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

    /** The asymmetry with `share`: the page raises its own toast and moves to the confirmation screen on its own button press. A `view=confirmation` reload on top of that would tear the toast down mid-copy. */
    @Test
    fun `a copy does not reload the page out from under its own toast`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(SharingRequest())
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

    /** The page's footer stays enabled across the whole hand-off. The window that matters is `track()`, which the chooser's dismissal returns into with the page still live underneath. */
    @Test
    fun `two taps on the page's share button raise one chooser and bill one interaction`() =
        runTest {
            val app = ApplicationProvider.getApplicationContext<Application>()
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(SharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Share)
            state.onPageAction(SharingPageAction.Share)
            advanceUntilIdle()

            assertEquals("one share must bill one interaction", 1, client.trackCount)
            assertNotNull("the chooser must have been raised", shadowOf(app).nextStartedActivity)
            assertNull("and only once", shadowOf(app).nextStartedActivity)
        }

    /** Same guard on the copy half: two taps would otherwise bill two interactions. */
    @Test
    fun `two taps on the page's copy button bill one interaction`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)

            state.prepare(SharingRequest())
            advanceUntilIdle()
            state.attach(WebView(context))

            state.onPageAction(SharingPageAction.Copy)
            state.onPageAction(SharingPageAction.Copy)
            advanceUntilIdle()

            assertEquals("one copy must bill one interaction", 1, client.trackCount)
        }

    /** The install page's failure is not tier 3's business — the user has already shared. The sheet must not just sit on an error page with nothing to press either. */
    @Test
    fun `a failed install page falls back to the confirmation screen, not a dead sheet`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(SharingRequest())
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
            // Tier 3 would raise a chooser for a share that already happened.
            assertEquals("no chooser, and no premature outcome", 0, finishedCount)
        }

    @Test
    fun `the page reporting ready uncovers it, without ending the session`() =
        runTest {
            val client = FakeSharingClient()
            var finishedCount = 0
            val state = newState(client, onFinished = { finishedCount++ })
            state.prepare(SharingRequest())
            advanceUntilIdle()

            assertFalse("covered until the page says otherwise", state.pageVisible)

            state.onPageAction(SharingPageAction.Ready)

            assertTrue("ready is what drops the skeleton", state.pageVisible)
            assertTrue("and settles the load, since a fragment nav may never finish a document", state.pageLoaded)
            // Every other page action settles the sheet; this one is progress, and a sheet that
            // closed the moment the page finished painting would be unusable.
            assertEquals("ready must not finish the session", 0, finishedCount)
        }

    /**
     * Fragment activation: the difference between reusing a warmed page and loading it twice.
     * These pin both halves, because getting it wrong is silent — a mismatched base just costs
     * ~300ms of React boot, and a wrongly-matched one shows the user a page that never activates.
     */
    @Test
    fun `a session on a matching warm page navigates by fragment only`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(SharingRequest())
            advanceUntilIdle()
            val warmBase = requireNotNull(state.session?.warmBaseUrl)

            val activated = newState(client, activationBaseUrl = warmBase)
            activated.prepare(SharingRequest(link = "https://acme.example/kettle"))
            advanceUntilIdle()
            val view = WebView(context)
            // The warm document, as the page left it: the router rewrites its own search params
            // on load, so the committed URL is NOT the string we warmed with. Activation has to
            // hang the fragment off this, which is the bug the first device trace exposed.
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
            state.prepare(SharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            val loaded = requireNotNull(shadowOf(view).lastLoadedUrl)
            // A pool warmed for a different merchant must not be activated on top of: the page
            // would keep the wrong merchant's queries and never fetch the right ones.
            assertFalse("must not activate on a page it was not warmed against", loaded.contains("#"))
            assertEquals(state.session?.url(confirmed = false), loaded)
        }

    @Test
    fun `the confirmation step stays same-document once activated`() =
        runTest {
            val client = FakeSharingClient()
            val probe = newState(client)
            probe.prepare(SharingRequest())
            advanceUntilIdle()
            val warmBase = requireNotNull(probe.session?.warmBaseUrl)

            val state = newState(client, activationBaseUrl = warmBase)
            state.prepare(SharingRequest())
            advanceUntilIdle()
            val view = WebView(context)
            view.loadUrl(NORMALISED_WARM_URL)
            state.attach(view)
            shadowOf(getMainLooper()).idle()

            // share(), not copy(): copy deliberately records without reloading, so it is share
            // that drives the page to its confirmation screen.
            state.share()
            advanceUntilIdle()

            val loaded = requireNotNull(shadowOf(view).lastLoadedUrl)
            // Routing only the first load through the activation path would make every later
            // step the expensive one instead — which is the bug this ordering exists to avoid.
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
            state.prepare(SharingRequest())
            advanceUntilIdle()
            launchDeadline(state)

            state.onPageAction(SharingPageAction.Ready)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            advanceUntilIdle()

            // The activation path is same-document, so `onPageFinished` may never arrive for it.
            // If `ready` did not settle the budget, the fastest open would be the one that gave
            // up on its own page and raised the native chooser instead.
            assertNull("a painted page must not be abandoned", finished)
        }

    /**
     * The sheet stopped clipping its web view — a round-rect clip cannot be handed to the WebView
     * draw functor, so HWUI paid for an offscreen pass on every frame that redrew. The page rounds
     * itself instead, which only works if the radius actually reaches it.
     */
    @Test
    fun `the session and warm urls both carry the sheet's corner radius`() =
        runTest {
            val client = FakeSharingClient()
            val state = newState(client)
            state.prepare(SharingRequest())
            advanceUntilIdle()

            val session = requireNotNull(state.session)
            val page = requireNotNull(session.url(confirmed = false))
            assertTrue("the page has to know what to round itself to: $page", page.contains("&cornerRadius=28"))
            // Both or neither: `navigation` compares the rebuilt warm URL against what the pool
            // loaded, so a radius on one side only turns every activation into a full load.
            val warm = requireNotNull(session.warmBaseUrl)
            assertTrue("was: $warm", warm.contains("&cornerRadius=28"))
        }

    /**
     * The sheet leaving composition with nothing reported — a configuration change, a nav-graph
     * pop, the merchant's screen being replaced. None of those route through `dismiss()`, and
     * before `abandon()` existed the merchant's callback was simply never called for them.
     */
    @Test
    fun `abandoning an untouched sheet reports a dismissal`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.abandon()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Dismissed)
        }

    /** Abandonment must not overwrite what the session actually achieved. */
    @Test
    fun `abandoning after a share still reports the share`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.copy()
            advanceUntilIdle()
            // Copy records but does not finish — the page owns its own confirmation toast.
            assertTrue("copy must not report on its own", results.isEmpty())

            state.abandon()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("a copy outranks a dismissal: ${results.first()}", results.first() is SharingResult.Copied)
        }

    /** Both the sheet's disposal and an explicit dismissal reach [SharingSheetState]; only one may report. */
    @Test
    fun `abandoning an already dismissed sheet reports nothing further`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.dismiss()
            state.abandon()
            advanceUntilIdle()

            assertEquals("exactly one callback per session", 1, results.size)
        }

    /**
     * The 1.5s budget only ever bounded the page load *given a build that finishes*: with no
     * session yet, `onLoadDeadline` records the expiry and waits for `build()` to come back. A
     * `resolveConfig()` that hangs rather than throwing therefore reported nothing at all, and left
     * the sheet on a blank surface once the skeleton's own 2.5s hold expired.
     */
    @Test
    fun `a build that never returns still reports, on its own budget`() =
        runTest {
            val client = FakeSharingClient()
            // Never completed: a resolve that hangs rather than failing.
            client.resolveGate = CompletableDeferred()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(SharingRequest())
            launchDeadline(state)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            runCurrent()
            assertTrue("the page deadline alone cannot rescue a hung build", results.isEmpty())

            advanceTimeBy(BUILD_DEADLINE_MILLIS)
            advanceUntilIdle()

            assertEquals("the merchant has to hear something", 1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Failed)
        }

    /**
     * `Frak.client`'s getter throws once `Frak.shutdown()` has run, which a host app may do while a
     * sheet is open. These calls run inside `scope.launch { }` with no exception handler between
     * them and the merchant's process, so an uncaught one took the app down mid-share.
     */
    @Test
    fun `a client call refused mid-share reports instead of propagating`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
            advanceUntilIdle()

            // Everything the sheet still reaches for after this point is gone.
            client.clientFailure = FrakError.NotInitialized()
            state.share()
            advanceUntilIdle()

            // share() records rather than finishing — the page moves to its confirmation screen and
            // the sheet stays up — so the outcome surfaces when the sheet goes away.
            state.abandon()
            advanceUntilIdle()

            assertEquals("the share still happened; only its attribution was refused", 1, results.size)
            // Typed, not just counted: a `guarded` that reported the refusal instead of swallowing
            // it would also produce exactly one result, and this test would pass on a real bug.
            assertTrue("was: ${results.first()}", results.first() is SharingResult.Shared)
        }

    /**
     * The sheet's teardown racing an outcome that has not landed yet.
     *
     * [SharingSheetState.share] and friends run on the launcher's scope, not the sheet's, so a
     * chooser outlives the sheet that raised it by design. A dismissal reported into that window
     * would beat the share to `finish`'s compare-and-set, and the real outcome would be dropped —
     * not out-ranked by significance, dropped, because the losing `finish` returns before it can
     * record anything.
     */
    @Test
    fun `abandoning while an outcome is still resolving waits for it`() =
        runTest {
            val client = FakeSharingClient()
            // Suspends `track()`, which share() awaits before it records anything.
            val gate = CompletableDeferred<Unit>()
            val results = mutableListOf<SharingResult>()
            client.trackGate = gate
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.share()
            runCurrent()

            // The sheet goes away mid-share: rotation, a nav pop, the merchant's screen replaced.
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

    /**
     * A renderer crash after the page painted deliberately leaves the sheet up rather than raising
     * a chooser over content the user is reading. That was fine while the web view painted opaque
     * white; it is transparent now, so the sheet has to be told to paint something itself.
     */
    @Test
    fun `a renderer crash after paint marks the content lost so the sheet stays opaque`() =
        runTest {
            val client = FakeSharingClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }
            state.prepare(SharingRequest())
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
            state.prepare(SharingRequest())
            advanceUntilIdle()

            client.clientFailure = FrakError.NotInitialized()
            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            // No install page to route to, so the store handoff runs and reports — the point being
            // that it reports at all rather than throwing out of the coroutine.
            assertEquals(1, results.size)
            assertTrue("was: ${results.first()}", results.first() is SharingResult.InstallStarted)
        }

    @Test
    fun `an activated sheet shows the warm page instead of covering it`() =
        runTest {
            val client = FakeSharingClient()

            // The skeleton exists to hide a blank web view. An activated one is not blank: it is
            // already showing the merchant's page, painted before the user tapped.
            val activated = newState(client, activationBaseUrl = NORMALISED_WARM_URL)
            assertTrue("nothing to cover", activated.pageVisible)

            val cold = newState(client)
            assertFalse("a cold view really is blank, and must stay covered", cold.pageVisible)
        }

    private fun TestScope.launchDeadline(state: SharingSheetState) =
        launch { state.awaitLoadDeadline(SHEET_LOAD_DEADLINE_MILLIS) }

    private companion object {
        const val MARKER_URL = "https://acme.example/marker"

        /**
         * What a warmed sharing page's URL actually looks like once loaded. The router
         * fills in and reorders its own search params, so this is deliberately not the
         * string we warm with — the point of the constant is that it differs.
         */
        const val NORMALISED_WARM_URL =
            "https://wallet.frak.id/sharing?embed=native&state=warm&view=share"

        /** Mirrors `SharingPresentation`'s own constant. */
        const val SHEET_LOAD_DEADLINE_MILLIS = 1_500L

        /** Mirrors `SharingSheetState`'s own private constant. */
        const val BUILD_DEADLINE_MILLIS = 8_000L
    }
}
