import { and, between, eq, isNull, sql } from "drizzle-orm";
import { interactionLogsTable } from "../domain/rewards/db/schema";
import type {
    OpenPanelChartFilter,
    OpenPanelChartSeries,
    OpenPanelExportClient,
} from "../infrastructure/integrations/openpanel";
import { db } from "../infrastructure/persistence/postgres";
import type {
    OverviewAnalyticsResponse,
    OverviewFunnelStep,
    OverviewFunnels,
    OverviewSharing,
    OverviewSharingBucket,
    OverviewWindowQuery,
} from "./schemas/campaignOverviewSchemas";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

type DateRange = { from: Date; to: Date };

/**
 * Per-step funnel definition. `eventNames` may carry multiple OpenPanel
 * events whose counts are summed for the step (e.g. `banner_impression +
 * post_purchase_impression → "Share CTA seen"`).
 */
type FunnelStepDefinition = {
    label: string;
    eventNames: string[];
    extraFilters?: OpenPanelChartFilter[];
};

const WALLET_SHARING_SOURCES = [
    "sharing_page_wallet",
    "explorer_detail",
    "welcome_card",
];

const WEBSITE_SHARING_SOURCES = [
    "sharing_page_listener",
    "modal",
    "embedded_wallet",
];

/**
 * Funnels + sharing breakdowns sourced from OpenPanel + small DB joins for
 * the conversion tail. Sibling to `CampaignOverviewOrchestrator` which
 * handles the cheaper Postgres-only summary section.
 *
 * All OpenPanel calls run in parallel and degrade independently — if a
 * single chart query fails the rest of the page still renders (the client
 * returns an empty series on failure).
 */
export class CampaignAnalyticsOrchestrator {
    constructor(private readonly openPanel: OpenPanelExportClient) {}

    async getAnalytics(
        merchantId: string,
        window: OverviewWindowQuery
    ): Promise<OverviewAnalyticsResponse> {
        const range = resolveRange(window);

        const [websiteSteps, walletSteps, platform, device, tail] =
            await Promise.all([
                this.getFunnelSteps(
                    merchantId,
                    range,
                    websiteFunnelDefinition()
                ),
                this.getFunnelSteps(
                    merchantId,
                    range,
                    walletFunnelDefinition()
                ),
                this.getSharingPlatform(merchantId, range),
                this.getSharingDevice(merchantId, range),
                this.getBackendFunnelTail(merchantId, range),
            ]);

        const funnels: OverviewFunnels = {
            website: [...websiteSteps, ...tail],
            wallet: [...walletSteps, ...tail],
        };
        const sharing: OverviewSharing = { platform, device };

        return { funnels, sharing };
    }

    private async getFunnelSteps(
        merchantId: string,
        range: DateRange,
        definitions: FunnelStepDefinition[]
    ): Promise<OverviewFunnelStep[]> {
        // Flatten into one OpenPanel series per event so a single chart
        // request covers the whole funnel. `seriesToStep[i]` records which
        // step the i-th request series belongs to; the response is matched
        // back by array position (OpenPanel preserves request order).
        const series: OpenPanelChartSeries[] = [];
        const seriesToStep: number[] = [];

        definitions.forEach((step, stepIdx) => {
            for (const event of step.eventNames) {
                series.push({
                    name: event,
                    filters: buildFunnelFilters(merchantId, event, step),
                });
                seriesToStep.push(stepIdx);
            }
        });

        const response = await this.openPanel.getChart({
            series,
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            previous: true,
        });

        const totals = definitions.map(() => 0);
        const previousTotals = definitions.map(() => 0);
        response.series.forEach((serie, idx) => {
            const stepIdx = seriesToStep[idx];
            if (stepIdx === undefined) return;
            totals[stepIdx] += serie.total;
            previousTotals[stepIdx] += serie.previousTotal ?? 0;
        });

        return definitions.map((step, idx) => ({
            label: step.label,
            value: totals[idx],
            delta: percentDelta(totals[idx], previousTotals[idx]),
        }));
    }

    private async getSharingPlatform(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingBucket[]> {
        const buckets = await this.getSharingBreakdown(
            merchantId,
            range,
            "source"
        );

        let walletApp = 0;
        let merchantSite = 0;
        for (const bucket of buckets) {
            if (WALLET_SHARING_SOURCES.includes(bucket.label)) {
                walletApp += bucket.value;
            } else if (WEBSITE_SHARING_SOURCES.includes(bucket.label)) {
                merchantSite += bucket.value;
            }
        }

        return [
            { label: "Merchant Site", value: merchantSite },
            { label: "Wallet App", value: walletApp },
        ];
    }

    private async getSharingDevice(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingBucket[]> {
        // OpenPanel auto-collects `device` (mobile / desktop / tablet) on
        // every event. iOS/Android are surfaced as `mobile` here — finer
        // platform splits can be added later via the `platform` global
        // prop (also set by the wallet/listener).
        const buckets = await this.getSharingBreakdown(
            merchantId,
            range,
            "device"
        );

        return buckets.map((b) => ({
            label: capitalize(b.label),
            value: b.value,
        }));
    }

    private async getSharingBreakdown(
        merchantId: string,
        range: DateRange,
        breakdown: string
    ): Promise<OverviewSharingBucket[]> {
        const merchantFilter: OpenPanelChartFilter = {
            name: "merchant_id",
            operator: "is",
            value: [merchantId],
        };
        const response = await this.openPanel.getChart({
            series: [
                { name: "sharing_link_shared", filters: [merchantFilter] },
                { name: "sharing_link_copied", filters: [merchantFilter] },
            ],
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            breakdowns: [{ name: breakdown }],
        });

        const totals = new Map<string, number>();
        for (const serie of response.series) {
            const bucketLabel = serie.event ?? "unknown";
            totals.set(
                bucketLabel,
                (totals.get(bucketLabel) ?? 0) + serie.total
            );
        }

        return Array.from(totals.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
    }

    private async getBackendFunnelTail(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewFunnelStep[]> {
        // Backend can't tell whether a referral came from the wallet or the
        // partner site — both funnels reuse the same tail. Revisit when
        // referral_links grow a `source` column. `'referral_arrival'` is
        // matched via raw SQL to mirror `CampaignStatsOrchestrator` (the
        // `InteractionType` TS union is the legacy/v1 shape and doesn't
        // expose the actual stored literal yet).
        const rows = await db
            .select({
                referred: sql<number>`COUNT(*) FILTER (WHERE ${interactionLogsTable.type} = 'referral_arrival')`,
                converted: sql<number>`COUNT(*) FILTER (WHERE ${interactionLogsTable.type} = 'purchase')`,
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    isNull(interactionLogsTable.cancelledAt),
                    between(
                        interactionLogsTable.createdAt,
                        range.from,
                        range.to
                    )
                )
            );

        return [
            { label: "Referred", value: Number(rows[0]?.referred ?? 0) },
            { label: "Converted", value: Number(rows[0]?.converted ?? 0) },
        ];
    }
}

function websiteFunnelDefinition(): FunnelStepDefinition[] {
    const websiteSourceFilter: OpenPanelChartFilter = {
        name: "source",
        operator: "is",
        value: WEBSITE_SHARING_SOURCES,
    };
    return [
        {
            label: "Share CTA seen",
            eventNames: ["banner_impression", "post_purchase_impression"],
        },
        { label: "Share initiated", eventNames: ["share_button_clicked"] },
        {
            label: "Link shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [websiteSourceFilter],
        },
    ];
}

function walletFunnelDefinition(): FunnelStepDefinition[] {
    const walletSourceFilter: OpenPanelChartFilter = {
        name: "source",
        operator: "is",
        value: WALLET_SHARING_SOURCES,
    };
    const explorerModalFilter: OpenPanelChartFilter = {
        name: "modal",
        operator: "is",
        value: ["explorerDetail"],
    };
    return [
        { label: "Explorer impressions", eventNames: ["screen_view"] },
        {
            label: "Brand page opened",
            eventNames: ["wallet_modal_opened"],
            extraFilters: [explorerModalFilter],
        },
        { label: "Share initiated", eventNames: ["sharing_page_viewed"] },
        {
            label: "Link shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [walletSourceFilter],
        },
    ];
}

function resolveRange(window: OverviewWindowQuery): DateRange {
    const to = window.to ? endOfIsoDay(window.to) : new Date();
    const defaultFrom = new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    const from = window.from ? startOfIsoDay(window.from) : defaultFrom;
    return { from, to };
}

function startOfIsoDay(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

function endOfIsoDay(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
}

function percentDelta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined;
    return Math.round(((current - previous) / previous) * 100);
}

function capitalize(value: string): string {
    if (value.length === 0) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildFunnelFilters(
    merchantId: string,
    event: string,
    step: FunnelStepDefinition
): OpenPanelChartFilter[] {
    const filters: OpenPanelChartFilter[] = [];
    if (event === "screen_view") {
        // `screen_view` is OpenPanel-autotracked and never carries
        // `merchant_id` — the wallet "Explorer impressions" step is a
        // global denominator. All other funnel events are scoped per
        // merchant.
        filters.push({
            name: "__path",
            operator: "startsWith",
            value: ["/explorer"],
        });
    } else {
        filters.push({
            name: "merchant_id",
            operator: "is",
            value: [merchantId],
        });
    }
    if (step.extraFilters) filters.push(...step.extraFilters);
    return filters;
}
