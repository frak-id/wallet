import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./AreaChartRecharts.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function AreaChartRecharts({ data }: Props) {
    // Create data points for each step
    const areaData = [
        {
            step: "1. Modal visit",
            referrer: data.referrer.steps[0]?.count || 0,
            referred: 0,
        },
        {
            step: "2. Share",
            referrer: data.referrer.steps[1]?.count || 0,
            referred: 0,
        },
        {
            step: "3. Open",
            referrer: data.referrer.steps[2]?.count || 0,
            referred: 0,
        },
        {
            step: "4. Site visit",
            referrer: 0,
            referred: data.referred.steps[0]?.count || 0,
        },
        {
            step: "5. Modal visit",
            referrer: 0,
            referred: data.referred.steps[1]?.count || 0,
        },
        {
            step: "6. Purchase",
            referrer: 0,
            referred: data.referred.steps[2]?.count || 0,
        },
        {
            step: "7. Rewards",
            referrer: data.rewards.count / 2,
            referred: data.rewards.count / 2,
        },
    ];

    return (
        <div className={styles.container}>
            <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                    data={areaData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                    <defs>
                        <linearGradient
                            id="colorReferrer"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#667eea"
                                stopOpacity={0.8}
                            />
                            <stop
                                offset="95%"
                                stopColor="#667eea"
                                stopOpacity={0.1}
                            />
                        </linearGradient>
                        <linearGradient
                            id="colorReferred"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#f093fb"
                                stopOpacity={0.8}
                            />
                            <stop
                                offset="95%"
                                stopColor="#f093fb"
                                stopOpacity={0.1}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="step" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                        content={({ payload, label }) => {
                            if (!payload || !payload.length) return null;
                            return (
                                <div className={styles.tooltip}>
                                    <p className={styles.tooltipTitle}>
                                        {label}
                                    </p>
                                    {payload.map((entry) => {
                                        if (!entry.value || entry.value === 0)
                                            return null;
                                        return (
                                            <p
                                                key={entry.dataKey}
                                                className={styles.tooltipValue}
                                                style={{
                                                    color: entry.color as string,
                                                }}
                                            >
                                                {entry.name}:{" "}
                                                {Number(
                                                    entry.value
                                                ).toLocaleString("en-US")}
                                            </p>
                                        );
                                    })}
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
                                        style={{ background: "#667eea" }}
                                    />
                                    <span>Referrer Flow</span>
                                </div>
                                <div className={styles.legendItem}>
                                    <div
                                        className={styles.legendColor}
                                        style={{ background: "#f093fb" }}
                                    />
                                    <span>Referred Flow</span>
                                </div>
                            </div>
                        )}
                    />
                    <Area
                        type="monotone"
                        dataKey="referrer"
                        name="Referrer"
                        stroke="#667eea"
                        strokeWidth={2}
                        fill="url(#colorReferrer)"
                    />
                    <Area
                        type="monotone"
                        dataKey="referred"
                        name="Referred"
                        stroke="#f093fb"
                        strokeWidth={2}
                        fill="url(#colorReferred)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
