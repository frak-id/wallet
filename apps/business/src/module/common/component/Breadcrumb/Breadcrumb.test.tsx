import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

describe("Breadcrumb", () => {
    it("should render with current page", () => {
        render(<Breadcrumb current="Products" />);

        expect(screen.getByText("Products")).toBeInTheDocument();
    });

    it("should render dashboard link", () => {
        render(<Breadcrumb current="Products" />);

        const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
        expect(dashboardLink).toBeInTheDocument();
        expect(dashboardLink).toHaveAttribute("href", "/dashboard");
    });

    it("should render separator icon", () => {
        const { container } = render(<Breadcrumb current="Products" />);

        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should render full breadcrumb structure", () => {
        render(<Breadcrumb current="Settings" />);

        expect(
            screen.getByRole("link", { name: /dashboard/i })
        ).toBeInTheDocument();
        expect(screen.getByText("Settings")).toBeInTheDocument();
    });
});
