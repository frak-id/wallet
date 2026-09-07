package id.frak.sdk.tracking

import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.HttpClient.Companion.toServerError

/**
 * Delivers one row's kind: owns its URL, body, headers and response classification. The drain
 * looks one up by [QueuedRow.kind] and never interprets a row itself — see [EventOutbox.flush].
 */
internal interface RowSender {
    suspend fun deliver(
        row: QueuedRow,
        ctx: SendContext,
    ): DeliveryOutcome

    /** How long a row may sit in [DeliveryOutcome.Hold] before the drain gives up on it. */
    val holdTimeoutMillis: Long get() = DEFAULT_HOLD_TIMEOUT_MILLIS
}

/** `x-frak-client-id` carries the id the row was captured under, not the current one. Shared by every sender that posts on behalf of a device. */
internal fun clientIdHeaders(row: QueuedRow): Map<String, String> =
    row.clientId?.let { mapOf("x-frak-client-id" to it) } ?: emptyMap()

/**
 * The retry/reject boundary, in one place for every sender: 429 and 5xx ask for later, anything
 * else non-2xx is a verdict. Lived in three copies once, which is one drift away from a kind that
 * spends its failure cap on an outage — the bug this queue exists to prevent.
 */
internal fun classifyStatus(response: HttpClient.Response): DeliveryOutcome =
    when {
        response.isSuccess -> {
            DeliveryOutcome.Delivered
        }

        response.status == TOO_MANY_REQUESTS || response.status >= SERVER_ERROR -> {
            DeliveryOutcome.Retryable(response.toServerError())
        }

        else -> {
            DeliveryOutcome.Rejected
        }
    }

private const val TOO_MANY_REQUESTS = 429
private const val SERVER_ERROR = 500

/** Default hold budget: a day is long enough for a cold-started merchant config to resolve. */
internal const val DEFAULT_HOLD_TIMEOUT_MILLIS: Long = 24L * 60 * 60 * 1000
