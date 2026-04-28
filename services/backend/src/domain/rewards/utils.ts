/**
 * Build the canonical `external_event_id` for a purchase interaction log.
 *
 * Used by both `PurchaseInteractionCreator` (write) and the lookups that
 * resolve a purchase back to its interaction (read). Centralised so a format
 * change can't silently break the round-trip.
 */
export function purchaseExternalEventId(externalId: string): string {
    return `purchase:${externalId}`;
}
