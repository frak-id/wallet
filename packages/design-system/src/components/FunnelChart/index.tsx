import { funnelChartStyles } from "./funnelChart.css";

export type FunnelStep = {
    label: string;
    value: number;
    delta?: number;
};

type FunnelChartProps = {
    steps: FunnelStep[];
    valueFormatter?: (value: number) => string;
};

const defaultFormatter = (n: number) =>
    n.toLocaleString("en-US").replace(/,/g, " ");

export function FunnelChart({
    steps,
    valueFormatter = defaultFormatter,
}: FunnelChartProps) {
    const max = Math.max(...steps.map((s) => s.value), 1);
    const lastIndex = steps.length - 1;

    return (
        <div className={funnelChartStyles.container}>
            <div className={funnelChartStyles.guides} aria-hidden>
                <span className={funnelChartStyles.guide} />
            </div>
            {steps.map((step, i) => {
                const width = `${Math.max((step.value / max) * 100, 2)}%`;
                const isLast = i === lastIndex;
                return (
                    <div className={funnelChartStyles.row} key={step.label}>
                        <span className={funnelChartStyles.label}>
                            {step.label}
                        </span>
                        <div className={funnelChartStyles.track}>
                            <div
                                className={
                                    isLast
                                        ? funnelChartStyles.barSuccess
                                        : funnelChartStyles.bar
                                }
                                style={{ width }}
                            />
                        </div>
                        <div className={funnelChartStyles.valueCell}>
                            <span
                                className={`${funnelChartStyles.value}${
                                    isLast
                                        ? ` ${funnelChartStyles.valueSuccess}`
                                        : ""
                                }`}
                            >
                                {valueFormatter(step.value)}
                            </span>
                            {step.delta !== undefined && (
                                <span
                                    className={`${funnelChartStyles.delta} ${
                                        step.delta >= 0
                                            ? funnelChartStyles.deltaUp
                                            : funnelChartStyles.deltaDown
                                    }`}
                                >
                                    {step.delta >= 0 ? "▲" : "▼"}{" "}
                                    {step.delta > 0 ? "+" : ""}
                                    {step.delta}%
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
