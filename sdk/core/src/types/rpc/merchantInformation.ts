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
 * The listed literals mirror the backend campaign `RuleContext` and exist for
 * editor autocompletion; the trailing `string` member keeps the type open to
 * any other (future or custom) path the backend may emit, so it never lies at
 * runtime. Custom interaction data is addressed through `custom.${string}`.
 * @group RPC Schema
 */
export type RuleField =
    // Purchase context
    | "purchase.orderId"
    | "purchase.amount"
    | "purchase.currency"
    | "purchase.isFirstPurchase"
    | "purchase.shippingCost"
    | "purchase.taxAmount"
    // Attribution context
    | "attribution.referrerIdentityGroupId"
    // User context
    | "user.identityGroupId"
    | "user.walletAddress"
    | "user.countryCode"
    | "user.isNew"
    | "user.totalPurchases"
    | "user.totalSpend"
    | "user.rewards.campaignRewardCount"
    | "user.rewards.campaignRewardAmount"
    | "user.rewards.merchantRewardCount"
    | "user.rewards.merchantRewardAmount"
    // Time context
    | "time.dayOfWeek"
    | "time.hourOfDay"
    | "time.date"
    | "time.timestamp"
    // Custom interaction context
    | `custom.${string}`
    // Escape hatch — any other context path (kept assignable to/from `string`)
    | (string & Record<never, never>);

/**
 * A single leaf rule condition. Compares the value found at {@link RuleField}
 * in the evaluation context against `value` (and `valueTo` for `between`).
 * @group RPC Schema
 */
export type RuleCondition = {
    field: RuleField;
    operator: ConditionOperator;
    value: string | number | boolean | null;
    valueTo?: string | number | boolean | null;
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
 * Mirrors the backend `EstimatedRewardItem` one-to-one — a static parity
 * assertion on the backend keeps its runtime-validated schema in lockstep with
 * this published contract.
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
