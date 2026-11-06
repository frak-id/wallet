import type { PendingRewardSummary } from "@frak-labs/core-sdk";
import { useMemo } from "preact/hooks";
import { useReminderDismissed } from "@/hooks/useInlineReminder";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { getPreviewPending } from "@/rewards/previewSummary";
import { isClaimable } from "@/rewards/rewardSummaryStore";

/**
 * The pending rewards the banner can show. `baseMode` is the mode already decided
 * by the page (in-app, referral, or a previewed pending): the summary is only
 * fetched while none applies, so the other modes keep their priority.
 */
export function usePendingSummary(
    baseMode: "referral" | "inapp" | "pending" | null,
    canFetch: boolean
): PendingRewardSummary | null {
    const dismissed = useReminderDismissed();
    const { summary } = useRewardSummary(baseMode === null && canFetch);

    return useMemo(() => {
        if (baseMode === "pending") return getPreviewPending();
        if (baseMode !== null || dismissed) return null;
        return isClaimable(summary) ? summary.pending : null;
    }, [baseMode, dismissed, summary]);
}
