import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyMerchants } from "./index";

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: vi.fn(),
}));

vi.mock("@/module/merchant/component/ManageBudgetSheet", () => ({
    ManageBudgetSheet: () => null,
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

    it("should render an empty grid when there is no merchant", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
            isReadOnly: () => false,
            isPlatformAdmin: false,
        });

        render(<MyMerchants />);

        expect(screen.queryAllByTestId("merchant-item")).toHaveLength(0);
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
            isReadOnly: () => false,
            isPlatformAdmin: false,
        });

        render(<MyMerchants />);

        expect(screen.getAllByTestId("merchant-item").length).toBe(2);
        expect(screen.getByText("Merchant 1")).toBeInTheDocument();
        expect(screen.getByText("Merchant 2")).toBeInTheDocument();
    });
});
