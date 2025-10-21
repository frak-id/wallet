import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelDonut.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelDonut({ data }: Props) {
    // Calculate retention vs dropoff for each step
    const createDonutData = (steps: { count: number; name: string }[]) => {
        return steps.map((step, index) => {
            if (index === 0) {
                return {
                    name: step.name,
                    retained: 100,
                    dropped: 0,
                    count: step.count,
                };
            }
            const prevCount = steps[index - 1].count;
            const retained = (step.count / prevCount) * 100;
            const dropped = 100 - retained;
            return {
                name: step.name,
                retained,
                dropped,
                count: step.count,
            };
        });
    };

    const referrerDonuts = createDonutData(data.referrer.steps);
    const referredDonuts = createDonutData(data.referred.steps);

    // SVG donut chart creator
    const createDonut = (
        retained: number,
        _dropped: number,
        color: string,
        size = 120
    ) => {
        const strokeWidth = 20;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const retainedOffset = circumference - (retained / 100) * circumference;

        return (
            <svg
                width={size}
                height={size}
                className={styles.donut}
                role="img"
                aria-label="Donut chart showing retention percentage"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth={strokeWidth}
                />
                {/* Retained arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={retainedOffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    className={styles.retainedArc}
                />
                {/* Center percentage */}
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dy="0.3em"
                    className={styles.percentage}
                >
                    {retained.toFixed(0)}%
                </text>
            </svg>
        );
    };

    return (
        <div className={styles.container}>
            {/* Referrer Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>REFERRER</h3>
                <div className={styles.donuts}>
                    {referrerDonuts.map((donut, index) => (
                        <div key={donut.name} className={styles.donutCard}>
                            {createDonut(
                                donut.retained,
                                donut.dropped,
                                "#667eea"
                            )}
                            <div className={styles.donutInfo}>
                                <span className={styles.stepName}>
                                    {index + 1}. {donut.name}
                                </span>
                                <span className={styles.stepCount}>
                                    {donut.count.toLocaleString("en-US")}
                                </span>
                                {donut.dropped > 0 && (
                                    <span className={styles.dropoffText}>
                                        {donut.dropped.toFixed(1)}% dropped
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Referred Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>REFERRED</h3>
                <div className={styles.donuts}>
                    {referredDonuts.map((donut, index) => (
                        <div key={donut.name} className={styles.donutCard}>
                            {createDonut(
                                donut.retained,
                                donut.dropped,
                                "#f093fb"
                            )}
                            <div className={styles.donutInfo}>
                                <span className={styles.stepName}>
                                    {index + 4}. {donut.name}
                                </span>
                                <span className={styles.stepCount}>
                                    {donut.count.toLocaleString("en-US")}
                                </span>
                                {donut.dropped > 0 && (
                                    <span className={styles.dropoffText}>
                                        {donut.dropped.toFixed(1)}% dropped
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rewards */}
            <div className={styles.rewards}>
                <div className={styles.rewardsInfo}>
                    <span className={styles.rewardsName}>
                        7. {data.rewards.name}
                    </span>
                    <span className={styles.rewardsCount}>
                        {data.rewards.count.toLocaleString("en-US")}
                    </span>
                </div>
            </div>
        </div>
    );
}
