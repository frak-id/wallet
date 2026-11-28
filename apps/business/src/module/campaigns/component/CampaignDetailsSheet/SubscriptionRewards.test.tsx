import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RewardDefinition } from "@/types/Campaign";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key} ${JSON.stringify(options)}` : key,
        i18n: { language: "en" },
    }),
}));

import { SubscriptionRewardsSection } from "./SubscriptionRewards";

const fixed = (
    recipient: "referrer" | "referee",
    amount: number,
    cycles?: { from: number; to: number }
): RewardDefinition => ({
    recipient,
    type: "token",
    amountType: "fixed",
    amount,
    ...(cycles ? { cycles } : {}),
});

const CONFIG = "campaigns.details.config.subscription";
const PROGRESSION = "campaigns.create.validation.subscription.progression";
const TITLE = "campaigns.create.reward.subscription.periods.title";

describe("SubscriptionRewardsSection (ConfigTab)", () => {
    const rewards = [
        fixed("referrer", 10, { from: 1, to: 1 }),
        fixed("referrer", 5, { from: 2, to: 5 }),
        fixed("referee", 4, { from: 1, to: 1 }),
    ];

    it("names each range like the wizard's periods instead of one flat reward", () => {
        render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{ inactivityDays: 45 }}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${TITLE}.cycle.one {"from":1}`)
        ).toBeInTheDocument();
        expect(
            screen.getByText(`${TITLE}.cycle.range {"from":2,"to":5}`)
        ).toBeInTheDocument();
    });

    it("calls a range covering the whole plan all of its steps", () => {
        render(
            <SubscriptionRewardsSection
                rewards={[fixed("referrer", 5, { from: 1, to: 6 })]}
                subscription={{ stepBy: "duration", stepDays: 30 }}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(screen.getByText(`${TITLE}.duration.all`)).toBeInTheDocument();
    });

    it("ends each recipient's plan at its own last step", () => {
        render(
            <SubscriptionRewardsSection
                rewards={[
                    fixed("referrer", 5, { from: 1, to: 5 }),
                    fixed("referee", 2, { from: 1, to: 2 }),
                    fixed("referee", 1, { from: 3, to: 3 }),
                ]}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(screen.getByText(`${TITLE}.cycle.all`)).toBeInTheDocument();
        expect(
            screen.getByText(`${TITLE}.cycle.range {"from":1,"to":2}`)
        ).toBeInTheDocument();
    });

    it("lists the ranges in step order whatever the stored order", () => {
        render(
            <SubscriptionRewardsSection
                rewards={[rewards[1], rewards[0]]}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        const labels = screen
            .getAllByText(/periods\.title\.cycle\.(one|range)/)
            .map((node) => node.textContent);
        expect(labels).toEqual([
            `${TITLE}.cycle.one {"from":1}`,
            `${TITLE}.cycle.range {"from":2,"to":5}`,
        ]);
    });

    it("prices each range with its own reward value", () => {
        const { container } = render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(container.textContent).toContain(
            'campaigns.details.config.rewards.fixed {"amount":10,"currency":"EUR"}'
        );
        expect(container.textContent).toContain(
            'campaigns.details.config.rewards.fixed {"amount":5,"currency":"EUR"}'
        );
    });

    it("shows the inactivity window the rule stores", () => {
        render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{ inactivityDays: 45 }}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${CONFIG}.inactivityValue {"count":45}`)
        ).toBeInTheDocument();
    });

    it("shows the 90-day default when the rule stores no inactivity window", () => {
        render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${CONFIG}.inactivityValue {"count":90}`)
        ).toBeInTheDocument();
    });

    it("renders a range outside the first-payment and renewal shape instead of failing", () => {
        render(
            <SubscriptionRewardsSection
                rewards={[
                    fixed("referrer", 3, { from: 4, to: 9 }),
                    fixed("referrer", 1, { from: 7, to: 7 }),
                ]}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${TITLE}.cycle.range {"from":4,"to":9}`)
        ).toBeInTheDocument();
        expect(
            screen.getByText(`${TITLE}.cycle.one {"from":7}`)
        ).toBeInTheDocument();
    });

    it("shows the amount that unlocks each step of an amount plan", () => {
        render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{ stepBy: "amount", stepAmount: 30 }}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${PROGRESSION}.amount {"amount":"30€"}`)
        ).toBeInTheDocument();
        expect(
            screen.getByText(`${TITLE}.amount.range {"from":2,"to":5}`)
        ).toBeInTheDocument();
    });

    it("shows the length of a duration plan's steps", () => {
        render(
            <SubscriptionRewardsSection
                rewards={rewards}
                subscription={{ stepBy: "duration", stepDays: 30 }}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        expect(
            screen.getByText(`${PROGRESSION}.duration {"count":30}`)
        ).toBeInTheDocument();
    });

    it("renders the empty notice when the campaign has no reward yet", () => {
        render(
            <SubscriptionRewardsSection
                rewards={[]}
                subscription={{}}
                currency="EUR"
                currencyGlyph="€"
            />
        );

        const section = screen.getByRole("heading", {
            name: `${CONFIG}.title`,
        }).parentElement as HTMLElement;
        expect(
            within(section).getByText("campaigns.details.config.rewards.empty")
        ).toBeInTheDocument();
    });
});
