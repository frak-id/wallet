import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavigationProfile } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, className, ...props }: any) => (
        <a href={to} className={className} {...props}>
            {children}
        </a>
    ),
}));

describe("NavigationProfile", () => {
    it("should render link to settings", () => {
        render(<NavigationProfile />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/settings");
    });

    it("should render account text", () => {
        render(<NavigationProfile />);

        expect(screen.getByText("My account")).toBeInTheDocument();
    });

    it("should render user icon", () => {
        const { container } = render(<NavigationProfile />);

        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });
});
