import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCampaign } from "@/module/campaigns/api/campaignApi";
import { campaignsQueryKey } from "@/module/campaigns/queries/queryKeys";
import { campaignQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { setStartDate } from "@/stores/campaignStore";
import type { BudgetConfig, Campaign } from "@/types/Campaign";

type ConfigInput = {
    merchantId: string;
    campaignId: string;
    /** Current campaign — used to patch the cache (and demo mode) locally. */
    campaign: Campaign;
    /** ISO date to set the start gate, null to clear, undefined to leave as-is. */
    startDate?: string | null;
    /** ISO date to set the end date, null to clear, undefined to leave as-is. */
    expiresAt?: string | null;
    /** New budget config, or undefined to leave as-is. */
    budgetConfig?: BudgetConfig;
};

/**
 * Scoped config edit for a published campaign: schedule (start/end date) and/or
 * budget only. Sends the changed fields directly (never `rule`), which the
 * backend applies without unlocking the rest of the ruleset. The backend also
 * enforces that the start date may only move forward — the UI mirrors this with
 * the date picker's `minDate`, and surfaces any rejection via `isError`.
 */
export function useUpdateCampaignConfig() {
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();

    return useMutation({
        mutationKey: ["campaign", "config"],
        mutationFn: async ({
            merchantId,
            campaignId,
            campaign,
            startDate,
            expiresAt,
            budgetConfig,
        }: ConfigInput): Promise<Campaign> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                return {
                    ...campaign,
                    rule:
                        startDate !== undefined
                            ? setStartDate(
                                  campaign.rule,
                                  startDate === null ? undefined : startDate
                              )
                            : campaign.rule,
                    expiresAt:
                        expiresAt !== undefined
                            ? expiresAt
                            : campaign.expiresAt,
                    budgetConfig:
                        budgetConfig !== undefined
                            ? budgetConfig
                            : campaign.budgetConfig,
                };
            }

            return updateCampaign({
                merchantId,
                campaignId,
                startDate,
                expiresAt,
                budgetConfig,
            });
        },
        onSuccess: (updated, { merchantId, campaignId }) => {
            // Seed the shared campaign detail cache (which the details sheet
            // reads) so it repaints immediately.
            queryClient.setQueryData(
                campaignQueryOptions({ merchantId, campaignId, isDemoMode })
                    .queryKey,
                updated
            );
            // Refresh the list/overview in the background — not awaited, so Save
            // resolves as soon as the detail cache is seeded.
            queryClient.invalidateQueries({ queryKey: campaignsQueryKey() });
        },
    });
}
