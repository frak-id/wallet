import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { RewardDetailModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}:${JSON.stringify(opts)}` : key,
        i18n: { language: "en" },
    }),
}));

function makeItem(
    overrides: Partial<RewardHistoryItem> = {}
): RewardHistoryItem {
    return {
        merchant: { name: "Brand", domain: "brand.example" },
        token: { symbol: "USDC", decimals: 6 },
        amount: { amount: 5, eurAmount: 5, usdAmount: 5, gbpAmount: 5 },
        status: "settled",
        role: "referee",
        trigger: "purchase",
        createdAt: 1_700_000_000_000,
        ...overrides,
    } as RewardHistoryItem;
}

describe("RewardDetailModal", () => {
    test("shows the bonus explanation block for a welcome_bonus item", () => {
        const { getByText } = render(
            <RewardDetailModal
                item={makeItem({ role: "welcome_bonus" })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.frakBonus.detailTitle")).toBeInTheDocument();
    });

    test("omits the bonus explanation block for a regular referee item", () => {
        const { queryByText } = render(
            <RewardDetailModal
                item={makeItem({ role: "referee" })}
                onClose={vi.fn()}
            />
        );

        expect(
            queryByText("reward.frakBonus.detailTitle")
        ).not.toBeInTheDocument();
    });

    test("dates a reward without a purchase as earned, not purchased", () => {
        const { getByText, queryByText } = render(
            <RewardDetailModal
                item={makeItem({ status: "locked", trigger: "drop_join" })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.detail.earnedDate")).toBeInTheDocument();
        expect(
            queryByText("reward.detail.purchaseDate")
        ).not.toBeInTheDocument();
    });

    test("keeps the purchase date label when a purchase is behind the reward", () => {
        const { getByText } = render(
            <RewardDetailModal
                item={makeItem({
                    purchase: { id: "p1", amount: 40, currency: "EUR" },
                })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.detail.purchaseDate")).toBeInTheDocument();
    });

    test("explains how a locked reward unlocks instead of offering to collect it", () => {
        const { getByText, queryByText } = render(
            <RewardDetailModal
                item={makeItem({ status: "locked" })}
                onClose={vi.fn()}
            />
        );

        expect(
            getByText("reward.detail.lockedExplanation")
        ).toBeInTheDocument();
        expect(queryByText("reward.detail.toCollect")).not.toBeInTheDocument();
    });

    test("tells a referrer the reward waits on their friend's first brand reward", () => {
        const { getByText } = render(
            <RewardDetailModal
                item={makeItem({ status: "locked", waitsOnFriend: true })}
                onClose={vi.fn()}
            />
        );

        expect(
            getByText("reward.detail.lockedOnFriendExplanation")
        ).toBeInTheDocument();
    });
});
