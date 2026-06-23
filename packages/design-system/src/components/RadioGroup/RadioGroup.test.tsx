/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup, RadioGroupItem } from "./index";
import { radioGroupItem, radioGroupItemLarge } from "./radioGroup.css";

describe("RadioGroup", () => {
    it("should render its items", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        expect(screen.getAllByRole("radio")).toHaveLength(2);
    });

    it("should mark the default value as checked", () => {
        render(
            <RadioGroup defaultValue="a">
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        const [first, second] = screen.getAllByRole("radio");
        expect(first).toBeChecked();
        expect(second).not.toBeChecked();
    });

    it("should check an item when clicked", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        const [, second] = screen.getAllByRole("radio");
        fireEvent.click(second);
        expect(second).toBeChecked();
    });

    it("should call onValueChange when an item is selected", () => {
        const onValueChange = vi.fn();
        render(
            <RadioGroup onValueChange={onValueChange}>
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" />
            </RadioGroup>
        );
        fireEvent.click(screen.getAllByRole("radio")[1]);
        expect(onValueChange).toHaveBeenCalledWith("b");
    });

    it("should not check a disabled item", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="a" disabled />
            </RadioGroup>
        );
        const radio = screen.getByRole("radio");
        expect(radio).toBeDisabled();
        fireEvent.click(radio);
        expect(radio).not.toBeChecked();
    });

    it("should apply a custom className to group and item", () => {
        const { container } = render(
            <RadioGroup className="custom-group">
                <RadioGroupItem value="a" className="custom-item" />
            </RadioGroup>
        );
        expect(container.querySelector(".custom-group")).toBeInTheDocument();
        expect(screen.getByRole("radio")).toHaveClass("custom-item");
    });

    it("should only add the large size class when size is l", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="a" />
                <RadioGroupItem value="b" size="l" />
            </RadioGroup>
        );
        const [medium, large] = screen.getAllByRole("radio");
        expect(medium).toHaveClass(radioGroupItem);
        expect(medium).not.toHaveClass(radioGroupItemLarge);
        expect(large).toHaveClass(radioGroupItem, radioGroupItemLarge);
    });

    it("should reflect data-state on the checked item", () => {
        render(
            <RadioGroup defaultValue="a">
                <RadioGroupItem value="a" />
            </RadioGroup>
        );
        expect(screen.getByRole("radio")).toHaveAttribute(
            "data-state",
            "checked"
        );
    });
});
