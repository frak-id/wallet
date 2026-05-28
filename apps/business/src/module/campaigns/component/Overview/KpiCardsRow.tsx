import type { OverviewKpis } from "@frak-labs/backend-elysia/orchestration/schemas";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

const DEFAULT_REVENUE_CURRENCY = "EUR";
/** Avg CPA is `total_rewards_usd / purchases`, so display in USD. */
const REWARDS_CURRENCY = "USD";

export function KpiCardsRow({ kpis }: { kpis: OverviewKpis }) {
    const { i18n } = useTranslation();
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

    const sharingRate = useMemo(
        () => ({
            current: safeRatio(kpis.shares.current, kpis.ambassadors.current),
            previous: safeRatio(
                kpis.shares.previous,
                kpis.ambassadors.previous
            ),
        }),
        [kpis.shares, kpis.ambassadors]
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
                amount={formatters.integer.format(kpis.ambassadors.current)}
                delta={percentDelta(
                    kpis.ambassadors.current,
                    kpis.ambassadors.previous
                )}
            />
            <OverviewKpiCard
                label="Shares"
                descriptor="total"
                amount={formatters.integer.format(kpis.shares.current)}
                delta={percentDelta(kpis.shares.current, kpis.shares.previous)}
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
