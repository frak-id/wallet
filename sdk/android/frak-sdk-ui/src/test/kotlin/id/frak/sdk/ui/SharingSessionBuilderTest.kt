package id.frak.sdk.ui

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class SharingSessionBuilderTest {
    private fun builder(client: FakeSharingClient): SharingSessionBuilder =
        SharingSessionBuilder(dependencies = client, packageId = "com.acme.app", sessionId = "1", language = null)

    private suspend fun tier3Session(
        client: FakeSharingClient,
        request: SharingRequest = sharingRequest(),
    ): SharingSession {
        client.resolveFailure = FrakError.Network(IOException("offline"))
        val built = builder(client).build(request)
        val ready = built as SharingBuild.Ready
        assertTrue("expected a page-less tier-3 session", !ready.session.hasPage)
        return ready.session
    }

    @Test
    fun `a per-call override wins over everything else`() =
        runTest {
            val client = FakeSharingClient()
            client.resolveFailure = FrakError.Network(IOException("offline"))
            val built =
                builder(client).build(
                    sharingRequest(
                        products = listOf(sharingProduct(title = "Kettle", link = "https://acme.example/k")),
                        shareTitle = "Custom title",
                        shareText = "Custom text",
                    ),
                )
            val session = (built as SharingBuild.Ready).session
            assertEquals("Custom title", session.shareTitle)
            assertEquals("Custom text", session.shareText)
        }

    @Test
    fun `an override carrying the placeholder is interpolated too, not passed through raw`() =
        runTest {
            val client = FakeSharingClient()
            client.metadataNameValue = "Acme"
            val session =
                tier3Session(
                    client,
                    sharingRequest(shareTitle = "Win big with {{productName}}", shareText = "From {{productName}}!"),
                )
            assertEquals("Win big with Acme", session.shareTitle)
            assertEquals("From Acme!", session.shareText)
        }

    @Test
    fun `with no override, the first product's title wins over the built-in default`() =
        runTest {
            val client = FakeSharingClient()
            client.metadataNameValue = "Acme"
            val session =
                run {
                    client.resolveFailure = FrakError.Network(IOException("offline"))
                    val built =
                        builder(client).build(
                            sharingRequest(
                                products =
                                    listOf(
                                        sharingProduct(title = "Kettle", link = "https://acme.example/k"),
                                        sharingProduct(title = "Toaster", link = "https://acme.example/t"),
                                    ),
                            ),
                        )
                    (built as SharingBuild.Ready).session
                }
            assertEquals("the first product wins, not the merchant name", "Kettle", session.shareTitle)
        }

    @Test
    fun `with no override and no product, the built-in default interpolates the metadata name`() =
        runTest {
            val client = FakeSharingClient()
            client.metadataNameValue = "Acme"
            val session = tier3Session(client)
            assertEquals("Acme invite link", session.shareTitle)
            assertEquals("Discover this amazing product!", session.shareText)
        }

    @Test
    fun `a french merchant gets the french default, not the english one`() =
        runTest {
            val client = FakeSharingClient()
            client.metadataNameValue = "Acme"
            client.metadataLangValue = FrakLanguage.FR
            val session = tier3Session(client)
            assertEquals("Lien d'invitation Acme", session.shareTitle)
            assertEquals("Découvrez ce produit incroyable !", session.shareText)
        }

    @Test
    fun `a null metadata name drops the placeholder rather than rendering a gap`() =
        runTest {
            val client = FakeSharingClient()
            client.metadataNameValue = null
            val session = tier3Session(client)
            assertEquals("invite link", session.shareTitle)
            assertEquals("Discover this amazing product!", session.shareText)
        }

    @Test
    fun `tier 3 never reaches resolveConfig's translations`() =
        runTest {
            // resolveConfig() throws, so build() must not try to read a merchant that was never resolved.
            val client = FakeSharingClient()
            val session = tier3Session(client)
            assertNull("no page means no config-sourced copy at all", session.url(confirmed = false))
        }
}
