import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Balance } from "./index";

const mockUseGetUserBalance = vi.fn();
const mockT = vi.fn((key: string) => key);

vi.mock("@frak-labs/wallet-shared", () => ({
    useGetUserBalance: () => mockUseGetUserBalance(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: mockT,
    }),
}));

vi.mock("@/module/common/component/Title", () => ({
    Title: ({
        size,
        align,
        children,
    }: {
        size?: string;
        align?: string;
        children: React.ReactNode;
    }) => (
        <h1 data-testid="title" data-size={size} data-align={align}>
            {children}
        </h1>
    ),
}));

describe("Balance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render title with balance label", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: {
                    eurAmount: 100.5,
                },
            },
        });

        render(<Balance />);

        expect(mockT).toHaveBeenCalledWith("common.balance");
        expect(screen.getByTestId("title")).toHaveTextContent("common.balance");
    });

    it("should render title with big size and center alignment", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: {
                    eurAmount: 100.5,
                },
            },
        });

        render(<Balance />);

        const title = screen.getByTestId("title");
        expect(title).toHaveAttribute("data-size", "big");
        expect(title).toHaveAttribute("data-align", "center");
    });

    it("should render balance amount", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: {
                    eurAmount: 100.5,
                },
            },
        });

        render(<Balance />);

        expect(screen.getByText("100.50€")).toBeInTheDocument();
    });

    it("should render 0€ when userBalance is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: undefined,
        });

        render(<Balance />);

        expect(screen.getByText("0€")).toBeInTheDocument();
    });

    it("should render 0€ when total is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: undefined,
            },
        });

        render(<Balance />);

        expect(screen.getByText("0€")).toBeInTheDocument();
    });

    it("should render 0€ when eurAmount is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: {},
            },
        });

        render(<Balance />);

        expect(screen.getByText("0€")).toBeInTheDocument();
    });

    it("should format balance with 2 decimal places", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: {
                    eurAmount: 123.456,
                },
            },
        });

        render(<Balance />);

        expect(screen.getByText("123.46€")).toBeInTheDocument();
    });
});
