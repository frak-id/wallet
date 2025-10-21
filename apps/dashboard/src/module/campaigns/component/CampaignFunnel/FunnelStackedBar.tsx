import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelStackedBar.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelStackedBar({ data }: Props) {
    // Combine steps for comparison
    const combinedSteps = [
        ...data.referrer.steps.map((step, i) => ({
            ...step,
            type: "referrer" as const,
            stepNumber: i + 1,
        })),
        ...data.referred.steps.map((step, i) => ({
            ...step,
            type: "referred" as const,
            stepNumber: i + 4,
        })),
    ];

    const maxCount = Math.max(...combinedSteps.map((s) => s.count));

    return (
        <div className={styles.container}>
            <div className={styles.bars}>
                {combinedSteps.map((step) => {
                    const widthPercent = (step.count / maxCount) * 100;
                    const isNarrow = widthPercent < 10;
                    return (
                        <div
                            key={`${step.type}-${step.name}`}
                            className={styles.barRow}
                        >
                            <div className={styles.label}>
                                <span className={styles.stepNumber}>
                                    {step.stepNumber}.
                                </span>
                                <span className={styles.stepName}>
                                    {step.name}
                                </span>
                                <span className={styles.stepType}>
                                    (
                                    {step.type === "referrer"
                                        ? "Referrer"
                                        : "Referred"}
                                    )
                                </span>
                            </div>
                            <div className={styles.barContainer}>
                                <div
                                    className={`${styles.bar} ${styles[step.type]}`}
                                    style={{ width: `${widthPercent}%` }}
                                >
                                    {!isNarrow && (
                                        <>
                                            <span className={styles.barValue}>
                                                {step.count.toLocaleString(
                                                    "en-US"
                                                )}
                                            </span>
                                            {step.dropoff > 0 &&
                                                step.dropoff < 100 && (
                                                    <span
                                                        className={
                                                            styles.conversion
                                                        }
                                                    >
                                                        {(
                                                            100 - step.dropoff
                                                        ).toFixed(1)}
                                                        %
                                                    </span>
                                                )}
                                        </>
                                    )}
                                </div>
                                {isNarrow && (
                                    <div className={styles.outsideValues}>
                                        <span
                                            className={styles.barValueOutside}
                                        >
                                            {step.count.toLocaleString("en-US")}
                                        </span>
                                        {step.dropoff > 0 &&
                                            step.dropoff < 100 && (
                                                <span
                                                    className={
                                                        styles.conversionOutside
                                                    }
                                                >
                                                    {(
                                                        100 - step.dropoff
                                                    ).toFixed(1)}
                                                    %
                                                </span>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Rewards row */}
                <div className={styles.barRow}>
                    <div className={styles.label}>
                        <span className={styles.stepNumber}>7.</span>
                        <span className={styles.stepName}>
                            {data.rewards.name}
                        </span>
                        <span className={styles.stepType}>(Both)</span>
                    </div>
                    <div className={styles.barContainer}>
                        <div
                            className={`${styles.bar} ${styles.rewards}`}
                            style={{
                                width: `${(data.rewards.count / maxCount) * 100}%`,
                            }}
                        >
                            {(data.rewards.count / maxCount) * 100 >= 10 && (
                                <span className={styles.barValue}>
                                    {data.rewards.count.toLocaleString("en-US")}
                                </span>
                            )}
                        </div>
                        {(data.rewards.count / maxCount) * 100 < 10 && (
                            <div className={styles.outsideValues}>
                                <span className={styles.barValueOutside}>
                                    {data.rewards.count.toLocaleString("en-US")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <div
                        className={`${styles.legendColor} ${styles.referrer}`}
                    />
                    <span>Referrer</span>
                </div>
                <div className={styles.legendItem}>
                    <div
                        className={`${styles.legendColor} ${styles.referred}`}
                    />
                    <span>Referred</span>
                </div>
                <div className={styles.legendItem}>
                    <div
                        className={`${styles.legendColor} ${styles.rewards}`}
                    />
                    <span>Rewards</span>
                </div>
            </div>
        </div>
    );
}
