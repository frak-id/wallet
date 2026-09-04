// Framework-agnostic reward display logic, depending only on core-sdk's own
// reward types so it stays safe to ship inside the published SDK.

export type { ProductDetails } from "../types/product";
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
