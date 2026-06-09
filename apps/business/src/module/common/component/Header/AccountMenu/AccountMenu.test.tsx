import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockParams = vi.fn();
const mockLocation = vi.fn(() => ({ pathname: "/m/merchant-1/dashboard" }));
vi.mock("@tanstack/react-router", () => ({
    Link: ({ to, children, onClick }: any) => (
        <a href={to} onClick={onClick}>
            {children}
        </a>
    ),
    useParams: () => mockParams(),
    useLocation: () => mockLocation(),
}));

const mockUseMyMerchants = vi.fn();
vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: () => mockUseMyMerchants(),
}));

const mockLogout = vi.fn();
vi.mock("@/module/common/hook/useLogout", () => ({
    useLogout: () => mockLogout,
}));

// Popover renders inline content so we can assert against it in jsdom
vi.mock("@frak-labs/design-system/components/Popover", () => ({
    Popover: ({ children }: any) => children,
    PopoverTrigger: ({ children }: any) => children,
    PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

import { AccountMenu } from "./index";

describe("AccountMenu", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParams.mockReturnValue({ merchantId: "merchant-1" });
    });

    it("renders Settings and Log out even with no merchants", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });
        render(<AccountMenu />);
        expect(
            screen.getByText("shell.header.account.settings")
        ).toBeInTheDocument();
        expect(
            screen.getByText("shell.header.account.logout")
        ).toBeInTheDocument();
    });

    it("lists every merchant with a switch target preserving the section", () => {
        mockLocation.mockReturnValue({ pathname: "/m/merchant-1/members" });
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            owned: [{ id: "merchant-1", name: "Acme", domain: "acme.example" }],
            adminOf: [
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            isEmpty: false,
        });
        render(<AccountMenu />);
        expect(screen.getByText("Acme")).toBeInTheDocument();
        expect(screen.getByText("Globex")).toBeInTheDocument();
        const merchantLinks = screen
            .getAllByRole("link")
            .filter((l) => l.getAttribute("href")?.startsWith("/m/"));
        expect(merchantLinks.map((l) => l.getAttribute("href"))).toEqual([
            "/m/merchant-1/members",
            "/m/merchant-2/members",
        ]);
    });

    it("logs out when the Log out item is clicked", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });
        render(<AccountMenu />);
        screen.getByText("shell.header.account.logout").click();
        expect(mockLogout).toHaveBeenCalledOnce();
    });
});
