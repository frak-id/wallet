import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelSankey.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelSankey({ data }: Props) {
    // Calculate flows and losses
    const referrerFlows = data.referrer.steps.map((step, i) => {
        const nextStep = data.referrer.steps[i + 1];
        const loss = nextStep ? step.count - nextStep.count : 0;
        return {
            step,
            nextCount: nextStep?.count || 0,
            loss,
            stepNumber: i + 1,
        };
    });

    const referredFlows = data.referred.steps.map((step, i) => {
        const nextStep = data.referred.steps[i + 1];
        const loss = nextStep ? step.count - nextStep.count : 0;
        return {
            step,
            nextCount: nextStep?.count || 0,
            loss,
            stepNumber: i + 4,
        };
    });

    const maxCount = Math.max(
        ...data.referrer.steps.map((s) => s.count),
        ...data.referred.steps.map((s) => s.count)
    );

    return (
        <div className={styles.container}>
            {/* Referrer Flow */}
            <div className={styles.flowSection}>
                <h3 className={styles.sectionTitle}>REFERRER</h3>
                <div className={styles.flow}>
                    {referrerFlows.map((flow, _index) => {
                        const widthPercent = (flow.step.count / maxCount) * 100;
                        const nextWidthPercent =
                            (flow.nextCount / maxCount) * 100;
                        const _lossWidthPercent = (flow.loss / maxCount) * 100;

                        return (
                            <div
                                key={flow.step.name}
                                className={styles.flowStep}
                            >
                                {/* Node */}
                                <div className={styles.node}>
                                    <div
                                        className={`${styles.nodeBar} ${styles.referrer}`}
                                        style={{ width: `${widthPercent}%` }}
                                    >
                                        <span className={styles.nodeName}>
                                            {flow.stepNumber}. {flow.step.name}
                                        </span>
                                        <span className={styles.nodeCount}>
                                            {flow.step.count.toLocaleString(
                                                "en-US"
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Flow connector */}
                                {flow.nextCount > 0 && (
                                    <div className={styles.connector}>
                                        <svg
                                            className={styles.svg}
                                            viewBox="0 0 100 50"
                                            preserveAspectRatio="none"
                                            role="img"
                                            aria-label="Flow connector"
                                        >
                                            <path
                                                className={styles.flowPath}
                                                d={`M 0 0 L ${nextWidthPercent} 50`}
                                                stroke="#667eea"
                                                strokeWidth={widthPercent / 10}
                                                fill="none"
                                                opacity="0.3"
                                            />
                                        </svg>
                                        {flow.loss > 0 && (
                                            <div className={styles.loss}>
                                                <span>
                                                    -
                                                    {flow.loss.toLocaleString(
                                                        "en-US"
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Referred Flow */}
            <div className={styles.flowSection}>
                <h3 className={styles.sectionTitle}>REFERRED</h3>
                <div className={styles.flow}>
                    {referredFlows.map((flow, _index) => {
                        const widthPercent = (flow.step.count / maxCount) * 100;
                        const nextWidthPercent =
                            (flow.nextCount / maxCount) * 100;

                        return (
                            <div
                                key={flow.step.name}
                                className={styles.flowStep}
                            >
                                {/* Node */}
                                <div className={styles.node}>
                                    <div
                                        className={`${styles.nodeBar} ${styles.referred}`}
                                        style={{ width: `${widthPercent}%` }}
                                    >
                                        <span className={styles.nodeName}>
                                            {flow.stepNumber}. {flow.step.name}
                                        </span>
                                        <span className={styles.nodeCount}>
                                            {flow.step.count.toLocaleString(
                                                "en-US"
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Flow connector */}
                                {flow.nextCount > 0 && (
                                    <div className={styles.connector}>
                                        <svg
                                            className={styles.svg}
                                            viewBox="0 0 100 50"
                                            preserveAspectRatio="none"
                                            role="img"
                                            aria-label="Flow connector"
                                        >
                                            <path
                                                className={styles.flowPath}
                                                d={`M 0 0 L ${nextWidthPercent} 50`}
                                                stroke="#f093fb"
                                                strokeWidth={widthPercent / 10}
                                                fill="none"
                                                opacity="0.3"
                                            />
                                        </svg>
                                        {flow.loss > 0 && (
                                            <div className={styles.loss}>
                                                <span>
                                                    -
                                                    {flow.loss.toLocaleString(
                                                        "en-US"
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rewards */}
            <div className={styles.rewards}>
                <div className={styles.nodeBar}>
                    <span className={styles.nodeName}>
                        7. {data.rewards.name}
                    </span>
                    <span className={styles.nodeCount}>
                        {data.rewards.count.toLocaleString("en-US")}
                    </span>
                </div>
            </div>
        </div>
    );
}
