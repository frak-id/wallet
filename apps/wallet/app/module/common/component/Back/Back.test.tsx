import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Back } from "./index";

vi.mock("react-router", async () => {
    const actual = await vi.importActual("react-router");
    return {
        ...actual,
        Link: ({ children, to, ...props }: any) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

describe("Back", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render as link when href is provided", () => {
        render(<Back href="/previous">Go back</Back>);

        const link = screen.getByRole("link", { name: "Go back" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/previous");
    });

    it("should render as button when onClick is provided", () => {
        const handleClick = vi.fn();
        render(<Back onClick={handleClick}>Go back</Back>);

        const button = screen.getByRole("button", { name: "Go back" });
        expect(button).toBeInTheDocument();
    });

    it("should call onClick when button is clicked", () => {
        const handleClick = vi.fn();
        render(<Back onClick={handleClick}>Go back</Back>);

        const button = screen.getByRole("button");
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
        render(
            <Back href="/previous" disabled>
                Go back
            </Back>
        );

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("aria-disabled", "true");
    });

    it("should not call onClick when disabled", () => {
        const handleClick = vi.fn();
        render(
            <Back onClick={handleClick} disabled>
                Go back
            </Back>
        );

        const button = screen.getByRole("button");
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("should render arrow icon", () => {
        const { container } = render(<Back href="/previous">Go back</Back>);

        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should render children", () => {
        render(<Back href="/previous">Custom back text</Back>);

        expect(screen.getByText("Custom back text")).toBeInTheDocument();
    });
});
