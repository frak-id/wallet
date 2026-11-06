import { sdkConfigStore } from "@frak-labs/core-sdk";

/** Either the page's SDK config or the merchant dashboard can switch the floating reminder off. */
export function isRewardReminderEnabled(): boolean {
    return (
        window.FrakSetup?.config?.rewardReminder?.enabled !== false &&
        sdkConfigStore.getConfig().components?.rewardReminder?.enabled !== false
    );
}
