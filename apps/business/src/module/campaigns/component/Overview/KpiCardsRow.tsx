import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import { OverviewKpiCard } from "./OverviewKpiCard";
import * as styles from "./overview.css";

const integerFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
});

function formatCount(n: number) {
    return integerFormatter.format(n).replace(/,/g, ",");
}

function formatRevenue(n: number) {
    if (n >= 1000) return `${Math.round(n / 1000)}k€`;
    return `${n}€`;
}

function formatPercent(n: number) {
    return `${(n * 100).toFixed(1)}%`;
}

export function KpiCardsRow({ kpis }: { kpis: CampaignsOverview["kpis"] }) {
    return (
        <div className={styles.kpiRow}>
            <OverviewKpiCard
                label="Ambassadors"
                descriptor="total"
                amount={formatCount(kpis.ambassadors.value)}
                delta={kpis.ambassadors.delta}
            />
            <OverviewKpiCard
                label="Shares"
                descriptor="total"
                amount={formatCount(kpis.shares.value)}
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
                amount={formatPercent(kpis.sharingRate.value)}
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
