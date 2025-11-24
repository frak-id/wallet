import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import { MyProducts } from "./index";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@/module/dashboard/hooks/useMyProducts", () => ({
    useMyProducts: vi.fn(),
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
        // useSuspenseQuery always returns data after suspense resolves
        vi.mocked(useMyProducts).mockReturnValue({
            products: {
                operator: [],
                owner: [],
            },
            isEmpty: true,
        } as any);

        render(<MyProducts />);

        expect(screen.getByText("My Products")).toBeInTheDocument();
    });

    it("should render products list when loaded", async () => {
        vi.mocked(useMyProducts).mockReturnValue({
            products: {
                operator: [
                    {
                        id: "0x1" as `0x${string}`,
                        name: "Product 1",
                        domain: "product1.com",
                    },
                ],
                owner: [
                    {
                        id: "0x2" as `0x${string}`,
                        name: "Product 2",
                        domain: "product2.com",
                    },
                ],
            },
            isPending: false,
        } as any);

        render(<MyProducts />);

        expect(screen.getByText("My Products")).toBeInTheDocument();
        expect(screen.getByText("Product 1")).toBeInTheDocument();
        expect(screen.getByText("Product 2")).toBeInTheDocument();
    });

    it("should render empty list with add product button", async () => {
        vi.mocked(useMyProducts).mockReturnValue({
            products: {
                operator: [],
                owner: [],
            },
            isPending: false,
        } as any);

        render(<MyProducts />);

        expect(screen.getByText("My Products")).toBeInTheDocument();
        expect(screen.getByText("List a Product")).toBeInTheDocument();
        expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
    });
});
