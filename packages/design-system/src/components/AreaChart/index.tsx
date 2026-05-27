import {
    Area,
    CartesianGrid,
    AreaChart as RAreaChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";
import { vars } from "../../theme.css";
import { areaChartStyles } from "./areaChart.css";

export type AreaPoint = {
    label: string;
    actual?: number;
    forecast?: number;
};

type AreaChartProps = {
    data: AreaPoint[];
    yMax?: number;
    yTicks?: number[];
    valueFormatter?: (value: number) => string;
};

const tickStyle = { fontSize: 11, fill: "currentColor" };
const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 };

export function AreaChart({
    data,
    yMax,
    yTicks,
    valueFormatter,
}: AreaChartProps) {
    return (
        <div className={areaChartStyles.container}>
            <ResponsiveContainer width="100%" height="100%">
                <RAreaChart data={data} margin={chartMargin}>
                    <defs>
                        <linearGradient
                            id="areaActualFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor={vars.icon.success}
                                stopOpacity={0.32}
                            />
                            <stop
                                offset="100%"
                                stopColor={vars.icon.success}
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
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
                            valueFormatter ?? ((v) => `${v / 1000}k€`)
                        }
                        width={52}
                        allowDecimals={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="actual"
                        stroke={vars.icon.success}
                        strokeWidth={2}
                        fill="url(#areaActualFill)"
                        connectNulls
                    />
                    <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke={vars.icon.success}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={0}
                        connectNulls
                    />
                </RAreaChart>
            </ResponsiveContainer>
        </div>
    );
}
