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
        id: "asset-1",
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

    test("explains the prize for a game winner item", () => {
        const { getByText, queryByText } = render(
            <RewardDetailModal
                item={makeItem({ role: "winner" })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.gamePrize.detailTitle")).toBeInTheDocument();
        expect(queryByText("reward.frakBonus.detailTitle")).toBeNull();
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
                item={makeItem({ status: "locked", trigger: "game_join" })}
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

    test("offers to collect a reward that is on-chain", () => {
        const { getByText } = render(
            <RewardDetailModal
                item={makeItem({ status: "settled" })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.detail.toCollect")).toBeInTheDocument();
    });

    test.each(["processing", "bank_depleted", "cancelled", "expired"] as const)(
        "says where a %s reward stands instead of offering to collect it",
        (status) => {
            const { getByText, queryByText } = render(
                <RewardDetailModal
                    item={makeItem({ status })}
                    onClose={vi.fn()}
                />
            );

            expect(getByText(`reward.status.${status}`)).toBeInTheDocument();
            expect(
                queryByText("reward.detail.toCollect")
            ).not.toBeInTheDocument();
        }
    );

    test.each([
        { status: "cancelled", shown: "\u20ac5.00" },
        { status: "bank_depleted", shown: "+\u20ac5.00" },
    ] as const)(
        "signs a $status reward's amount as $shown",
        ({ status, shown }) => {
            const { getByText } = render(
                <RewardDetailModal
                    item={makeItem({ status })}
                    onClose={vi.fn()}
                />
            );

            expect(getByText(shown)).toBeInTheDocument();
        }
    );

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

    test("keeps the brand validation copy for a pending purchase reward", () => {
        const { getByText } = render(
            <RewardDetailModal
                item={makeItem({
                    status: "pending",
                    purchase: { id: "p1", amount: 40, currency: "EUR" },
                })}
                onClose={vi.fn()}
            />
        );

        expect(
            getByText("reward.detail.pendingValidation")
        ).toBeInTheDocument();
        expect(
            getByText("reward.detail.pendingDisclaimer")
        ).toBeInTheDocument();
    });

    test("says a pending prize is on its way, not awaiting the brand", () => {
        const { getByText, queryByText } = render(
            <RewardDetailModal
                item={makeItem({
                    status: "pending",
                    role: "winner",
                    trigger: "custom",
                })}
                onClose={vi.fn()}
            />
        );

        expect(getByText("reward.pending.onItsWay")).toBeInTheDocument();
        expect(
            getByText("reward.pending.onItsWayDisclaimer")
        ).toBeInTheDocument();
        expect(
            queryByText("reward.detail.pendingDisclaimer")
        ).not.toBeInTheDocument();
    });

    test("dates a pending reward without a purchase from its lockup", () => {
        const { getByText, queryByText } = render(
            <RewardDetailModal
                item={makeItem({
                    status: "pending",
                    trigger: "referral_signup",
                    availableAt: Date.now() + 86_400_000,
                })}
                onClose={vi.fn()}
            />
        );

        expect(
            getByText("reward.pending.availableOnLabel")
        ).toBeInTheDocument();
        expect(
            getByText("reward.pending.availableOnDisclaimer")
        ).toBeInTheDocument();
        expect(
            queryByText("reward.detail.pendingValidation")
        ).not.toBeInTheDocument();
    });
});
