import type { ExplorerConfig } from "@backend-domain/merchant/schemas";
import type { Address, Hex } from "viem";
import type {
    AssetStatus,
    AssetType,
    CancellationReason,
    InteractionType,
    RecipientType,
} from "../schemas";

export { InteractionTypeSchema } from "../schemas";
export type {
    AssetStatus,
    AssetType,
    CancellationReason,
    InteractionType,
    RecipientType,
};

// =============================================================================
// DETAILED ASSET LOG (joined view for reward history)
// =============================================================================

export type DetailedAssetLog = {
    id: string;
    amount: string;
    tokenAddress: Address | null;
    status: AssetStatus;
    recipientType: RecipientType;
    createdAt: Date;
    settledAt: Date | null;
    onchainTxHash: Hex | null;
    interactionType: InteractionType | null;
    interactionPayload: InteractionPayload | null;
    referralLinkId: string | null;
    identityGroupId: string;
    merchantId: string;
    merchantName: string;
    merchantDomain: string;
    merchantExplorerConfig: ExplorerConfig | null;
};

// =============================================================================
// INTERACTION LOG TYPES
// =============================================================================

/**
 * Payload for referral arrival interaction.
 *
 * Discriminated on `referralRegistered`:
 *  - `true` → a new referral_links row was inserted; `referralLinkId` is
 *    guaranteed non-null and points to that row.
 *  - `false` → the referral was rejected (self-referral, cycle, duplicate,
 *    or no referrer resolvable); no link id is carried.
 */
export type ReferralArrivalPayload = {
    referrerWallet?: Address;
    referrerClientId?: string;
    referrerMerchantId?: string;
    referralTimestamp?: number;
} & (
    | { referralRegistered: true; referralLinkId: string }
    | { referralRegistered: false; referralLinkId: null }
);

/**
 * Payload for create referral link interaction (user shares their link).
 */
export type CreateReferralLinkPayload = {
    sharerWallet?: Address;
    merchantId: string;
    sharingTimestamp?: number;
    purchaseId?: string;
};

/**
 * Payload for purchase interaction.
 */
export type PurchasePayload = {
    orderId: string;
    externalCustomerId: string;
    amount: number;
    currency: string;
    items: {
        productId?: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
    }[];
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
    errors: {
        assetLogId: string;
        error: string;
    }[];
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
    referralLinkId?: string;
    interactionLogId: string;
    chainDepth?: number;
    expirationDays?: number;
    /**
     * Number of days the reward stays locked before it becomes claimable.
     * `0` or `undefined` means no lockup.
     */
    lockupDays?: number;
};
