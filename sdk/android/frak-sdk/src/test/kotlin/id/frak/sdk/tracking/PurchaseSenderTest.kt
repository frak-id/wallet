package id.frak.sdk.tracking

import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * classifyStatus's split is pinned once, in [RowSenderTest]; this file only covers what is
 * unique to a purchase: the merchant-fill/Hold boundary and an unreachable backend.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PurchaseSenderTest {
    private val transport = FakeHttpTransport()
    private val sender = PurchaseSender()

    @Test
    fun `holds, without sending, while no merchant can be resolved`() =
        runTest {
            val outcome = sender.deliver(row(merchantId = null), context(resolveMerchantId = { null }))

            assertEquals(DeliveryOutcome.Hold, outcome)
            assertTrue("a held row must not reach the wire", transport.requests.isEmpty())
        }

    @Test
    fun `keeps the merchant frozen at capture when the row already carries one`() =
        runTest {
            transport.respond(200, """{"success":true}""")

            sender.deliver(row(merchantId = MERCHANT_ID), context(resolveMerchantId = { OTHER_MERCHANT_ID }))

            assertEquals(MERCHANT_ID, JSONObject(transport.requests.single().body!!).getString("merchantId"))
        }

    @Test
    fun `treats an unreachable backend as retryable, never as a verdict`() =
        runTest {
            transport.fail(IOException("offline"))

            assertTrue(sender.deliver(row(), context()) is DeliveryOutcome.Retryable)
        }

    private fun TestScope.context(resolveMerchantId: suspend () -> String? = { MERCHANT_ID }): SendContext =
        SendContext(
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
            resolveMerchantId = resolveMerchantId,
            signProof = { _, _, _ -> null },
        )

    private fun row(merchantId: String? = MERCHANT_ID) =
        QueuedRow(
            kind = PurchaseSender.KIND,
            idempotencyKey = "key-0",
            payload =
                JSONObject()
                    .put("customerId", "customer-1")
                    .put("orderId", ORDER_ID)
                    .put("token", TOKEN),
            clientId = CLIENT_ID,
            merchantId = merchantId,
            capturedAtMillis = 1_709_654_400_000L,
            rowId = 1L,
        )

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
        const val OTHER_MERCHANT_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
        const val ORDER_ID = "order-42"
        const val TOKEN = "checkout-token"
    }
}
