"use client";

import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useState } from "react";
import { useGetCampaignFunnel } from "@/module/campaigns/hook/useGetCampaignFunnel";
import { Panel } from "@/module/common/component/Panel";
import { FunnelChart } from "./FunnelChart";
import { FunnelConversionChart } from "./FunnelConversionChart";
import { FunnelDonut } from "./FunnelDonut";
import { FunnelFilters } from "./FunnelFilters";
import { FunnelMetrics } from "./FunnelMetrics";
import { FunnelStackedBar } from "./FunnelStackedBar";
import { FunnelTrapezoid } from "./FunnelTrapezoid";
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
                <h2 className={styles.title}>
                    Acquisition Funnel Visualizations
                </h2>
                <FunnelFilters
                    value={selectedCampaignId}
                    onChangeAction={setSelectedCampaignId}
                />
            </div>

            {/* Metrics */}
            <Panel title="Campaign Metrics" withBadge={false}>
                <FunnelMetrics metrics={data.metrics} />
            </Panel>

            {/* Style 1: Gradient Funnel (Original) */}
            <Panel title="Style 1: Gradient Funnel" withBadge={false}>
                <FunnelChart data={data} />
            </Panel>

            {/* Style 2: Trapezoid Funnel */}
            <Panel title="Style 2: Trapezoid Funnel" withBadge={false}>
                <FunnelTrapezoid data={data} />
            </Panel>

            {/* Style 3: Conversion Rate Chart */}
            <Panel title="Style 3: Conversion Rate Chart" withBadge={false}>
                <FunnelConversionChart data={data} />
            </Panel>

            {/* Style 4: Stacked Bar Chart */}
            <Panel title="Style 4: Stacked Bar Chart" withBadge={false}>
                <FunnelStackedBar data={data} />
            </Panel>

            {/* Style 5: Donut Charts */}
            <Panel title="Style 5: Donut Charts" withBadge={false}>
                <FunnelDonut data={data} />
            </Panel>
        </div>
    );
}
