import type { scaleBand, scaleLinear, scaleTime } from "@visx/scale";

type ScaleLinear<Output, _Input = number> = ReturnType<
    typeof scaleLinear<Output>
>;
type ScaleTime<Output, _Input = Date | number> = ReturnType<
    typeof scaleTime<Output>
>;
type ScaleBand<Domain extends { toString(): string }> = ReturnType<
    typeof scaleBand<Domain>
>;

import {
    createContext,
    type ReactNode,
    type RefObject,
    useContext,
    useMemo,
} from "react";
import type { ChartSelection } from "./use-chart-interaction";

export interface Margin {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface TooltipData {
    /** The data point being hovered */
    point: Record<string, unknown>;
    /** Index in the data array */
    index: number;
    /** X position in pixels (relative to chart area) */
    x: number;
    /** Y positions for each line, keyed by dataKey */
    yPositions: Record<string, number>;
    /** X positions for each series (for bars), keyed by dataKey */
    xPositions?: Record<string, number>;
}

export interface LineConfig {
    dataKey: string;
    stroke: string;
}

/**
 * Hover/selection state — every field here changes on mouse movement.
 * Lives in its own context so cold consumers (Grid, YAxis, …) can subscribe
 * to the stable slice and skip re-rendering on every hover.
 */
export interface ChartHoverContextValue {
    tooltipData: TooltipData | null;
    /** Current drag/pinch selection range (area chart) */
    selection?: ChartSelection | null;
    /** Index of currently hovered bar (bar chart) */
    hoveredBarIndex?: number | null;
}

export interface ChartContextValue extends ChartHoverContextValue {
    data: Record<string, unknown>[];
    /** Decimated subset for SVG path rendering; equals `data` when no decimation is needed. */
    renderData: Record<string, unknown>[];

    xScale: ScaleTime<number, number>;
    yScale: ScaleLinear<number, number>;

    width: number;
    innerWidth: number;
    innerHeight: number;
    margin: Margin;

    containerRef: RefObject<HTMLDivElement | null>;

    lines: LineConfig[];

    isLoaded: boolean;
    /** Increments when the enter animation should replay. */
    revealEpoch: number;

    xAccessor: (d: Record<string, unknown>) => Date;

    dateLabels: string[];

    /** BCP-47 locale for date/number formatting in axes & tooltip. */
    locale: string;

    // Bar chart only
    /** Band scale for the categorical x-axis */
    barScale?: ScaleBand<string>;
    /** Width of each bar band */
    bandWidth?: number;
    /** X accessor for bar charts (returns string instead of Date) */
    barXAccessor?: (d: Record<string, unknown>) => string;
}

/**
 * Stable slice of the chart context — everything that doesn't change on hover
 * (data, scales, dimensions, animation state). Consumers that subscribe via
 * `useChartStable()` skip re-renders on every mouse move.
 */
export type ChartStableContextValue = Omit<
    ChartContextValue,
    keyof ChartHoverContextValue
>;

const ChartStableContext = createContext<ChartStableContextValue | null>(null);
const ChartHoverContext = createContext<ChartHoverContextValue | null>(null);

/**
 * Splits the merged `value` into a stable slice and a volatile hover slice,
 * publishing each to its own context. Each slice is memoized on its own
 * field identities, so changing `tooltipData` does not bust the stable
 * slice — consumers of `useChartStable()` skip re-renders on hover.
 */
export function ChartProvider({
    children,
    value,
}: {
    children: ReactNode;
    value: ChartContextValue;
}) {
    const stable = useMemo<ChartStableContextValue>(
        () => ({
            data: value.data,
            renderData: value.renderData,
            xScale: value.xScale,
            yScale: value.yScale,
            width: value.width,
            innerWidth: value.innerWidth,
            innerHeight: value.innerHeight,
            margin: value.margin,
            containerRef: value.containerRef,
            lines: value.lines,
            isLoaded: value.isLoaded,
            revealEpoch: value.revealEpoch,
            xAccessor: value.xAccessor,
            dateLabels: value.dateLabels,
            locale: value.locale,
            barScale: value.barScale,
            bandWidth: value.bandWidth,
            barXAccessor: value.barXAccessor,
        }),
        [
            value.data,
            value.renderData,
            value.xScale,
            value.yScale,
            value.width,
            value.innerWidth,
            value.innerHeight,
            value.margin,
            value.containerRef,
            value.lines,
            value.isLoaded,
            value.revealEpoch,
            value.xAccessor,
            value.dateLabels,
            value.locale,
            value.barScale,
            value.bandWidth,
            value.barXAccessor,
        ]
    );

    const hover = useMemo<ChartHoverContextValue>(
        () => ({
            tooltipData: value.tooltipData,
            selection: value.selection,
            hoveredBarIndex: value.hoveredBarIndex,
        }),
        [value.tooltipData, value.selection, value.hoveredBarIndex]
    );

    return (
        <ChartStableContext.Provider value={stable}>
            <ChartHoverContext.Provider value={hover}>
                {children}
            </ChartHoverContext.Provider>
        </ChartStableContext.Provider>
    );
}

/**
 * Stable slice — data, scales, dimensions, animation state.
 * Subscribers skip re-renders on hover (the hover slice lives in a separate
 * context). Prefer this in cold consumers like axes and grid.
 */
export function useChartStable(): ChartStableContextValue {
    const context = useContext(ChartStableContext);
    if (!context) {
        throw new Error(
            "useChartStable must be used within a ChartProvider. " +
                "Make sure your component is wrapped in <AreaChart> or <BarChart>."
        );
    }
    return context;
}

/**
 * Hover slice — tooltipData, selection, hovered bar index.
 * Subscribers re-render on every mouse move. Use only when the component
 * actually reads hover state.
 */
export function useChartHover(): ChartHoverContextValue {
    const context = useContext(ChartHoverContext);
    if (!context) {
        throw new Error(
            "useChartHover must be used within a ChartProvider. " +
                "Make sure your component is wrapped in <AreaChart> or <BarChart>."
        );
    }
    return context;
}

/**
 * Merged stable + hover context. Re-renders on every hover, so prefer
 * `useChartStable()` or `useChartHover()` when only one slice is needed.
 */
export function useChart(): ChartContextValue {
    const stable = useChartStable();
    const hover = useChartHover();
    return { ...stable, ...hover };
}
