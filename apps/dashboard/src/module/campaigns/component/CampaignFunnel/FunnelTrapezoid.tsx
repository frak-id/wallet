import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelTrapezoid.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelTrapezoid({ data }: Props) {
    // Calculate max count for scaling
    const maxCount = Math.max(
        ...data.referrer.steps.map((s) => s.count),
        ...data.referred.steps.map((s) => s.count)
    );

    return (
        <div className={styles.container}>
            {/* Referrer Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>REFERRER</h3>
                <div className={styles.funnel}>
                    {data.referrer.steps.map((step, index) => {
                        const widthPercent = (step.count / maxCount) * 100;
                        return (
                            <div key={step.name} className={styles.stepWrapper}>
                                <div
                                    className={`${styles.trapezoid} ${styles.referrer}`}
                                    style={{ width: `${widthPercent}%` }}
                                >
                                    <div className={styles.stepContent}>
                                        <span className={styles.stepName}>
                                            {index + 1}. {step.name}
                                        </span>
                                        <span className={styles.stepCount}>
                                            {step.count.toLocaleString("en-US")}
                                        </span>
                                    </div>
                                </div>
                                {step.dropoff > 0 && (
                                    <span className={styles.dropoff}>
                                        -{step.dropoff.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Referred Section */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>REFERRED</h3>
                <div className={styles.funnel}>
                    {data.referred.steps.map((step, index) => {
                        const widthPercent = (step.count / maxCount) * 100;
                        return (
                            <div key={step.name} className={styles.stepWrapper}>
                                <div
                                    className={`${styles.trapezoid} ${styles.referred}`}
                                    style={{ width: `${widthPercent}%` }}
                                >
                                    <div className={styles.stepContent}>
                                        <span className={styles.stepName}>
                                            {index + 4}. {step.name}
                                        </span>
                                        <span className={styles.stepCount}>
                                            {step.count.toLocaleString("en-US")}
                                        </span>
                                    </div>
                                </div>
                                {step.dropoff > 0 && (
                                    <span className={styles.dropoff}>
                                        -{step.dropoff.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rewards */}
            <div className={styles.rewards}>
                <span className={styles.rewardsLabel}>
                    7. {data.rewards.name}
                </span>
                <span className={styles.rewardsCount}>
                    {data.rewards.count.toLocaleString("en-US")}
                </span>
            </div>
        </div>
    );
}
