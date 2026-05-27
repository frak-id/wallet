import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { donutChartStyles } from "./donutChart.css";

export type DonutSegment = {
    label: string;
    value: number;
    color: string;
};

type DonutChartProps = {
    segments: DonutSegment[];
};

const renderLabel = ({
    percent,
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
}: {
    percent?: number;
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
}) => {
    if (
        percent === undefined ||
        cx === undefined ||
        cy === undefined ||
        midAngle === undefined ||
        innerRadius === undefined ||
        outerRadius === undefined
    ) {
        return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const RADIAN = Math.PI / 180;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x}
            y={y}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
        >
            {Math.round(percent * 100)}%
        </text>
    );
};

export function DonutChart({ segments }: DonutChartProps) {
    return (
        <div className={donutChartStyles.container}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={segments}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="58%"
                        outerRadius="90%"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                        label={renderLabel}
                        labelLine={false}
                        isAnimationActive
                    >
                        {segments.map((s) => (
                            <Cell key={s.label} fill={s.color} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
