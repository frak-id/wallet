import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

type BankData = {
    deployed: boolean;
    bankAddress: `0x${string}` | undefined;
    isManager: boolean;
    managerRole: "granted" | "no_wallet" | "missing";
    isOpen: boolean;
    vatApplicable: boolean;
    tokens: {
        symbol: string;
        address: `0x${string}`;
        balance: bigint;
        allowance: bigint;
    }[];
};

const bankAddress = "0x1111111111111111111111111111111111111111" as const;
const eureAddress = "0x2222222222222222222222222222222222222222" as const;
const refetch = vi.fn();
const syncBank = vi.fn();
const setOpenStatus = vi.fn();
let bankQuery: {
    data: BankData | undefined;
    isLoading: boolean;
    isError: boolean;
};
let canOnchain = true;
let syncState = { isPending: false, isError: false };

vi.mock("@/module/merchant/hook/useGetMerchantBank", () => ({
    useGetMerchantBank: () => ({ ...bankQuery, refetch }),
}));
vi.mock("@/module/common/hook/useCapabilities", () => ({
    useCapabilities: () => ({ canOnchain }),
}));
vi.mock("@/module/merchant/hook/useSyncMerchantBank", () => ({
    useSyncMerchantBank: () => ({ mutate: syncBank, ...syncState }),
}));
vi.mock("@/module/merchant/hook/useSetBankOpenStatus", () => ({
    useSetBankOpenStatus: () => ({
        setOpenStatus,
        isSettingOpenStatus: false,
        isOpenStatusError: false,
    }),
}));
vi.mock("./LegacyBankMigration", () => ({ LegacyBankMigration: () => null }));
vi.mock("./LinkWalletNotice", () => ({
    LinkWalletNotice: () => <div>link-wallet-notice</div>,
}));
vi.mock("./TokenCard", () => ({
    FundedTokenCard: () => <div>funded-card</div>,
    EmptyTokenCard: () => <div>empty-card</div>,
}));

import { BudgetView } from "./BudgetView";

function bank(overrides: Partial<BankData> = {}): BankData {
    return {
        deployed: true,
        bankAddress,
        isManager: true,
        managerRole: "granted",
        isOpen: true,
        vatApplicable: true,
        tokens: [
            {
                symbol: "eure",
                address: eureAddress,
                balance: 0n,
                allowance: 0n,
            },
        ],
        ...overrides,
    };
}

function renderView() {
    render(<BudgetView merchantId="merchant-1" onAddFunds={vi.fn()} />);
}

beforeEach(() => {
    bankQuery = { data: bank(), isLoading: false, isError: false };
    canOnchain = true;
    syncState = { isPending: false, isError: false };
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("BudgetView", () => {
    test("retries the budget query from the error view", () => {
        bankQuery = { data: undefined, isLoading: false, isError: true };
        renderView();

        expect(screen.getByText("funding.error")).toBeTruthy();
        fireEvent.click(screen.getByText("funding.retry"));
        expect(refetch).toHaveBeenCalledTimes(1);
    });

    test("explains what the budget is while no currency is funded", () => {
        renderView();
        expect(screen.getByText("funding.budget.intro")).toBeTruthy();
    });

    test("drops the intro once a currency is funded", () => {
        bankQuery = {
            data: bank({
                tokens: [
                    {
                        symbol: "eure",
                        address: eureAddress,
                        balance: 5n,
                        allowance: 5n,
                    },
                ],
            }),
            isLoading: false,
            isError: false,
        };
        renderView();
        expect(screen.queryByText("funding.budget.intro")).toBeNull();
    });

    test("names the Pay rewards switch for assistive tech", () => {
        renderView();
        expect(screen.getByRole("switch").getAttribute("aria-label")).toBe(
            "funding.budget.distributing"
        );
    });

    test("shows the hint that matches the switch position", () => {
        renderView();
        expect(
            screen.getByText("funding.budget.distributingHintOn")
        ).toBeTruthy();
        expect(
            screen.queryByText("funding.budget.distributingHintOff")
        ).toBeNull();
    });

    test("shows the off hint when Pay rewards is off", () => {
        bankQuery = {
            data: bank({ isOpen: false }),
            isLoading: false,
            isError: false,
        };
        renderView();
        expect(
            screen.getByText("funding.budget.distributingHintOff")
        ).toBeTruthy();
        expect(
            screen.queryByText("funding.budget.distributingHintOn")
        ).toBeNull();
    });

    test("tells a walletless owner why the Pay rewards switch is missing", () => {
        canOnchain = false;
        bankQuery = {
            data: bank({ isManager: false, managerRole: "no_wallet" }),
            isLoading: false,
            isError: false,
        };
        renderView();

        expect(screen.queryByRole("switch")).toBeNull();
        expect(
            screen.getByText("funding.budget.walletlessPayRewards")
        ).toBeTruthy();
        expect(screen.getByText("link-wallet-notice")).toBeTruthy();
    });

    test("keeps the walletless row off for a linked wallet without the manager role", () => {
        bankQuery = {
            data: bank({ isManager: false, managerRole: "missing" }),
            isLoading: false,
            isError: false,
        };
        renderView();
        expect(
            screen.queryByText("funding.budget.walletlessPayRewards")
        ).toBeNull();
    });

    test("shows a pending line while the budget is being set up", () => {
        bankQuery = {
            data: bank({ deployed: false, bankAddress: undefined }),
            isLoading: false,
            isError: false,
        };
        syncState = { isPending: true, isError: false };
        renderView();

        expect(screen.getByText("funding.setup.description")).toBeTruthy();
        expect(screen.getByText("funding.setup.pending")).toBeTruthy();
        expect(screen.queryByText("funding.pending")).toBeNull();
    });
});
