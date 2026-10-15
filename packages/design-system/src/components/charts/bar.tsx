import type { scaleBand } from "@visx/scale";
import { motion } from "motion/react";
import { memo, useMemo } from "react";
import {
    ANIMATION_DURATION_MS,
    DEFAULT_CHART_ENTER_TRANSITION,
} from "./animation";
import { useChart, useChartStable } from "./chart-context";

type ScaleBand<Domain extends { toString(): string }> = ReturnType<
    typeof scaleBand<Domain>
>;

export interface BarProps {
    /** Key in data to use for y values */
    dataKey: string;
    /** Fill color for the bar */
    fill: string;
}

interface BarInnerProps extends BarProps {
    barScale: ScaleBand<string>;
    bandWidth: number;
    barXAccessor: (d: Record<string, unknown>) => string;
}

interface AnimatedBarProps {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    index: number;
    isFaded: boolean;
    innerHeight: number;
    staggerDelay: number;
    revealEpoch: number;
}

function AnimatedBar({
    x,
    y,
    width,
    height,
    fill,
    index,
    isFaded,
    innerHeight,
    staggerDelay,
    revealEpoch,
}: AnimatedBarProps) {
    const enterAnim = {
        ...DEFAULT_CHART_ENTER_TRANSITION,
        delay: index * staggerDelay,
    };

    return (
        <g
            opacity={isFaded ? 0.3 : 1}
            style={{ transition: "opacity 0.15s ease-in-out" }}
        >
            <motion.rect
                animate={{ width, height, x, y }}
                fill={fill}
                initial={{ width, height: 0, x, y: innerHeight }}
                key={`grow-${index}-${revealEpoch}`}
                rx={0}
                ry={0}
                transition={enterAnim}
            />
        </g>
    );
}

const BarInner = memo(function BarInner({
    dataKey,
    fill,
    barScale,
    bandWidth,
    barXAccessor,
}: BarInnerProps) {
    const {
        data,
        yScale,
        innerHeight,
        isLoaded,
        hoveredBarIndex,
        lines,
        revealEpoch,
    } = useChart();

    // 40% of the animation time is spread across the bars as stagger.
    const staggerSpread = ANIMATION_DURATION_MS * 0.4;
    const staggerDelay =
        data.length > 1 ? staggerSpread / 1000 / data.length : 0;

    // Find the index of this bar series among all bar series
    const seriesIndex = useMemo(() => {
        const idx = lines.findIndex((l) => l.dataKey === dataKey);
        return idx >= 0 ? idx : 0;
    }, [lines, dataKey]);

    const seriesCount = lines.length;
    const groupGap = seriesCount > 1 ? 4 : 0;

    // Width of each bar within a group
    const barWidth = useMemo(() => {
        if (!bandWidth || seriesCount === 0) {
            return 0;
        }
        return (bandWidth - groupGap * (seriesCount - 1)) / seriesCount;
    }, [bandWidth, seriesCount, groupGap]);

    return (
        <g>
            {data.map((d, i) => {
                const value = d[dataKey];
                if (typeof value !== "number") {
                    return null;
                }

                const categoryValue = barXAccessor(d);
                const bandPos = barScale(categoryValue) ?? 0;

                const y = yScale(value) ?? 0;
                const barHeight = innerHeight - y;
                const x = bandPos + seriesIndex * (barWidth + groupGap);

                const isFaded =
                    hoveredBarIndex !== null && hoveredBarIndex !== i;

                // Use categoryValue as key since it's the unique identifier from data
                const barKey = `bar-${dataKey}-${categoryValue}`;

                if (!isLoaded) {
                    return (
                        <AnimatedBar
                            fill={fill}
                            height={barHeight}
                            index={i}
                            innerHeight={innerHeight}
                            isFaded={isFaded}
                            key={barKey}
                            revealEpoch={revealEpoch}
                            staggerDelay={staggerDelay}
                            width={barWidth}
                            x={x}
                            y={y}
                        />
                    );
                }

                // Static bar after animation completes
                return (
                    <rect
                        fill={fill}
                        height={barHeight}
                        key={barKey}
                        opacity={isFaded ? 0.3 : 1}
                        rx={0}
                        ry={0}
                        style={{
                            cursor: "default",
                            transition: "opacity 0.15s ease-in-out",
                        }}
                        width={barWidth}
                        x={x}
                        y={y}
                    />
                );
            })}
        </g>
    );
});

export function Bar(props: BarProps) {
    const { barScale, bandWidth, barXAccessor } = useChartStable();

    if (!(barScale && bandWidth && barXAccessor)) {
        return null;
    }

    return (
        <BarInner
            {...props}
            bandWidth={bandWidth}
            barScale={barScale}
            barXAccessor={barXAccessor}
        />
    );
}

Bar.displayName = "Bar";
