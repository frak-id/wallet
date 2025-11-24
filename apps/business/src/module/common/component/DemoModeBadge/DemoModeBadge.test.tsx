import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModeBadge } from "./index";

const mockUseIsDemoMode = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => mockUseIsDemoMode(),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
    Link: ({ to, children, className, ...props }: any) => (
        <a href={to} className={className} {...props}>
            {children}
        </a>
    ),
}));

describe("DemoModeBadge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("should render badge when demo mode is active", () => {
        mockUseIsDemoMode.mockReturnValue(true);

        render(<DemoModeBadge />);

        const badge = screen.getByRole("link", { name: /demo/i });
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

    it("should render link to settings", () => {
        mockUseIsDemoMode.mockReturnValue(true);

        const { container } = render(<DemoModeBadge />);

        const link = container.querySelector('a[href="/settings"]');
        expect(link).toBeInTheDocument();
        expect(link).toHaveTextContent("demo");
    });
});
