// Framework-agnostic reward display logic shared across the SDK, listener,
// wallet and wallet-shared. Depends only on `@frak-labs/core-sdk`'s own reward
// types (`EstimatedReward`, `MerchantReward`, `RuleConditions`) — no backend or
// framework coupling — so it stays safe to ship inside the published SDK and
// lets core-sdk consume its own reward logic without a dependency cycle.

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
    formatRewardOrHide,
} from "./format";
export {
    type BestReward,
    type DisplayCampaign,
    formatBestReward,
    type RewardAudience,
    type SelectDisplayCampaignOptions,
    selectBestReward,
    selectDisplayCampaign,
} from "./select";
export { getRewardValue } from "./value";
