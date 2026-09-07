import Foundation

/// One delivery attempt for a queued row, made by the `RowSender` registered for its kind.
enum DeliveryOutcome: Sendable {
    /// Sent and accepted. Removed from the queue.
    case delivered
    /// Removed from the queue without a backend verdict (e.g. a foreign-merchant arrival, or a
    /// body that failed to encode). Kept apart from `.delivered` because nothing was sent:
    /// reporting backend success for a request that never happened is a lie, whatever the drain
    /// later does with it.
    case dropped
    /// Transient. Arms the shared backoff and leaves the row untouched, however often it recurs.
    case retryable(FrakError?)
    /// A backend verdict that will not change on retry. Counts toward the failure cap.
    case rejected
    /// Inputs not derivable yet (no merchant, no proof). Leaves the row untouched; no failure, no backoff.
    case hold
}
