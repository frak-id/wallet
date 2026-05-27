import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationCampaignsSwitcher } from "./NavigationCampaignsSwitcher";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseMediaQuery = vi.fn();
const mockUseLocation = vi.fn();
const mockNavigate = vi.fn();
const mockMatchRoute = vi.fn();

vi.mock("@frak-labs/design-system/hooks/useMediaQuery", () => ({
    useMediaQuery: () => mockUseMediaQuery(),
}));

vi.mock("@tanstack/react-router", () => ({
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
    useMatchRoute: () => mockMatchRoute,
    useParams: () => ({}),
}));

vi.mock("./index", () => ({
    NavigationItem: ({
        url,
        children,
        isActive,
        icon,
        rightSection,
    }: {
        url?: string;
        children: React.ReactNode;
        isActive?: boolean;
        icon?: React.ReactNode;
        rightSection?: React.ReactNode;
    }) => (
        <li data-testid="navigation-item" data-url={url} data-active={isActive}>
            {icon}
            {children}
            {rightSection}
        </li>
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
        expect(
            screen.getByText("shell.pages.campaigns.nav")
        ).toBeInTheDocument();
    });

    it("should render desktop collapsible navigation when not on mobile", () => {
        mockUseMediaQuery.mockReturnValue(false);
        mockUseLocation.mockReturnValue({ pathname: "/campaigns/list" });

        render(<NavigationCampaignsSwitcher />);

        const item = screen.getByTestId("navigation-item");
        expect(item).toBeInTheDocument();
        expect(
            screen.getByText("shell.pages.campaigns.nav")
        ).toBeInTheDocument();
    });

    it("should show both sub-navigation items when expanded", () => {
        mockUseMediaQuery.mockReturnValue(false);
        mockUseLocation.mockReturnValue({ pathname: "/campaigns/list" });

        render(<NavigationCampaignsSwitcher />);

        const subItems = screen.getAllByTestId("sub-navigation-item");
        expect(subItems).toHaveLength(2);
        expect(subItems[0]).toHaveAttribute(
            "data-url",
            "/campaigns/overview"
        );
        expect(subItems[1]).toHaveAttribute("data-url", "/campaigns/list");
        expect(
            screen.getByText("shell.pages.campaignsOverview.nav")
        ).toBeInTheDocument();
        expect(
            screen.getByText("shell.pages.campaignsList.nav")
        ).toBeInTheDocument();
    });
});
