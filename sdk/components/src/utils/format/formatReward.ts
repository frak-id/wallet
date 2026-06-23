// Reward formatting is shared across the SDK, wallet and listener via the
// framework-agnostic `@frak-labs/rewards` package. Re-exported here so the
// existing `@/utils/format/formatReward` import path stays stable.
export {
    applyRewardPlaceholder,
    formatEstimatedReward,
} from "@frak-labs/rewards";
