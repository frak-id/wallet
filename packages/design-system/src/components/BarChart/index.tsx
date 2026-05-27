import {
    Bar,
    CartesianGrid,
    BarChart as RBarChart,
    ReferenceLine,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";
import { vars } from "../../theme.css";
import { barChartStyles } from "./barChart.css";

export type BarPoint = {
    label: string;
    value: number;
};

type BarChartProps = {
    data: BarPoint[];
    avg?: number;
    avgLabel?: string;
    yMax?: number;
    yTicks?: number[];
    valueFormatter?: (value: number) => string;
};

const tickStyle = { fontSize: 11, fill: "currentColor" };
const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 };

export function BarChart({
    data,
    avg,
    avgLabel,
    yMax,
    yTicks,
    valueFormatter,
}: BarChartProps) {
    return (
        <div className={barChartStyles.container}>
            <ResponsiveContainer width="100%" height="100%">
                <RBarChart data={data} margin={chartMargin}>
                    <CartesianGrid
                        horizontal
                        vertical={false}
                        strokeDasharray="2 4"
                        stroke={vars.border.subtle}
                    />
                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={tickStyle}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={tickStyle}
                        domain={[0, yMax ?? "auto"]}
                        ticks={yTicks}
                        tickFormatter={
                            valueFormatter ?? ((v) => `${v / 1000}k`)
                        }
                        width={36}
                        allowDecimals={false}
                    />
                    <Bar
                        dataKey="value"
                        fill={vars.icon.action}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={28}
                    />
                    {avg !== undefined && (
                        <ReferenceLine
                            y={avg}
                            stroke={vars.icon.action}
                            strokeDasharray="3 3"
                            label={
                                avgLabel
                                    ? {
                                          value: avgLabel,
                                          position: "right",
                                          fill: vars.text.action,
                                          fontSize: 11,
                                      }
                                    : undefined
                            }
                        />
                    )}
                </RBarChart>
            </ResponsiveContainer>
        </div>
    );
}
