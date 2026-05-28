import { and, between, eq, isNull, sql } from "drizzle-orm";
import { interactionLogsTable } from "../domain/rewards/db/schema";
import type {
    OpenPanelChartFilter,
    OpenPanelChartSerie,
    OpenPanelChartSeries,
    OpenPanelExportClient,
} from "../infrastructure/integrations/openpanel";
import { db } from "../infrastructure/persistence/postgres";
import type {
    OverviewAccurateKpis,
    OverviewAnalyticsResponse,
    OverviewFunnelKind,
    OverviewFunnelStep,
    OverviewFunnels,
    OverviewSharing,
    OverviewSharingDeviceBucket,
    OverviewSharingDeviceKind,
    OverviewSharingPlatformBucket,
    OverviewWindowQuery,
} from "./schemas/campaignOverviewSchemas";
import {
    type DateRange,
    type ResolvedWindow,
    resolveWindow,
} from "./utils/window";

/**
 * Per-step funnel definition. `eventNames` may carry multiple OpenPanel
 * events whose counts are summed for the step (e.g. `banner_impression +
 * post_purchase_impression → share_cta_seen`). `kind` is the stable
 * identifier the frontend translates via i18n.
 */
type FunnelStepDefinition = {
    kind: OverviewFunnelKind;
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
 * OpenPanel's autotracked `device` property is `"mobile" | "desktop" |
 * "tablet"` (plus the empty string when missing). Anything outside that
 * maps to `"other"` so the FE never receives an unbounded label.
 */
const DEVICE_KIND_MAP: Record<string, OverviewSharingDeviceKind> = {
    mobile: "mobile",
    desktop: "desktop",
    tablet: "tablet",
};

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
        const resolved = resolveWindow(window);

        const [
            websiteSteps,
            walletSteps,
            accurateKpis,
            platform,
            device,
            tail,
        ] = await Promise.all([
            this.getWebsiteFunnel(merchantId, resolved.current),
            this.getWalletFunnel(merchantId, resolved.current),
            this.getAccurateKpis(merchantId, resolved.current),
            this.getSharingPlatform(merchantId, resolved.current),
            this.getSharingDevice(merchantId, resolved.current),
            this.getBackendFunnelTail(merchantId, resolved),
        ]);

        const funnels: OverviewFunnels = {
            website: [...websiteSteps, ...tail],
            wallet: [...walletSteps, ...tail],
        };
        const sharing: OverviewSharing = { platform, device };

        return { funnels, sharing, accurateKpis };
    }

    private async getWebsiteFunnel(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewFunnelStep[]> {
        const definitions = websiteFunnelDefinition();
        const response = await this.openPanel.getChart({
            series: buildFunnelSeries(merchantId, definitions),
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            previous: true,
        });
        return aggregateFunnelSteps(definitions, response.series);
    }

    private async getWalletFunnel(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewFunnelStep[]> {
        const definitions = walletFunnelDefinition();
        const response = await this.openPanel.getChart({
            series: buildFunnelSeries(merchantId, definitions),
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            previous: true,
        });
        return aggregateFunnelSteps(definitions, response.series);
    }

    /**
     * Combines `sharing_link_shared` + `sharing_link_copied` for both
     * `shares` (event segment) and `ambassadors` (user segment).
     * Summing user-segment totals across the two events overcounts
     * profiles who both shared AND copied a link in the window — treat
     * this as a tight upper bound, still less wrong than the Postgres
     * count which excludes anyone who hasn't earned a referrer reward
     * yet.
     */
    private async getAccurateKpis(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewAccurateKpis> {
        const response = await this.openPanel.getChart({
            series: buildKpiSeries(merchantId),
            startDate: range.from.toISOString(),
            endDate: range.to.toISOString(),
            range: "custom",
            previous: true,
        });
        return aggregateAccurateKpis(response.series);
    }

    private async getSharingPlatform(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingPlatformBucket[]> {
        const totals = await this.getSharingBreakdown(
            merchantId,
            range,
            "properties.source"
        );

        let walletApp = 0;
        let merchantSite = 0;
        for (const [source, value] of totals) {
            if (WALLET_SHARING_SOURCES.includes(source)) {
                walletApp += value;
            } else if (WEBSITE_SHARING_SOURCES.includes(source)) {
                merchantSite += value;
            }
        }

        return [
            { kind: "merchant_site", value: merchantSite },
            { kind: "wallet_app", value: walletApp },
        ];
    }

    private async getSharingDevice(
        merchantId: string,
        range: DateRange
    ): Promise<OverviewSharingDeviceBucket[]> {
        // OpenPanel auto-collects `device` (mobile / desktop / tablet) on
        // every event. iOS/Android both surface as `mobile`; finer
        // platform splits would need the `platform` global prop instead.
        const totals = await this.getSharingBreakdown(
            merchantId,
            range,
            "device"
        );

        // Collapse unknown values into a single `other` bucket so the FE
        // never receives an enum value it can't render.
        const byKind = new Map<OverviewSharingDeviceKind, number>();
        for (const [source, value] of totals) {
            const kind = DEVICE_KIND_MAP[source] ?? "other";
            byKind.set(kind, (byKind.get(kind) ?? 0) + value);
        }

        return Array.from(byKind, ([kind, value]) => ({ kind, value })).sort(
            (a, b) => b.value - a.value
        );
    }

    private async getSharingBreakdown(
        merchantId: string,
        range: DateRange,
        breakdown: string
    ): Promise<Map<string, number>> {
        const merchantFilter: OpenPanelChartFilter = {
            name: "properties.merchant_id",
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
            const value = serie.event.breakdowns?.[breakdown] ?? "unknown";
            totals.set(value, (totals.get(value) ?? 0) + serieSum(serie));
        }
        return totals;
    }

    private async getBackendFunnelTail(
        merchantId: string,
        resolved: ResolvedWindow
    ): Promise<OverviewFunnelStep[]> {
        // Backend can't tell whether a referral came from the wallet or the
        // partner site — both funnels reuse the same tail. Revisit when
        // referral_links grow a `source` column. `'referral_arrival'` is
        // matched via raw SQL to mirror `CampaignStatsOrchestrator` (the
        // `InteractionType` TS union is the legacy/v1 shape and doesn't
        // expose the actual stored literal yet).
        const { current, previous } = resolved;
        const createdAt = interactionLogsTable.createdAt;
        const type = interactionLogsTable.type;
        // FILTER clauses use drizzle's `between()` so Date params flow
        // through the column encoder (Date → ISO). Raw `${date}` falls
        // through to `String(date)` and PG rejects the timezone format.
        // Mirrors the fix in `CampaignOverviewOrchestrator`.
        const rows = await db
            .select({
                referredCurrent: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'referral_arrival' AND ${between(createdAt, current.from, current.to)})`,
                referredPrevious: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'referral_arrival' AND ${between(createdAt, previous.from, previous.to)})`,
                convertedCurrent: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'purchase' AND ${between(createdAt, current.from, current.to)})`,
                convertedPrevious: sql<number>`COUNT(*) FILTER (WHERE ${type} = 'purchase' AND ${between(createdAt, previous.from, previous.to)})`,
            })
            .from(interactionLogsTable)
            .where(
                and(
                    eq(interactionLogsTable.merchantId, merchantId),
                    isNull(interactionLogsTable.cancelledAt),
                    between(createdAt, previous.from, current.to)
                )
            );

        const row = rows[0];
        return [
            {
                kind: "referred",
                value: Number(row?.referredCurrent ?? 0),
                previousValue: Number(row?.referredPrevious ?? 0),
            },
            {
                kind: "converted",
                value: Number(row?.convertedCurrent ?? 0),
                previousValue: Number(row?.convertedPrevious ?? 0),
            },
        ];
    }
}

function websiteFunnelDefinition(): FunnelStepDefinition[] {
    const websiteSourceFilter: OpenPanelChartFilter = {
        name: "properties.source",
        operator: "is",
        value: WEBSITE_SHARING_SOURCES,
    };
    return [
        {
            kind: "share_cta_seen",
            eventNames: ["sharing_page_viewed"],
        },
        {
            kind: "share_initiated",
            eventNames: ["share_button_clicked"],
        },
        {
            kind: "link_shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [websiteSourceFilter],
        },
    ];
}

function walletFunnelDefinition(): FunnelStepDefinition[] {
    const walletSourceFilter: OpenPanelChartFilter = {
        name: "properties.source",
        operator: "is",
        value: WALLET_SHARING_SOURCES,
    };
    const explorerModalFilter: OpenPanelChartFilter = {
        name: "properties.modal",
        operator: "is",
        value: ["explorerDetail"],
    };
    return [
        {
            kind: "explorer_impressions",
            eventNames: ["screen_view"],
        },
        {
            kind: "brand_page_opened",
            eventNames: ["wallet_modal_opened"],
            extraFilters: [explorerModalFilter],
        },
        {
            kind: "share_initiated",
            eventNames: ["sharing_page_viewed"],
        },
        {
            kind: "link_shared",
            eventNames: ["sharing_link_shared", "sharing_link_copied"],
            extraFilters: [walletSourceFilter],
        },
    ];
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
            name: "path",
            operator: "startsWith",
            value: ["/explorer"],
        });
    } else {
        filters.push({
            name: "properties.merchant_id",
            operator: "is",
            value: [merchantId],
        });
    }
    if (step.extraFilters) filters.push(...step.extraFilters);
    return filters;
}

function buildFunnelSeries(
    merchantId: string,
    definitions: FunnelStepDefinition[]
): OpenPanelChartSeries[] {
    return definitions.flatMap((step) =>
        step.eventNames.map((event) => ({
            name: event,
            filters: buildFunnelFilters(merchantId, event, step),
        }))
    );
}

/**
 * Accurate-KPI request layout. Index `0..1` feeds `shares` (event
 * segment), index `2..3` feeds `ambassadors` (user segment). The
 * aggregator below relies on this exact order.
 */
function buildKpiSeries(merchantId: string): OpenPanelChartSeries[] {
    const merchantFilter: OpenPanelChartFilter = {
        name: "properties.merchant_id",
        operator: "is",
        value: [merchantId],
    };
    return [
        {
            name: "sharing_link_shared",
            filters: [merchantFilter],
            segment: "event",
        },
        {
            name: "sharing_link_copied",
            filters: [merchantFilter],
            segment: "event",
        },
        {
            name: "sharing_link_shared",
            filters: [merchantFilter],
            segment: "user",
        },
        {
            name: "sharing_link_copied",
            filters: [merchantFilter],
            segment: "user",
        },
    ];
}

/**
 * Index returned series by their original request position so the
 * aggregators below can stay positional.
 *
 * OpenPanel does NOT preserve request order in the response — it
 * drops zero-sum series entirely and sorts the rest by `sum`
 * descending. Each returned serie carries `event.id` as a single
 * sequential letter (`"A"`, `"B"`, …) reflecting its 0-based position
 * in the request. We invert that here so callers can read by index
 * and get either the matching serie or `undefined` (= zero).
 */
function indexByRequestPosition(
    responseSeries: OpenPanelChartSerie[]
): Map<number, OpenPanelChartSerie> {
    const indexed = new Map<number, OpenPanelChartSerie>();
    for (const serie of responseSeries) {
        const id = serie.event?.id;
        if (typeof id !== "string" || id.length === 0) continue;
        const position = id.charCodeAt(0) - "A".charCodeAt(0);
        if (position >= 0) indexed.set(position, serie);
    }
    return indexed;
}

function aggregateFunnelSteps(
    definitions: FunnelStepDefinition[],
    responseSeries: OpenPanelChartSerie[]
): OverviewFunnelStep[] {
    const indexed = indexByRequestPosition(responseSeries);
    let position = 0;
    return definitions.map((step) => {
        let value = 0;
        let previousValue = 0;
        for (let i = 0; i < step.eventNames.length; i++) {
            const serie = indexed.get(position++);
            value += serieSum(serie);
            previousValue += seriePreviousSum(serie);
        }
        return { kind: step.kind, value, previousValue };
    });
}

function aggregateAccurateKpis(
    responseSeries: OpenPanelChartSerie[]
): OverviewAccurateKpis {
    const indexed = indexByRequestPosition(responseSeries);
    const sharesSeries = [indexed.get(0), indexed.get(1)];
    const ambassadorsSeries = [indexed.get(2), indexed.get(3)];
    return {
        shares: {
            current: sharesSeries.reduce((a, s) => a + serieSum(s), 0),
            previous: sharesSeries.reduce((a, s) => a + seriePreviousSum(s), 0),
        },
        ambassadors: {
            current: ambassadorsSeries.reduce((a, s) => a + serieSum(s), 0),
            previous: ambassadorsSeries.reduce(
                (a, s) => a + seriePreviousSum(s),
                0
            ),
        },
    };
}

/**
 * Defensive readers — coerce missing or non-finite values to 0.
 *
 * Elysia's TypeBox `t.Number()` validator rejects NaN (it calls
 * `Number.isFinite`, and `AllowNaN` defaults to false), so a single
 * malformed serie reaching the response would turn the whole analytics
 * endpoint into a 422 — the error report shows the offending value as
 * `null` because `JSON.stringify(NaN) === "null"`. `?? 0` alone is not
 * sufficient because `??` only triggers on `null`/`undefined`, not NaN.
 */
function serieSum(serie: OpenPanelChartSerie | undefined): number {
    return finiteOrZero(serie?.metrics?.sum);
}

function seriePreviousSum(serie: OpenPanelChartSerie | undefined): number {
    return finiteOrZero(serie?.metrics?.previous?.sum.value);
}

function finiteOrZero(value: number | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
