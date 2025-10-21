import {
    Cell,
    Funnel,
    FunnelChart,
    LabelList,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelChartRecharts.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelChartRecharts({ data }: Props) {
    // Combine all steps into single funnel data
    const funnelData = [
        ...data.referrer.steps.map((step, i) => ({
            name: `${i + 1}. ${step.name}`,
            value: step.count,
            fill: "#667eea",
            type: "Referrer",
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? (100 - step.dropoff).toFixed(1)
                    : null,
        })),
        ...data.referred.steps.map((step, i) => ({
            name: `${i + 4}. ${step.name}`,
            value: step.count,
            fill: "#f093fb",
            type: "Referred",
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? (100 - step.dropoff).toFixed(1)
                    : null,
        })),
        {
            name: `7. ${data.rewards.name}`,
            value: data.rewards.count,
            fill: "#4facfe",
            type: "Rewards",
            conversionRate: null,
        },
    ];

    return (
        <div className={styles.container}>
            <ResponsiveContainer width="100%" height={500}>
                <FunnelChart
                    margin={{ top: 20, right: 200, bottom: 20, left: 20 }}
                >
                    <Tooltip
                        content={({ payload }) => {
                            if (!payload || !payload[0]) return null;
                            const dataPoint = payload[0]
                                .payload as (typeof funnelData)[0];
                            return (
                                <div className={styles.tooltip}>
                                    <p className={styles.tooltipTitle}>
                                        {dataPoint.name}
                                    </p>
                                    <p className={styles.tooltipValue}>
                                        Count:{" "}
                                        {dataPoint.value.toLocaleString(
                                            "en-US"
                                        )}
                                    </p>
                                    <p className={styles.tooltipType}>
                                        Type: {dataPoint.type}
                                    </p>
                                    {dataPoint.conversionRate && (
                                        <p className={styles.tooltipConversion}>
                                            Conversion:{" "}
                                            {dataPoint.conversionRate}%
                                        </p>
                                    )}
                                </div>
                            );
                        }}
                    />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                        {funnelData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                        ))}
                        <LabelList
                            position="right"
                            fill="#000"
                            stroke="none"
                            dataKey="name"
                        />
                    </Funnel>
                </FunnelChart>
            </ResponsiveContainer>
        </div>
    );
}
