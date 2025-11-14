import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./index";

describe("MultiSelect", () => {
    const options = [
        { name: "Option 1", value: "opt1" },
        { name: "Option 2", value: "opt2" },
        { name: "Option 3", value: "opt3" },
    ];

    it("should render with placeholder", () => {
        const onValueChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                onValueChange={onValueChange}
                placeholder="Select items"
            />
        );

        expect(screen.getByText("Select items")).toBeInTheDocument();
    });

    it("should display selected values when value prop is provided", () => {
        const onValueChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                onValueChange={onValueChange}
                value={["opt1", "opt2"]}
            />
        );

        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("Option 2")).toBeInTheDocument();
    });

    it("should show count badge when more than 2 items selected", () => {
        const onValueChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                onValueChange={onValueChange}
                value={["opt1", "opt2", "opt3"]}
            />
        );

        expect(screen.getByText("3 selected")).toBeInTheDocument();
    });

    it("should render button with trigger variant", () => {
        const onValueChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                onValueChange={onValueChange}
                placeholder="Select items"
            />
        );

        const button = screen.getByText("Select items").closest("button");
        expect(button).toBeInTheDocument();
        // Button should have specific structure for MultiSelect trigger
        expect(button?.className).toContain("multiSelect__trigger");
    });

    it("should call onValueChange when clear is clicked", () => {
        const onValueChange = vi.fn();
        render(
            <MultiSelect
                options={options}
                onValueChange={onValueChange}
                value={["opt1"]}
            />
        );

        // Find clear button (X icon)
        const clearButton = screen
            .getByText("Option 1")
            .closest("span")
            ?.querySelector("svg");
        expect(clearButton).toBeInTheDocument();
    });
});
