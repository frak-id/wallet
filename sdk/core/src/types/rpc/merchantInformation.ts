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
 * A tier definition for tiered rewards — pays either a flat token amount
 * or a percent of the tier field value
 */
export type RewardTier =
    | {
          minValue: number;
          maxValue?: number;
          amount: TokenAmountType;
      }
    | {
          minValue: number;
          maxValue?: number;
          percent: number;
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
          /**
           * Basis the percent is applied to: the whole order, or the sum of the
           * line items matched by {@link MerchantReward.productScope}. Kept open
           * so a future basis doesn't require an SDK release.
           */
          percentOf:
              | "purchase_amount"
              | "matched_items_amount"
              | (string & Record<never, never>);
          maxAmount?: TokenAmountType;
          minAmount?: TokenAmountType;
      }
    | {
          payoutType: "tiered";
          tierField: string;
          tiers: RewardTier[];
      };

/**
 * Comparison operators usable in a {@link RuleCondition}.
 * @group RPC Schema
 */
export type ConditionOperator =
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "not_in"
    | "contains"
    | "starts_with"
    | "ends_with"
    | "exists"
    | "not_exists"
    | "between";

/**
 * Dot-path of the rule-evaluation context field a {@link RuleCondition} targets.
 *
 * Only the paths the SDK actually reads are listed (for editor autocompletion);
 * the trailing `string` member keeps the type open to any other path the backend
 * may emit, so it never lies at runtime. Custom interaction data is addressed
 * through `custom.${string}`.
 * @group RPC Schema
 */
export type RuleField =
    // Minimum-purchase gating (read by `extractMinPurchaseAmount`)
    | "purchase.amount"
    // Campaign start gating (read by `extractStartDate`)
    | "time.timestamp"
    // Referrer attribution
    | "attribution.referrerIdentityGroupId"
    // Custom interaction context
    | `custom.${string}`
    // Escape hatch — any other context path (kept assignable to/from `string`)
    | (string & Record<never, never>);

/**
 * A single leaf rule condition. Compares the value found at {@link RuleField}
 * in the evaluation context against `value` (and `valueTo` for `between`).
 *
 * The array variant of `value`/`valueTo` is only meaningful with `in`/`not_in`;
 * every other operator treats an array operand as a non-match.
 * @group RPC Schema
 */
export type RuleCondition = {
    field: RuleField;
    operator: ConditionOperator;
    value: string | number | boolean | null | (string | number | boolean)[];
    valueTo?: string | number | boolean | null | (string | number | boolean)[];
};

/**
 * A recursive group of conditions combined through a boolean `logic`.
 * @group RPC Schema
 */
export type ConditionGroup = {
    logic: "all" | "any" | "none";
    conditions: (RuleCondition | ConditionGroup)[];
};

/**
 * Campaign gating rules: a flat list of {@link RuleCondition} (implicitly
 * AND-ed) or a nested {@link ConditionGroup} tree. Surfaced raw so integrators
 * can inspect the rules and derive their own display (start date, minimum
 * purchase, …) instead of relying on pre-computed fields.
 * @group RPC Schema
 */
export type RuleConditions = RuleCondition[] | ConditionGroup;

/**
 * A reward offer exposed by a merchant campaign.
 *
 * Mirrors the backend `EstimatedRewardItem` one-to-one, enforced by
 * `schemas/merchantRewardParity.ts`.
 * @group RPC Schema
 */
export type MerchantReward = {
    /** Reward token address; falls back to the merchant token when omitted. */
    token?: Address;
    /** Identifier of the campaign rule this reward originates from. */
    campaignId: string;
    /** Campaign display name. */
    name: string;
    /** Interaction that triggers the reward. */
    interactionTypeKey: InteractionTypeKey;
    /** Reward paid to the referrer, when the campaign defines one. */
    referrer?: EstimatedReward;
    /** Reward paid to the referee, when the campaign defines one. */
    referee?: EstimatedReward;
    /** Raw gating rules — inspect to derive start date, minimum purchase, … */
    conditions: RuleConditions;
    /**
     * Per-item scope: when set, this reward only applies to purchases with at
     * least one line item matching these conditions. Absent means it applies to
     * the whole basket.
     */
    productScope?: RuleConditions;
    /** Seconds a reward stays locked before settlement. */
    defaultLockupSeconds?: number;
    /** Days before a pending reward expires. */
    pendingRewardExpirationDays?: number;
    /** Per-user reward cap for this campaign. */
    maxRewardsPerUser?: number;
    /** Merchant-wide per-user reward cap across every campaign. */
    merchantMaxRewardsPerUser?: number;
    /** ISO-8601 campaign end date, or `null` when open-ended. */
    expiresAt?: string | null;
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
    rewards: MerchantReward[];
};
