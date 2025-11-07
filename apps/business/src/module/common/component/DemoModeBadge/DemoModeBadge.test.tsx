import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModeBadge } from "./index";

const mockUseIsDemoMode = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => mockUseIsDemoMode(),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

describe("DemoModeBadge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render badge when demo mode is active", () => {
        mockUseIsDemoMode.mockReturnValue(true);

        render(<DemoModeBadge />);

        const badge = screen.getByRole("button", { name: /demo/i });
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute(
            "title",
            "Demo mode is active. Click to manage settings."
        );
    });

    it("should not render when demo mode is inactive", () => {
        mockUseIsDemoMode.mockReturnValue(false);

        const { container } = render(<DemoModeBadge />);

        expect(container.firstChild).toBeNull();
    });

    it("should navigate to settings when clicked", () => {
        mockUseIsDemoMode.mockReturnValue(true);

        render(<DemoModeBadge />);

        const badge = screen.getByRole("button", { name: /demo/i });
        fireEvent.click(badge);

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
    });
});
