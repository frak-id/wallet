import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { ExplorerDetail } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: undefined }),
}));

vi.mock("@frak-labs/wallet-shared", async () => {
    const { createStore } = await import("zustand");
    return {
        buildSharingLink: () => undefined,
        clientIdStore: createStore(() => ({ clientId: undefined })),
        sessionStore: createStore(() => ({ session: undefined })),
        ExternalLink: ({ children }: { children: React.ReactNode }) => children,
        mergeTokenQueryOptions: () => ({ queryKey: [], queryFn: vi.fn() }),
        trackEvent: vi.fn(),
        ua: { isMobile: true },
        useCopyToClipboardWithState: () => ({ copied: false, copy: vi.fn() }),
        useShareLink: () => ({ mutate: vi.fn(), canShare: false }),
    };
});

vi.mock("../../campaignView", () => ({ useCampaignView: () => null }));
vi.mock("../../rewardOffer", () => ({ useRewardOffer: () => ({}) }));
vi.mock("../../hook/useAffiliateShareLink", () => ({
    useAffiliateShareLink: () => ({
        link: undefined,
        isLoading: false,
        create: vi.fn(),
        isCreating: false,
        isCreateError: false,
    }),
}));
vi.mock("../RewardOfferLines", () => ({ RewardOfferLines: () => null }));
vi.mock("./CampaignInfoSection", () => ({ CampaignInfoSection: () => null }));

function merchant(): ExplorerMerchantItem {
    return {
        id: "m1",
        name: "Brand",
        domain: "brand.example",
        explorerConfig: {
            heroImageUrl: "https://cdn.example/hero-1.jpg",
            heroImageUrls: ["https://cdn.example/hero-2.jpg"],
        },
        activeCampaignCount: 0,
        integration: "native",
        popularity: 0,
        views: 0,
        recent: null,
        expiring: null,
        reward: null,
    };
}

describe("ExplorerDetail", () => {
    test("hero slider opts out of the overlay edge swipe so a drag changes slide", () => {
        HTMLElement.prototype.scrollTo = vi.fn();
        const { container } = render(
            <ExplorerDetail merchant={merchant()} onClose={vi.fn()} />
        );

        const slider = container.querySelector("[data-owns-horizontal-drag]");

        expect(slider).not.toBeNull();
        expect(slider?.querySelectorAll("img")).toHaveLength(2);
    });
});
