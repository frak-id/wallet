import type { Address } from "viem";
import type { InteractionTypeKey } from "../../constants/interactionTypes";

/**
 * The type for the amount of tokens
 */
export type TokenAmountType = {
    amount: number;
    eurAmount: number;
    usdAmount: number;
    gbpAmount: number;
};

/**
 * A tier definition for tiered rewards
 */
export type RewardTier = {
    minValue: number;
    maxValue?: number;
    amount: TokenAmountType;
};

/**
 * Estimated reward amount — discriminated union by payout type
 *
 * - `fixed`: A known token amount (with fiat equivalents)
 * - `percentage`: A percent of a purchase field (e.g. 5% of purchase_amount), with optional min/max caps
 * - `tiered`: Amount depends on a field value matching tier brackets
 */
export type EstimatedReward =
    | {
          payoutType: "fixed";
          amount: TokenAmountType;
      }
    | {
          payoutType: "percentage";
          percent: number;
          percentOf: string;
          maxAmount?: TokenAmountType;
          minAmount?: TokenAmountType;
      }
    | {
          payoutType: "tiered";
          tierField: string;
          tiers: RewardTier[];
      };

/**
 * Response of the `frak_getMerchantInformation` RPC method
 * @group RPC Schema
 */
export type GetMerchantInformationReturnType = {
    /**
     * Current merchant id
     */
    id: string;
    /**
     * Some metadata
     */
    onChainMetadata: {
        /**
         * Name of the merchant on-chain
         */
        name: string;
        /**
         * Domain of the merchant on-chain
         */
        domain: string;
    };
    rewards: {
        token?: Address;
        campaignId: string;
        interactionTypeKey: InteractionTypeKey;
        referrer?: EstimatedReward;
        referee?: EstimatedReward;
    }[];
};
