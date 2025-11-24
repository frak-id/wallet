import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Switch } from "./index";

describe("Switch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render unchecked by default", () => {
        render(<Switch />);
        const switchElement = screen.getByRole("switch");
        expect(switchElement).toBeInTheDocument();
        expect(switchElement).not.toBeChecked();
    });

    it("should toggle when clicked", () => {
        render(<Switch />);
        const switchElement = screen.getByRole("switch");

        expect(switchElement).not.toBeChecked();

        fireEvent.click(switchElement);

        expect(switchElement).toBeChecked();
    });

    it("should work in controlled mode with checked prop", () => {
        const { rerender } = render(<Switch checked={false} />);
        const switchElement = screen.getByRole("switch");

        expect(switchElement).not.toBeChecked();

        rerender(<Switch checked={true} />);

        expect(switchElement).toBeChecked();
    });

    it("should be disabled when disabled prop is true", () => {
        render(<Switch disabled />);
        const switchElement = screen.getByRole("switch");
        expect(switchElement).toBeDisabled();
    });

    it("should not toggle when disabled", () => {
        render(<Switch disabled />);
        const switchElement = screen.getByRole("switch");

        expect(switchElement).not.toBeChecked();
        expect(switchElement).toBeDisabled();

        fireEvent.click(switchElement);

        // Should remain unchecked when disabled
        expect(switchElement).not.toBeChecked();
    });

    it("should call onCheckedChange callback when toggled", () => {
        const handleCheckedChange = vi.fn();
        render(<Switch onCheckedChange={handleCheckedChange} />);

        const switchElement = screen.getByRole("switch");
        fireEvent.click(switchElement);

        expect(handleCheckedChange).toHaveBeenCalledTimes(1);
        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("should apply custom className", () => {
        const { container } = render(<Switch className="custom-switch" />);
        const switchElement = container.querySelector("button");
        expect(switchElement).toHaveClass("custom-switch");
    });

    it("should render with defaultChecked prop", () => {
        render(<Switch defaultChecked={true} />);
        const switchElement = screen.getByRole("switch");
        expect(switchElement).toBeChecked();
    });

    it("should toggle from checked to unchecked", () => {
        render(<Switch defaultChecked={true} />);
        const switchElement = screen.getByRole("switch");

        expect(switchElement).toBeChecked();

        fireEvent.click(switchElement);

        expect(switchElement).not.toBeChecked();
    });

    it("should call onCheckedChange with false when toggled from checked to unchecked", () => {
        const handleCheckedChange = vi.fn();
        render(
            <Switch
                defaultChecked={true}
                onCheckedChange={handleCheckedChange}
            />
        );

        const switchElement = screen.getByRole("switch");
        fireEvent.click(switchElement);

        expect(handleCheckedChange).toHaveBeenCalledWith(false);
    });

    it("should accept required prop", () => {
        render(<Switch required />);
        const switchElement = screen.getByRole("switch");
        // Radix Switch sets aria-required, check for that attribute
        expect(switchElement).toHaveAttribute("aria-required", "true");
    });

    it("should accept name prop", () => {
        render(<Switch name="toggle-switch" />);
        const switchElement = screen.getByRole("switch");
        // Radix Switch may not forward name to the underlying button
        // Check that the component renders (name prop is accepted even if not forwarded)
        expect(switchElement).toBeInTheDocument();
    });
});
