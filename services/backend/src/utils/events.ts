/**
 * Events emitted by the backend for async processing.
 *
 * Event-driven architecture for decoupled processing:
 * - Layer 1 (Fast Path): Webhooks/SDK → save interaction_log → emit event → return 200
 * - Layer 2 (Batch): newInteraction triggers reward calculation job
 * - Layer 3 (Settlement): newPendingRewards triggers blockchain settlement
 */
export type FrakEvents = {
    /**
     * Emitted when a new interaction is logged (purchase, referral_arrival, etc.).
     * Triggers the reward calculation job to process pending interactions.
     */
    newInteraction: [{ type: InteractionEventType }];

    /**
     * Emitted when new rewards are created and pending settlement.
     * Triggers the settlement job to push rewards to blockchain.
     */
    newPendingRewards: [{ count: number }];
};

/**
 * Types of interactions that can trigger events.
 */
export type InteractionEventType =
    | "referral_arrival"
    | "purchase"
    | "wallet_connect"
    | "identity_merge";
