/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Area } from "./area";
import { AreaChart } from "./area-chart";
import * as styles from "./charts.css";
import { Grid } from "./grid";
import { NumericYAxis } from "./numeric-y-axis";
import { ChartTooltip } from "./tooltip/chart-tooltip";
import { XAxis } from "./x-axis";

vi.mock("@visx/responsive", () => ({
    ParentSize: ({
        children,
    }: {
        children: (size: { width: number; height: number }) => ReactNode;
    }) => children({ width: 600, height: 180 }),
}));

vi.mock("./animation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./animation")>()),
    ANIMATION_DURATION_MS: 10,
}));

const margin = { top: 8, right: 44, bottom: 24, left: 8 };
const ACTUAL = "rgb(1, 2, 3)";
const FORECAST = "rgb(4, 5, 6)";
const INNER_WIDTH = 600 - margin.left - margin.right;

const data = [
    { date: new Date(2026, 0, 1), actual: 100 },
    { date: new Date(2026, 0, 2), actual: 200, forecast: 200 },
    { date: new Date(2026, 0, 3), forecast: 300 },
];

function seriesLines(container: HTMLElement, stroke: string) {
    return container.querySelectorAll(`path[stroke="${stroke}"]`);
}

function pathXs(path: Element | undefined) {
    const d = path?.getAttribute("d") ?? "";
    const ends =
        d.match(/[ML][^MLC]+|C(?:[^MLC,]+,[^MLC,]+,){2}[^MLC]+/g) ?? [];
    return ends.map((segment) => {
        const coords = segment.slice(1).split(",").map(Number);
        return coords[coords.length - 2];
    });
}

async function hoverAt(container: HTMLElement, fraction: number) {
    const surface = container.querySelector("svg > g");
    if (!surface) {
        throw new Error("chart surface not found");
    }
    await waitFor(() => expect(surface).toHaveStyle({ cursor: "crosshair" }));
    fireEvent.mouseMove(surface, {
        clientX: margin.left + INNER_WIDTH * fraction,
        clientY: 50,
    });
    return surface;
}

function renderProjectedRevenueChart({
    showDatePill,
}: {
    showDatePill?: boolean;
} = {}) {
    return render(
        <AreaChart data={data} margin={margin}>
            <Grid />
            <Area dataKey="actual" fill={ACTUAL} stroke={ACTUAL} />
            <Area dataKey="forecast" fill={FORECAST} stroke={FORECAST} />
            <XAxis />
            <NumericYAxis ticks={[0, 250, 1000]} />
            <ChartTooltip
                rows={(point) =>
                    [
                        point.actual != null
                            ? {
                                  color: ACTUAL,
                                  label: "Actual",
                                  value: point.actual as number,
                              }
                            : null,
                        point.forecast != null
                            ? {
                                  color: FORECAST,
                                  label: "Forecast",
                                  value: point.forecast as number,
                              }
                            : null,
                    ].filter((row) => row !== null)
                }
                showDatePill={showDatePill}
            />
        </AreaChart>
    );
}

describe("AreaChart", () => {
    it("draws one line per Area, in its own stroke", () => {
        const { container } = renderProjectedRevenueChart();

        expect(seriesLines(container, ACTUAL)).toHaveLength(1);
        expect(seriesLines(container, FORECAST)).toHaveLength(1);
    });

    it("draws no line for a series that no Area declares", () => {
        const { container } = render(
            <AreaChart data={data} margin={margin}>
                <Area dataKey="actual" fill={ACTUAL} stroke={ACTUAL} />
            </AreaChart>
        );

        expect(seriesLines(container, ACTUAL)).toHaveLength(1);
        expect(seriesLines(container, FORECAST)).toHaveLength(0);
    });

    it("ends a series line at its last value instead of dropping to the top", () => {
        const { container } = renderProjectedRevenueChart();

        expect(pathXs(seriesLines(container, ACTUAL)[0])).toEqual([
            0,
            INNER_WIDTH / 2,
        ]);
        expect(pathXs(seriesLines(container, FORECAST)[0])).toEqual([
            INNER_WIDTH / 2,
            INNER_WIDTH,
        ]);
    });

    it("puts a hover dot only on the series present at that point", async () => {
        const { container } = renderProjectedRevenueChart();

        await hoverAt(container, 1);

        await waitFor(() =>
            expect(container.querySelectorAll("circle[r='5']")).toHaveLength(1)
        );
    });

    it("labels the x axis with one short date per data point", async () => {
        const { container } = renderProjectedRevenueChart();

        await waitFor(() =>
            expect(
                Array.from(
                    container.querySelectorAll(`.${styles.xTickLabel}`)
                ).map((el) => el.textContent)
            ).toEqual(["Jan 1", "Jan 2", "Jan 3"])
        );
    });

    it("labels the y axis with the given ticks that fall inside the data range", async () => {
        const { container } = renderProjectedRevenueChart();

        await waitFor(() =>
            expect(
                Array.from(
                    container.querySelectorAll(`.${styles.yTickLabel}`)
                ).map((el) => el.textContent)
            ).toEqual(["0", "250"])
        );
    });

    it("marks a value that has no neighbour to draw a line to", () => {
        const { container } = render(
            <AreaChart
                data={[
                    { date: new Date(2026, 0, 1), actual: 100, forecast: 100 },
                    { date: new Date(2026, 1, 1), forecast: 300 },
                ]}
                margin={margin}
            >
                <Area dataKey="actual" fill={ACTUAL} stroke={ACTUAL} />
                <Area dataKey="forecast" fill={FORECAST} stroke={FORECAST} />
            </AreaChart>
        );

        expect(
            container.querySelectorAll(`circle[fill="${ACTUAL}"]`)
        ).toHaveLength(1);
        expect(
            container.querySelectorAll(`circle[fill="${FORECAST}"]`)
        ).toHaveLength(0);
    });

    it("shows only the series present at the first hovered point", async () => {
        const { container } = renderProjectedRevenueChart();

        await hoverAt(container, 0);

        expect(await screen.findByText("Actual")).toBeInTheDocument();
        expect(screen.getByText("100")).toBeInTheDocument();
        expect(screen.queryByText("Forecast")).not.toBeInTheDocument();
    });

    it("shows only the series present at the last hovered point", async () => {
        const { container } = renderProjectedRevenueChart();

        await hoverAt(container, 1);

        expect(await screen.findByText("Forecast")).toBeInTheDocument();
        expect(screen.getByText("300")).toBeInTheDocument();
        expect(screen.queryByText("Actual")).not.toBeInTheDocument();
    });

    it("shows both series where the seam point carries both", async () => {
        const { container } = renderProjectedRevenueChart();

        await hoverAt(container, 0.5);

        expect(await screen.findByText("Actual")).toBeInTheDocument();
        expect(screen.getByText("Forecast")).toBeInTheDocument();
        expect(screen.getAllByText("200")).toHaveLength(2);
    });

    it("titles the tooltip with the weekday and date of the hovered point", async () => {
        const { container } = renderProjectedRevenueChart();

        await hoverAt(container, 0.5);

        expect(await screen.findByText("Fri, Jan 2")).toBeInTheDocument();
    });

    it("shows the date pill while hovering and removes it afterwards", async () => {
        const { container } = renderProjectedRevenueChart();
        expect(screen.queryByText("Jan")).not.toBeInTheDocument();

        const surface = await hoverAt(container, 0.5);
        expect(await screen.findByText("Jan")).toBeInTheDocument();

        fireEvent.mouseLeave(surface);
        await waitFor(() =>
            expect(screen.queryByText("Jan")).not.toBeInTheDocument()
        );
        expect(screen.queryByText("Actual")).not.toBeInTheDocument();
    });

    it("omits the date pill when showDatePill is false", async () => {
        const { container } = renderProjectedRevenueChart({
            showDatePill: false,
        });

        await hoverAt(container, 0.5);

        expect(await screen.findByText("Actual")).toBeInTheDocument();
        expect(screen.queryByText("Jan")).not.toBeInTheDocument();
    });

    it("dims the series lines while hovering", async () => {
        const { container } = renderProjectedRevenueChart();
        const line = seriesLines(container, ACTUAL)[0];
        const dimmedGroup = line?.parentElement;

        await hoverAt(container, 0.5);

        await waitFor(() =>
            expect(Number(dimmedGroup?.style.opacity)).toBeLessThan(1)
        );
    });
});
