import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to} data-testid={`link-${to.replace(/\//g, "")}`}>
            {children}
        </a>
    ),
    useLocation: () => ({ pathname: "/campaigns/list" }),
}));

vi.mock("@/module/common/component/ButtonRefresh", () => ({
    ButtonRefresh: () => <button type="button" data-testid="refresh-btn" />,
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: () => false,
}));

vi.mock("@/module/campaigns/component/ButtonNewCampaign", () => ({
    ButtonNewCampaign: () => (
        <button type="button" data-testid="new-campaign-btn">
            Create campaign
        </button>
    ),
}));

vi.mock("@/module/dashboard/component/AddMerchantSheet", () => ({
    AddMerchantSheet: ({ trigger }: { trigger: React.ReactNode }) => (
        <>{trigger}</>
    ),
}));

describe("Header", () => {
    it("should render as header element", () => {
        const { container } = render(<Header />);
        const header = container.querySelector("header");
        expect(header).toBeInTheDocument();
    });

    it("should render breadcrumb with current pathname", () => {
        render(<Header />);
        expect(
            screen.getByRole("navigation", { name: "Breadcrumb" })
        ).toBeInTheDocument();
        // /campaigns/list → "Campaigns" (link) / "List" (current)
        expect(screen.getByText("Campaigns")).toBeInTheDocument();
        expect(screen.getByText("List")).toBeInTheDocument();
    });

    it("should render contextual export and create campaign buttons on /campaigns", () => {
        render(<Header />);
        expect(screen.getByText("Export")).toBeInTheDocument();
        expect(screen.getByTestId("new-campaign-btn")).toBeInTheDocument();
    });

    it("should render My account profile link", () => {
        render(<Header />);
        const profileLink = screen.getByTestId("link-settings");
        expect(profileLink).toBeInTheDocument();
        expect(profileLink).toHaveTextContent("My account");
    });

    it("should render refresh button", () => {
        render(<Header />);
        expect(screen.getByTestId("refresh-btn")).toBeInTheDocument();
    });
});
