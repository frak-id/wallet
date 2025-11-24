import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./index";

vi.mock("@radix-ui/react-popover", () => ({
    Root: ({ children, ...props }: any) => (
        <div data-testid="popover-root" {...props}>
            {children}
        </div>
    ),
    Trigger: ({ children, ...props }: any) => (
        <button data-testid="popover-trigger" {...props}>
            {children}
        </button>
    ),
    Content: ({ children, className, align, sideOffset, ...props }: any) => (
        <div
            data-testid="popover-content"
            className={className}
            data-align={align}
            data-side-offset={sideOffset}
            {...props}
        >
            {children}
        </div>
    ),
    Portal: ({ children }: any) => <div data-testid="portal">{children}</div>,
}));

describe("Popover", () => {
    it("should render root component", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Content</PopoverContent>
            </Popover>
        );

        expect(screen.getByTestId("popover-root")).toBeInTheDocument();
    });
});

describe("PopoverTrigger", () => {
    it("should render trigger button", () => {
        render(
            <Popover>
                <PopoverTrigger>Open Popover</PopoverTrigger>
                <PopoverContent>Content</PopoverContent>
            </Popover>
        );

        expect(screen.getByTestId("popover-trigger")).toBeInTheDocument();
        expect(screen.getByText("Open Popover")).toBeInTheDocument();
    });
});

describe("PopoverContent", () => {
    it("should render content", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Popover content</PopoverContent>
            </Popover>
        );

        expect(screen.getByTestId("popover-content")).toBeInTheDocument();
        expect(screen.getByText("Popover content")).toBeInTheDocument();
    });

    it("should render in portal", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Content</PopoverContent>
            </Popover>
        );

        expect(screen.getByTestId("portal")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent className="custom-popover">
                    Content
                </PopoverContent>
            </Popover>
        );

        const content = screen.getByTestId("popover-content");
        expect(content.className).toContain("custom-popover");
    });

    it("should default align to center", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Content</PopoverContent>
            </Popover>
        );

        const content = screen.getByTestId("popover-content");
        expect(content).toHaveAttribute("data-align", "center");
    });

    it("should accept custom align prop", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent align="start">Content</PopoverContent>
            </Popover>
        );

        const content = screen.getByTestId("popover-content");
        expect(content).toHaveAttribute("data-align", "start");
    });

    it("should default sideOffset to 4", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>Content</PopoverContent>
            </Popover>
        );

        const content = screen.getByTestId("popover-content");
        expect(content).toHaveAttribute("data-side-offset", "4");
    });

    it("should accept custom sideOffset prop", () => {
        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent sideOffset={8}>Content</PopoverContent>
            </Popover>
        );

        const content = screen.getByTestId("popover-content");
        expect(content).toHaveAttribute("data-side-offset", "8");
    });
});
