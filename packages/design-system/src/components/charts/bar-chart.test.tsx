/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { BarXAxis } from "./bar-x-axis";
import * as styles from "./charts.css";
import { NumericYAxis } from "./numeric-y-axis";
import { ReferenceLine } from "./reference-line";
import { ChartTooltip } from "./tooltip/chart-tooltip";

const size = vi.hoisted(() => ({ width: 600, height: 180 }));

vi.mock("@visx/responsive", () => ({
    ParentSize: ({
        children,
    }: {
        children: (size: { width: number; height: number }) => ReactNode;
    }) => children(size),
}));

vi.mock("./animation", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./animation")>()),
    ANIMATION_DURATION_MS: 10,
}));

const margin = { top: 8, right: 44, bottom: 40, left: 8 };
const BAR_FILL = "rgb(10, 20, 30)";
const COLUMN_WIDTH = (600 - margin.left - margin.right) / 4;

const data = [
    { label: "Jan", value: 10 },
    { label: "Feb", value: 20 },
    { label: "Mar", value: 1234 },
    { label: "Apr", value: 40 },
];

function bars(container: HTMLElement) {
    return container.querySelectorAll(`rect[fill="${BAR_FILL}"]`);
}

function textsOf(container: HTMLElement, className: string) {
    return Array.from(container.querySelectorAll(`.${className}`)).map(
        (el) => el.textContent
    );
}

async function hoverColumn(container: HTMLElement, column: number) {
    const surface = container.querySelector("svg > g");
    if (!surface) {
        throw new Error("chart surface not found");
    }
    await waitFor(() => expect(surface).toHaveStyle({ cursor: "crosshair" }));
    fireEvent.mouseMove(surface, {
        clientX: margin.left + COLUMN_WIDTH * column + COLUMN_WIDTH / 2,
        clientY: 50,
    });
    return surface;
}

describe("BarChart", () => {
    afterEach(() => {
        size.width = 600;
        size.height = 180;
    });

    it("renders one bar per numeric data point", () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
            </BarChart>
        );

        expect(bars(container)).toHaveLength(4);
    });

    it("renders no bar for a non-numeric value", () => {
        const { container } = render(
            <BarChart
                data={[
                    { label: "Jan", value: 10 },
                    { label: "Feb", value: "n/a" },
                    { label: "Mar", value: null },
                    { label: "Apr", value: 40 },
                ]}
                margin={margin}
            >
                <Bar dataKey="value" fill={BAR_FILL} />
            </BarChart>
        );

        expect(bars(container)).toHaveLength(2);
    });

    it("renders nothing when the chart has no measurable size", () => {
        size.width = 0;
        size.height = 0;

        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
            </BarChart>
        );

        expect(container.querySelector("svg")).toBeNull();
    });

    it("shows the category labels on the x axis", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <BarXAxis />
            </BarChart>
        );

        await waitFor(() =>
            expect(textsOf(container, styles.xTickLabel)).toEqual([
                "Jan",
                "Feb",
                "Mar",
                "Apr",
            ])
        );
    });

    it("labels the y axis with the given ticks inside the data range, through the formatter", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <NumericYAxis
                    formatter={(v) => (v === 0 ? "0" : `${v / 1000}k`)}
                    ticks={[0, 1000, 5000]}
                />
            </BarChart>
        );

        await waitFor(() =>
            expect(textsOf(container, styles.yTickLabel)).toEqual(["0", "1k"])
        );
    });

    it("falls back to the scale's own ticks, printed as plain numbers", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <NumericYAxis />
            </BarChart>
        );

        await waitFor(() =>
            expect(textsOf(container, styles.yTickLabel)).toEqual([
                "0",
                "500",
                "1000",
            ])
        );
    });

    it("shows the reference line label", () => {
        render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ReferenceLine label="Avg 300 / month" y={300} />
            </BarChart>
        );

        expect(screen.getByText("Avg 300 / month")).toBeInTheDocument();
    });

    it("places the reference line at its value on the y scale", () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ReferenceLine y={0} />
                <ReferenceLine y={1400} />
            </BarChart>
        );

        const [zero, top] = Array.from(
            container.querySelectorAll("line[stroke-dasharray]")
        ).map((line) => Number(line.getAttribute("y1")));
        expect(zero).toBe(132);
        expect(top).toBe(0);
    });

    it("shows the hovered row's label and value formatted for the locale", async () => {
        const { container } = render(
            <BarChart data={data} locale="de-DE" margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        await hoverColumn(container, 2);

        expect(await screen.findByText("Mar")).toBeInTheDocument();
        expect(screen.getByText("Purchases")).toBeInTheDocument();
        expect(screen.getByText("1.234")).toBeInTheDocument();
    });

    it("formats the tooltip value with the default en-US locale", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        await hoverColumn(container, 2);

        expect(await screen.findByText("1,234")).toBeInTheDocument();
    });

    it("follows the pointer from one bar to another", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        await hoverColumn(container, 0);
        expect(await screen.findByText("Jan")).toBeInTheDocument();

        await hoverColumn(container, 1);
        expect(await screen.findByText("Feb")).toBeInTheDocument();
        expect(screen.queryByText("Jan")).not.toBeInTheDocument();
    });

    it("fades the bars other than the hovered one", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip rows={() => []} showDatePill={false} />
            </BarChart>
        );

        await hoverColumn(container, 1);

        await waitFor(() =>
            expect(
                Array.from(bars(container)).map((bar) =>
                    bar.getAttribute("opacity")
                )
            ).toEqual(["0.3", "1", "0.3", "0.3"])
        );
    });

    it("hides the tooltip when the pointer leaves", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        const surface = await hoverColumn(container, 2);
        expect(await screen.findByText("Purchases")).toBeInTheDocument();

        fireEvent.mouseLeave(surface);

        await waitFor(() =>
            expect(screen.queryByText("Purchases")).not.toBeInTheDocument()
        );
        expect(
            Array.from(bars(container)).map((bar) =>
                bar.getAttribute("opacity")
            )
        ).toEqual(["1", "1", "1", "1"]);
    });

    it("clamps a pointer past the last column to the last bar", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        await hoverColumn(container, 9);

        await waitFor(() =>
            expect(screen.getByText("Apr")).toBeInTheDocument()
        );
    });

    it("clamps a pointer left of the first column to the first bar", async () => {
        const { container } = render(
            <BarChart data={data} margin={margin}>
                <Bar dataKey="value" fill={BAR_FILL} />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: BAR_FILL,
                            label: "Purchases",
                            value: point.value as number,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        );

        await hoverColumn(container, -3);

        expect(await screen.findByText("Jan")).toBeInTheDocument();
    });
});
