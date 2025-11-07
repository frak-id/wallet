import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationItem } from "./index";

vi.mock("react-router", async () => {
    const actual = await vi.importActual("react-router");
    return {
        ...actual,
        NavLink: ({ children, to, className }: any) => {
            const isActive = false; // Mock active state
            const classNames =
                typeof className === "function"
                    ? className({ isActive })
                    : className;
            return (
                <a href={to} className={classNames}>
                    {children}
                </a>
            );
        },
    };
});

describe("NavigationItem", () => {
    it("should render children", () => {
        render(
            <NavigationItem url="/test">
                <span>Test Link</span>
            </NavigationItem>
        );

        expect(screen.getByText("Test Link")).toBeInTheDocument();
    });

    it("should render as list item", () => {
        const { container } = render(
            <NavigationItem url="/test">Link</NavigationItem>
        );

        const listItem = container.querySelector("li");
        expect(listItem).toBeInTheDocument();
    });

    it("should render link with correct url", () => {
        render(<NavigationItem url="/settings">Settings</NavigationItem>);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/settings");
    });

    it("should render with ReactNode children", () => {
        render(
            <NavigationItem url="/test">
                <span data-testid="custom-content">Custom</span>
            </NavigationItem>
        );

        expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    });
});
