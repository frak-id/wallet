import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to} data-testid={`link-${to.replace(/\//g, "")}`}>
            {children}
        </a>
    ),
    useLocation: () => ({ pathname: "/m/merchant-1/campaigns/list" }),
    useParams: () => ({ merchantId: "merchant-1" }),
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

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: () => ({
        merchants: [{ id: "merchant-1", name: "Acme", domain: "acme.example" }],
        owned: [{ id: "merchant-1", name: "Acme", domain: "acme.example" }],
        adminOf: [],
        isEmpty: false,
    }),
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
            screen.getByRole("navigation", {
                name: "shell.header.breadcrumbLabel",
            })
        ).toBeInTheDocument();
        // /campaigns/list → "Campaigns" (link) / "List" (current)
        expect(screen.getByText("shell.nav.campaigns")).toBeInTheDocument();
        expect(screen.getByText("shell.nav.campaignsList")).toBeInTheDocument();
    });

    it("should render contextual export and create campaign buttons on /campaigns", () => {
        render(<Header />);
        expect(screen.getByText("shell.header.export")).toBeInTheDocument();
        expect(screen.getByTestId("new-campaign-btn")).toBeInTheDocument();
    });

    it("should render My account profile link", () => {
        render(<Header />);
        const profileLink = screen.getByTestId("link-settings");
        expect(profileLink).toBeInTheDocument();
        expect(profileLink).toHaveTextContent("shell.header.myAccount");
    });
});
