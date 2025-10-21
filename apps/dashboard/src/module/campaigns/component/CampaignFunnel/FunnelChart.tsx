import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./index.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelChart({ data }: Props) {
    return (
        <>
            <div className={styles.funnelContainer}>
                {/* Referrer Column */}
                <div className={styles.funnelColumn}>
                    <h3 className={styles.funnelHeader}>REFERRER</h3>
                    {data.referrer.steps.map((step, index) => (
                        <div
                            key={step.name}
                            className={`${styles.funnelStep} ${styles.referrer}`}
                        >
                            {step.dropoff > 0 && (
                                <span className={styles.stepDropoff}>
                                    -{step.dropoff.toFixed(1)}%
                                </span>
                            )}
                            <span className={styles.stepName}>
                                {index + 1}. {step.name}
                            </span>
                            <span className={styles.stepCount}>
                                {step.count.toLocaleString("en-US")}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Referred Column */}
                <div className={styles.funnelColumn}>
                    <h3 className={styles.funnelHeader}>REFERRED</h3>
                    {data.referred.steps.map((step, index) => (
                        <div
                            key={step.name}
                            className={`${styles.funnelStep} ${styles.referred}`}
                        >
                            {step.dropoff > 0 && (
                                <span className={styles.stepDropoff}>
                                    -{step.dropoff.toFixed(1)}%
                                </span>
                            )}
                            <span className={styles.stepName}>
                                {index + 4}. {step.name}
                            </span>
                            <span className={styles.stepCount}>
                                {step.count.toLocaleString("en-US")}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rewards Step (Common) */}
            <div className={styles.rewardsStep}>
                <p className={styles.rewardsLabel}>7. {data.rewards.name}</p>
                <p className={styles.rewardsCount}>
                    {data.rewards.count.toLocaleString("en-US")}
                </p>
            </div>
        </>
    );
}
