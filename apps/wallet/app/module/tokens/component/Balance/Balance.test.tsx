import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { Balance } from "./index";

const mockUseGetUserBalance = vi.fn();
const mockUseGetPendingRewards = vi.fn();
const mockUseGetUnpaidRewards = vi.fn();
const mockNavigate = vi.fn();
const mockT = vi.fn((key: string) => key);
let mockLanguage = "en-US";

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        useGetUserBalance: () => mockUseGetUserBalance(),
        trackEvent: vi.fn(),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: mockT,
        i18n: { language: mockLanguage },
    }),
}));

vi.mock("@/module/tokens/hook/useGetPendingRewards", () => ({
    useGetPendingRewards: () => mockUseGetPendingRewards(),
}));

vi.mock("@/module/tokens/hook/useGetUnpaidRewards", () => ({
    useGetUnpaidRewards: () => mockUseGetUnpaidRewards(),
}));

describe("Balance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLanguage = "en-US";
        modalStore.getState().closeModal();
        mockUseGetPendingRewards.mockReturnValue({
            totalClaimable: 0,
            pendingRewards: [],
        });
        mockUseGetUnpaidRewards.mockReturnValue({ totalUnpaid: 0 });
    });
    it("should render balance label via i18n", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100.5 },
            },
        });

        render(<Balance />);

        expect(mockT).toHaveBeenCalledWith("wallet.balance.label");
    });

    it("formats the balance for an English locale", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 1234.5 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("€1,234")).toBeInTheDocument();
        expect(screen.getByText(".50")).toBeInTheDocument();
    });

    it("formats the balance for a French locale", () => {
        mockLanguage = "fr-FR";
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 1234.5 },
            },
        });

        render(<Balance />);

        expect(screen.getByText(/^1\s234$/)).toBeInTheDocument();
        expect(screen.getByText(",50")).toBeInTheDocument();
        expect(screen.getByText("€")).toBeInTheDocument();
    });

    it("should render €0.00 when userBalance is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: undefined,
        });

        render(<Balance />);

        expect(screen.getByText(".00").parentElement).toHaveTextContent(
            "€0.00"
        );
    });

    it("should render €0.00 when total is undefined", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: { total: undefined },
        });

        render(<Balance />);

        expect(screen.getByText(".00").parentElement).toHaveTextContent(
            "€0.00"
        );
    });

    it("should format balance with 2 decimal places", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 123.456 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("€123")).toBeInTheDocument();
        expect(screen.getByText(".46")).toBeInTheDocument();
    });

    it("should hide amount when eye icon is clicked", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: {
                total: { eurAmount: 100 },
            },
        });

        render(<Balance />);

        expect(screen.getByText("€100")).toBeInTheDocument();

        // Click the EyeOff icon to hide
        const eyeIcon = screen.getByText("€100").closest("div")
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

    it("adds the rewards not on-chain yet to the pending amount", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: { total: { eurAmount: 0 } },
        });
        mockUseGetPendingRewards.mockReturnValue({
            totalClaimable: 2,
            pendingRewards: [],
        });
        mockUseGetUnpaidRewards.mockReturnValue({ totalUnpaid: 1.5 });

        render(<Balance />);

        expect(screen.getByText("\u20ac3.50")).toBeInTheDocument();
    });

    it("opens the history when only rewards not on-chain yet are pending", () => {
        mockUseGetUserBalance.mockReturnValue({
            userBalance: { total: { eurAmount: 0 } },
        });
        mockUseGetUnpaidRewards.mockReturnValue({ totalUnpaid: 1 });

        render(<Balance />);

        fireEvent.click(
            screen
                .getByText("wallet.stats.pending")
                .closest("button") as HTMLButtonElement
        );

        expect(mockNavigate).toHaveBeenCalledWith({ to: "/history" });
        expect(modalStore.getState().modal).toBeNull();
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
