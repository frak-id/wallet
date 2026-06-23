import type { CampaignStatus } from "@/types/Campaign";

/**
 * A campaign is considered "ended" when it was running (`active`) and its
 * expiry date has passed. Draft / Paused / Archived keep their own state
 * regardless of date — manual intent wins.
 */
export function isEnded(
    status: CampaignStatus,
    expiresAt: string | null
): boolean {
    if (status !== "active" || expiresAt === null) return false;
    return new Date(expiresAt).getTime() < Date.now();
}
