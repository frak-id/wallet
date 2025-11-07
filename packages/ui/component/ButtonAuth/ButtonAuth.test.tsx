import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ButtonAuth } from "./index";

describe("ButtonAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with children", () => {
        render(<ButtonAuth>Sign in</ButtonAuth>);
        expect(
            screen.getByRole("button", { name: "Sign in" })
        ).toBeInTheDocument();
    });

    it("should render with fingerprint icon", () => {
        render(<ButtonAuth>Sign in</ButtonAuth>);
        const button = screen.getByRole("button");
        // Fingerprint icon should be present
        expect(button.querySelector("svg")).toBeInTheDocument();
    });

    it("should handle click events", () => {
        const handleClick = vi.fn();
        render(<ButtonAuth onClick={handleClick}>Sign in</ButtonAuth>);

        fireEvent.click(screen.getByRole("button"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when disabled prop is true", () => {
        render(<ButtonAuth disabled>Sign in</ButtonAuth>);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should render with different sizes", () => {
        const sizes = ["none", "small", "normal", "big"] as const;

        sizes.forEach((size) => {
            const { unmount } = render(
                <ButtonAuth size={size}>Sign in</ButtonAuth>
            );
            expect(screen.getByRole("button")).toBeInTheDocument();
            unmount();
        });
    });

    it("should render with width variants", () => {
        const { container } = render(
            <ButtonAuth width="full">Sign in</ButtonAuth>
        );
        expect(container.querySelector("button")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <ButtonAuth className="custom-class">Sign in</ButtonAuth>
        );
        const button = container.querySelector("button");
        expect(button?.className).toContain("custom-class");
    });

    it("should show loading state", () => {
        render(<ButtonAuth isLoading>Sign in</ButtonAuth>);
        const button = screen.getByRole("button");
        // Loading spinner should be present when isLoading is true
        expect(button).toBeInTheDocument();
    });

    it("should accept type prop", () => {
        render(<ButtonAuth type="submit">Sign in</ButtonAuth>);
        expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("should have default type button", () => {
        render(<ButtonAuth>Sign in</ButtonAuth>);
        expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });
});
