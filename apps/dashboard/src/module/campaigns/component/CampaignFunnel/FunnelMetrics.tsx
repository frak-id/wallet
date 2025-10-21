import type { FunnelMetrics as FunnelMetricsType } from "@/types/Funnel";
import styles from "./index.module.css";

type Props = {
    metrics: FunnelMetricsType;
};

export function FunnelMetrics({ metrics }: Props) {
    return (
        <div className={styles.metricsGrid}>
            <MetricCard
                label="CPM"
                value={`${metrics.cpm.toFixed(2)}€`}
                description="Cost per 1000 views"
            />
            <MetricCard
                label="CPC"
                value={`${metrics.cpc.toFixed(2)}€`}
                description="Cost per click"
            />
            <MetricCard
                label="Sharing Rate"
                value={`${metrics.sharingRate.toFixed(2)}%`}
                description="Sharing rate"
            />
            <MetricCard
                label="CPA"
                value={`${metrics.cpa.toFixed(2)}€`}
                description="Cost per action"
            />
            <MetricCard
                label="CAC"
                value={`${metrics.cac.toFixed(2)}€`}
                description="Customer acquisition cost"
            />
            <MetricCard
                label="Amount Spent"
                value={`${metrics.amountSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}€`}
                description="Total amount spent"
            />
        </div>
    );
}

type MetricCardProps = {
    label: string;
    value: string;
    description: string;
};

function MetricCard({ label, value, description }: MetricCardProps) {
    return (
        <div className={styles.metricCard}>
            <p className={styles.metricLabel}>{label}</p>
            <p className={styles.metricValue}>{value}</p>
            <p className={styles.metricDescription}>{description}</p>
        </div>
    );
}
