import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationCampaignsSwitcher } from "./NavigationCampaignsSwitcher";

const mockUseMediaQuery = vi.fn();
const mockUseLocation = vi.fn();
const mockNavigate = vi.fn();
const mockMatchRoute = vi.fn();

vi.mock("@frak-labs/ui/hook/useMediaQuery", () => ({
    useMediaQuery: () => mockUseMediaQuery(),
}));

vi.mock("@tanstack/react-router", () => ({
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
    useMatchRoute: () => mockMatchRoute,
}));

vi.mock("@/assets/icons/Laptop", () => ({
    Laptop: () => <svg data-testid="icon-laptop" />,
}));

vi.mock("@/assets/icons/ChevronDown", () => ({
    ChevronDown: () => <svg data-testid="icon-chevron-down" />,
}));

vi.mock("@/assets/icons/ChevronUp", () => ({
    ChevronUp: () => <svg data-testid="icon-chevron-up" />,
}));

vi.mock("./index", () => ({
    NavigationItem: ({
        url,
        children,
        isActive,
        rightSection,
    }: {
        url?: string;
        children: React.ReactNode;
        isActive?: boolean;
        rightSection?: React.ReactNode;
    }) => (
        <li data-testid="navigation-item" data-url={url} data-active={isActive}>
            {children}
            {rightSection}
        </li>
    ),
    NavigationLabel: ({
        icon,
        children,
    }: {
        icon: React.ReactNode;
        children: React.ReactNode;
    }) => (
        <>
            {icon}
            <span>{children}</span>
        </>
    ),
    SubNavigationItem: ({
        url,
        children,
    }: {
        url?: string;
        children: React.ReactNode;
    }) => (
        <li data-testid="sub-navigation-item" data-url={url}>
            {children}
        </li>
    ),
}));

describe("NavigationCampaignsSwitcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchRoute.mockReturnValue(false);
        mockUseLocation.mockReturnValue({ pathname: "/dashboard" });
    });

    it("should render mobile navigation item when on mobile", () => {
        mockUseMediaQuery.mockReturnValue(true);

        render(<NavigationCampaignsSwitcher />);

        const item = screen.getByTestId("navigation-item");
        expect(item).toHaveAttribute("data-url", "/campaigns/list");
        expect(screen.getByText("Campaigns")).toBeInTheDocument();
        expect(screen.getByTestId("icon-laptop")).toBeInTheDocument();
    });

    it("should render desktop collapsible navigation when not on mobile", () => {
        mockUseMediaQuery.mockReturnValue(false);
        mockUseLocation.mockReturnValue({ pathname: "/campaigns/list" });

        render(<NavigationCampaignsSwitcher />);

        const item = screen.getByTestId("navigation-item");
        expect(item).toBeInTheDocument();
        expect(screen.getByText("Campaigns")).toBeInTheDocument();
    });

    it("should show sub-navigation items when expanded", () => {
        mockUseMediaQuery.mockReturnValue(false);
        mockUseLocation.mockReturnValue({ pathname: "/campaigns/list" });

        render(<NavigationCampaignsSwitcher />);

        const subItems = screen.getAllByTestId("sub-navigation-item");
        expect(subItems).toHaveLength(2);
        expect(subItems[0]).toHaveAttribute("data-url", "/campaigns/list");
        expect(subItems[1]).toHaveAttribute(
            "data-url",
            "/campaigns/performance"
        );
    });
});
