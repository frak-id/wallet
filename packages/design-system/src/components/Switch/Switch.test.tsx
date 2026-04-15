/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./index";

describe("Switch", () => {
    it("should render unchecked by default", () => {
        render(<Switch />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).toBeInTheDocument();
        expect(switchEl).not.toBeChecked();
    });

    it("should render checked when defaultChecked is true", () => {
        render(<Switch defaultChecked={true} />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).toBeChecked();
    });

    it("should toggle when clicked", () => {
        render(<Switch />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).not.toBeChecked();

        fireEvent.click(switchEl);
        expect(switchEl).toBeChecked();
    });

    it("should work in controlled mode", () => {
        const { rerender } = render(<Switch checked={false} />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).not.toBeChecked();

        rerender(<Switch checked={true} />);
        expect(switchEl).toBeChecked();
    });

    it("should be disabled when disabled prop is true", () => {
        render(<Switch disabled />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).toBeDisabled();
    });

    it("should not toggle when disabled", () => {
        render(<Switch disabled />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).not.toBeChecked();

        fireEvent.click(switchEl);
        expect(switchEl).not.toBeChecked();
    });

    it("should call onCheckedChange callback when toggled", () => {
        const handleCheckedChange = vi.fn();
        render(<Switch onCheckedChange={handleCheckedChange} />);

        fireEvent.click(screen.getByRole("switch"));
        expect(handleCheckedChange).toHaveBeenCalledOnce();
        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("should apply custom className", () => {
        const { container } = render(<Switch className="custom-switch" />);
        const switchEl = container.querySelector("button");
        expect(switchEl).toHaveClass("custom-switch");
    });

    it("should have data-state attribute reflecting checked state", () => {
        const { rerender } = render(<Switch checked={false} />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).toHaveAttribute("data-state", "unchecked");

        rerender(<Switch checked={true} />);
        expect(switchEl).toHaveAttribute("data-state", "checked");
    });

    it("should toggle from checked to unchecked", () => {
        render(<Switch defaultChecked={true} />);
        const switchEl = screen.getByRole("switch");
        expect(switchEl).toBeChecked();

        fireEvent.click(switchEl);
        expect(switchEl).not.toBeChecked();
    });
});
