// Framework-agnostic reward display logic shared across the SDK, listener,
// wallet and wallet-shared. Depends only on `@frak-labs/core-sdk`'s own reward
// types (`EstimatedReward`, `MerchantReward`, `RuleConditions`) — no backend or
// framework coupling — so it stays safe to ship inside the published SDK and
// lets core-sdk consume its own reward logic without a dependency cycle.

export type { ProductDetails } from "../types/product";
// Re-exported here because `BestReward.parts` is typed with it, so every
// consumer of that field needs it from the same entry point.
export type { RewardAmountParts } from "../utils/format/formatAmountParts";
export { extractMinPurchaseAmount, extractStartDate } from "./conditions";
export {
    buildPercentageExample,
    buildTierExample,
    pickFlatBasket,
    pickTierBasket,
    type RewardExample,
} from "./example";
export {
    applyRewardPlaceholder,
    formatEstimatedReward,
    formatEstimatedRewardParts,
    formatRewardOrHide,
} from "./format";
export { matchesProductScope } from "./matchesProductScope";
export {
    ARRAY_OPERATORS,
    EXISTENCE_OPERATORS,
    NEGATIVE_OPERATORS,
    SCALAR_OPERATORS,
    STRING_OPERATORS,
} from "./operators";
export {
    type BestReward,
    type DisplayCampaign,
    formatBestReward,
    type RewardAudience,
    type SelectDisplayCampaignOptions,
    selectBestReward,
    selectDisplayCampaign,
} from "./select";
export { getRewardValue, isMatchedItemsBasis } from "./value";
