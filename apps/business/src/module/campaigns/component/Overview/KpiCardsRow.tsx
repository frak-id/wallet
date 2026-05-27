import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

export function KpiCardsRow({ kpis }: { kpis: CampaignsOverview["kpis"] }) {
    const { i18n } = useTranslation();
    const locale = i18n.language;

    const { integerFormatter, currencyFormatter, percentFormatter } = useMemo(
        () => ({
            integerFormatter: new Intl.NumberFormat(locale, {
                maximumFractionDigits: 0,
            }),
            currencyFormatter: new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 2,
            }),
            percentFormatter: new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 1,
            }),
        }),
        [locale]
    );

    function formatRevenue(n: number) {
        if (n >= 1000)
            return `${integerFormatter.format(Math.round(n / 1000))}k€`;
        return `${integerFormatter.format(n)}€`;
    }

    return (
        <div className={styles.kpiRow}>
            <OverviewKpiCard
                label="Ambassadors"
                descriptor="total"
                amount={integerFormatter.format(kpis.ambassadors.value)}
                delta={kpis.ambassadors.delta}
            />
            <OverviewKpiCard
                label="Shares"
                descriptor="total"
                amount={integerFormatter.format(kpis.shares.value)}
                delta={kpis.shares.delta}
            />
            <OverviewKpiCard
                label="Generated Revenue"
                descriptor="total"
                amount={formatRevenue(kpis.revenue.value)}
                delta={kpis.revenue.delta}
            />
            <OverviewKpiCard
                label="Sharing rate"
                descriptor="total"
                amount={percentFormatter.format(kpis.sharingRate.value)}
                delta={kpis.sharingRate.delta}
            />
            <OverviewKpiCard
                label="Avg. CPA"
                descriptor="All campaigns"
                amount={currencyFormatter.format(kpis.avgCpa.value)}
            />
        </div>
    );
}
