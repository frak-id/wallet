import type { OverviewKpis } from "@frak-labs/backend-elysia/orchestration/schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { overviewAnalyticsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

const DEFAULT_REVENUE_CURRENCY = "EUR";
/** Avg CPA is `total_rewards_usd / purchases`, so display in USD. */
const REWARDS_CURRENCY = "USD";

/**
 * Hint shown on the three KPI cards whose Postgres-backed values
 * (`ambassadors`, `shares`, derived `sharingRate`) under-report reality.
 * Disappears once the OpenPanel analytics query resolves and the
 * accurate counts overlay the postgres ones.
 */
const APPROXIMATE_HINT = "Approximate";

type Props = {
    kpis: OverviewKpis;
    from?: string;
    to?: string;
};

export function KpiCardsRow({ kpis, from, to }: Props) {
    const { i18n } = useTranslation();
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    // Non-suspense read: KpiCardsRow renders immediately with the
    // postgres-backed `kpis` while the (slower) OpenPanel analytics
    // query loads. Shares the cache entry with the suspense readers in
    // sibling Funnel / Sharing cards — only one network round-trip.
    const { data: analytics } = useQuery(
        overviewAnalyticsQueryOptions({ merchantId, isDemoMode, from, to })
    );
    const accurateKpis = analytics?.accurateKpis;

    const locale = i18n.language;
    const revenueCurrency = kpis.revenue.currency ?? DEFAULT_REVENUE_CURRENCY;

    const formatters = useMemo(
        () => ({
            integer: new Intl.NumberFormat(locale, {
                maximumFractionDigits: 0,
            }),
            revenue: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: revenueCurrency,
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 1,
            }),
            cpa: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: REWARDS_CURRENCY,
                maximumFractionDigits: 2,
            }),
            percent: new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 1,
            }),
        }),
        [locale, revenueCurrency]
    );

    // Overlay accurate values when available — keeps sharingRate
    // internally consistent with the displayed ambassadors / shares.
    const ambassadors = accurateKpis?.ambassadors ?? kpis.ambassadors;
    const shares = accurateKpis?.shares ?? kpis.shares;
    const accuracyHint = accurateKpis ? undefined : APPROXIMATE_HINT;

    const sharingRate = useMemo(
        () => ({
            current: safeRatio(shares.current, ambassadors.current),
            previous: safeRatio(shares.previous, ambassadors.previous),
        }),
        [shares, ambassadors]
    );

    const avgCpa = safeRatio(
        kpis.totalRewardsUsd.current,
        kpis.purchaseCount.current
    );

    return (
        <div className={styles.kpiRow}>
            <OverviewKpiCard
                label="Ambassadors"
                descriptor="total"
                amount={formatters.integer.format(ambassadors.current)}
                delta={percentDelta(ambassadors.current, ambassadors.previous)}
                hint={accuracyHint}
            />
            <OverviewKpiCard
                label="Shares"
                descriptor="total"
                amount={formatters.integer.format(shares.current)}
                delta={percentDelta(shares.current, shares.previous)}
                hint={accuracyHint}
            />
            <OverviewKpiCard
                label="Generated Revenue"
                descriptor="total"
                amount={formatters.revenue.format(kpis.revenue.current)}
                delta={percentDelta(
                    kpis.revenue.current,
                    kpis.revenue.previous
                )}
            />
            <OverviewKpiCard
                label="Sharing rate"
                descriptor="total"
                amount={formatters.percent.format(sharingRate.current)}
                delta={percentDelta(sharingRate.current, sharingRate.previous)}
                hint={accuracyHint}
            />
            <OverviewKpiCard
                label="Avg. CPA"
                descriptor="All campaigns"
                amount={formatters.cpa.format(avgCpa)}
            />
        </div>
    );
}

function safeRatio(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return numerator / denominator;
}

/**
 * Integer percent delta, matching the legacy backend formula. Returns
 * `undefined` when no comparison is possible (previous=0 and current>0)
 * so the card hides the chip.
 */
function percentDelta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined;
    return Math.round(((current - previous) / previous) * 100);
}
