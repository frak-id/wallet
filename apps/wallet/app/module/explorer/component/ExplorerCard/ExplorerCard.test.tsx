import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { useFrakBonusEligibility } from "@frak-labs/wallet-shared";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { ExplorerCard } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    trackEvent: vi.fn(),
    useFrakBonusEligibility: vi.fn(),
}));

const mockView = vi.fn();
vi.mock("../../campaignView", () => ({
    useCampaignView: () => mockView(),
}));

function merchant(
    overrides: Partial<ExplorerMerchantItem> = {}
): ExplorerMerchantItem {
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
        ...overrides,
    };
}

describe("ExplorerCard", () => {
    test("shows the Frak bonus badge when eligible and a purchase referrer reward exists", () => {
        vi.mocked(useFrakBonusEligibility).mockReturnValue({
            isFrakReferred: true,
            isEligible: () => true,
        });
        mockView.mockReturnValue({ hasFrakBonusReward: true });

        const { getByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(getByText("explorer.frakBonus.label")).toBeInTheDocument();
    });

    test("hides the badge when ineligible", () => {
        vi.mocked(useFrakBonusEligibility).mockReturnValue({
            isFrakReferred: false,
            isEligible: () => false,
        });
        mockView.mockReturnValue({ hasFrakBonusReward: true });

        const { queryByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(queryByText("explorer.frakBonus.label")).not.toBeInTheDocument();
    });

    test("hides the badge when no reward has a purchase-triggered referrer share", () => {
        vi.mocked(useFrakBonusEligibility).mockReturnValue({
            isFrakReferred: true,
            isEligible: () => true,
        });
        mockView.mockReturnValue({ hasFrakBonusReward: false });

        const { queryByText } = render(<ExplorerCard merchant={merchant()} />);

        expect(queryByText("explorer.frakBonus.label")).not.toBeInTheDocument();
    });
});
