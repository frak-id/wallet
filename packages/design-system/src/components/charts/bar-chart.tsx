import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import clsx from "clsx";
import {
    Children,
    isValidElement,
    memo,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ANIMATION_DURATION_MS } from "./animation";
import { Bar, type BarProps } from "./bar";
import { ChartProvider, type LineConfig, type Margin } from "./chart-context";
import * as styles from "./charts.css";
import { useScheduledTooltip } from "./use-scheduled-tooltip";

export interface BarChartProps {
    /** One item per x position, keyed by `label`, plus the numeric series. */
    data: ({ label: string } & Record<string, unknown>)[];
    /** Chart margins */
    margin: Margin;
    /** Additional class name for the container */
    className?: string;
    /** BCP-47 locale for number formatting in the tooltip. Default "en-US". */
    locale?: string;
    /** Child components (Bar, ChartTooltip, etc.) */
    children: ReactNode;
}

const BAR_WIDTH = 16;
const BAR_GAP = 0.2;

function categoryAccessor(d: Record<string, unknown>): string {
    return String(d.label ?? "");
}

function xAccessorDate(d: Record<string, unknown>): Date {
    const value = d.label;
    if (value instanceof Date) {
        return value;
    }
    return new Date();
}

function extractBarConfigs(children: ReactNode): LineConfig[] {
    const configs: LineConfig[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child) || child.type !== Bar) {
            return;
        }

        const props = child.props as BarProps;
        configs.push({ dataKey: props.dataKey, stroke: props.fill });
    });

    return configs;
}

interface BarChartCoreProps {
    width: number;
    height: number;
    data: Record<string, unknown>[];
    margin: Margin;
    locale: string;
    children: ReactNode;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const BarChartCore = memo(function BarChartCore({
    width,
    height,
    data,
    margin,
    locale,
    children,
    containerRef,
}: BarChartCoreProps) {
    const { tooltipData, scheduleTooltip, clearTooltip } =
        useScheduledTooltip();
    const [isLoaded, setIsLoaded] = useState(false);
    const [revealEpoch, setRevealEpoch] = useState(0);
    const hoveredBarIndex = tooltipData?.index ?? null;

    const lines = useMemo(() => extractBarConfigs(children), [children]);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const categoryScale = useMemo(() => {
        const domain = data.map((d) => categoryAccessor(d));
        return scaleBand<string>({
            range: [0, innerWidth],
            domain,
            padding: BAR_GAP,
        });
    }, [innerWidth, data]);

    const maxValue = useMemo(() => {
        let max = 0;
        for (const line of lines) {
            for (const d of data) {
                const value = d[line.dataKey];
                if (typeof value === "number" && value > max) {
                    max = value;
                }
            }
        }
        return max || 100;
    }, [data, lines]);

    const valueScale = useMemo(
        () =>
            scaleLinear({
                range: [innerHeight, 0],
                domain: [0, maxValue * 1.1],
                nice: true,
            }),
        [innerHeight, maxValue]
    );

    const columnWidth = useMemo(() => {
        if (data.length < 1) {
            return 0;
        }
        return innerWidth / data.length;
    }, [innerWidth, data.length]);

    const dateLabels = useMemo(
        () => data.map((d) => categoryAccessor(d)),
        [data]
    );

    // Create a fake time scale for compatibility with ChartContext
    const fakeTimeScale = useMemo(() => {
        const now = Date.now();
        const start = now - data.length * 24 * 60 * 60 * 1000;
        const scale = {
            ...categoryScale,
            domain: () => [new Date(start), new Date(now)],
            range: () => [0, innerWidth] as [number, number],
            invert: (x: number) =>
                new Date(start + (x / innerWidth) * (now - start)),
            copy: () => scale,
        };
        return scale;
    }, [categoryScale, innerWidth, data.length]);

    useEffect(() => {
        setRevealEpoch((n) => n + 1);
        setIsLoaded(false);
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, ANIMATION_DURATION_MS);
        return () => clearTimeout(timer);
    }, []);

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<SVGGElement>) => {
            const point = localPoint(event);
            if (!point) {
                return;
            }

            const pos = point.x - margin.left;

            // Find which band the mouse is over
            const bandIndex = Math.floor(pos / columnWidth);
            const clampedIndex = Math.max(
                0,
                Math.min(data.length - 1, bandIndex)
            );
            const d = data[clampedIndex];

            if (!d) {
                return;
            }

            const yPositions: Record<string, number> = {};
            const xPositions: Record<string, number> = {};
            const barPos = categoryScale(categoryAccessor(d)) ?? 0;

            const seriesCount = lines.length;
            const groupGap = seriesCount > 1 ? 4 : 0;
            const individualBarWidth =
                seriesCount > 0
                    ? (BAR_WIDTH - groupGap * (seriesCount - 1)) / seriesCount
                    : BAR_WIDTH;

            lines.forEach((line, idx) => {
                const value = d[line.dataKey];
                if (typeof value === "number") {
                    yPositions[line.dataKey] = valueScale(value) ?? 0;
                    xPositions[line.dataKey] =
                        barPos +
                        idx * (individualBarWidth + groupGap) +
                        individualBarWidth / 2;
                }
            });

            scheduleTooltip({
                point: d,
                index: clampedIndex,
                x: barPos + BAR_WIDTH / 2,
                yPositions,
                xPositions:
                    Object.keys(xPositions).length > 0 ? xPositions : undefined,
            });
        },
        [
            categoryScale,
            valueScale,
            data,
            lines,
            margin.left,
            columnWidth,
            scheduleTooltip,
        ]
    );

    const contextValue = {
        data,
        renderData: data,
        xScale: fakeTimeScale as unknown as ReturnType<
            typeof import("@visx/scale").scaleTime<number>
        >,
        yScale: valueScale,
        width,
        innerWidth,
        innerHeight,
        margin,
        tooltipData,
        containerRef,
        lines,
        isLoaded,
        revealEpoch,
        xAccessor: xAccessorDate,
        dateLabels,
        locale,
        barScale: categoryScale,
        bandWidth: BAR_WIDTH,
        hoveredBarIndex,
        barXAccessor: categoryAccessor,
    };

    return (
        <ChartProvider value={contextValue}>
            <svg aria-hidden="true" height={height} width={width}>
                <rect
                    fill="transparent"
                    height={height}
                    width={width}
                    x={0}
                    y={0}
                />

                <g
                    onMouseLeave={isLoaded ? clearTooltip : undefined}
                    onMouseMove={isLoaded ? handleMouseMove : undefined}
                    style={{ cursor: isLoaded ? "crosshair" : "default" }}
                    transform={`translate(${margin.left},${margin.top})`}
                >
                    {/* Background rect for mouse event detection */}
                    <rect
                        fill="transparent"
                        height={innerHeight}
                        width={innerWidth}
                        x={0}
                        y={0}
                    />

                    {children}
                </g>
            </svg>
        </ChartProvider>
    );
});

export function BarChart({
    data,
    margin,
    className,
    locale = "en-US",
    children,
}: BarChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className={clsx(styles.chartRoot, className)}
            ref={containerRef}
            style={{ aspectRatio: "2 / 1" }}
        >
            <ParentSize debounceTime={10}>
                {({ width, height }) =>
                    width < 10 || height < 10 ? null : (
                        <BarChartCore
                            containerRef={containerRef}
                            data={data}
                            height={height}
                            locale={locale}
                            margin={margin}
                            width={width}
                        >
                            {children}
                        </BarChartCore>
                    )
                }
            </ParentSize>
        </div>
    );
}

BarChart.displayName = "BarChart";
