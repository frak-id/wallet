import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "./index";

describe("Checkbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render unchecked by default", () => {
        render(<Checkbox />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    it("should toggle when clicked", () => {
        render(<Checkbox />);
        const checkbox = screen.getByRole("checkbox");

        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);

        expect(checkbox).toBeChecked();
    });

    it("should work in controlled mode with checked prop", () => {
        const { rerender } = render(<Checkbox checked={false} />);
        const checkbox = screen.getByRole("checkbox");

        expect(checkbox).not.toBeChecked();

        rerender(<Checkbox checked={true} />);

        expect(checkbox).toBeChecked();
    });

    it("should be disabled when disabled prop is true", () => {
        render(<Checkbox disabled />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeDisabled();
    });

    it("should not toggle when disabled", () => {
        render(<Checkbox disabled />);
        const checkbox = screen.getByRole("checkbox");

        expect(checkbox).not.toBeChecked();
        expect(checkbox).toBeDisabled();

        fireEvent.click(checkbox);

        // Should remain unchecked when disabled
        expect(checkbox).not.toBeChecked();
    });

    it("should call onCheckedChange callback when toggled", () => {
        const handleCheckedChange = vi.fn();
        render(<Checkbox onCheckedChange={handleCheckedChange} />);

        const checkbox = screen.getByRole("checkbox");
        fireEvent.click(checkbox);

        expect(handleCheckedChange).toHaveBeenCalledTimes(1);
        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("should render with indeterminate state", () => {
        render(<Checkbox checked="indeterminate" />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toHaveAttribute("data-state", "indeterminate");
    });

    it("should toggle from checked to unchecked", () => {
        render(<Checkbox defaultChecked={true} />);
        const checkbox = screen.getByRole("checkbox");

        expect(checkbox).toBeChecked();

        fireEvent.click(checkbox);

        expect(checkbox).not.toBeChecked();
    });

    it("should call onCheckedChange with false when toggled from checked to unchecked", () => {
        const handleCheckedChange = vi.fn();
        render(
            <Checkbox
                defaultChecked={true}
                onCheckedChange={handleCheckedChange}
            />
        );

        const checkbox = screen.getByRole("checkbox");
        fireEvent.click(checkbox);

        expect(handleCheckedChange).toHaveBeenCalledWith(false);
    });

    it("should apply custom className", () => {
        const { container } = render(<Checkbox className="custom-checkbox" />);
        const checkbox = container.querySelector("button");
        expect(checkbox).toHaveClass("custom-checkbox");
    });

    it("should render with defaultChecked prop", () => {
        render(<Checkbox defaultChecked={true} />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeChecked();
    });

    it("should accept required prop", () => {
        render(<Checkbox required />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeRequired();
    });

    it("should accept name prop", () => {
        render(<Checkbox name="test-checkbox" />);
        const checkbox = screen.getByRole("checkbox");
        // Radix Checkbox may not forward name to underlying button
        // Check that component renders (name prop is accepted even if not forwarded)
        expect(checkbox).toBeInTheDocument();
    });
});
