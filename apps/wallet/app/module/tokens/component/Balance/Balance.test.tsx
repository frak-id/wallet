import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { Balance } from "./index";

const mockUseGetUserBalance = vi.fn();
const mockUseGetPendingRewards = vi.fn();
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

vi.mock("@/module/tokens/hooks/useGetPendingRewards", () => ({
    useGetPendingRewards: () => mockUseGetPendingRewards(),
}));

describe("Balance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        modalStore.getState().closeModal();
        mockUseGetPendingRewards.mockReturnValue({
            totalClaimable: 0,
            pendingRewards: [],
            queryData: {},
        });
    });
    it("should render balance label via i18n", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100.5 },
            },
        });

        render(<Balance />);

        expect(mockT).toHaveBeenCalledWith("common.rewards");
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

    it("should open empty transfer modal when amount is zero", () => {
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
        expect(modalStore.getState().modal).toEqual({
            id: "emptyTransfer",
        });
    });

    it("should open empty pending gains modal when pending stat card is clicked with zero amount", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 0 },
            },
        });

        render(<Balance />);

        const pendingCardButton = screen
            .getByText("wallet.stats.pending")
            .closest("button");

        expect(pendingCardButton).toBeInTheDocument();

        fireEvent.click(pendingCardButton as HTMLButtonElement);

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(modalStore.getState().modal).toEqual({
            id: "emptyPendingGains",
        });
    });

    it("should open pending gains modal when pending stat card is clicked with positive amount", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 50 },
            },
        });
        mockUseGetPendingRewards.mockReturnValue({
            totalClaimable: 50,
            pendingRewards: [],
            queryData: {},
        });

        render(<Balance />);

        const pendingCardButton = screen
            .getByText("wallet.stats.pending")
            .closest("button");

        fireEvent.click(pendingCardButton as HTMLButtonElement);

        expect(modalStore.getState().modal).toEqual({
            id: "pendingGains",
        });
    });

    it("should open empty transferred gains modal when lifetime stat card is clicked with zero amount", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 0 },
            },
        });

        render(<Balance />);

        const lifetimeCardButton = screen
            .getByText("wallet.stats.lifetime")
            .closest("button");

        expect(lifetimeCardButton).toBeInTheDocument();

        fireEvent.click(lifetimeCardButton as HTMLButtonElement);

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(modalStore.getState().modal).toEqual({
            id: "emptyTransferredGains",
        });
    });

    it("should open transfer modal when amount is positive", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100 },
            },
        });

        render(<Balance />);

        fireEvent.click(
            screen.getByRole("button", { name: "wallet.transferToBank" })
        );

        expect(modalStore.getState().modal).toEqual({
            id: "transfer",
        });
    });
});
