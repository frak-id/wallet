import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingTab } from "../BillingTab";

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: vi.fn(),
}));

vi.mock("@/module/common/hook/useActiveMerchantId", () => ({
    useActiveMerchantId: () => "merchant-1",
}));

vi.mock("../useBillingInfo", () => ({
    useBillingInfo: () => ({
        info: null,
        hasInfo: false,
        invoices: [],
        deposits: [],
        saveInfo: vi.fn(),
        isLoading: false,
        isSaving: false,
    }),
}));

vi.mock("../BillingInfoCard", () => ({
    BillingInfoCard: () => <div data-testid="billing-info-card" />,
}));

vi.mock("../AddDepositSheet", () => ({
    AddDepositSheet: () => <div data-testid="add-deposit-sheet" />,
}));

vi.mock("../AddWithdrawSheet", () => ({
    AddWithdrawSheet: () => <div data-testid="add-withdraw-sheet" />,
}));

const { useMyMerchants } = await import(
    "@/module/dashboard/hooks/useMyMerchants"
);

describe("BillingAdminPanel visibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("is hidden for non platform-admins", () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            isPlatformAdmin: false,
        } as ReturnType<typeof useMyMerchants>);

        render(<BillingTab />);

        expect(
            screen.queryByTestId("add-deposit-sheet")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("add-withdraw-sheet")
        ).not.toBeInTheDocument();
    });

    it("is shown for platform admins", () => {
        vi.mocked(useMyMerchants).mockReturnValue({
            isPlatformAdmin: true,
        } as ReturnType<typeof useMyMerchants>);

        render(<BillingTab />);

        expect(screen.getByTestId("add-deposit-sheet")).toBeInTheDocument();
        expect(screen.getByTestId("add-withdraw-sheet")).toBeInTheDocument();
    });
});
