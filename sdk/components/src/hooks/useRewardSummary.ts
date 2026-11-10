import { useSyncExternalStore } from "preact/compat";
import { useEffect } from "preact/hooks";
import {
    getRewardSummaryState,
    loadRewardSummary,
    type RewardSummaryState,
    subscribeRewardSummary,
} from "@/rewards/rewardSummaryStore";

/**
 * The visitor's reward summary at this merchant, shared by every component on the
 * page. Fetches only once `enabled` (client ready, component visible), and again
 * after an invalidation.
 */
export function useRewardSummary(enabled: boolean): RewardSummaryState {
    const snapshot = useSyncExternalStore(
        subscribeRewardSummary,
        getRewardSummaryState
    );

    useEffect(() => {
        if (enabled && snapshot.status === "idle") {
            loadRewardSummary();
        }
    }, [enabled, snapshot.status]);

    return snapshot;
}
