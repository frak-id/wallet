"use client";

import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useState } from "react";
import { useGetCampaignFunnel } from "@/module/campaigns/hook/useGetCampaignFunnel";
import { Panel } from "@/module/common/component/Panel";
import { AreaChartRecharts } from "./AreaChartRecharts";
import { BarChartRecharts } from "./BarChartRecharts";
import { ComposedChartRecharts } from "./ComposedChartRecharts";
import { FunnelChartRecharts } from "./FunnelChartRecharts";
import { FunnelFilters } from "./FunnelFilters";
import { FunnelMetrics } from "./FunnelMetrics";
import { FunnelStackedBar } from "./FunnelStackedBar";
import styles from "./index.module.css";

export function CampaignFunnel() {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

    const { data, isLoading } = useGetCampaignFunnel(
        selectedCampaignId === "all" ? undefined : selectedCampaignId
    );

    if (isLoading || !data) {
        return <Skeleton />;
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

            {/* Original CSS-based Funnel */}
            <Panel title="Conversion Funnel" withBadge={false}>
                <FunnelStackedBar data={data} />
            </Panel>

            {/* Recharts Visualizations */}
            <Panel
                title="Recharts Style 1: Native Funnel Chart"
                withBadge={false}
            >
                <FunnelChartRecharts data={data} />
            </Panel>

            <Panel
                title="Recharts Style 2: Horizontal Bar Chart"
                withBadge={false}
            >
                <BarChartRecharts data={data} />
            </Panel>

            <Panel
                title="Recharts Style 3: Area Chart (Flow Visualization)"
                withBadge={false}
            >
                <AreaChartRecharts data={data} />
            </Panel>

            <Panel
                title="Recharts Style 4: Composed Chart (Bars + Conversion Line)"
                withBadge={false}
            >
                <ComposedChartRecharts data={data} />
            </Panel>
        </div>
    );
}
