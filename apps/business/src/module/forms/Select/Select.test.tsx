import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "./index";

vi.mock("@radix-ui/react-select", () => ({
    Root: ({ children, ...props }: any) => (
        <div data-testid="select-root" {...props}>
            {children}
        </div>
    ),
    Group: ({ children, ...props }: any) => (
        <div data-testid="select-group" {...props}>
            {children}
        </div>
    ),
    Value: ({ placeholder }: any) => (
        <span data-testid="select-value">{placeholder}</span>
    ),
    Trigger: ({ children, className, ...props }: any) => (
        <button data-testid="select-trigger" className={className} {...props}>
            {children}
        </button>
    ),
    Icon: ({ children }: any) => (
        <span data-testid="select-icon">{children}</span>
    ),
    Portal: ({ children }: any) => (
        <div data-testid="select-portal">{children}</div>
    ),
    Content: ({ children, className, position }: any) => (
        <div
            data-testid="select-content"
            className={className}
            data-position={position}
        >
            {children}
        </div>
    ),
    Viewport: ({ children, className }: any) => (
        <div data-testid="select-viewport" className={className}>
            {children}
        </div>
    ),
    ScrollUpButton: ({ className }: any) => (
        <button
            type="button"
            data-testid="select-scroll-up"
            className={className}
        />
    ),
    ScrollDownButton: ({ className }: any) => (
        <button
            type="button"
            data-testid="select-scroll-down"
            className={className}
        />
    ),
    Label: ({ children, className }: any) => (
        <div data-testid="select-label" className={className}>
            {children}
        </div>
    ),
    Item: ({ children, className }: any) => (
        <div data-testid="select-item" className={className}>
            {children}
        </div>
    ),
    ItemIndicator: ({ children }: any) => (
        <span data-testid="select-item-indicator">{children}</span>
    ),
    ItemText: ({ children }: any) => (
        <span data-testid="select-item-text">{children}</span>
    ),
    Separator: ({ className }: any) => (
        <div data-testid="select-separator" className={className} />
    ),
}));

describe("Select", () => {
    it("should render root component", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
            </Select>
        );

        expect(screen.getByTestId("select-root")).toBeInTheDocument();
    });
});

describe("SelectTrigger", () => {
    it("should render trigger", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
            </Select>
        );

        expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
    });

    it("should render icon", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
            </Select>
        );

        expect(screen.getByTestId("select-icon")).toBeInTheDocument();
    });

    it("should apply length variant", () => {
        render(
            <Select>
                <SelectTrigger length="medium">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
            </Select>
        );

        const trigger = screen.getByTestId("select-trigger");
        expect(trigger.className).toBeTruthy();
    });

    it("should apply custom className", () => {
        render(
            <Select>
                <SelectTrigger className="custom-trigger">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
            </Select>
        );

        const trigger = screen.getByTestId("select-trigger");
        expect(trigger.className).toContain("custom-trigger");
    });
});

describe("SelectContent", () => {
    it("should render content in portal", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-portal")).toBeInTheDocument();
        expect(screen.getByTestId("select-content")).toBeInTheDocument();
    });

    it("should render scroll buttons", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-scroll-up")).toBeInTheDocument();
        expect(screen.getByTestId("select-scroll-down")).toBeInTheDocument();
    });

    it("should default position to popper", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        const content = screen.getByTestId("select-content");
        expect(content).toHaveAttribute("data-position", "popper");
    });
});

describe("SelectItem", () => {
    it("should render item", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-item")).toBeInTheDocument();
        expect(screen.getByText("Option 1")).toBeInTheDocument();
    });

    it("should render item indicator", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-item-indicator")).toBeInTheDocument();
    });
});

describe("SelectLabel", () => {
    it("should render label", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectLabel>Label</SelectLabel>
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-label")).toBeInTheDocument();
        expect(screen.getByText("Label")).toBeInTheDocument();
    });
});

describe("SelectSeparator", () => {
    it("should render separator", () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectSeparator />
                </SelectContent>
            </Select>
        );

        expect(screen.getByTestId("select-separator")).toBeInTheDocument();
    });
});
