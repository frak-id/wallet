/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./index";

describe("Checkbox", () => {
    it("should render as unchecked by default", () => {
        render(<Checkbox />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
    });

    it("should render as checked when defaultChecked is true", () => {
        render(<Checkbox defaultChecked={true} />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toBeChecked();
    });

    it("should toggle when clicked", () => {
        render(<Checkbox />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
    });

    it("should work in controlled mode", () => {
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

        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it("should call onCheckedChange callback when toggled", () => {
        const handleCheckedChange = vi.fn();
        render(<Checkbox onCheckedChange={handleCheckedChange} />);

        fireEvent.click(screen.getByRole("checkbox"));
        expect(handleCheckedChange).toHaveBeenCalledOnce();
        expect(handleCheckedChange).toHaveBeenCalledWith(true);
    });

    it("should apply custom className", () => {
        const { container } = render(<Checkbox className="custom-check" />);
        const checkbox = container.querySelector("button");
        expect(checkbox).toHaveClass("custom-check");
    });

    it("should have data-state attribute reflecting checked state", () => {
        const { rerender } = render(<Checkbox checked={false} />);
        const checkbox = screen.getByRole("checkbox");
        expect(checkbox).toHaveAttribute("data-state", "unchecked");

        rerender(<Checkbox checked={true} />);
        expect(checkbox).toHaveAttribute("data-state", "checked");
    });
});
