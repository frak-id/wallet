import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Navigation,
    NavigationItem,
    NavigationLabel,
    SubNavigationItem,
} from "./index";

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

vi.mock("@/assets/icons/Home", () => ({
    Home: () => <svg data-testid="icon-home" />,
}));

vi.mock("@/assets/icons/Users", () => ({
    Users: () => <svg data-testid="icon-users" />,
}));

vi.mock("@/assets/icons/Cash", () => ({
    Cash: () => <svg data-testid="icon-cash" />,
}));

vi.mock("@/assets/icons/Message", () => ({
    Message: () => <svg data-testid="icon-message" />,
}));

vi.mock("@/assets/icons/Wallet", () => ({
    Wallet: () => <svg data-testid="icon-wallet" />,
}));

vi.mock("@/assets/icons/Gear", () => ({
    Gear: () => <svg data-testid="icon-gear" />,
}));

vi.mock("@/assets/icons/Info", () => ({
    Info: () => <svg data-testid="icon-info" />,
}));

vi.mock("./NavigationCampaignsSwitcher", () => ({
    NavigationCampaignsSwitcher: () => (
        <li data-testid="campaigns-switcher">Campaigns</li>
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

    it("should render navigation items", () => {
        render(<Navigation />);

        expect(screen.getByText("Dashboard")).toBeInTheDocument();
        expect(screen.getByText("Members")).toBeInTheDocument();
        expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("should render navigation icons", () => {
        const { container } = render(<Navigation />);

        expect(
            container.querySelector('[data-testid="icon-home"]')
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="icon-users"]')
        ).toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="icon-gear"]')
        ).toBeInTheDocument();
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

        const li = container.querySelector("li");
        expect(li).toBeInTheDocument();
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

    it("should render as link with isSub styling", () => {
        const { container } = render(
            <SubNavigationItem url="/test">Sub Item</SubNavigationItem>
        );

        const link = container.querySelector("a");
        expect(link).toBeInTheDocument();
    });
});

describe("NavigationLabel", () => {
    it("should render icon and label", () => {
        render(
            <NavigationLabel icon={<span data-testid="custom-icon">Icon</span>}>
                Label Text
            </NavigationLabel>
        );

        expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
        expect(screen.getByText("Label Text")).toBeInTheDocument();
    });

    it("should render label with span", () => {
        const { container } = render(
            <NavigationLabel icon={<span>Icon</span>}>Label</NavigationLabel>
        );

        const span = container.querySelector("span");
        expect(span).toBeInTheDocument();
    });
});
