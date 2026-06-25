import { fireEvent, render, screen } from "@testing-library/react";
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

import { activeMerchantStore } from "@/stores/activeMerchantStore";
import { AccountMenu } from "./index";

describe("AccountMenu", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParams.mockReturnValue({ merchantId: "merchant-1" });
        activeMerchantStore.setState({ lastMerchantId: null });
    });

    it("renders Settings and Log out even with no merchants", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
            isReadOnly: () => false,
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
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        // Acme is the active merchant: once in the trigger label, once in the list
        expect(screen.getAllByText("Acme")).toHaveLength(2);
        expect(screen.getByText("Globex")).toBeInTheDocument();
        const merchantLinks = screen
            .getAllByRole("link")
            .filter((l) => l.getAttribute("href")?.startsWith("/m/"));
        expect(merchantLinks.map((l) => l.getAttribute("href"))).toEqual([
            "/m/merchant-1/members",
            "/m/merchant-2/members",
        ]);
    });

    it("tags read-only merchants with a badge in the list", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            owned: [{ id: "merchant-1", name: "Acme", domain: "acme.example" }],
            adminOf: [],
            isEmpty: false,
            // merchant-2 is a platform-admin read-only view
            isReadOnly: (id: string) => id === "merchant-2",
        });
        render(<AccountMenu />);
        // Exactly one badge, for the read-only merchant only
        expect(screen.getAllByText("platformAdmin.readOnlyTag")).toHaveLength(
            1
        );
    });

    it("shows the active merchant name in the trigger", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            owned: [],
            adminOf: [],
            isEmpty: false,
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        expect(
            screen.getByRole("button", { name: "Acme" })
        ).toBeInTheDocument();
    });

    it("shows the remembered merchant on a param-less route", () => {
        mockParams.mockReturnValue({});
        activeMerchantStore.setState({ lastMerchantId: "merchant-2" });
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            owned: [],
            adminOf: [],
            isEmpty: false,
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        expect(
            screen.getByRole("button", { name: "Globex" })
        ).toBeInTheDocument();
    });

    it("switches merchant in place on a param-less route", () => {
        mockParams.mockReturnValue({});
        activeMerchantStore.setState({ lastMerchantId: "merchant-2" });
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
                { id: "merchant-2", name: "Globex", domain: "globex.example" },
            ],
            owned: [],
            adminOf: [],
            isEmpty: false,
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        // No /m/ navigation links on a param-less route
        expect(
            screen
                .queryAllByRole("link")
                .filter((l) => l.getAttribute("href")?.startsWith("/m/"))
        ).toHaveLength(0);
        fireEvent.click(screen.getByText("Acme"));
        expect(activeMerchantStore.getState().lastMerchantId).toBe(
            "merchant-1"
        );
    });

    it("falls back to the My account label with no merchants", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        expect(
            screen.getByRole("button", { name: "shell.header.myAccount" })
        ).toBeInTheDocument();
    });

    it("logs out when the Log out item is clicked", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
            isReadOnly: () => false,
        });
        render(<AccountMenu />);
        screen.getByText("shell.header.account.logout").click();
        expect(mockLogout).toHaveBeenCalledOnce();
    });
});
