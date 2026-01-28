import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { MyProducts } from "./index";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

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

vi.mock("@/module/dashboard/component/ProductItem", () => ({
    ProductItem: ({
        name,
        domain,
    }: {
        name: React.ReactNode;
        domain: string;
    }) => (
        <div data-testid="product-item">
            <div>{name}</div>
            <div>{domain}</div>
        </div>
    ),
}));

vi.mock("lucide-react", () => ({
    Plus: () => <span data-testid="plus-icon">+</span>,
}));

describe("MyProducts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render products when data is available", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });

        render(<MyProducts />);

        expect(screen.getByText("My Products")).toBeInTheDocument();
    });

    it("should render products list when loaded", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [
                {
                    id: "merchant-1",
                    name: "Product 1",
                    domain: "product1.com",
                },
                {
                    id: "merchant-2",
                    name: "Product 2",
                    domain: "product2.com",
                },
            ],
            owned: [],
            adminOf: [],
            isEmpty: false,
        });

        render(<MyProducts />);

        expect(screen.getAllByTestId("panel").length).toBeGreaterThan(0);
        expect(screen.getByText("Product 1")).toBeInTheDocument();
        expect(screen.getByText("Product 2")).toBeInTheDocument();
    });

    it("should render empty list with add merchant button", async () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            merchants: [],
            owned: [],
            adminOf: [],
            isEmpty: true,
        });

        render(<MyProducts />);

        expect(screen.getAllByTestId("panel").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Add a Merchant").length).toBeGreaterThan(0);
        expect(screen.getAllByTestId("plus-icon").length).toBeGreaterThan(0);
    });
});
