import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to} data-testid="logo-link">
            {children}
        </a>
    ),
}));

vi.mock("@/module/common/component/NavigationTop", () => ({
    NavigationTop: () => <div data-testid="navigation-top">Navigation</div>,
}));

describe("Header", () => {
    it("should render logo link to /dashboard", () => {
        render(<Header />);
        const logoLink = screen.getByTestId("logo-link");
        expect(logoLink).toBeInTheDocument();
        expect(logoLink).toHaveAttribute("href", "/dashboard");
    });

    it("should render LogoFrak icon inside link", () => {
        render(<Header />);
        const logoLink = screen.getByTestId("logo-link");
        // LogoFrak renders as SVG
        const svg = logoLink.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should render NavigationTop component", () => {
        render(<Header />);
        expect(screen.getByTestId("navigation-top")).toBeInTheDocument();
    });

    it("should render as header element", () => {
        const { container } = render(<Header />);
        const header = container.querySelector("header");
        expect(header).toBeInTheDocument();
    });
});
