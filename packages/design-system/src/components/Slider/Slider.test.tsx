import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from ".";

describe("Slider", () => {
    it("should render slider element", () => {
        render(<Slider label="Volume" min={0} max={100} defaultValue={[50]} />);
        expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
    });

    it("should render with defaultValue", () => {
        render(<Slider label="Volume" min={0} max={100} defaultValue={[50]} />);
        const slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "50");
    });

    it("should work in controlled mode", () => {
        const { rerender } = render(
            <Slider label="Volume" min={0} max={100} value={[25]} />
        );

        let slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "25");

        rerender(<Slider label="Volume" min={0} max={100} value={[75]} />);

        slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuenow", "75");
    });

    it("should respect min and max values", () => {
        render(<Slider label="Volume" min={10} max={90} defaultValue={[50]} />);
        const slider = screen.getByRole("slider");
        expect(slider).toHaveAttribute("aria-valuemin", "10");
        expect(slider).toHaveAttribute("aria-valuemax", "90");
    });

    it("should accept onValueChange callback", () => {
        const handleChange = vi.fn();
        render(
            <Slider
                label="Volume"
                min={0}
                max={100}
                defaultValue={[50]}
                onValueChange={handleChange}
            />
        );
        expect(screen.getByRole("slider")).toBeTruthy();
    });

    it("should accept onValueCommit callback", () => {
        const handleCommit = vi.fn();
        render(
            <Slider
                label="Volume"
                min={0}
                max={100}
                defaultValue={[50]}
                onValueCommit={handleCommit}
            />
        );
        expect(screen.getByRole("slider")).toBeTruthy();
    });

    it("should forward className", () => {
        const { container } = render(
            <Slider
                label="Volume"
                min={0}
                max={100}
                defaultValue={[50]}
                className="custom-slider"
            />
        );
        expect(container.querySelector(".custom-slider")).toBeTruthy();
    });

    it("should accept step prop", () => {
        render(
            <Slider
                label="Volume"
                min={0}
                max={100}
                step={5}
                defaultValue={[50]}
            />
        );
        expect(screen.getByRole("slider")).toBeTruthy();
    });
});
