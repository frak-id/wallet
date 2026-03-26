import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Balance } from "./index";

const mockUseGetUserBalance = vi.fn();
const mockT = vi.fn((key: string) => key);
const mockNavigate = vi.fn();

vi.mock("@frak-labs/wallet-shared", () => ({
    useGetUserBalance: () => mockUseGetUserBalance(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: mockT,
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@/module/common/utils/walletMode", () => ({
    isCryptoMode: true,
}));

describe("Balance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render balance label via i18n", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100.5 },
            },
        });

        render(<Balance />);

        expect(mockT).toHaveBeenCalledWith("common.balance");
    });

    it("should render integer and decimal parts separately", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100.5 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("100")).toBeInTheDocument();
        expect(screen.getByText(",50")).toBeInTheDocument();
        expect(screen.getByText("EUR")).toBeInTheDocument();
    });

    it("should render 0,00 EUR when userBalance is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: undefined,
        });

        render(<Balance />);

        expect(screen.getByText("0")).toBeInTheDocument();
        expect(screen.getByText(",00")).toBeInTheDocument();
    });

    it("should render 0,00 EUR when total is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: { total: undefined },
        });

        render(<Balance />);

        expect(screen.getByText("0")).toBeInTheDocument();
        expect(screen.getByText(",00")).toBeInTheDocument();
    });

    it("should format balance with 2 decimal places", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 123.456 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("123")).toBeInTheDocument();
        expect(screen.getByText(",46")).toBeInTheDocument();
    });

    it("should hide amount when eye icon is clicked", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("100")).toBeInTheDocument();

        // Click the EyeOff icon to hide
        const eyeIcon = screen.getByText("100").closest("div")
            ?.parentElement as HTMLElement;
        const svgButton = eyeIcon?.querySelector("svg");
        if (svgButton) {
            fireEvent.click(svgButton);
        }

        expect(screen.getByText("••••")).toBeInTheDocument();
    });

    it("should open empty transfer modal when amount is zero", async () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 0 },
            },
        });

        render(<Balance />);

        fireEvent.click(
            screen.getByRole("button", { name: "wallet.transferToBank" })
        );

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(
            await screen.findAllByText("wallet.transferEmpty.title")
        ).toHaveLength(2);
        expect(
            screen.getAllByText("wallet.transferEmpty.description")
        ).toHaveLength(2);
        expect(
            screen.getByRole("button", {
                name: "wallet.transferEmpty.discover",
            })
        ).toBeInTheDocument();
    });

    it("should navigate to offramp when amount is positive", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100 },
            },
        });

        render(<Balance />);

        fireEvent.click(
            screen.getByRole("button", { name: "wallet.transferToBank" })
        );

        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/monerium/offramp",
        });
    });

    it("should navigate to explorer when discover offers is clicked", async () => {
        const assignSpy = vi.fn();

        Object.defineProperty(window, "location", {
            value: {
                ...window.location,
                assign: assignSpy,
            },
            writable: true,
            configurable: true,
        });

        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 0 },
            },
        });

        render(<Balance />);

        fireEvent.click(
            screen.getByRole("button", { name: "wallet.transferToBank" })
        );

        fireEvent.click(
            await screen.findByRole("button", {
                name: "wallet.transferEmpty.discover",
            })
        );

        expect(assignSpy).toHaveBeenCalledWith("/explorer");
    });

    it("should render close button in empty transfer modal", async () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 0 },
            },
        });

        render(<Balance />);

        fireEvent.click(
            screen.getByRole("button", { name: "wallet.transferToBank" })
        );

        expect(
            await screen.findByRole("button", { name: "common.close" })
        ).toBeInTheDocument();
    });
});
