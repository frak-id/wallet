import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyMerchants } from "./index";

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: vi.fn(),
}));

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({
        children,
        title,
    }: {
        children: React.ReactNode;
        title: string;
    }) => (
        <div data-testid="panel">
            <h2>{title}</h2>
            {children}
        </div>
    ),
}));

vi.mock("@/module/dashboard/component/MerchantItem", () => ({
    MerchantItem: ({
        name,
        domain,
    }: {
        name: React.ReactNode;
        domain: string;
    }) => (
        <div data-testid="merchant-item">
            <div>{name}</div>
            <div>{domain}</div>
        </div>
    ),
}));

// Import after mocks
const { useMyMerchants } = await import(
    "@/module/dashboard/hooks/useMyMerchants"
);

describe("MyMerchants", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render merchants panel when data is available", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });

        render(<MyMerchants />);

        expect(screen.getByText("My Merchants")).toBeInTheDocument();
    });

    it("should render merchants list when loaded", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [
                {
                    id: "merchant-1",
                    name: "Merchant 1",
                    domain: "merchant1.com",
                },
                {
                    id: "merchant-2",
                    name: "Merchant 2",
                    domain: "merchant2.com",
                },
            ],
            owned: [],
            adminOf: [],
            isEmpty: false,
        });

        render(<MyMerchants />);

        expect(screen.getAllByTestId("panel").length).toBeGreaterThan(0);
        expect(screen.getByText("Merchant 1")).toBeInTheDocument();
        expect(screen.getByText("Merchant 2")).toBeInTheDocument();
    });
});
