import type { OverviewKpis } from "@frak-labs/backend-elysia/orchestration/schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { overviewAnalyticsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { currencyStore } from "@/stores/currencyStore";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

const DEFAULT_REVENUE_CURRENCY = "EUR";

// Shown on a KPI card when its value comes from the Postgres summary rather
// than the accurate OpenPanel count — before analytics loads, or when
// OpenPanel returns 0 and we fall back. Cleared per-card once OpenPanel
// supplies a non-zero accurate count.
const APPROXIMATE_HINT = "Approximate";

type Props = {
    kpis: OverviewKpis;
    from?: string;
    to?: string;
};

export function KpiCardsRow({ kpis, from, to }: Props) {
    const { t, i18n } = useTranslation();
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
    // Rewards/CPA are token→fiat converted to the user's chosen currency
    // — the same one the summary query requested, so symbol and value
    // stay in sync. ISO-4217 wants uppercase; the store holds lowercase.
    const rewardsCurrency = currencyStore(
        (state) => state.preferredCurrency
    ).toUpperCase();

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
                currency: rewardsCurrency,
                maximumFractionDigits: 2,
            }),
            percent: new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 1,
            }),
        }),
        [locale, revenueCurrency, rewardsCurrency]
    );

    // Prefer the accurate OpenPanel counts, but fall back to the Postgres
    // summary when OpenPanel reports 0 — a degraded/empty analytics result
    // must not zero out a KPI the summary can still populate.
    const { value: ambassadors, accurate: ambassadorsAccurate } = pickKpi(
        accurateKpis?.ambassadors,
        kpis.ambassadors
    );
    const { value: shares, accurate: sharesAccurate } = pickKpi(
        accurateKpis?.shares,
        kpis.shares
    );

    const sharingRate = useMemo(
        () => ({
            current: safeRatio(shares.current, ambassadors.current),
            previous: safeRatio(shares.previous, ambassadors.previous),
        }),
        [shares, ambassadors]
    );

    const avgCpa = safeRatio(
        kpis.totalRewardsFiat.current,
        kpis.purchaseCount.current
    );

    return (
        <div className={styles.kpiRow}>
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.ambassadors")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={formatters.integer.format(ambassadors.current)}
                delta={percentDelta(ambassadors.current, ambassadors.previous)}
                hint={ambassadorsAccurate ? undefined : APPROXIMATE_HINT}
                empty={ambassadors.current === 0}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.shares")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={formatters.integer.format(shares.current)}
                delta={percentDelta(shares.current, shares.previous)}
                hint={sharesAccurate ? undefined : APPROXIMATE_HINT}
                empty={shares.current === 0}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.revenue")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={formatters.revenue.format(kpis.revenue.current)}
                delta={percentDelta(
                    kpis.revenue.current,
                    kpis.revenue.previous
                )}
                empty={kpis.revenue.current === 0}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.sharingRate")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={formatters.percent.format(sharingRate.current)}
                delta={percentDelta(sharingRate.current, sharingRate.previous)}
                hint={
                    ambassadorsAccurate && sharesAccurate
                        ? undefined
                        : APPROXIMATE_HINT
                }
                empty={sharingRate.current === 0}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.avgCpa")}
                descriptor={t("campaigns.overview.kpi.descriptorAllCampaigns")}
                amount={formatters.cpa.format(avgCpa)}
                empty={avgCpa === 0}
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

type Kpi = { current: number; previous: number };

// Prefer the OpenPanel count; fall back to the Postgres value when OpenPanel
// is absent or reports 0. `accurate` flags whether the accurate source won,
// so the card can show the approximate hint on fallback.
function pickKpi(
    openPanel: Kpi | undefined,
    fallback: Kpi
): { value: Kpi; accurate: boolean } {
    if (openPanel && openPanel.current > 0) {
        return { value: openPanel, accurate: true };
    }
    return { value: fallback, accurate: false };
}
