package id.frak.sdk.tracking

import id.frak.sdk.config.Backoff
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.identity.ProofOp
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.util.UUID

/**
 * Queues tracked events and drains them oldest first: enqueue is durable, sending is best-effort
 * behind it, one send in flight at a time. Delivery for a row's [QueuedRow.kind] is delegated to
 * [senders]; this class only owns ordering, consent, backoff, reconciliation and the failure cap.
 */
internal class EventOutbox(
    private val queue: EventQueue,
    private val http: HttpClient,
    private val logger: FrakLogger,
    /** Drains run here, not on the caller: [track] must not block on the whole backlog. */
    private val scope: CoroutineScope,
    /** The id events are currently captured under, read fresh so a reset is visible mid-drain. */
    private val currentClientId: suspend () -> String?,
    /**
     * Whether tracking is still permitted, re-read per event: [flush] posts outside [queueMutex],
     * so without this an event already read would still upload after a withdrawal.
     */
    private val trackingAllowed: suspend () -> Boolean = { true },
    /**
     * Resolves the merchant for a row captured without one, at drain time. Called at most once
     * per drain and only when a deferred row is actually reached; null means "not yet", which
     * holds the row rather than dropping it. Never let this throw.
     */
    private val resolveMerchantId: suspend () -> String? = { null },
    /** Mints a proof for a sender that needs one (currently only [MergeSender]). Never let this throw. */
    private val signProof: suspend (
        op: ProofOp,
        merchantId: String,
        binding: ByteArray,
    ) -> String? = { _, _, _ -> null },
    /** One [RowSender] per [QueuedRow.kind]; an unrecognised kind is skipped, never generic-POSTed. */
    private val senders: Map<String, RowSender> = emptyMap(),
    private val now: () -> Long = System::currentTimeMillis,
    private val newKey: () -> String = { UUID.randomUUID().toString() },
    private val backoff: Backoff = Backoff(now),
) {
    /** Guards the file. Held only for reads and writes, never across a request. */
    private val queueMutex = Mutex()

    /** One drain at a time. A second concurrent flush would reorder the queue it is draining. */
    private val flushMutex = Mutex()

    /**
     * Returns once the event is durable, not once delivered: the drain is detached onto [scope].
     *
     * A null [merchantId] is captured anyway and resolved at drain ([resolveMerchantId]), so a
     * referral arriving before any config could be resolved is held rather than lost.
     */
    suspend fun track(
        merchantId: String?,
        clientId: String?,
        interaction: Interaction,
    ) {
        val key = (interaction.kind as? Interaction.Kind.Custom)?.idempotencyKey ?: newKey()
        enqueue(InteractionSender.KIND, interactionPayload(interaction, key), clientId, merchantId, key)
        scope.launch { flush() }
    }

    /** Same contract as [track]. Idempotency key never reaches the wire; backend dedupes on `(orderId, token)`. */
    suspend fun trackPurchase(
        merchantId: String?,
        clientId: String?,
        customerId: String,
        orderId: String,
        token: String,
    ) {
        val payload =
            JSONObject()
                .put("customerId", customerId)
                .put("orderId", orderId)
                .put("token", token)
        enqueue(PurchaseSender.KIND, payload, clientId, merchantId, newKey())
        scope.launch { flush() }
    }

    // No shutdown(): every drain is launched on the client's scope, which
    // DefaultFrakClient.shutdown() cancels and joins.

    /** Called on anonymous id reset: an event captured under the dead id must never be emitted. */
    suspend fun purge() {
        queueMutex.withLock { queue.clear() }
    }

    /**
     * Queues an inbound identity merge, with the same durability contract as [track]: an `fmt`
     * token is single-use and short-lived, so losing one to a cold cache or a dead network is
     * permanent, and it must not depend on a merchant resolving before it can be written down.
     */
    suspend fun trackMerge(
        merchantId: String?,
        anonymousId: String,
        mergeToken: String,
    ) {
        // A token already on disk was claimed by a previous process, whose in-memory guard died
        // with it; without this, every cold start on the same intent would queue it again.
        if (isQueued(MergeSender.KIND, mergeToken)) return
        enqueue(MergeSender.KIND, JSONObject(), anonymousId, merchantId, mergeToken)
        scope.launch { flush() }
    }

    /** [idempotencyKey] is the token itself for a merge row; it never reaches the wire from there. */
    private suspend fun isQueued(
        kind: String,
        idempotencyKey: String,
    ): Boolean =
        queueMutex
            .withLock { queue.read(now()) }
            .any { it.kind == kind && it.idempotencyKey == idempotencyKey }

    /**
     * Books one failed delivery against [event]: retried until [MAX_FAILURES], then dropped so a
     * permanently-rejected row cannot block the FIFO behind it forever.
     */
    private fun recordRetry(
        event: QueuedRow,
        delivered: MutableSet<Long>,
        retried: MutableMap<Long, QueuedRow>,
        reason: String,
    ) {
        val failed = event.withFailure()
        if (failed.failures >= MAX_FAILURES) {
            logger.warn("Dropping an event: $reason.")
            delivered += event.rowId
        } else {
            retried[event.rowId] = failed
        }
    }

    /**
     * Sends oldest first, stopping (not skipping) at the first failure to keep FIFO order — except
     * a permanently-rejected event, dropped after [MAX_FAILURES], and an unrecognised kind or one
     * already delivered, both of which skip ahead. Network I/O happens outside [queueMutex], and
     * the file is reconciled against a fresh read so a mid-flush append isn't lost.
     */
    suspend fun flush() {
        flushMutex.withLock {
            if (!trackingAllowed()) return
            if (backoff.isBackingOff(BACKOFF_KEY)) return

            val pending = queueMutex.withLock { queue.read(now()) }
            if (pending.isEmpty()) {
                // Expired or unreadable rows may still be on disk.
                queueMutex.withLock { queue.reconcile(emptySet(), emptyMap(), now()) }
                return
            }

            val currentClientId = currentClientId()
            val delivered = mutableSetOf<Long>()
            val retried = mutableMapOf<Long, QueuedRow>()
            val ctx = sendContext()

            for (event in pending) {
                // break, not return: falling through to reconcile prevents a re-send when a
                // concurrent purge's file delete silently fails.
                if (!trackingAllowed()) {
                    logger.info("Tracking was disabled mid-drain; stopping without sending the rest.")
                    break
                }
                // Dropped even if purge and this drain raced: event carries the id it was captured under.
                if (event.clientId != null && currentClientId != null && event.clientId != currentClientId) {
                    delivered += event.rowId
                    continue
                }

                val sender = senders[event.kind]
                if (sender == null) {
                    logger.warn("No sender registered for row kind '${event.kind}'; skipping it.")
                    continue
                }

                when (val outcome = sender.deliver(event, ctx)) {
                    is DeliveryOutcome.Delivered -> {
                        backoff.recordSuccess(BACKOFF_KEY)
                        delivered += event.rowId
                        continue
                    }

                    is DeliveryOutcome.Dropped -> {
                        delivered += event.rowId
                        continue
                    }

                    is DeliveryOutcome.Retryable -> {
                        backoff.recordFailure(BACKOFF_KEY, outcome.error)
                        break
                    }

                    is DeliveryOutcome.Rejected -> {
                        recordRetry(event, delivered, retried, "the backend rejected it")
                        break
                    }

                    is DeliveryOutcome.Hold -> {
                        if (event.heldSince == null) {
                            retried[event.rowId] = event.withHeldSince(now())
                            break
                        }
                        val heldFor = now() - event.heldSince
                        if (heldFor <= sender.holdTimeoutMillis) break
                        // continue, not break: dropping the dead row is the point, and the rows
                        // behind it must get their turn in this same drain.
                        logger.warn("Dropping a '${event.kind}' row held ${heldFor}ms with no resolvable inputs.")
                        delivered += event.rowId
                        continue
                    }
                }
            }

            // One EventQueue-owned hop: a read()-then-replace() from here would erase an event
            // appended between the two suspending calls.
            queueMutex.withLock {
                queue.reconcile(delivered, retried, now())
            }
        }
    }

    /**
     * Built once per drain, so [SendContext.resolveMerchantId] resolves at most once however many
     * deferred rows this pass reaches — matching [resolveMerchantId]'s own once-per-drain contract.
     */
    private fun sendContext(): SendContext {
        var merchantId: String? = null
        var attempted = false
        return SendContext(
            http = http,
            resolveMerchantId = {
                if (!attempted) {
                    attempted = true
                    merchantId = resolveMerchantId()
                }
                merchantId
            },
            signProof = signProof,
        )
    }

    private suspend fun enqueue(
        kind: String,
        payload: JSONObject,
        clientId: String?,
        merchantId: String?,
        idempotencyKey: String,
    ) {
        queueMutex.withLock {
            // EventQueue.append assigns and persists the real row id; no caller may choose one.
            queue.append(
                QueuedRow(
                    idempotencyKey = idempotencyKey,
                    kind = kind,
                    payload = payload,
                    clientId = clientId,
                    merchantId = merchantId,
                    capturedAtMillis = now(),
                    rowId = EventQueue.MISSING_ROW_ID,
                ),
            )
        }
    }

    /** Idempotency key is only written for the two shapes whose schema carries one; `arrival` has none. */
    private fun interactionPayload(
        interaction: Interaction,
        idempotencyKey: String,
    ): JSONObject =
        when (val kind = interaction.kind) {
            is Interaction.Kind.Arrival -> {
                JSONObject()
                    .put("type", "arrival")
                    .put("referrerWallet", kind.referrerWallet)
                    .put("referrerClientId", kind.referrerClientId)
                    .put("referrerMerchantId", kind.referrerMerchantId)
                    .put("referralTimestamp", kind.referralTimestamp)
            }

            is Interaction.Kind.Sharing -> {
                JSONObject()
                    .put("type", "sharing")
                    .put("sharingTimestamp", kind.sharingTimestamp ?: (now() / 1000))
                    .put("purchaseId", kind.purchaseId)
                    .put("idempotencyKey", idempotencyKey)
            }

            is Interaction.Kind.Custom -> {
                // Not validated here: the route's schema is the authority, and a rejection is a 4xx.
                val data = JSONObject()
                kind.data.forEach { (key, value) -> data.put(key, value) }
                JSONObject()
                    .put("type", "custom")
                    .put("customType", kind.customType)
                    .put("data", data)
                    .put("idempotencyKey", idempotencyKey)
            }
        }

    private companion object {
        const val MAX_FAILURES = 3
        const val BACKOFF_KEY = "track"
    }
}
