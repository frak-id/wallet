import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Navigation, NavigationItem, SubNavigationItem } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = vi.fn();
const mockMatchRoute = vi.fn();

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
    useMatchRoute: () => mockMatchRoute,
    Link: ({ to, children, className, ...props }: any) => (
        <a href={to} className={className} {...props}>
            {children}
        </a>
    ),
}));

vi.mock("./NavigationCampaignsSwitcher", () => ({
    NavigationCampaignsSwitcher: () => (
        <li data-testid="campaigns-switcher">shell.nav.campaigns</li>
    ),
}));

describe("Navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchRoute.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("should render the Frak logo at the top", () => {
        const { container } = render(<Navigation />);
        // LogoFrakWithName renders an <svg> with <title>Frak</title>
        expect(container.querySelector("svg title")).toHaveTextContent("Frak");
    });

    it("should render the primary navigation items from the Figma spec", () => {
        render(<Navigation />);

        expect(screen.getByText("shell.nav.dashboard")).toBeInTheDocument();
        expect(screen.getByText("shell.nav.members")).toBeInTheDocument();
        expect(screen.getByText("shell.nav.wallet")).toBeInTheDocument();
    });

    it("should render section labels", () => {
        render(<Navigation />);
        expect(
            screen.getByText("shell.nav.sectionAcquisition")
        ).toBeInTheDocument();
        expect(
            screen.getByText("shell.nav.sectionPreview")
        ).toBeInTheDocument();
    });

    it("should not render dropped items (Revenue, Messenger, Settings, Help)", () => {
        render(<Navigation />);
        expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
        expect(screen.queryByText("Messenger")).not.toBeInTheDocument();
        expect(screen.queryByText("Settings")).not.toBeInTheDocument();
        expect(screen.queryByText("Help & FAQ")).not.toBeInTheDocument();
    });

    it("should render campaigns switcher", () => {
        const { container } = render(<Navigation />);
        expect(
            container.querySelector('[data-testid="campaigns-switcher"]')
        ).toBeInTheDocument();
    });
});

describe("NavigationItem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchRoute.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("should render as list item", () => {
        const { container } = render(
            <NavigationItem url="/test">Item</NavigationItem>
        );
        expect(container.querySelector("li")).toBeInTheDocument();
    });

    it("should render as link for internal URLs", () => {
        const { container } = render(
            <NavigationItem url="/test">Item</NavigationItem>
        );
        const link = container.querySelector('a[href="/test"]');
        expect(link).toBeInTheDocument();
        expect(link).toHaveTextContent("Item");
    });

    it("should open external URLs in new window", () => {
        const windowOpenSpy = vi
            .spyOn(window, "open")
            .mockImplementation(() => null);

        render(
            <NavigationItem url="https://example.com">External</NavigationItem>
        );

        const button = screen.getByRole("button", { name: "External" });
        fireEvent.click(button);

        expect(windowOpenSpy).toHaveBeenCalledWith(
            "https://example.com",
            "_blank",
            "noopener,noreferrer"
        );

        windowOpenSpy.mockRestore();
    });

    it("should be disabled when disabled prop is true", () => {
        render(
            <NavigationItem url="/test" disabled>
                Item
            </NavigationItem>
        );
        const button = screen.getByRole("button", { name: "Item" });
        expect(button).toBeDisabled();
    });

    it("should apply active class when route matches", () => {
        mockMatchRoute.mockReturnValue(true);
        const { container } = render(
            <NavigationItem url="/test">Item</NavigationItem>
        );
        const link = container.querySelector("a");
        expect(link?.className).toBeTruthy();
    });

    it("should apply active class when isActive is true", () => {
        const { container } = render(
            <NavigationItem url="/test" isActive>
                Item
            </NavigationItem>
        );
        const link = container.querySelector("a");
        expect(link?.className).toBeTruthy();
    });

    it("should render rightSection", () => {
        render(
            <NavigationItem url="/test" rightSection={<span>Right</span>}>
                Item
            </NavigationItem>
        );
        expect(screen.getByText("Right")).toBeInTheDocument();
    });

    it("should not navigate when url is not provided", () => {
        render(<NavigationItem>Item</NavigationItem>);
        const button = screen.getByRole("button", { name: "Item" });
        fireEvent.click(button);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe("SubNavigationItem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchRoute.mockReturnValue(false);
    });

    afterEach(() => {
        cleanup();
    });

    it("should render as sub navigation item", () => {
        render(<SubNavigationItem url="/test">Sub Item</SubNavigationItem>);
        expect(screen.getByText("Sub Item")).toBeInTheDocument();
    });

    it("should render as link", () => {
        const { container } = render(
            <SubNavigationItem url="/test">Sub Item</SubNavigationItem>
        );
        expect(container.querySelector("a")).toBeInTheDocument();
    });
});
