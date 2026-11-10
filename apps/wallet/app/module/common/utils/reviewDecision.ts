import type { ReviewTrigger } from "@/module/stores/reviewPromptStore";

const MIN_GAP_MS = 30 * 24 * 60 * 60 * 1000;

type ReviewDecisionState = {
    launchCount: number;
    lastAskedAt: number | null;
};

/** `app_launch` is the catch-up for a first ask that never happened, so it never repeats one. */
export function shouldAskForReview(
    { launchCount, lastAskedAt }: ReviewDecisionState,
    trigger: ReviewTrigger,
    now: number
): boolean {
    if (launchCount < 2) return false;
    if (lastAskedAt === null) return true;
    return trigger !== "app_launch" && now - lastAskedAt >= MIN_GAP_MS;
}
