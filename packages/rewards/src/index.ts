// Framework-agnostic reward display logic shared across the SDK, listener,
// wallet and wallet-shared. Depends only on `@frak-labs/core-sdk` types.
//
// Campaign selection and rule-condition extraction (which carry backend domain
// types) live behind the `./campaign` subpath to keep those types out of the
// published SDK surface.

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
} from "./format";
export {
    getRewardEurValue,
    getRewardValue,
    type RewardCampaignLike,
    selectBestReward,
} from "./value";
