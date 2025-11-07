import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./index";

describe("Toast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with text", () => {
        render(<Toast text="Test message" />);
        expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    it("should render with ReactNode text", () => {
        render(<Toast text={<span data-testid="custom-text">Custom</span>} />);
        expect(screen.getByTestId("custom-text")).toBeInTheDocument();
    });

    it("should render dismiss button when onDismiss is provided", () => {
        const handleDismiss = vi.fn();
        render(<Toast text="Test message" onDismiss={handleDismiss} />);
        // Dismiss button has X icon, find by role button
        const buttons = screen.getAllByRole("button");
        // Should have dismiss button (X icon button)
        expect(buttons.length).toBeGreaterThan(0);
    });

    it("should call onDismiss when dismiss button is clicked", () => {
        const handleDismiss = vi.fn();
        render(<Toast text="Test message" onDismiss={handleDismiss} />);

        // Find the dismiss button (it's the button with X icon, not the clickable wrapper)
        const buttons = screen.getAllByRole("button");
        // The dismiss button is the last one (X button)
        const dismissButton = buttons[buttons.length - 1];
        fireEvent.click(dismissButton);

        expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it("should render with ariaLabel when onClick is provided", () => {
        const handleClick = vi.fn();
        render(
            <Toast
                text="Test message"
                onClick={handleClick}
                ariaLabel="Clickable toast"
            />
        );

        const clickableButton = screen.getByRole("button", {
            name: "Clickable toast",
        });
        expect(clickableButton).toBeInTheDocument();
    });

    it("should call onClick when toast is clicked", () => {
        const handleClick = vi.fn();
        const handleDismiss = vi.fn();
        render(
            <Toast
                text="Test message"
                onClick={handleClick}
                onDismiss={handleDismiss}
            />
        );

        // When onClick is provided, Warning is wrapped in a button
        const buttons = screen.getAllByRole("button");
        // The clickable button is the first one (wraps the Warning)
        const clickableButton = buttons[0];
        fireEvent.click(clickableButton);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should render with ariaDismissLabel", () => {
        render(
            <Toast text="Test message" ariaDismissLabel="Close notification" />
        );

        const dismissButton = screen.getByRole("button", {
            name: "Close notification",
        });
        expect(dismissButton).toBeInTheDocument();
    });

    it("should render loading state with spinner", () => {
        render(<Toast text="Loading..." isLoading={true} />);
        expect(screen.getByText("Loading...")).toBeInTheDocument();
        // Spinner should be rendered
        const spinner = document.querySelector("span[class*='spinner']");
        expect(spinner).toBeInTheDocument();
    });

    it("should not render dismiss button in loading state", () => {
        render(<Toast text="Loading..." isLoading={true} />);
        // In loading state, dismiss button should not be present
        const dismissButtons = screen.queryAllByRole("button");
        expect(dismissButtons).toHaveLength(0);
    });

    it("should render warning component when not loading", () => {
        render(<Toast text="Warning message" />);
        // Warning component should be rendered
        expect(screen.getByText("Warning message")).toBeInTheDocument();
    });

    it("should not be clickable when onClick is not provided", () => {
        render(<Toast text="Test message" />);
        // Should not have a clickable button wrapper
        const buttons = screen.getAllByRole("button");
        // Only dismiss button should be present
        expect(buttons).toHaveLength(1);
    });
});
