import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import type { RewardOffer } from "../../rewardOffer";
import { ExplorerCard } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { amount?: string }) =>
            options?.amount ? `${key}:${options.amount}` : key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    trackEvent: vi.fn(),
}));

vi.mock("../../campaignView", () => ({
    useCampaignView: () => null,
}));

const mockOffer = vi.fn<() => RewardOffer>();
vi.mock("../../rewardOffer", () => ({
    useRewardOffer: () => mockOffer(),
}));

const fixed = {
    payoutType: "fixed",
    amount: { amount: 5, eurAmount: 5, usdAmount: 5, gbpAmount: 5 },
} as const;

function merchant(): ExplorerMerchantItem {
    return {
        id: "m1",
        name: "Brand",
        domain: "brand.example",
        explorerConfig: null,
        activeCampaignCount: 0,
        integration: "native",
        popularity: 0,
        views: 0,
        recent: null,
        expiring: null,
        reward: null,
    };
}

describe("ExplorerCard", () => {
    test("shows the first-purchase amount and the sharing amount", () => {
        mockOffer.mockReturnValue({
            purchase: { cashback: fixed, welcomeBonus: fixed, amount: "10 €" },
            share: { amount: "5 €" },
        });

        const { getByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(
            getByText("explorer.offer.purchaseFirst:10 €")
        ).toBeInTheDocument();
        expect(
            getByText("explorer.detail.rewardPerReferral:5 €")
        ).toBeInTheDocument();
    });

    test("shows plain cashback when there is no welcome bonus", () => {
        mockOffer.mockReturnValue({
            purchase: { cashback: fixed, amount: "5 €" },
        });

        const { getByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(getByText("explorer.offer.purchase:5 €")).toBeInTheDocument();
    });

    test("shows only the sharing amount when buying earns nothing", () => {
        mockOffer.mockReturnValue({
            share: { amount: "5 €" },
        });

        const { getByText, queryByText } = render(
            <ExplorerCard merchant={merchant()} />
        );

        expect(
            getByText("explorer.detail.rewardPerReferral:5 €")
        ).toBeInTheDocument();
        expect(
            queryByText(/explorer\.offer\.purchase/)
        ).not.toBeInTheDocument();
    });

    test("falls back to the domain without any reward", () => {
        mockOffer.mockReturnValue({});

        const { getByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(getByText("brand.example")).toBeInTheDocument();
    });
});
