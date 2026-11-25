import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { formatDayMonth } from "@/module/history/utils/formatDayMonth";
import {
    eur,
    makePlan,
    makeStep,
} from "@/module/history/utils/rewardPlan.fixtures";
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

    describe("subscription plan", () => {
        const DAY = 86_400_000;

        function renderPlan(
            steps: ReturnType<typeof makeStep>[],
            overrides: {
                plan?: Parameters<typeof makePlan>[1];
                item?: Partial<RewardHistoryItem>;
            } = {}
        ) {
            return render(
                <RewardDetailModal
                    item={makeItem({
                        amount: eur(20),
                        status: "pending",
                        plan: makePlan(steps, {
                            paidAmount: eur(5),
                            pendingAmount: eur(15),
                            ...overrides.plan,
                        }),
                        ...overrides.item,
                    })}
                    onClose={vi.fn()}
                />
            );
        }

        function stepLabel(key: string) {
            return new RegExp(`^${key.replaceAll(".", "\\.")}:`);
        }

        test("shows the plan total, then what is paid and what is still to come", () => {
            const { getByText } = renderPlan([makeStep(1)]);

            expect(getByText("+\u20ac20.00")).toBeInTheDocument();
            expect(getByText("\u20ac5.00")).toBeInTheDocument();
            expect(getByText("\u20ac15.00")).toBeInTheDocument();
        });

        test("shows how many payments are earned out of the plan", () => {
            const { getByText } = renderPlan([makeStep(1), makeStep(2)], {
                plan: { stepsEarned: 1, stepsTotal: 2 },
            });

            expect(
                getByText('reward.plan.progress:{"count":1,"total":2}')
            ).toBeInTheDocument();
        });

        test("prefixes the total and the pending amount with ≈ when the plan is estimated", () => {
            const { getByText } = renderPlan([makeStep(1)], {
                plan: { estimated: true },
            });

            expect(getByText("\u2248 +\u20ac20.00")).toBeInTheDocument();
            expect(getByText("\u2248 \u20ac15.00")).toBeInTheDocument();
            expect(getByText("\u20ac5.00")).toBeInTheDocument();
        });

        test("shows no ≈ when every step of the plan is exact", () => {
            const { container } = renderPlan([makeStep(1), makeStep(2)]);

            expect(container.textContent).not.toContain("\u2248");
        });

        test("dates a paid step by its settlement", () => {
            const settledAt = 1_700_000_000_000;
            const { getByText } = renderPlan([
                makeStep(1, {
                    status: "paid",
                    amount: eur(7),
                    settledAt,
                }),
            ]);

            expect(getByText("\u20ac7.00")).toBeInTheDocument();
            expect(
                getByText(
                    `reward.plan.step.paidOn:${JSON.stringify({ date: formatDayMonth(settledAt, "en") })}`
                )
            ).toBeInTheDocument();
        });

        test("dates an unlocking step by the day it becomes available", () => {
            const availableAt = Date.now() + 3 * DAY;
            const { getByText } = renderPlan([
                makeStep(2, { status: "unlocking", availableAt }),
            ]);

            expect(
                getByText(
                    `reward.plan.step.unlockingOn:${JSON.stringify({ date: formatDayMonth(availableAt, "en") })}`
                )
            ).toBeInTheDocument();
        });

        test("says an unlocking step without a date is unlocking soon", () => {
            const { getByText, queryByText } = renderPlan([
                makeStep(2, { status: "unlocking" }),
            ]);

            expect(
                getByText(stepLabel("reward.plan.step.unlockingSoon"))
            ).toBeInTheDocument();
            expect(
                queryByText(stepLabel("reward.plan.step.unlockingOn"))
            ).not.toBeInTheDocument();
        });

        test("tells a referrer an upcoming step unlocks at the next renewal", () => {
            const { getByText, queryByText } = renderPlan(
                [makeStep(3, { status: "upcoming" })],
                { item: { role: "referrer" } }
            );

            expect(
                getByText(stepLabel("reward.plan.step.upcoming"))
            ).toBeInTheDocument();
            expect(
                queryByText(stepLabel("reward.plan.step.upcomingReferee"))
            ).not.toBeInTheDocument();
        });

        test("tells a referee an upcoming step unlocks at their own renewal", () => {
            const { getByText } = renderPlan(
                [makeStep(3, { status: "upcoming" })],
                { item: { role: "referee" } }
            );

            expect(
                getByText(stepLabel("reward.plan.step.upcomingReferee"))
            ).toBeInTheDocument();
        });

        test("shows an upcoming step with an estimated amount as ≈", () => {
            const { getByText } = renderPlan([
                makeStep(3, {
                    status: "upcoming",
                    estimated: true,
                    amount: eur(4.5),
                }),
            ]);

            expect(getByText("\u2248 \u20ac4.50")).toBeInTheDocument();
        });

        test("shows an upcoming step with a fixed amount without ≈", () => {
            const { getByText } = renderPlan([
                makeStep(3, { status: "upcoming", amount: eur(4.5) }),
            ]);

            expect(getByText("\u20ac4.50")).toBeInTheDocument();
        });

        test("calls an expired step expired", () => {
            const { getByText } = renderPlan(
                [makeStep(4, { status: "expired" })],
                { item: { status: "expired" } }
            );

            expect(
                getByText(stepLabel("reward.plan.step.expired"))
            ).toBeInTheDocument();
        });

        test.each(["referrer", "referee"] as const)(
            "never mentions a cancellation to a %s whatever the step states",
            (role) => {
                const { container } = renderPlan(
                    [
                        makeStep(1, { status: "paid", settledAt: Date.now() }),
                        makeStep(2, { status: "unlocking" }),
                        makeStep(3, { status: "upcoming" }),
                        makeStep(4, { status: "expired" }),
                    ],
                    { item: { role, status: "expired" } }
                );

                expect(container.textContent).not.toMatch(/cancel|friend/i);
            }
        );

        test("replaces the single-reward status rows with the steps", () => {
            const { queryByText } = renderPlan([makeStep(1)], {
                item: { status: "locked" },
            });

            expect(
                queryByText("reward.detail.lockedExplanation")
            ).not.toBeInTheDocument();
            expect(
                queryByText("reward.detail.toCollect")
            ).not.toBeInTheDocument();
            expect(
                queryByText("reward.detail.rewardGenerated")
            ).not.toBeInTheDocument();
        });

        test("lists the steps in order with their number", () => {
            const { getAllByText } = renderPlan([
                makeStep(2),
                makeStep(1),
                makeStep(3),
            ]);

            expect(
                getAllByText(/^reward\.plan\.step\.label:/).map(
                    (node) => node.textContent
                )
            ).toEqual([
                'reward.plan.step.label:{"step":1}',
                'reward.plan.step.label:{"step":2}',
                'reward.plan.step.label:{"step":3}',
            ]);
        });
    });
});
