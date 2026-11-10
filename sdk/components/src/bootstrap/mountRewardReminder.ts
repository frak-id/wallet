import { isReminderDismissed } from "../rewards/dismissal";
import { isClaimable, loadRewardSummary } from "../rewards/rewardSummaryStore";

const TAG = "frak-reward-reminder";

/** Adds the floating reminder when the visitor has something to claim; the loader's observer then fetches its chunk. */
export async function mountRewardReminder(): Promise<void> {
    if (document.querySelector(TAG) || isReminderDismissed()) return;
    const summary = await loadRewardSummary();
    if (!isClaimable(summary) || document.querySelector(TAG)) return;
    document.body.append(document.createElement(TAG));
}
