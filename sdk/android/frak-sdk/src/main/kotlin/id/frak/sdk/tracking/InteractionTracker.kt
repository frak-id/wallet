package id.frak.sdk.tracking

import id.frak.sdk.config.Backoff
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.HttpClient.Companion.toServerError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.util.UUID

/**
 * Queues tracked events and drains them, oldest first. Enqueue is durable; sending is
 * best-effort behind it. Strictly FIFO with one send in flight; parallel sends would reorder
 * events for no gain at this volume.
 */
internal class InteractionTracker(
    private val queue: EventQueue,
    private val http: HttpClient,
    private val logger: FrakLogger,
    /** Drains run here, not on the caller: [track] must not block on the whole backlog. */
    private val scope: CoroutineScope,
    /**
     * The id events are currently captured under, read fresh so a reset is visible mid-drain.
     * Suspending (4.5): [id.frak.sdk.identity.AnonymousIdStore.anonymousId] awaits eager
     * generation rather than blocking, so this drain loop no longer calls a blocking keystore
     * read from inside itself.
     */
    private val currentClientId: suspend () -> String?,
    private val now: () -> Long = System::currentTimeMillis,
    private val newKey: () -> String = { UUID.randomUUID().toString() },
    private val backoff: Backoff = Backoff(now),
) {
    /** Guards the file. Held only for reads and writes, never across a request. */
    private val queueMutex = Mutex()

    /** One drain at a time. A second concurrent flush would reorder the queue it is draining. */
    private val flushMutex = Mutex()

    /** Returns once the event is durable, not once delivered: the drain is detached onto [scope]. */
    suspend fun track(
        merchantId: String,
        clientId: String?,
        interaction: Interaction,
    ) {
        val key = (interaction as? Interaction.Custom)?.idempotencyKey ?: newKey()
        enqueue(INTERACTION_PATH, interactionBody(merchantId, interaction, key), clientId, key)
        scope.launch { flush() }
    }

    /** Same contract as [track]. Idempotency key never reaches the wire; backend dedupes on `(orderId, token)`. */
    suspend fun trackPurchase(
        merchantId: String,
        clientId: String?,
        customerId: String,
        orderId: String,
        token: String,
    ) {
        val body =
            JSONObject()
                .put("merchantId", merchantId)
                .put("customerId", customerId)
                .put("orderId", orderId)
                .put("token", token)
        enqueue(PURCHASE_PATH, body, clientId, newKey())
        scope.launch { flush() }
    }

    /** Called on anonymous id reset: an event captured under the dead id must never be emitted. */
    suspend fun purge() {
        queueMutex.withLock { queue.clear() }
    }

    /**
     * Sends oldest first, stopping (not skipping) at the first failure to keep FIFO order —
     * except a permanently-rejected event, dropped after [MAX_FAILURES]. Network I/O happens
     * outside [queueMutex] so [enqueue] never waits on a request. File is reconciled against a
     * fresh read afterwards, so an event appended mid-flush isn't lost.
     */
    suspend fun flush() {
        flushMutex.withLock {
            if (backoff.isBackingOff(BACKOFF_KEY)) return

            val pending = queueMutex.withLock { queue.read(now()) }
            if (pending.isEmpty()) {
                // Nothing to send, but expired/unreadable rows may still be on disk. `reconcile`,
                // not a bare `replace(emptyList())`: that call relied on an unstated invariant
                // (a non-durable read is never empty, per EventQueue.readLocked's contract) to
                // avoid wiping a queue whose migration ids hadn't actually persisted — fragile,
                // and one edit away from reopening 2.7's critical bug. `reconcile` already refuses
                // to compact a non-durable read, so it is safe unconditionally and matches the
                // iOS actor twin exactly.
                queueMutex.withLock { queue.reconcile(emptySet(), emptyMap(), now()) }
                return
            }

            val currentClientId = currentClientId()
            val delivered = mutableSetOf<Long>()
            val retried = mutableMapOf<Long, QueuedEvent>()

            for (event in pending) {
                // Dropped even if purge and this drain raced: event carries the id it was captured under.
                if (event.clientId != null && currentClientId != null && event.clientId != currentClientId) {
                    delivered += event.rowId
                    continue
                }

                val response =
                    try {
                        http.post(event.path, event.body.toString(), headersFor(event))
                    } catch (failure: FrakError) {
                        backoff.recordFailure(BACKOFF_KEY, failure)
                        break
                    }

                if (response.isSuccess) {
                    backoff.recordSuccess(BACKOFF_KEY)
                    delivered += event.rowId
                    continue
                }

                val error = response.toServerError()
                backoff.recordFailure(BACKOFF_KEY, error)

                // 429/5xx ask for later; everything else is a verdict that won't change on retry.
                if (response.status == TOO_MANY_REQUESTS || response.status >= SERVER_ERROR) break

                val failed = event.withFailure()
                if (failed.failures >= MAX_FAILURES) {
                    logger.warn("Dropping an event the backend keeps rejecting (HTTP ${response.status}).")
                    delivered += event.rowId
                } else {
                    retried[event.rowId] = failed
                }
                break
            }

            // queue.reconcile, not a read()-then-replace() from here (2.7/6): those would be two
            // separate suspending hops on ioDispatcher — genuinely multi-threaded — and an event
            // appended between them would be read by neither and erased by the second. queueMutex
            // wraps every call site in this file today so that specific window can't open yet, but
            // EventQueue's own doc says "single writer only" while providing no internal
            // serialisation of its own; keeping read+write inside one EventQueue-owned hop, the way
            // the iOS actor twin already does, means that stays true regardless of what future
            // caller reaches EventQueue next.
            queueMutex.withLock {
                queue.reconcile(delivered, retried, now())
            }
        }
    }

    private suspend fun enqueue(
        path: String,
        body: JSONObject,
        clientId: String?,
        idempotencyKey: String,
    ) {
        queueMutex.withLock {
            // MISSING_ROW_ID: EventQueue.append assigns and persists the real id; nothing
            // upstream of it, including this call site, is allowed to choose one (2.7).
            queue.append(QueuedEvent(idempotencyKey, path, body, clientId, now(), rowId = EventQueue.MISSING_ROW_ID))
        }
    }

    /** `x-frak-client-id` carries the id the event was captured under, not the current one. */
    private fun headersFor(event: QueuedEvent): Map<String, String> =
        event.clientId?.let { mapOf(CLIENT_ID_HEADER to it) } ?: emptyMap()

    /** Idempotency key is only written for the two shapes whose schema carries one; `arrival` has none. */
    private fun interactionBody(
        merchantId: String,
        interaction: Interaction,
        idempotencyKey: String,
    ): JSONObject {
        val body = JSONObject().put("merchantId", merchantId)
        return when (interaction) {
            is Interaction.Arrival -> {
                body
                    .put("type", "arrival")
                    .put("referrerWallet", interaction.referrerWallet)
                    .put("referrerClientId", interaction.referrerClientId)
                    .put("referrerMerchantId", interaction.referrerMerchantId)
                    .put("referralTimestamp", interaction.referralTimestamp)
            }

            is Interaction.Sharing -> {
                body
                    .put("type", "sharing")
                    .put("sharingTimestamp", interaction.sharingTimestamp ?: (now() / 1000))
                    .put("purchaseId", interaction.purchaseId)
                    .put("idempotencyKey", idempotencyKey)
            }

            is Interaction.Custom -> {
                // Not validated here: the route's schema is the authority; a rejection is a 4xx
                // the flush loop already evicts.
                val data = JSONObject()
                interaction.data.forEach { (key, value) -> data.put(key, value) }
                body
                    .put("type", "custom")
                    .put("customType", interaction.customType)
                    .put("data", data)
                    .put("idempotencyKey", idempotencyKey)
            }
        }
    }

    private companion object {
        const val INTERACTION_PATH = "/user/track/interaction"
        const val PURCHASE_PATH = "/user/track/purchase"

        const val CLIENT_ID_HEADER = "x-frak-client-id"

        const val TOO_MANY_REQUESTS = 429
        const val SERVER_ERROR = 500
        const val MAX_FAILURES = 3

        const val BACKOFF_KEY = "track"
    }
}
