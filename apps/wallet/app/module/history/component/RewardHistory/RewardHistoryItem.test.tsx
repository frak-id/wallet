import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import {
    eur,
    makePlan,
    makeStep,
} from "@/module/history/utils/rewardPlan.fixtures";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { RewardHistoryItem } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            typeof opts?.count === "number"
                ? `${key}:${JSON.stringify(opts)}`
                : key,
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

    test("shows the draw-prize label for a game winner row", () => {
        const { getByText } = render(
            <RewardHistoryItem item={makeItem({ role: "winner" })} />
        );

        expect(getByText("reward.gamePrize.label")).toBeInTheDocument();
    });

    test("omits the welcome-bonus label for a regular referee row", () => {
        const { queryByText } = render(
            <RewardHistoryItem item={makeItem({ role: "referee" })} />
        );

        expect(queryByText("reward.frakBonus.label")).not.toBeInTheDocument();
    });

    test("marks a locked row with its unlock condition and padlocks", () => {
        const { getByText, container } = render(
            <RewardHistoryItem item={makeItem({ status: "locked" })} />
        );

        expect(getByText("reward.status.locked")).toBeInTheDocument();
        // One padlock on the logo badge, one next to the amount.
        expect(container.querySelectorAll("svg")).toHaveLength(2);
    });

    test.each([
        {
            label: "reward.status.pending",
            item: { purchase: { id: "p1", amount: 40, currency: "EUR" } },
        },
        { label: "reward.pending.onItsWay", item: { role: "winner" as const } },
        {
            label: "reward.pending.availableOn",
            item: { availableAt: Date.now() + 86_400_000 },
        },
    ])("labels a pending row $label", ({ label, item }) => {
        const { getByText } = render(
            <RewardHistoryItem
                item={makeItem({ status: "pending", ...item })}
            />
        );

        expect(getByText(label)).toBeInTheDocument();
    });

    describe("subscription plan", () => {
        const steps = [
            makeStep(1, { status: "paid" }),
            makeStep(2, { status: "paid" }),
            makeStep(3),
        ];

        test("shows the plan total like any reward amount", () => {
            const { getByText } = render(
                <RewardHistoryItem
                    item={makeItem({
                        amount: eur(25),
                        plan: makePlan(steps),
                    })}
                />
            );

            expect(getByText("+\u20ac25.00")).toBeInTheDocument();
        });

        test("puts a ≈ in front of the total when the plan is estimated", () => {
            const { getByText } = render(
                <RewardHistoryItem
                    item={makeItem({
                        amount: eur(25),
                        plan: makePlan(steps, { estimated: true }),
                    })}
                />
            );

            expect(getByText("\u2248 +\u20ac25.00")).toBeInTheDocument();
        });

        test("hints how many payments of the plan are earned", () => {
            const { getByText } = render(
                <RewardHistoryItem item={makeItem({ plan: makePlan(steps) })} />
            );

            expect(
                getByText('reward.plan.progress:{"count":2,"total":3}')
            ).toBeInTheDocument();
        });

        test("keeps the merchant and the role label of a plan row", () => {
            const { getByText } = render(
                <RewardHistoryItem
                    item={makeItem({
                        role: "welcome_bonus",
                        plan: makePlan(steps),
                    })}
                />
            );

            expect(getByText("Brand")).toBeInTheDocument();
            expect(getByText("reward.frakBonus.label")).toBeInTheDocument();
        });

        test("shows no progress hint and no ≈ on a reward without a plan", () => {
            const { queryByText, container } = render(
                <RewardHistoryItem item={makeItem()} />
            );

            expect(queryByText(/reward\.plan\.progress/)).toBeNull();
            expect(container.textContent).not.toContain("\u2248");
        });
    });
});
