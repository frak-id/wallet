import type { CampaignFunnelData } from "@/types/Funnel";
import styles from "./FunnelConversionChart.module.css";

type Props = {
    data: CampaignFunnelData;
};

export function FunnelConversionChart({ data }: Props) {
    // Calculate conversion rates (cumulative)
    const referrerRates = data.referrer.steps.map((step, index) => {
        if (index === 0) return 100;
        return ((step.count / data.referrer.steps[0].count) * 100).toFixed(1);
    });

    const referredRates = data.referred.steps.map((step, index) => {
        if (index === 0) return 100;
        return ((step.count / data.referred.steps[0].count) * 100).toFixed(1);
    });

    const _maxSteps = Math.max(
        data.referrer.steps.length,
        data.referred.steps.length
    );

    return (
        <div className={styles.container}>
            <div className={styles.chart}>
                {/* Y-axis labels */}
                <div className={styles.yAxis}>
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                </div>

                {/* Chart area */}
                <div className={styles.chartArea}>
                    {/* Grid lines */}
                    <div className={styles.gridLines}>
                        <div className={styles.gridLine} />
                        <div className={styles.gridLine} />
                        <div className={styles.gridLine} />
                        <div className={styles.gridLine} />
                    </div>

                    {/* Referrer line */}
                    <svg
                        className={styles.svg}
                        viewBox="0 0 100 100"
                        role="img"
                        aria-label="Referrer conversion rate chart"
                    >
                        <polyline
                            className={styles.lineReferrer}
                            points={referrerRates
                                .map(
                                    (rate, i) =>
                                        `${(i / (data.referrer.steps.length - 1)) * 100},${100 - Number(rate)}`
                                )
                                .join(" ")}
                        />
                        <polygon
                            className={styles.areaReferrer}
                            points={`0,100 ${referrerRates
                                .map(
                                    (rate, i) =>
                                        `${(i / (data.referrer.steps.length - 1)) * 100},${100 - Number(rate)}`
                                )
                                .join(" ")} 100,100`}
                        />
                        {data.referrer.steps.map((step, i) => (
                            <circle
                                key={step.name}
                                className={styles.dotReferrer}
                                cx={
                                    (i / (data.referrer.steps.length - 1)) * 100
                                }
                                cy={100 - Number(referrerRates[i])}
                                r="2"
                            />
                        ))}
                    </svg>

                    {/* Referred line */}
                    <svg
                        className={styles.svg}
                        viewBox="0 0 100 100"
                        role="img"
                        aria-label="Referred conversion rate chart"
                    >
                        <polyline
                            className={styles.lineReferred}
                            points={referredRates
                                .map(
                                    (rate, i) =>
                                        `${(i / (data.referred.steps.length - 1)) * 100},${100 - Number(rate)}`
                                )
                                .join(" ")}
                        />
                        <polygon
                            className={styles.areaReferred}
                            points={`0,100 ${referredRates
                                .map(
                                    (rate, i) =>
                                        `${(i / (data.referred.steps.length - 1)) * 100},${100 - Number(rate)}`
                                )
                                .join(" ")} 100,100`}
                        />
                        {data.referred.steps.map((step, i) => (
                            <circle
                                key={step.name}
                                className={styles.dotReferred}
                                cx={
                                    (i / (data.referred.steps.length - 1)) * 100
                                }
                                cy={100 - Number(referredRates[i])}
                                r="2"
                            />
                        ))}
                    </svg>
                </div>
            </div>

            {/* X-axis labels */}
            <div className={styles.xAxis}>
                <div className={styles.xAxisLabels}>
                    {data.referrer.steps.map((step, _i) => (
                        <span key={step.name} className={styles.xLabel}>
                            {step.name}
                        </span>
                    ))}
                </div>
                <div className={styles.xAxisLabels}>
                    {data.referred.steps.map((step, _i) => (
                        <span key={step.name} className={styles.xLabel}>
                            {step.name}
                        </span>
                    ))}
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
            </div>
        </div>
    );
}
