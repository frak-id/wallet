import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/common/component/Tooltip", () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/module/common/hook/useTokenMetadata", () => ({
    useTokenMetadata: () => ({ data: { decimals: 6, symbol: "EURe" } }),
}));
vi.mock("@frak-labs/react-sdk", () => ({
    useWalletStatus: () => ({ data: { wallet: undefined } }),
}));
vi.mock("@/module/merchant/hook/useBankAllowanceMutation", () => ({
    useBankAllowanceMutation: () => ({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));
vi.mock("@/module/merchant/hook/useWithdrawFromBank", () => ({
    useWithdrawFromBank: () => ({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));

import { EmptyTokenCard, FundedTokenCard } from "./TokenCard";

const bankAddress = "0x1111111111111111111111111111111111111111" as const;
const eure = "0x2222222222222222222222222222222222222222" as const;
const usdc = "0x3333333333333333333333333333333333333333" as const;

function renderFunded({
    balance = 5_000_000n,
    allowance = 5_000_000n,
    isBankOpen = true,
    isManager = true,
    vatApplicable = true,
}: {
    balance?: bigint;
    allowance?: bigint;
    isBankOpen?: boolean;
    isManager?: boolean;
    vatApplicable?: boolean;
} = {}) {
    render(
        <FundedTokenCard
            token={{ symbol: "eure", address: eure, balance, allowance }}
            merchantId="merchant-1"
            bankAddress={bankAddress}
            isManager={isManager}
            isBankOpen={isBankOpen}
            vatApplicable={vatApplicable}
        />
    );
}

describe("FundedTokenCard", () => {
    test("labels the headline total with the fees and VAT caption", () => {
        renderFunded();
        expect(screen.getByText("funding.budget.totalInclVat")).toBeTruthy();
    });

    test("uses the no-VAT caption when VAT does not apply", () => {
        renderFunded({ vatApplicable: false });
        expect(screen.getByText("funding.budget.totalExclVat")).toBeTruthy();
    });

    test("shows the plain currency name instead of the provider", () => {
        renderFunded();
        expect(
            screen.getByText("funding.budget.currencyName.euros")
        ).toBeTruthy();
        expect(screen.queryByText("Monerium")).toBeNull();
    });

    test("shows a healthy bank as active", () => {
        renderFunded();
        expect(screen.getByText("funding.budget.status.active")).toBeTruthy();
    });

    test("labels an owner's Pay rewards off as paused, not as a currency stop", () => {
        renderFunded({ isBankOpen: false });
        expect(screen.getByText("funding.budget.status.paused")).toBeTruthy();
        expect(
            screen.queryByText("funding.budget.status.currencyStopped")
        ).toBeNull();
    });

    test("labels a zero spending limit as stopped in this currency", () => {
        renderFunded({ allowance: 0n });
        expect(
            screen.getByText("funding.budget.status.currencyStopped")
        ).toBeTruthy();
        expect(screen.queryByText("funding.budget.status.paused")).toBeNull();
    });

    test("explains the consequence of a limit below the budget", () => {
        renderFunded({ allowance: 1_000_000n });
        expect(
            screen.getByText("funding.budget.status.actionNeeded")
        ).toBeTruthy();
        expect(screen.getByText("funding.budget.limitTooLow")).toBeTruthy();
        expect(
            screen.getByText("funding.budget.actions.increaseLimit")
        ).toBeTruthy();
    });

    test("tells the manager how to unlock withdrawing while Pay rewards is on", () => {
        renderFunded();
        expect(
            screen.getByText("funding.budget.actions.withdrawLocked")
        ).toBeTruthy();
        expect(
            screen.queryByText("funding.budget.actions.withdrawCta")
        ).toBeNull();
    });

    test("offers withdrawing, without the lock caption, once Pay rewards is off", () => {
        renderFunded({ isBankOpen: false });
        expect(
            screen.getByText("funding.budget.actions.withdrawCta")
        ).toBeTruthy();
        expect(
            screen.queryByText("funding.budget.actions.withdrawLocked")
        ).toBeNull();
    });

    test("shows no action or caption without the manager role", () => {
        renderFunded({ isManager: false });
        expect(
            screen.queryByText("funding.budget.actions.withdrawLocked")
        ).toBeNull();
        expect(screen.queryByText("funding.pause.title")).toBeNull();
    });
});

describe("EmptyTokenCard", () => {
    test("names the US dollar card in plain words", () => {
        render(
            <EmptyTokenCard
                token={{
                    symbol: "usdc",
                    address: usdc,
                    balance: 0n,
                    allowance: 0n,
                }}
            />
        );
        expect(
            screen.getByText("funding.budget.currencyName.dollars")
        ).toBeTruthy();
        expect(screen.queryByText("Circle")).toBeNull();
    });
});
