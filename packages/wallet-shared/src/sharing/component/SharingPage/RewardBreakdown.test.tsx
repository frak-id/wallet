import type { EstimatedReward } from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardBreakdown } from "./RewardBreakdown";

// Deterministic stand-in for the merchant-aware `t`: echoes the interpolated
// values so assertions read against concrete text instead of raw keys.
const t = (key: string, opts?: Record<string, unknown>): string => {
    switch (key) {
        case "sdk.sharingPage.faq.reward.referrerLabel":
            return "Reward as ambassador";
        case "sdk.sharingPage.faq.reward.refereeLabel":
            return "Reward for referee";
        case "sdk.sharingPage.faq.reward.percentOfBasket":
            return `${opts?.percent}% of basket`;
        case "sdk.sharingPage.faq.reward.percentExample":
            return `e.g. ${opts?.reward} for ${opts?.basket}`;
        case "sdk.sharingPage.faq.reward.tierAndAbove":
            return `${opts?.min} and above`;
        default:
            return key;
    }
};

// `formatAmount` uses a narrow no-break space; Testing Library normalizes DOM
// whitespace to plain spaces, so align expected strings the same way.
const fmt = (eur: number) => formatAmount(eur).replace(/\s/g, " ");

const tokenAmount = (eur: number) => ({
    amount: eur,
    eurAmount: eur,
    usdAmount: eur,
    gbpAmount: eur,
});

const fixed = (eur: number): EstimatedReward => ({
    payoutType: "fixed",
    amount: tokenAmount(eur),
});

const percentage = (percent: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
});

const tiered = (
    tiers: Extract<EstimatedReward, { payoutType: "tiered" }>["tiers"]
): EstimatedReward => ({
    payoutType: "tiered",
    tierField: "purchase_amount",
    tiers,
});

describe("RewardBreakdown", () => {
    it("renders tiered rows for both audiences", () => {
        const referrer = tiered([
            { minValue: 0, maxValue: 50, amount: tokenAmount(8) },
            { minValue: 50, amount: tokenAmount(18) },
        ]);
        const referee = tiered([
            { minValue: 0, maxValue: 50, amount: tokenAmount(2) },
            { minValue: 50, amount: tokenAmount(5) },
        ]);

        render(<RewardBreakdown referrer={referrer} referee={referee} t={t} />);

        expect(screen.getByText("Reward as ambassador")).toBeInTheDocument();
        expect(screen.getByText("Reward for referee")).toBeInTheDocument();

        // Per-audience amounts (unique) render as formatted values.
        expect(screen.getByText(fmt(8))).toBeInTheDocument();
        expect(screen.getByText(fmt(18))).toBeInTheDocument();
        expect(screen.getByText(fmt(2))).toBeInTheDocument();
        expect(screen.getByText(fmt(5))).toBeInTheDocument();

        // Bounded range + open-ended top tier appear once per audience.
        expect(screen.getAllByText(`0\u2013${fmt(50)}`)).toHaveLength(2);
        expect(screen.getAllByText(`${fmt(50)} and above`)).toHaveLength(2);
    });

    it("renders a percentage reward with a worked example at the 100 reference basket", () => {
        render(<RewardBreakdown referrer={percentage(10)} t={t} />);

        expect(screen.getByText("10% of basket")).toBeInTheDocument();
        expect(
            screen.getByText(`e.g. ${fmt(10)} for ${fmt(100)}`)
        ).toBeInTheDocument();
    });

    it("bumps the example basket to the campaign minimum when higher", () => {
        render(
            <RewardBreakdown
                referrer={percentage(10)}
                minPurchaseValue={150}
                t={t}
            />
        );

        expect(
            screen.getByText(`e.g. ${fmt(15)} for ${fmt(150)}`)
        ).toBeInTheDocument();
    });

    it("renders percent tiers with a per-tier example", () => {
        render(
            <RewardBreakdown
                referrer={tiered([{ minValue: 0, maxValue: 100, percent: 5 }])}
                t={t}
            />
        );

        expect(screen.getByText("5% of basket")).toBeInTheDocument();
        expect(
            screen.getByText(`e.g. ${fmt(5)} for ${fmt(100)}`)
        ).toBeInTheDocument();
    });

    it("shows only the audience that has a percentage/tiered reward", () => {
        render(
            <RewardBreakdown
                referrer={percentage(12)}
                referee={fixed(3)}
                t={t}
            />
        );

        expect(screen.getByText("Reward as ambassador")).toBeInTheDocument();
        expect(
            screen.queryByText("Reward for referee")
        ).not.toBeInTheDocument();
    });

    it("renders nothing when both rewards are fixed", () => {
        const { container } = render(
            <RewardBreakdown referrer={fixed(5)} referee={fixed(2)} t={t} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for a tiered reward with no tiers", () => {
        const { container } = render(
            <RewardBreakdown referrer={tiered([])} t={t} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when no rewards are provided", () => {
        const { container } = render(<RewardBreakdown t={t} />);
        expect(container).toBeEmptyDOMElement();
    });
});
