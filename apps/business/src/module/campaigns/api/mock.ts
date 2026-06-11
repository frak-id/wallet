import type { CampaignStatsItem } from "@frak-labs/backend-elysia/api/schemas";
import type { Address } from "viem";
import campaignStatsData from "@/mock/campaignStats.json";
import campaignsData from "@/mock/campaigns.json";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import type {
    Campaign,
    CampaignActions,
    CampaignListItem,
    CampaignListItemWithActions,
    CampaignListResponse,
    CampaignListReward,
    CampaignStatus,
    RewardDefinition,
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
    const expiresAt: string | null = draft.expiresAt ?? null;

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

function toRewardSummary(reward: RewardDefinition): CampaignListReward {
    switch (reward.amountType) {
        case "fixed":
            return {
                recipient: reward.recipient,
                amountType: "fixed",
                amount: reward.amount,
            };
        case "percentage":
            return {
                recipient: reward.recipient,
                amountType: "percentage",
                percent: reward.percent,
            };
        case "tiered":
            return {
                recipient: reward.recipient,
                amountType: "tiered",
                tiers: reward.tiers,
            };
    }
}

type RawStats = (typeof campaignStatsData)[number];

function rawStatsToItem(raw: RawStats): CampaignStatsItem {
    return {
        campaignId: raw.id,
        tokenAddress: raw.token as Address,
        referredInteractions: raw.referredInteractions,
        purchaseInteractions: raw.purchaseInteractions,
        createReferralLinkInteractions: raw.createReferredLinkInteractions,
        totalRewards: raw.totalRewards,
        attributedRevenue: raw.attributedRevenue,
        avgBasketValue: raw.avgBasketValue,
        ambassador: raw.ambassador,
        sharingRate: raw.sharingRate,
        ctr: raw.ctr,
        costPerPurchase: raw.costPerPurchase,
        costPerShare: raw.costPerShare,
    };
}

function toListItem(campaign: Campaign): Omit<CampaignListItem, "stats"> {
    return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        rewards: (campaign.rule.rewards ?? []).map(toRewardSummary),
        budgetConfig: campaign.budgetConfig,
        budgetUsed: campaign.budgetUsed,
        expiresAt: campaign.expiresAt,
        publishedAt: campaign.publishedAt,
        createdAt: campaign.createdAt,
    };
}

function buildMockResponse(merchantId?: string): CampaignListResponse {
    const all = campaignsData as unknown as Campaign[];
    const scopedCampaigns = merchantId
        ? all.filter((c) => c.merchantId === merchantId)
        : all;

    const stats = (
        merchantId
            ? campaignStatsData.filter((s) => s.merchantId === merchantId)
            : campaignStatsData
    ).map(rawStatsToItem);
    const statsById = new Map(stats.map((s) => [s.campaignId, s]));

    const campaigns: CampaignListItemWithActions[] = scopedCampaigns.map(
        (campaign) => ({
            ...toListItem(campaign),
            stats: statsById.get(campaign.id) ?? null,
            actions: mapStatusToActions(campaign.status),
        })
    );

    const bankDistributionStatus =
        scopedCampaigns.find((c) => c.bankDistributionStatus)
            ?.bankDistributionStatus ?? null;

    return { bankDistributionStatus, campaigns };
}

/**
 * Returns the demo campaigns response (campaigns + embedded stats) for a
 * given merchant. Mocks are keyed by the real merchant UUIDs from
 * `merchants.json`; a demo merchant with no campaigns naturally surfaces
 * the empty state, matching production behaviour.
 */
export async function getMyCampaignsMock(
    merchantId?: string
): Promise<CampaignListResponse> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return buildMockResponse(merchantId);
}

export function getMyCampaignsMockSync(
    merchantId?: string
): CampaignListResponse {
    return buildMockResponse(merchantId);
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
