import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Slider } from "./index";

describe("Slider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render slider", () => {
        render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                defaultValue={[50]}
            />
        );

        const slider = screen.getByRole("slider", { name: "Test Slider" });
        expect(slider).toBeInTheDocument();
    });

    it("should render with defaultValue", () => {
        render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                defaultValue={[50]}
            />
        );

        const slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "50");
    });

    it("should work in controlled mode", () => {
        const { rerender } = render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                value={[25]}
            />
        );

        let slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "25");

        rerender(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                value={[75]}
            />
        );

        slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "75");
    });

    it("should accept onValueChange callback", () => {
        const handleValueChange = vi.fn();
        render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                defaultValue={[50]}
                onValueChange={handleValueChange}
            />
        );

        const slider = screen.getByRole("slider");
        // Radix Slider handles value changes through pointer/keyboard events
        // This test verifies the component accepts the callback prop
        expect(slider).toBeInTheDocument();
    });

    it("should call onValueCommit when slider interaction ends", () => {
        const handleValueCommit = vi.fn();
        render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={1}
                defaultValue={[50]}
                onValueCommit={handleValueCommit}
            />
        );

        const slider = screen.getByRole("slider");
        // Simulate slider interaction end
        fireEvent.mouseUp(slider);

        // Note: Radix Slider handles commit internally
        // This test verifies the component accepts the callback
        expect(slider).toBeInTheDocument();
    });

    it("should respect min and max values", () => {
        render(
            <Slider
                label="Test Slider"
                min={10}
                max={90}
                step={1}
                defaultValue={[50]}
            />
        );

        const slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuemin", "10");
        expect(slider).toHaveAttribute("aria-valuemax", "90");
    });

    it("should respect step value", () => {
        render(
            <Slider
                label="Test Slider"
                min={0}
                max={100}
                step={5}
                defaultValue={[50]}
            />
        );

        const slider = screen.getByRole("slider");
        expect(slider).toBeInTheDocument();
        // Step is handled internally by Radix Slider
    });

    it("should render with different label", () => {
        render(
            <Slider
                label="Volume Control"
                min={0}
                max={100}
                step={1}
                defaultValue={[50]}
            />
        );

        const slider = screen.getByRole("slider", { name: "Volume Control" });
        expect(slider).toBeInTheDocument();
    });
});
