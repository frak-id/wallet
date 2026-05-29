import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import campaignDetailsMock from "@/mock/campaignDetails.json";
import campaignsMockData from "@/mock/campaigns.json";
import campaignsOverviewMock from "@/mock/campaignsOverview.json";
import {
    getCampaignDetail,
    getMerchantCampaigns,
} from "@/module/campaigns/api/campaignApi";
import {
    getMerchantCampaignsStats,
    getMerchantCampaignsStatsMock,
} from "@/module/campaigns/api/campaignStatsApi";
import { getCampaignDetailsMockSync } from "@/module/campaigns/api/mock";
import type { Campaign, CampaignWithActions } from "@/types/Campaign";

export type CampaignsOverview = typeof campaignsOverviewMock;

export type CampaignDetailsStats = typeof campaignDetailsMock;

type CampaignStateValidator = (campaign: Campaign) => {
    shouldRedirect: boolean;
    redirectTo?: {
        to: string;
        params: { merchantId: string; campaignId: string };
    };
};

function getCampaignsInitialData(merchantId?: string): CampaignWithActions[] {
    const all = campaignsMockData as unknown as Campaign[];
    const scoped = merchantId
        ? all.filter((c) => c.merchantId === merchantId)
        : all;
    return scoped.map((campaign) => ({
        ...campaign,
        actions: {
            canEdit: campaign.status === "draft",
            canDelete: campaign.status === "draft",
            canPublish: campaign.status === "draft",
            canPause: campaign.status === "active",
            canResume: campaign.status === "paused",
            canArchive:
                campaign.status === "active" || campaign.status === "paused",
        },
    }));
}

export const campaignsListQueryOptions = ({
    merchantId,
    isDemoMode,
}: {
    merchantId: string;
    isDemoMode: boolean;
}) =>
    queryOptions<CampaignWithActions[]>({
        queryKey: [
            "campaigns",
            "list",
            merchantId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: () => getMerchantCampaigns({ merchantId, isDemoMode }),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode
            ? getCampaignsInitialData(merchantId)
            : undefined,
    });

// Aggregated dashboard data for the campaigns overview page. v1 serves
// mock data unconditionally; real backend aggregates will swap in here
// once they ship (swap queryFn to
// `api.merchant({ merchantId }).campaigns.overview.get({ from, to })`).
// `from`/`to` (yyyy-MM-dd) are already threaded into the key so the
// Date range chip refetches once the endpoint honours the window. Split
// into per-section keys later if endpoints land piecemeal.
export const campaignsOverviewQueryOptions = ({
    merchantId,
    isDemoMode,
    from,
    to,
}: {
    merchantId: string;
    isDemoMode: boolean;
    from?: string;
    to?: string;
}) =>
    queryOptions<CampaignsOverview>({
        queryKey: [
            "campaigns",
            "overview",
            merchantId,
            isDemoMode ? "demo" : "live",
            from ?? null,
            to ?? null,
        ],
        queryFn: () => Promise.resolve(campaignsOverviewMock),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: campaignsOverviewMock,
    });

// Per-campaign analytics for the campaign details sheet. v1 serves mock
// data unconditionally; a per-campaign backend aggregate swaps in here once
// it ships (swap queryFn to
// `api.merchant({ merchantId }).campaigns({ campaignId }).details.get()`).
// Funnel stages, ambassador leaderboard, CPA-by-recipient and the Frak-vs-Meta
// comparison are not computed by the backend yet — see the merchant-level
// `feat/openpanel-stats-from-backend` work, which covers overview only.
export const campaignDetailsQueryOptions = ({
    merchantId,
    campaignId,
    isDemoMode,
}: {
    merchantId: string;
    campaignId: string;
    isDemoMode: boolean;
}) =>
    queryOptions<CampaignDetailsStats>({
        queryKey: [
            "campaign",
            "details",
            merchantId,
            campaignId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: () => Promise.resolve(campaignDetailsMock),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        // Seed only in demo — an unscoped mock under a merchant-keyed cache
        // entry would stick forever once the queryFn hits a real backend.
        initialData: isDemoMode ? campaignDetailsMock : undefined,
    });

export const campaignsStatsQueryOptions = ({
    merchantId,
    isDemoMode,
}: {
    merchantId: string;
    isDemoMode: boolean;
}) =>
    queryOptions({
        queryKey: [
            "campaigns",
            "stats",
            merchantId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: () => getMerchantCampaignsStats({ merchantId, isDemoMode }),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        // initialData must be scoped to the active merchant — with
        // `staleTime: Infinity` in demo, unscoped seed data would stick
        // around forever under a merchant-keyed cache entry.
        initialData: isDemoMode
            ? getMerchantCampaignsStatsMock(merchantId)
            : undefined,
    });

export const campaignQueryOptions = ({
    merchantId,
    campaignId,
    isDemoMode,
    validateState,
}: {
    merchantId: string;
    campaignId: string;
    isDemoMode: boolean;
    validateState?: CampaignStateValidator;
}) =>
    queryOptions({
        queryKey: [
            "campaign",
            merchantId,
            campaignId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            const campaign = await getCampaignDetail({
                merchantId,
                campaignId,
                isDemoMode,
            });

            if (!campaign) {
                throw redirect({
                    to: "/m/$merchantId/campaigns/list",
                    params: { merchantId },
                });
            }

            if (validateState) {
                const validation = validateState(campaign);
                if (validation.shouldRedirect && validation.redirectTo) {
                    throw redirect(validation.redirectTo);
                }
            }

            return campaign;
        },
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        // initialData must be merchant-scoped: with a merchant-keyed
        // cache entry and `staleTime: Infinity`, seeding the wrong
        // merchant's campaign here would short-circuit the queryFn's
        // redirect-on-null and show stale content.
        initialData: isDemoMode
            ? (getCampaignDetailsMockSync({ campaignId, merchantId }) ??
              undefined)
            : undefined,
    });

export function validateDraftCampaign(merchantId: string, campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const isPublished = campaign.status !== "draft";
        if (isPublished) {
            return {
                shouldRedirect: true,
                redirectTo: {
                    to: "/m/$merchantId/campaigns/edit/$campaignId",
                    params: { merchantId, campaignId },
                },
            };
        }
        return { shouldRedirect: false };
    };
}

export function validateEditCampaign(merchantId: string, campaignId: string) {
    return (campaign: Campaign): ReturnType<CampaignStateValidator> => {
        const isDraft = campaign.status === "draft";
        if (isDraft) {
            return {
                shouldRedirect: true,
                redirectTo: {
                    to: "/m/$merchantId/campaigns/draft/$campaignId",
                    params: { merchantId, campaignId },
                },
            };
        }
        return { shouldRedirect: false };
    };
}
