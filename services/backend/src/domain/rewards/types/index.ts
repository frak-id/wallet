import type { Address, Hex } from "viem";

// =============================================================================
// INTERACTION LOG TYPES
// =============================================================================

/**
 * Types of interactions that can be logged.
 */
export type InteractionType =
    | "referral_arrival" // User lands via referral link
    | "purchase" // Purchase event from webhook
    | "wallet_connect" // User connects wallet
    | "identity_merge"; // Two identity groups combined

/**
 * Payload for referral arrival interaction.
 */
export type ReferralArrivalPayload = {
    referrerWallet: Address;
    landingUrl?: string;
    touchpointId: string;
};

/**
 * Payload for purchase interaction.
 */
export type PurchasePayload = {
    orderId: string;
    externalCustomerId: string;
    amount: number;
    currency: string;
    items: Array<{
        productId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }>;
    purchaseId: string;
    touchpointId?: string;
};

/**
 * Payload for wallet connect interaction.
 */
export type WalletConnectPayload = {
    wallet: Address;
    previousGroupId?: string;
};

/**
 * Payload for identity merge interaction.
 */
export type IdentityMergePayload = {
    sourceGroupId: string;
    targetGroupId: string;
    mergedNodeCount: number;
};

export type InteractionPayload =
    | ReferralArrivalPayload
    | PurchasePayload
    | WalletConnectPayload
    | IdentityMergePayload;

// =============================================================================
// ASSET LOG TYPES
// =============================================================================

/**
 * Status of an asset log entry.
 * See state machine in REFACTO_ARCHITECTURE.md
 */
export type AssetStatus =
    | "pending" // Reward created, waiting for settlement batch
    | "ready_to_claim" // Pushed/locked on blockchain, user can claim
    | "claimed" // User claimed on-chain
    | "consumed" // Soft reward used (discount redeemed)
    | "cancelled"; // Refunded or fraud detected

/**
 * Type of asset/reward.
 */
export type AssetType =
    | "token" // Crypto token (USDC, etc.)
    | "discount" // Store discount (soft reward)
    | "points"; // Loyalty points (soft reward)

/**
 * Who receives the reward (denormalized from campaign rule for queries).
 */
export type RecipientType =
    | "referrer" // The user who shared the referral link
    | "referee" // The user who clicked and converted
    | "user"; // The current user (non-referral rewards)

// =============================================================================
// SETTLEMENT TYPES
// =============================================================================

/**
 * Result of a single reward settlement attempt.
 */
export type RewardSettlementResult = {
    assetLogId: string;
    success: boolean;
    txHash?: Hex;
    blockNumber?: bigint;
    error?: string;
};

/**
 * Aggregated result of batch settlement.
 */
export type SettlementResult = {
    pushedCount: number;
    lockedCount: number;
    failedCount: number;
    txHashes: Hex[];
    errors: Array<{
        assetLogId: string;
        error: string;
    }>;
};

/**
 * Attestation event structure for on-chain proof.
 */
export type AttestationEvent = {
    event: string;
    timestampInSecond: number;
};

// =============================================================================
// PROCESSING TYPES
// =============================================================================

/**
 * Result of processing a purchase event.
 */
export type ProcessPurchaseResult = {
    interactionLogId: string;
    rewards: Array<{
        assetLogId: string;
        recipient: RecipientType;
        amount: number;
        token: Address | null;
    }>;
    budgetExceeded: boolean;
    skippedCampaigns: string[];
    errors: Array<{
        campaignRuleId: string;
        error: string;
    }>;
};

/**
 * Parameters for creating an asset log entry.
 */
export type CreateAssetLogParams = {
    identityGroupId: string;
    merchantId: string;
    campaignRuleId: string;
    assetType: AssetType;
    amount: number;
    tokenAddress?: Address;
    recipientType: RecipientType;
    recipientWallet?: Address;
    touchpointId?: string;
    purchaseId?: string;
    interactionLogId: string;
    chainDepth?: number;
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

export function encodeUserId(identityGroupId: string): Hex {
    const uuidWithoutHyphens = identityGroupId.replace(/-/g, "");
    return `0x${uuidWithoutHyphens.padStart(64, "0")}` as Hex;
}

export function decodeUserId(userId: Hex): string {
    const hex = userId.slice(2).replace(/^0+/, "");
    if (hex.length !== 32) {
        throw new Error(`Invalid userId length: ${hex.length}`);
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Build attestation for on-chain proof.
 */
export function buildAttestation(
    events: Array<{ event: string; timestamp: Date }>
): string {
    const payload: AttestationEvent[] = events.map((e) => ({
        event: e.event,
        timestampInSecond: Math.floor(e.timestamp.getTime() / 1000),
    }));
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
