import type { Address, Hex } from "viem";
import type {
    AssetStatus,
    AssetType,
    InteractionType,
    RecipientType,
} from "../schemas";

export type { AssetStatus, AssetType, InteractionType, RecipientType };
export { InteractionTypeSchema } from "../schemas";

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
    referralRegistered: boolean;
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

export type CustomPayload = {
    customType: string;
    data: Record<string, unknown>;
};

export type InteractionPayload =
    | ReferralArrivalPayload
    | CreateReferralLinkPayload
    | PurchasePayload
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
    banks: Set<Address>;
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
