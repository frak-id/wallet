package id.frak.sdk.tracking

import id.frak.sdk.core.FrakError

/** One delivery attempt for a queued row, made by the [RowSender] registered for its kind. */
internal sealed interface DeliveryOutcome {
    /** Sent and accepted. Removed from the queue. */
    data object Delivered : DeliveryOutcome

    /**
     * Removed from the queue without a backend verdict (e.g. a foreign-merchant arrival). Kept
     * apart from [Delivered] because nothing was sent: reporting backend success for a request
     * that never happened is a lie, whatever the drain later does with it.
     */
    data object Dropped : DeliveryOutcome

    /** Transient. Arms the shared backoff and leaves the row untouched, however often it recurs. */
    class Retryable(
        val error: FrakError?,
    ) : DeliveryOutcome

    /** A backend verdict that will not change on retry. Counts toward the failure cap. */
    data object Rejected : DeliveryOutcome

    /** Inputs not derivable yet (no merchant, no proof). Leaves the row untouched; no failure, no backoff. */
    data object Hold : DeliveryOutcome
}
