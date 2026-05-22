import campaignsData from "@/mock/campaigns.json";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import type {
    Campaign,
    CampaignActions,
    CampaignStatus,
    CampaignWithActions,
} from "@/types/Campaign";

function mapStatusToActions(status: CampaignStatus): CampaignActions {
    return {
        canEdit: status === "draft",
        canDelete: status === "draft",
        canPublish: status === "draft",
        canPause: status === "active",
        canResume: status === "paused",
        canArchive: status === "active" || status === "paused",
    };
}

function draftToCampaign(draft: CampaignDraft): Campaign {
    const endDate = draft.scheduled.endDate;
    let expiresAt: string | null = null;
    if (endDate) {
        // Handle both Date objects and serialized strings (from Zustand persist)
        expiresAt =
            endDate instanceof Date ? endDate.toISOString() : String(endDate);
    }

    return {
        id: draft.id ?? "",
        merchantId: draft.merchantId,
        name: draft.name,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        rule: draft.rule,
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        budgetUsed: null,
        expiresAt,
        priority: draft.priority,
        bankDistributionStatus: null,
    } as Campaign;
}

/**
 * Returns the demo campaigns for a given merchant.
 *
 * Mock dataset is keyed by the real merchant UUIDs from
 * `merchants.json`, so the filter is a straight `merchantId` match. No
 * fallback / re-stamping — a demo merchant with no campaigns naturally
 * surfaces the empty state, matching production behaviour.
 */
export async function getMyCampaignsMock(
    merchantId?: string
): Promise<CampaignWithActions[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const all = campaignsData as unknown as Campaign[];
    const scoped = merchantId
        ? all.filter((c) => c.merchantId === merchantId)
        : all;

    return scoped.map((campaign) => ({
        ...campaign,
        actions: mapStatusToActions(campaign.status),
    }));
}

export async function getCampaignDetailsMock({
    campaignId,
    merchantId,
}: {
    campaignId: string;
    merchantId: string;
}): Promise<Campaign | null> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return findScopedCampaign({ campaignId, merchantId });
}

export function getCampaignDetailsMockSync({
    campaignId,
    merchantId,
}: {
    campaignId: string;
    merchantId: string;
}): Campaign | null {
    return findScopedCampaign({ campaignId, merchantId });
}

/**
 * Look up a demo campaign by id, but only return it when the merchantId
 * matches the active URL — mirrors the backend's per-merchant scoping so
 * `/m/A/campaigns/<id-of-B>` doesn't leak merchant B's campaign into
 * merchant A's view, and the `campaignQueryOptions` redirect-on-null
 * still fires.
 */
function findScopedCampaign({
    campaignId,
    merchantId,
}: {
    campaignId: string;
    merchantId: string;
}): Campaign | null {
    // Check mock JSON first (existing campaigns)
    const campaign = (campaignsData as unknown as Campaign[]).find(
        (c) => c.id === campaignId && c.merchantId === merchantId
    );
    if (campaign) return campaign;

    // Fall back to draft store (newly created campaigns not in mock JSON)
    const draft = campaignStore.getState().draft;
    if (draft.id === campaignId && draft.merchantId === merchantId) {
        return draftToCampaign(draft);
    }

    return null;
}
