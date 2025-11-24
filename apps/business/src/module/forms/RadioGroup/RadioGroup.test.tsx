import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadioGroup, RadioGroupItem } from "./index";

vi.mock("@radix-ui/react-radio-group", () => ({
    Root: ({ children, className, ...props }: any) => (
        <div data-testid="radio-group" className={className} {...props}>
            {children}
        </div>
    ),
    Item: ({ children, className, value, ...props }: any) => (
        <div
            data-testid="radio-item"
            className={className}
            data-value={value}
            {...props}
        >
            {children}
        </div>
    ),
    Indicator: ({ className }: any) => (
        <span data-testid="radio-indicator" className={className} />
    ),
}));

describe("RadioGroup", () => {
    it("should render children", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="option1" />
            </RadioGroup>
        );

        expect(screen.getByTestId("radio-group")).toBeInTheDocument();
        expect(screen.getByTestId("radio-item")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(
            <RadioGroup className="custom-radio-group">
                <RadioGroupItem value="option1" />
            </RadioGroup>
        );

        const group = screen.getByTestId("radio-group");
        expect(group.className).toContain("custom-radio-group");
    });

    it("should render multiple radio items", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="option1" />
                <RadioGroupItem value="option2" />
            </RadioGroup>
        );

        const items = screen.getAllByTestId("radio-item");
        expect(items).toHaveLength(2);
    });
});

describe("RadioGroupItem", () => {
    it("should render radio item", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="option1" />
            </RadioGroup>
        );

        const item = screen.getByTestId("radio-item");
        expect(item).toBeInTheDocument();
        expect(item).toHaveAttribute("data-value", "option1");
    });

    it("should render indicator", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="option1" />
            </RadioGroup>
        );

        // Indicator is rendered inside the Item
        expect(screen.getByTestId("radio-indicator")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(
            <RadioGroup>
                <RadioGroupItem value="option1" className="custom-item" />
            </RadioGroup>
        );

        const item = screen.getByTestId("radio-item");
        expect(item.className).toContain("custom-item");
    });
});
