import type { Address, Hex } from "viem";
import type {
    AssetStatus,
    AssetType,
    InteractionType,
    RecipientType,
} from "../schemas";

export type { AssetStatus, AssetType, InteractionType, RecipientType };

// =============================================================================
// INTERACTION LOG TYPES
// =============================================================================

/**
 * Payload for referral arrival interaction.
 */
export type ReferralArrivalPayload = {
    referrerWallet: Address;
    landingUrl?: string;
    touchpointId: string;
};

/**
 * Payload for create referral link interaction (user shares their link).
 */
export type CreateReferralLinkPayload = {
    sharerWallet: Address;
    merchantId: string;
    touchpointId?: string;
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

export type CustomPayload = {
    customType: string;
    data: Record<string, unknown>;
};

export type InteractionPayload =
    | ReferralArrivalPayload
    | CreateReferralLinkPayload
    | PurchasePayload
    | WalletConnectPayload
    | IdentityMergePayload
    | CustomPayload;

// =============================================================================
// ASSET LOG TYPES
// =============================================================================

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
