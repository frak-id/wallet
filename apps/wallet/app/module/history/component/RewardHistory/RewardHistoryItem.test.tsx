import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { RewardHistoryItem } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@/module/stores/modalStore", () => ({
    modalStore: { getState: () => ({ openModal: vi.fn() }) },
}));

function makeItem(
    overrides: Partial<RewardHistoryItemType> = {}
): RewardHistoryItemType {
    return {
        merchant: { name: "Brand", domain: "brand.example" },
        token: { symbol: "USDC", decimals: 6 },
        amount: { amount: 5, eurAmount: 5, usdAmount: 5, gbpAmount: 5 },
        status: "settled",
        role: "referee",
        trigger: "purchase",
        createdAt: 1_700_000_000_000,
        ...overrides,
    } as RewardHistoryItemType;
}

describe("RewardHistoryItem", () => {
    test("shows the welcome-bonus label for a welcome_bonus row", () => {
        const { getByText } = render(
            <RewardHistoryItem item={makeItem({ role: "welcome_bonus" })} />
        );

        expect(getByText("reward.frakBonus.label")).toBeInTheDocument();
    });

    test("omits the welcome-bonus label for a regular referee row", () => {
        const { queryByText } = render(
            <RewardHistoryItem item={makeItem({ role: "referee" })} />
        );

        expect(queryByText("reward.frakBonus.label")).not.toBeInTheDocument();
    });
});
