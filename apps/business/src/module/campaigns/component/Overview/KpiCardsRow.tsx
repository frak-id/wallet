import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

export function KpiCardsRow({ kpis }: { kpis: CampaignsOverview["kpis"] }) {
    const { t, i18n } = useTranslation();
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
                label={t("campaigns.overview.kpi.ambassadors")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={integerFormatter.format(kpis.ambassadors.value)}
                delta={kpis.ambassadors.delta}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.shares")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={integerFormatter.format(kpis.shares.value)}
                delta={kpis.shares.delta}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.revenue")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={formatRevenue(kpis.revenue.value)}
                delta={kpis.revenue.delta}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.sharingRate")}
                descriptor={t("campaigns.overview.kpi.descriptorTotal")}
                amount={percentFormatter.format(kpis.sharingRate.value)}
                delta={kpis.sharingRate.delta}
            />
            <OverviewKpiCard
                label={t("campaigns.overview.kpi.avgCpa")}
                descriptor={t("campaigns.overview.kpi.descriptorAllCampaigns")}
                amount={currencyFormatter.format(kpis.avgCpa.value)}
            />
        </div>
    );
}
