import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenListLite } from "./index";

const mockUseGetUserBalance = vi.fn();

vi.mock("@frak-labs/wallet-shared", () => ({
    useGetUserBalance: () => mockUseGetUserBalance(),
}));

vi.mock("@/module/common/component/Skeleton", () => ({
    Skeleton: ({ height }: { height?: number }) => (
        <div data-testid="skeleton" data-height={height}>
            Loading...
        </div>
    ),
}));

vi.mock("@/module/tokens/component/TokenItemLite", () => ({
    TokenItemLite: ({ token }: { token: any }) => (
        <li data-testid="token-item">{token.token}</li>
    ),
}));

describe("TokenListLite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render skeleton when loading", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: null,
            isLoading: true,
        });

        render(<TokenListLite />);

        expect(screen.getByTestId("skeleton")).toBeInTheDocument();
        expect(screen.getByTestId("skeleton")).toHaveAttribute(
            "data-height",
            "18"
        );
    });

    it("should render token list when loaded", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                balances: [
                    { token: "USDC", amount: "100" },
                    { token: "EURE", amount: "50" },
                ],
            },
            isLoading: false,
        });

        render(<TokenListLite />);

        const tokenItems = screen.getAllByTestId("token-item");
        expect(tokenItems).toHaveLength(2);
        expect(tokenItems[0]).toHaveTextContent("USDC");
        expect(tokenItems[1]).toHaveTextContent("EURE");
    });

    it("should render empty list when userBalance is null", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: null,
            isLoading: false,
        });

        const { container } = render(<TokenListLite />);

        expect(container.firstChild).toBeNull();
    });

    it("should render empty list when userBalance is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: undefined,
            isLoading: false,
        });

        const { container } = render(<TokenListLite />);

        expect(container.firstChild).toBeNull();
    });

    it("should render token items with correct keys", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                balances: [
                    { token: "USDC", amount: "100" },
                    { token: "EURE", amount: "50" },
                ],
            },
            isLoading: false,
        });

        render(<TokenListLite />);

        const tokenItems = screen.getAllByTestId("token-item");
        expect(tokenItems[0]).toHaveTextContent("USDC");
        expect(tokenItems[1]).toHaveTextContent("EURE");
    });

    it("should render empty list when balances array is empty", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                balances: [],
            },
            isLoading: false,
        });

        render(<TokenListLite />);

        const tokenItems = screen.queryAllByTestId("token-item");
        expect(tokenItems).toHaveLength(0);
    });
});
