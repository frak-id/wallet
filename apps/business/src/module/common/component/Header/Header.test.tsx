import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to} data-testid={`link-${to.replace(/\//g, "")}`}>
            {children}
        </a>
    ),
}));

vi.mock("@frak-labs/ui/component/ButtonRefresh", () => ({
    ButtonRefresh: () => <button type="button" data-testid="refresh-btn" />,
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => false,
}));

describe("Header", () => {
    it("should render logo link to /dashboard", () => {
        render(<Header />);
        const logoLink = screen.getByTestId("link-dashboard");
        expect(logoLink).toBeInTheDocument();
        expect(logoLink).toHaveAttribute("href", "/dashboard");
    });

    it("should render LogoFrak icon inside link", () => {
        render(<Header />);
        const logoLink = screen.getByTestId("link-dashboard");
        // LogoFrak renders as SVG
        const svg = logoLink.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should render as header element", () => {
        const { container } = render(<Header />);
        const header = container.querySelector("header");
        expect(header).toBeInTheDocument();
    });
});
