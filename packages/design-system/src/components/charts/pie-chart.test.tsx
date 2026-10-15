/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";
import { PieSliceLabels } from "./pie-slice-labels";

const segments = [
    { label: "Merchant site", value: 60, color: "rgb(1, 1, 1)" },
    { label: "Wallet app", value: 30, color: "rgb(2, 2, 2)" },
    { label: "Other", value: 10, color: "rgb(3, 3, 3)" },
];

type ControlledProps = {
    data?: typeof segments;
    onHoverChange?: (index: number | null) => void;
};

function ControlledPie({ data = segments, onHoverChange }: ControlledProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    return (
        <PieChart
            data={data}
            hoveredIndex={hoveredIndex}
            onHoverChange={(index) => {
                onHoverChange?.(index);
                setHoveredIndex(index);
            }}
        >
            {data.map((segment, i) => (
                <PieSlice index={i} key={segment.label} />
            ))}
            <PieSliceLabels />
        </PieChart>
    );
}

function hitboxes(container: HTMLElement) {
    return Array.from(container.querySelectorAll('path[fill="transparent"]'));
}

function visibleSlices(container: HTMLElement) {
    return segments.map((segment) =>
        container.querySelector(`path[fill="${segment.color}"]`)
    );
}

function labelOpacities(container: HTMLElement) {
    return Array.from(container.querySelectorAll("text")).map((text) =>
        text.getAttribute("fill-opacity")
    );
}

describe("PieChart", () => {
    it("renders one slice per datum", () => {
        const { container } = render(<ControlledPie />);

        expect(hitboxes(container)).toHaveLength(3);
        expect(visibleSlices(container).every(Boolean)).toBe(true);
    });

    it("renders no slice for an index outside the data", () => {
        const { container } = render(
            <PieChart
                data={segments}
                hoveredIndex={null}
                onHoverChange={vi.fn()}
            >
                <PieSlice index={7} />
            </PieChart>
        );

        expect(hitboxes(container)).toHaveLength(0);
    });

    it("labels each slice with its rounded share of the total", () => {
        render(<ControlledPie />);

        expect(screen.getByText("60%")).toBeInTheDocument();
        expect(screen.getByText("30%")).toBeInTheDocument();
        expect(screen.getByText("10%")).toBeInTheDocument();
    });

    it("rounds shares that do not divide evenly", () => {
        render(
            <ControlledPie
                data={[
                    { label: "A", value: 1, color: "rgb(1, 1, 1)" },
                    { label: "B", value: 2, color: "rgb(2, 2, 2)" },
                ]}
            />
        );

        expect(screen.getByText("33%")).toBeInTheDocument();
        expect(screen.getByText("67%")).toBeInTheDocument();
    });

    it("leaves slices under 5% unlabelled", () => {
        render(
            <ControlledPie
                data={[
                    { label: "A", value: 96, color: "rgb(1, 1, 1)" },
                    { label: "B", value: 4, color: "rgb(2, 2, 2)" },
                ]}
            />
        );

        expect(screen.getByText("96%")).toBeInTheDocument();
        expect(screen.queryByText("4%")).not.toBeInTheDocument();
    });

    it("renders no labels when every value is zero", () => {
        render(
            <ControlledPie
                data={[
                    { label: "A", value: 0, color: "rgb(1, 1, 1)" },
                    { label: "B", value: 0, color: "rgb(2, 2, 2)" },
                ]}
            />
        );

        expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it("reports the slice index when the pointer enters a slice", () => {
        const onHoverChange = vi.fn();
        const { container } = render(
            <ControlledPie onHoverChange={onHoverChange} />
        );

        fireEvent.mouseEnter(hitboxes(container)[1]);

        expect(onHoverChange).toHaveBeenCalledTimes(1);
        expect(onHoverChange).toHaveBeenCalledWith(1);
    });

    it("reports null when the pointer leaves a slice", () => {
        const onHoverChange = vi.fn();
        const { container } = render(
            <ControlledPie onHoverChange={onHoverChange} />
        );
        const slice = hitboxes(container)[2];

        fireEvent.mouseEnter(slice);
        fireEvent.mouseLeave(slice);

        expect(onHoverChange).toHaveBeenLastCalledWith(null);
    });

    it("dims every label but the hovered slice's", () => {
        const { container } = render(<ControlledPie />);
        expect(labelOpacities(container)).toEqual(["1", "1", "1"]);

        fireEvent.mouseEnter(hitboxes(container)[0]);

        expect(labelOpacities(container)).toEqual(["1", "0.4", "0.4"]);
    });

    it("moves only the hovered slice's label outwards", () => {
        const { container } = render(<ControlledPie />);
        const labelShifts = () =>
            Array.from(container.querySelectorAll("text")).map(
                (text) => text.parentElement?.style.transform
            );
        expect(labelShifts()).toEqual([
            "translate(0px, 0px)",
            "translate(0px, 0px)",
            "translate(0px, 0px)",
        ]);

        fireEvent.mouseEnter(hitboxes(container)[1]);

        const [first, second, third] = labelShifts();
        expect(second).not.toBe("translate(0px, 0px)");
        expect(first).toBe("translate(0px, 0px)");
        expect(third).toBe("translate(0px, 0px)");
    });

    it("reflects a hoveredIndex set by the parent without any pointer event", () => {
        const { container, rerender } = render(
            <PieChart data={segments} hoveredIndex={2} onHoverChange={vi.fn()}>
                <PieSlice index={0} />
                <PieSliceLabels />
            </PieChart>
        );
        expect(labelOpacities(container)).toEqual(["0.4", "0.4", "1"]);

        rerender(
            <PieChart
                data={segments}
                hoveredIndex={null}
                onHoverChange={vi.fn()}
            >
                <PieSlice index={0} />
                <PieSliceLabels />
            </PieChart>
        );

        expect(labelOpacities(container)).toEqual(["1", "1", "1"]);
    });

    it("fades the other slices while one is hovered", async () => {
        const { container } = render(<ControlledPie />);

        fireEvent.mouseEnter(hitboxes(container)[0]);

        await waitFor(() =>
            expect(
                visibleSlices(container).map((slice) =>
                    Number(
                        slice
                            ?.getAttribute("style")
                            ?.match(/opacity: ([\d.]+)/)?.[1]
                    )
                )
            ).toEqual([1, 0.4, 0.4])
        );
    });
});
