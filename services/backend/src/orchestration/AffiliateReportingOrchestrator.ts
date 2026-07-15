import { log } from "@backend-infrastructure";
import type { AffiliateAttributionRepository } from "../domain/affiliate/repositories/AffiliateAttributionRepository";
import type { AffiliateBrandRepository } from "../domain/affiliate/repositories/AffiliateBrandRepository";
import type {
    TakeAdsAction,
    TakeAdsActionStatus,
    TakeAdsClick,
} from "../infrastructure/integrations/takeads";
import type {
    AffiliateActionsReport,
    AffiliateClicksReport,
    AffiliateReportingResponse,
    AffiliateRevenueByCurrency,
} from "./schemas";

const PROVIDER = "takeads" as const;
const PAGE_LIMIT = 500;
// Admin-only, on-demand report: cap pagination so a large account/window can't
// hang the request. Hitting the cap flags the report as `truncated`.
const ACTION_PAGE_CAP = 50;
const CLICK_PAGE_CAP = 40;
const DEFAULT_WINDOW_DAYS = 30;
// The clicks endpoint rejects windows wider than 120 days.
const MAX_CLICK_WINDOW_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

type ActionsClient = {
    getActions(params: {
        merchantId?: number;
        createdAtFrom?: string;
        createdAtTo?: string;
        next?: string;
        limit?: number;
    }): Promise<{ meta: { next: string | null }; data: TakeAdsAction[] }>;
    getClicks(params: {
        dateFrom?: string;
        dateTo?: string;
        offset?: number;
        limit?: number;
    }): Promise<{ meta: { total: number }; data: TakeAdsClick[] }>;
};

/** `yyyy-MM-dd` slice of an ISO date-time. */
function toDay(value: string): string {
    return value.slice(0, 10);
}

/** Resolve the `from`/`to` window, defaulting to the last 30 days. */
function resolveWindow(query: { from?: string; to?: string }): {
    from: string;
    to: string;
} {
    const to = query.to ?? toDay(new Date().toISOString());
    const from =
        query.from ??
        toDay(
            new Date(Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString()
        );
    return { from, to };
}

export class AffiliateReportingOrchestrator {
    constructor(
        private readonly affiliateBrandRepository: AffiliateBrandRepository,
        private readonly affiliateAttributionRepository: AffiliateAttributionRepository,
        private readonly clientFactory: () => ActionsClient
    ) {}

    /**
     * Build the clicks + actions report for a TakeAds merchant, fetched live
     * from the TakeAds Stats API. Returns `null` when the merchant isn't linked
     * to a TakeAds brand (the caller maps that to a 404).
     */
    async getReport(
        merchantId: string,
        query: { from?: string; to?: string }
    ): Promise<AffiliateReportingResponse | null> {
        const brand =
            await this.affiliateBrandRepository.findByMerchantId(merchantId);
        if (!brand) return null;

        const window = resolveWindow(query);
        const client = this.clientFactory();

        const [actions, clicks] = await Promise.all([
            this.buildActionsReport(client, brand.externalId, window),
            this.buildClicksReport(client, merchantId, window),
        ]);

        return {
            brand: {
                provider: PROVIDER,
                externalId: brand.externalId,
                trackingLink: brand.trackingLink,
            },
            window,
            actions,
            clicks,
        };
    }

    /**
     * Paginate the actions report filtered server-side by the TakeAds brand id
     * (our `externalId`), aggregating status/type breakdowns, per-currency
     * revenue, and a daily count series.
     */
    private async buildActionsReport(
        client: ActionsClient,
        externalId: string,
        window: { from: string; to: string }
    ): Promise<AffiliateActionsReport> {
        const byStatus = { pending: 0, confirmed: 0, canceled: 0, settled: 0 };
        const byType = { lead: 0, sale: 0, click: 0, bonus: 0 };
        const revenueByCurrency = new Map<string, AffiliateRevenueByCurrency>();
        const seriesByDay = new Map<string, number>();
        let total = 0;
        let truncated = false;

        // TakeAds brand ids are integers; a non-numeric externalId can't match
        // an actions filter, so short-circuit to an empty report.
        const merchantIdNum = Number(externalId);
        if (!Number.isInteger(merchantIdNum)) {
            log.warn(
                { externalId },
                "AffiliateReportingOrchestrator: non-integer brand externalId, skipping actions"
            );
            return {
                total,
                byStatus,
                byType,
                revenue: [],
                series: [],
                truncated,
            };
        }

        let next: string | undefined;
        let pages = 0;
        do {
            if (pages >= ACTION_PAGE_CAP) {
                truncated = true;
                break;
            }
            let resp: Awaited<ReturnType<ActionsClient["getActions"]>>;
            try {
                resp = await client.getActions({
                    merchantId: merchantIdNum,
                    createdAtFrom: `${window.from}T00:00:00.000Z`,
                    createdAtTo: `${window.to}T23:59:59.999Z`,
                    next,
                    limit: PAGE_LIMIT,
                });
            } catch (err) {
                log.error(
                    { err, externalId, pages },
                    "AffiliateReportingOrchestrator: getActions failed, returning partial actions report"
                );
                truncated = true;
                break;
            }
            pages++;
            for (const action of resp.data) {
                total++;
                this.tallyStatus(byStatus, action.status);
                this.tallyType(byType, action.type);
                this.tallyRevenue(revenueByCurrency, action);
                const day = toDay(action.orderDate || action.createdAt);
                seriesByDay.set(day, (seriesByDay.get(day) ?? 0) + 1);
            }
            next = resp.meta.next ?? undefined;
        } while (next !== undefined);

        return {
            total,
            byStatus,
            byType,
            revenue: [...revenueByCurrency.values()],
            series: toSortedSeries(seriesByDay),
            truncated,
        };
    }

    private tallyStatus(
        byStatus: AffiliateActionsReport["byStatus"],
        status: TakeAdsActionStatus
    ): void {
        if (status === "PENDING") byStatus.pending++;
        else if (status === "CONFIRMED") byStatus.confirmed++;
        else if (status === "CANCELED") byStatus.canceled++;
        else if (status === "SETTLED") byStatus.settled++;
    }

    private tallyType(
        byType: AffiliateActionsReport["byType"],
        type: TakeAdsAction["type"]
    ): void {
        if (type === "LEAD") byType.lead++;
        else if (type === "SALE") byType.sale++;
        else if (type === "CLICK") byType.click++;
        else if (type === "BONUS") byType.bonus++;
    }

    private tallyRevenue(
        revenueByCurrency: Map<string, AffiliateRevenueByCurrency>,
        action: TakeAdsAction
    ): void {
        if (!action.currencyCode) return;
        const bucket = revenueByCurrency.get(action.currencyCode) ?? {
            currencyCode: action.currencyCode,
            orderAmount: 0,
            publisherRevenue: 0,
        };
        if (Number.isFinite(action.orderAmount)) {
            bucket.orderAmount += action.orderAmount;
        }
        if (Number.isFinite(action.publisherRevenue)) {
            bucket.publisherRevenue += action.publisherRevenue;
        }
        revenueByCurrency.set(action.currencyCode, bucket);
    }

    /**
     * Paginate the clicks report for the window and attribute each day-bucket
     * back to this merchant via the sub-id we minted (the clicks endpoint has
     * no server-side merchant filter). Buckets with a foreign/unknown sub-id
     * are ignored.
     */
    private async buildClicksReport(
        client: ActionsClient,
        merchantId: string,
        window: { from: string; to: string }
    ): Promise<AffiliateClicksReport> {
        const tokens =
            await this.affiliateAttributionRepository.listTokensByMerchant(
                merchantId
            );
        const seriesByDay = new Map<string, number>();
        let total = 0;
        let truncated = false;

        // No minted links ⇒ no attributable clicks; skip the API round-trips.
        if (tokens.size === 0) {
            return { total, series: [], truncated };
        }

        const clickWindow = clampClickWindow(window);
        let offset = 0;
        let pages = 0;
        let fetched = 0;
        let reportedTotal = Number.POSITIVE_INFINITY;
        do {
            if (pages >= CLICK_PAGE_CAP) {
                truncated = true;
                break;
            }
            let resp: Awaited<ReturnType<ActionsClient["getClicks"]>>;
            try {
                resp = await client.getClicks({
                    dateFrom: clickWindow.from,
                    dateTo: clickWindow.to,
                    offset,
                    limit: PAGE_LIMIT,
                });
            } catch (err) {
                log.error(
                    { err, merchantId, pages },
                    "AffiliateReportingOrchestrator: getClicks failed, returning partial clicks report"
                );
                truncated = true;
                break;
            }
            pages++;
            reportedTotal = resp.meta.total;
            for (const click of resp.data) {
                if (!click.subId || !tokens.has(click.subId)) continue;
                total += click.count;
                const day = toDay(click.date);
                seriesByDay.set(day, (seriesByDay.get(day) ?? 0) + click.count);
            }
            fetched += resp.data.length;
            offset += resp.data.length;
            // Stop once the page came back short or we've drained the reported
            // total (a full-limit page with no forward progress would loop).
            if (resp.data.length < PAGE_LIMIT || fetched >= reportedTotal) {
                break;
            }
        } while (fetched < reportedTotal);

        return { total, series: toSortedSeries(seriesByDay), truncated };
    }
}

/** Clamp a window to the clicks endpoint's 120-day maximum (keeping `to`). */
function clampClickWindow(window: { from: string; to: string }): {
    from: string;
    to: string;
} {
    const fromMs = Date.parse(`${window.from}T00:00:00.000Z`);
    const toMs = Date.parse(`${window.to}T00:00:00.000Z`);
    if (
        Number.isNaN(fromMs) ||
        Number.isNaN(toMs) ||
        toMs - fromMs <= MAX_CLICK_WINDOW_DAYS * DAY_MS
    ) {
        return window;
    }
    const clampedFrom = toDay(
        new Date(toMs - MAX_CLICK_WINDOW_DAYS * DAY_MS).toISOString()
    );
    return { from: clampedFrom, to: window.to };
}

/** Map<day,count> → ascending-by-date array. */
function toSortedSeries(
    byDay: Map<string, number>
): { date: string; count: number }[] {
    return [...byDay.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
