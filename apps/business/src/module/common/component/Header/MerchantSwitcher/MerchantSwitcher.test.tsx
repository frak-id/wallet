import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockParams = vi.fn();
const mockLocation = vi.fn(() => ({ pathname: "/m/merchant-1/dashboard" }));
vi.mock("@tanstack/react-router", () => ({
    Link: ({ to, params, children }: any) => {
        const href =
            params && to.includes("$")
                ? to.replace(
                      /\$(\w+)/g,
                      (_: string, name: string) => params[name] ?? ""
                  )
                : to;
        return <a href={href}>{children}</a>;
    },
    useParams: () => mockParams(),
    useLocation: () => mockLocation(),
}));

const mockUseMyMerchants = vi.fn();
vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: () => mockUseMyMerchants(),
}));

// Popover renders inline content so we can assert against it in jsdom
vi.mock("@frak-labs/design-system/components/Popover", () => ({
    Popover: ({ children }: any) => children,
    PopoverTrigger: ({ children }: any) => children,
    PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

import { MerchantSwitcher } from "./index";

describe("MerchantSwitcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParams.mockReturnValue({ merchantId: "merchant-1" });
    });

    it("renders nothing when user has no merchants", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });
        const { container } = render(<MerchantSwitcher />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders a read-only label with a single merchant", () => {
        mockUseMyMerchants.mockReturnValue({
            merchants: [
                { id: "merchant-1", name: "Acme", domain: "acme.example" },
            ],
            owned: [{ id: "merchant-1", name: "Acme", domain: "acme.example" }],
            adminOf: [],
            isEmpty: false,
        });
        render(<MerchantSwitcher />);
        expect(screen.getByText("Acme")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /switch merchant/i })
        ).not.toBeInTheDocument();
    });

    it("opens a dropdown listing owned + adminOf when multiple merchants", () => {
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
        render(<MerchantSwitcher />);
        expect(
            screen.getByRole("button", { name: /merchantSwitcher\.label/i })
        ).toBeInTheDocument();
        expect(
            screen.getByText("shell.header.merchantSwitcher.owned")
        ).toBeInTheDocument();
        expect(
            screen.getByText("shell.header.merchantSwitcher.adminOf")
        ).toBeInTheDocument();
        const links = screen.getAllByRole("link");
        expect(links.map((l) => l.getAttribute("href"))).toEqual([
            "/m/merchant-1/dashboard",
            "/m/merchant-2/dashboard",
        ]);
    });
});
