"use client";

import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { useState } from "react";
import { useGetCampaignFunnel } from "@/module/campaigns/hook/useGetCampaignFunnel";
import { Panel } from "@/module/common/component/Panel";
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

            {/* Funnel Visualization */}
            <Panel title="Conversion Funnel" withBadge={false}>
                <FunnelStackedBar data={data} />
            </Panel>
        </div>
    );
}
