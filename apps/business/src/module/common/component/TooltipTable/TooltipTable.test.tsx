import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipTable } from "./index";

describe("TooltipTable", () => {
    it("should render children", () => {
        render(
            <TooltipTable content="Tooltip content">
                <span>Hover me</span>
            </TooltipTable>
        );

        expect(screen.getByText("Hover me")).toBeInTheDocument();
    });

    it("should show tooltip on mouse over", () => {
        render(
            <TooltipTable content="Tooltip content">
                <span>Hover me</span>
            </TooltipTable>
        );

        const trigger = screen.getByText("Hover me");
        fireEvent.mouseOver(trigger);

        expect(screen.getByText("Tooltip content")).toBeInTheDocument();
    });

    it("should hide tooltip on mouse leave", () => {
        render(
            <TooltipTable content="Tooltip content">
                <span>Hover me</span>
            </TooltipTable>
        );

        const trigger = screen.getByText("Hover me");
        fireEvent.mouseOver(trigger);
        expect(screen.getByText("Tooltip content")).toBeInTheDocument();

        const tooltip = screen.getByText("Tooltip content");
        fireEvent.mouseLeave(tooltip);

        expect(screen.queryByText("Tooltip content")).not.toBeInTheDocument();
    });

    it("should render ReactNode content", () => {
        render(
            <TooltipTable
                content={<span data-testid="custom-content">Custom</span>}
            >
                <span>Hover me</span>
            </TooltipTable>
        );

        const trigger = screen.getByText("Hover me");
        fireEvent.mouseOver(trigger);

        expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });

    it("should render tooltip with CSS module class", () => {
        render(
            <TooltipTable content="Tooltip">
                <span>Hover me</span>
            </TooltipTable>
        );

        const trigger = screen.getByText("Hover me");
        fireEvent.mouseOver(trigger);

        const tooltip = screen.getByText("Tooltip");
        // Tooltip should have a class applied (CSS module)
        expect(tooltip).toHaveAttribute("class");
        expect(tooltip.className).toBeTruthy();
    });
});
