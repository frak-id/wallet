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
type ReferralArrivalPayload = {
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
type IdentityMergePayload = {
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
 * Simplified flow: pending → processing → settled
 */
export type AssetStatus =
    | "pending" // Reward created, waiting for wallet + settlement
    | "processing" // Settlement batch processing it
    | "settled" // Pushed on blockchain, user can claim via smart contract
    | "consumed" // Soft reward used (discount redeemed)
    | "cancelled" // Refunded or fraud detected
    | "expired"; // Pending reward expired (no wallet connected in time)

export type AssetType = "token" | "discount" | "points";

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

export type SettlementResult = {
    settledCount: number;
    failedCount: number;
    txHashes: Hex[];
    errors: Array<{
        assetLogId: string;
        error: string;
    }>;
};

export { buildAttestation } from "@backend-utils";

// =============================================================================
// PROCESSING TYPES
// =============================================================================

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
    interactionLogId: string;
    chainDepth?: number;
    expirationDays?: number;
};
