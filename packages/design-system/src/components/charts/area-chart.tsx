import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import clsx from "clsx";
import { bisector, extent } from "d3-array";
import { motion } from "motion/react";
import {
    Children,
    isValidElement,
    memo,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ANIMATION_DURATION_MS } from "./animation";
import { Area, type AreaProps } from "./area";
import { ChartProvider, type LineConfig, type Margin } from "./chart-context";
import { getShortDateFmt } from "./chart-formatters";
import * as styles from "./charts.css";
import {
    decimateTimeSeries,
    maxRenderPointsForWidth,
} from "./decimate-time-series";
import { useChartInteraction } from "./use-chart-interaction";

export interface AreaChartProps {
    /** One item per x position, keyed by `date`, plus the numeric series. */
    data: ({ date: Date } & Record<string, unknown>)[];
    /** Chart margins */
    margin: Margin;
    /** Additional class name for the container */
    className?: string;
    /** BCP-47 locale for date axis/tooltip formatting. Default "en-US". */
    locale?: string;
    /** Child components (Area, Grid, ChartTooltip, etc.) */
    children: ReactNode;
}

function xAccessor(d: Record<string, unknown>): Date {
    const value = d.date;
    return value instanceof Date ? value : new Date(value as string | number);
}

const EDGE_BLEED = 4;

const bisectDate = bisector<Record<string, unknown>, Date>((d) =>
    xAccessor(d)
).left;

function extractAreaConfigs(children: ReactNode): LineConfig[] {
    const configs: LineConfig[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child) || child.type !== Area) {
            return;
        }

        const props = child.props as AreaProps;
        configs.push({ dataKey: props.dataKey, stroke: props.stroke });
    });

    return configs;
}

function collectNumericExtents(
    data: Record<string, unknown>[],
    dataKeys: string[]
) {
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (const d of data) {
        for (const key of dataKeys) {
            const value = d[key];
            if (typeof value === "number") {
                if (value < minValue) {
                    minValue = value;
                }
                if (value > maxValue) {
                    maxValue = value;
                }
            }
        }
    }

    if (minValue === Number.POSITIVE_INFINITY) {
        return { minValue: 0, maxValue: 100 };
    }

    return { minValue, maxValue };
}

function resolveYDomain(
    data: Record<string, unknown>[],
    dataKeys: string[]
): [number, number] {
    const { minValue, maxValue } = collectNumericExtents(data, dataKeys);

    if (minValue >= 0) {
        const top = maxValue <= 0 ? 100 : maxValue * 1.1;
        return [0, top];
    }

    const padding = (maxValue - minValue) * 0.05 || 1;
    return [minValue - padding, maxValue + padding];
}

interface AreaChartCoreProps {
    width: number;
    height: number;
    data: Record<string, unknown>[];
    margin: Margin;
    locale: string;
    children: ReactNode;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const AreaChartCore = memo(function AreaChartCore({
    width,
    height,
    data,
    margin,
    locale,
    children,
    containerRef,
}: AreaChartCoreProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [revealEpoch, setRevealEpoch] = useState(0);

    const lines = useMemo(() => extractAreaConfigs(children), [children]);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = useMemo(() => {
        const timeExtent = extent(data, (d) => xAccessor(d).getTime());
        const minTime = timeExtent[0] ?? 0;
        const maxTime = timeExtent[1] ?? minTime;

        return scaleTime({
            range: [0, innerWidth],
            domain: [minTime, maxTime],
        });
    }, [innerWidth, data]);

    const renderData = useMemo(() => {
        const valueKeys = lines.map((line) => line.dataKey);
        return decimateTimeSeries(
            data,
            maxRenderPointsForWidth(innerWidth),
            valueKeys
        );
    }, [data, innerWidth, lines]);

    const yScale = useMemo(() => {
        const dataKeys = lines.map((line) => line.dataKey);

        return scaleLinear({
            range: [innerHeight, 0],
            domain: resolveYDomain(data, dataKeys),
            nice: true,
        });
    }, [innerHeight, data, lines]);

    const dateLabels = useMemo(() => {
        const fmt = getShortDateFmt(locale);
        return data.map((d) => fmt.format(xAccessor(d)));
    }, [data, locale]);

    useEffect(() => {
        setRevealEpoch((n) => n + 1);
        setIsLoaded(false);
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, ANIMATION_DURATION_MS);
        return () => clearTimeout(timer);
    }, []);

    const { tooltipData, selection, interactionHandlers, interactionStyle } =
        useChartInteraction({
            xScale,
            yScale,
            data,
            lines,
            margin,
            xAccessor,
            bisectDate,
            canInteract: isLoaded,
        });

    const contextValue = useMemo(
        () => ({
            data,
            renderData,
            xScale,
            yScale,
            width,
            innerWidth,
            innerHeight,
            margin,
            tooltipData,
            containerRef,
            lines,
            isLoaded,
            revealEpoch,
            xAccessor,
            dateLabels,
            locale,
            selection,
        }),
        [
            data,
            renderData,
            xScale,
            yScale,
            width,
            innerWidth,
            innerHeight,
            margin,
            tooltipData,
            containerRef,
            lines,
            isLoaded,
            revealEpoch,
            dateLabels,
            locale,
            selection,
        ]
    );

    // One shared reveal clip for every series: a single motion-driven width
    // animation, with all series referencing the same `<clipPath>`.
    const showReveal = renderData.length > 1 && innerWidth > 0;

    return (
        <ChartProvider value={contextValue}>
            <svg aria-hidden="true" height={height} width={width}>
                <defs>
                    {showReveal ? (
                        <clipPath id="chart-area-grow-clip">
                            {/* Bleeds past the plot so edge dots and line caps are not cut in half. */}
                            <motion.rect
                                animate={{ width: innerWidth + 2 * EDGE_BLEED }}
                                height={innerHeight + 20}
                                initial={{ width: 0 }}
                                key={`reveal-${revealEpoch}`}
                                transition={{
                                    type: "tween",
                                    duration: ANIMATION_DURATION_MS / 1000,
                                }}
                                width={innerWidth + 2 * EDGE_BLEED}
                                x={-EDGE_BLEED}
                                y={0}
                            />
                        </clipPath>
                    ) : null}
                </defs>

                <rect
                    fill="transparent"
                    height={height}
                    width={width}
                    x={0}
                    y={0}
                />

                <g
                    {...interactionHandlers}
                    style={interactionStyle}
                    transform={`translate(${margin.left},${margin.top})`}
                >
                    <rect
                        fill="transparent"
                        height={innerHeight}
                        width={innerWidth}
                        x={0}
                        y={0}
                    />

                    {showReveal ? (
                        <g clipPath="url(#chart-area-grow-clip)">{children}</g>
                    ) : (
                        children
                    )}
                </g>
            </svg>
        </ChartProvider>
    );
});

export function AreaChart({
    data,
    margin,
    className,
    locale = "en-US",
    children,
}: AreaChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className={clsx(styles.chartRoot, className)}
            ref={containerRef}
            style={{ aspectRatio: "2 / 1", touchAction: "none" }}
        >
            <ParentSize debounceTime={10}>
                {({ width, height }) =>
                    width < 10 || height < 10 ? null : (
                        <AreaChartCore
                            containerRef={containerRef}
                            data={data}
                            height={height}
                            locale={locale}
                            margin={margin}
                            width={width}
                        >
                            {children}
                        </AreaChartCore>
                    )
                }
            </ParentSize>
        </div>
    );
}
