import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./BarChartRecharts.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function BarChartRecharts({ data }: Props) {
    // Combine all steps
    const barData = [
        ...data.referrer.steps.map((step, i) => ({
            name: `${i + 1}. ${step.name}`,
            count: step.count,
            type: "Referrer",
            fill: "#667eea",
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? (100 - step.dropoff).toFixed(1)
                    : null,
        })),
        ...data.referred.steps.map((step, i) => ({
            name: `${i + 4}. ${step.name}`,
            count: step.count,
            type: "Referred",
            fill: "#f093fb",
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? (100 - step.dropoff).toFixed(1)
                    : null,
        })),
        {
            name: `7. ${data.rewards.name}`,
            count: data.rewards.count,
            type: "Rewards",
            fill: "#4facfe",
            conversionRate: null,
        },
    ];

    return (
        <div className={styles.container}>
            <ResponsiveContainer width="100%" height={400}>
                <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 150, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#6b7280"
                        width={140}
                    />
                    <Tooltip
                        content={({ payload }) => {
                            if (!payload || !payload[0]) return null;
                            const dataPoint = payload[0]
                                .payload as (typeof barData)[0];
                            return (
                                <div className={styles.tooltip}>
                                    <p className={styles.tooltipTitle}>
                                        {dataPoint.name}
                                    </p>
                                    <p className={styles.tooltipValue}>
                                        Count:{" "}
                                        {dataPoint.count.toLocaleString(
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
                    <Legend
                        wrapperStyle={{ paddingTop: "20px" }}
                        content={() => (
                            <div className={styles.legend}>
                                <div className={styles.legendItem}>
                                    <div
                                        className={styles.legendColor}
                                        style={{
                                            background:
                                                "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                                        }}
                                    />
                                    <span>Referrer</span>
                                </div>
                                <div className={styles.legendItem}>
                                    <div
                                        className={styles.legendColor}
                                        style={{
                                            background:
                                                "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)",
                                        }}
                                    />
                                    <span>Referred</span>
                                </div>
                                <div className={styles.legendItem}>
                                    <div
                                        className={styles.legendColor}
                                        style={{
                                            background:
                                                "linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)",
                                        }}
                                    />
                                    <span>Rewards</span>
                                </div>
                            </div>
                        )}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {barData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
