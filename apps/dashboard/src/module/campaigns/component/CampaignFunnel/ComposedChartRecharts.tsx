import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./ComposedChartRecharts.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function ComposedChartRecharts({ data }: Props) {
    // Combine all steps with conversion rates
    const composedData = [
        ...data.referrer.steps.map((step, i) => ({
            name: `${i + 1}. ${step.name}`,
            count: step.count,
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? 100 - step.dropoff
                    : null,
            type: "Referrer",
            fill: "#667eea",
        })),
        ...data.referred.steps.map((step, i) => ({
            name: `${i + 4}. ${step.name}`,
            count: step.count,
            conversionRate:
                step.dropoff > 0 && step.dropoff < 100
                    ? 100 - step.dropoff
                    : null,
            type: "Referred",
            fill: "#f093fb",
        })),
        {
            name: `7. ${data.rewards.name}`,
            count: data.rewards.count,
            conversionRate: null,
            type: "Rewards",
            fill: "#4facfe",
        },
    ];

    return (
        <div className={styles.container}>
            <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                    data={composedData}
                    margin={{ top: 20, right: 60, left: 20, bottom: 60 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="name"
                        stroke="#6b7280"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                    />
                    <YAxis
                        yAxisId="left"
                        stroke="#6b7280"
                        label={{
                            value: "User Count",
                            angle: -90,
                            position: "insideLeft",
                            style: { fill: "#6b7280" },
                        }}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#10b981"
                        domain={[0, 100]}
                        label={{
                            value: "Conversion Rate (%)",
                            angle: 90,
                            position: "insideRight",
                            style: { fill: "#10b981" },
                        }}
                    />
                    <Tooltip
                        content={({ payload }) => {
                            if (!payload || !payload[0]) return null;
                            const dataPoint = payload[0]
                                .payload as (typeof composedData)[0];
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
                                    {dataPoint.conversionRate !== null && (
                                        <p className={styles.tooltipConversion}>
                                            Conversion:{" "}
                                            {dataPoint.conversionRate.toFixed(
                                                1
                                            )}
                                            %
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
                                <div className={styles.legendItem}>
                                    <div
                                        className={styles.legendLine}
                                        style={{ background: "#10b981" }}
                                    />
                                    <span>Conversion Rate</span>
                                </div>
                            </div>
                        )}
                    />
                    <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]}>
                        {composedData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                        ))}
                    </Bar>
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="conversionRate"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
