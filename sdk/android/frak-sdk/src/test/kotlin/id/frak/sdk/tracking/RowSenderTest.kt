package id.frak.sdk.tracking

import id.frak.sdk.core.FrakError
import id.frak.sdk.net.HttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The retry/reject boundary every sender shares. Pinned here rather than per sender: a kind that
 * classified an outage as a verdict would spend its failure cap on it and drop attribution the
 * queue exists to keep, and this is the one place that decision is made.
 */
class RowSenderTest {
    @Test
    fun `a 2xx is delivered`() {
        assertEquals(DeliveryOutcome.Delivered, classifyStatus(HttpClient.Response(200, "{}", null)))
        assertEquals(DeliveryOutcome.Delivered, classifyStatus(HttpClient.Response(204, "", null)))
    }

    @Test
    fun `an outage asks for later and never becomes a verdict`() {
        assertTrue(classifyStatus(HttpClient.Response(500, "", null)) is DeliveryOutcome.Retryable)
        assertTrue(classifyStatus(HttpClient.Response(503, "", null)) is DeliveryOutcome.Retryable)
        assertTrue(classifyStatus(HttpClient.Response(429, "", 30)) is DeliveryOutcome.Retryable)
    }

    @Test
    fun `a 4xx is a verdict that retrying will not change`() {
        assertEquals(DeliveryOutcome.Rejected, classifyStatus(HttpClient.Response(400, "{}", null)))
        assertEquals(DeliveryOutcome.Rejected, classifyStatus(HttpClient.Response(403, "{}", null)))
        // 404 included deliberately: a merchant on a stale build hitting a removed route must
        // stop retrying, not hold a row for fourteen days.
        assertEquals(DeliveryOutcome.Rejected, classifyStatus(HttpClient.Response(404, "", null)))
    }

    @Test
    fun `carries the server's Retry-After through, so the backoff can honour it`() {
        val outcome = classifyStatus(HttpClient.Response(429, "", 30))
        val error = (outcome as DeliveryOutcome.Retryable).error
        assertEquals(30L, (error as FrakError.Server).retryAfterSeconds)
    }
}
