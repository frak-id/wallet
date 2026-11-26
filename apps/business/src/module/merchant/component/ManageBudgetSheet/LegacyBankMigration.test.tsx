import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { amount?: string }) =>
            options?.amount ? `${key}|${options.amount}` : key,
    }),
}));

let canOnchain = false;
let legacyStatus: {
    token: `0x${string}`;
    balance: bigint;
    totalPending: bigint;
    withdrawable: bigint;
    isDistributionEnabled: boolean;
} | null = null;

vi.mock("@/module/common/hook/useCapabilities", () => ({
    useCapabilities: () => ({ canOnchain }),
}));
vi.mock("@/module/common/hook/useTokenMetadata", () => ({
    useTokenMetadata: () => ({ data: { decimals: 6, symbol: "EURe" } }),
}));
vi.mock("@/module/merchant/hook/useGetLegacyBankStatus", () => ({
    useGetLegacyBankStatus: () => ({ data: legacyStatus, isLoading: false }),
}));
vi.mock("@/module/merchant/hook/useMigrateLegacyBank", () => ({
    useMigrateLegacyBank: () => ({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));
vi.mock("@/module/merchant/hook/useMerchant", () => ({
    useMerchant: () => ({ data: { domain: "legacy.example" } }),
}));
vi.mock("@/module/merchant/utils/computeProductId", () => ({
    computeProductId: () => "0xproduct",
}));
vi.mock("@/module/merchant/utils/legacyBanks", () => ({
    legacyBankMap: {
        "0xproduct": "0x4444444444444444444444444444444444444444",
    },
}));

import { LegacyBankMigration } from "./LegacyBankMigration";

const newBank = "0x1111111111111111111111111111111111111111" as const;
const token = "0x2222222222222222222222222222222222222222" as const;

function fundedStatus() {
    return {
        token,
        balance: 12_000_000n,
        totalPending: 2_000_000n,
        withdrawable: 10_000_000n,
        isDistributionEnabled: false,
    };
}

describe("LegacyBankMigration", () => {
    test("shows a walletless owner the amount and a pointer, with no move button", () => {
        canOnchain = false;
        legacyStatus = fundedStatus();
        render(
            <LegacyBankMigration
                merchantId="merchant-1"
                newBankAddress={newBank}
            />
        );

        expect(
            screen.getByText("funding.legacy.walletless|10 EURe")
        ).toBeTruthy();
        expect(screen.queryByText("funding.legacy.migrate")).toBeNull();
    });

    test("keeps the move button for a linked wallet", () => {
        canOnchain = true;
        legacyStatus = fundedStatus();
        render(
            <LegacyBankMigration
                merchantId="merchant-1"
                newBankAddress={newBank}
            />
        );
        expect(screen.getByText("funding.legacy.migrate")).toBeTruthy();
        expect(
            screen.queryByText("funding.legacy.walletless|10 EURe")
        ).toBeNull();
    });

    test("shows nothing when the old budget has nothing to move", () => {
        canOnchain = false;
        legacyStatus = { ...fundedStatus(), withdrawable: 0n };
        const { container } = render(
            <LegacyBankMigration
                merchantId="merchant-1"
                newBankAddress={newBank}
            />
        );
        expect(container.textContent).toBe("");
    });
});
