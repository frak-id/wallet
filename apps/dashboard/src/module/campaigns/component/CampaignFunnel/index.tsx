"use client";

import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useGetCampaignFunnel } from "@/module/campaigns/hook/useGetCampaignFunnel";
import { Panel } from "@/module/common/component/Panel";
import { FunnelFilters } from "./FunnelFilters";
import { FunnelMetrics } from "./FunnelMetrics";
import styles from "./index.module.css";

// Dynamic import for recharts horizontal bar chart to reduce main bundle size
const BarChartRecharts = dynamic(
    () =>
        import("./BarChartRecharts").then((mod) => ({
            default: mod.BarChartRecharts,
        })),
    { ssr: false, loading: () => <Skeleton /> }
);

export function CampaignFunnel() {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

    const { data, isLoading } = useGetCampaignFunnel(
        selectedCampaignId === "all" ? undefined : selectedCampaignId
    );

    if (isLoading || !data) {
        return (
            <div className={styles.visualizations}>
                <Skeleton />
            </div>
        );
    }

    return (
        <div className={styles.visualizations}>
            {/* Header with filters */}
            <div className={styles.header}>
                <h2 className={styles.title}>Campaign Funnel Analysis</h2>
                <FunnelFilters
                    value={selectedCampaignId}
                    onChangeAction={setSelectedCampaignId}
                />
            </div>

            {/* Metrics */}
            <Panel title="Campaign Metrics" withBadge={false}>
                <FunnelMetrics metrics={data.metrics} />
            </Panel>

            {/* Conversion Funnel */}
            <Panel title="Conversion Funnel" withBadge={false}>
                <BarChartRecharts data={data} />
            </Panel>
        </div>
    );
}
