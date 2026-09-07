import { renderHook } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import {
    createCampaign,
    updateCampaign,
} from "@/module/campaigns/api/campaignApi";
import {
    DEFAULT_PRODUCTS_FORM,
    productsFormToDraft,
} from "@/module/campaigns/component/Creation/ProductsCampaign/utils";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { type CampaignDraft, setStartDate } from "@/stores/campaignStore";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { Campaign } from "@/types/Campaign";
import { useSaveCampaign } from "./useSaveCampaign";

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(),
}));

const REWARD_TOKEN = "0x1234567890123456789012345678901234567890" as const;

const draft: CampaignDraft = {
    merchantId: "merchant-1",
    name: "Summer sale",
    rewardToken: REWARD_TOKEN,
    rule: { trigger: "purchase", conditions: [], rewards: [] },
    metadata: { goal: undefined, specialCategories: [], territories: [] },
    budgetConfig: [],
    expiresAt: "2024-12-31T00:00:00.000Z",
    priority: 0,
};

const mockCampaign: Campaign = {
    id: "created-99",
    merchantId: "merchant-1",
    name: "Summer sale",
    status: "draft",
    priority: 0,
    rule: { trigger: "purchase", conditions: [], rewards: [] },
    metadata: null,
    budgetConfig: null,
    budgetUsed: null,
    expiresAt: null,
    publishedAt: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    bankDistributionStatus: "distributing",
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useSaveCampaign", () => {
    describe("demo mode", () => {
        test("persists the submitted draft + id and reflects expiresAt", async ({
            freshCampaignStore,
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useIsDemoMode).mockReturnValue(true);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });
            const saved = await result.current.mutateAsync(draft);

            // Demo campaign reflects the schedule end (regression: was null).
            expect(saved.expiresAt).toBe(draft.expiresAt);
            expect(saved.id).toBeTruthy();

            // The store holds the just-saved values + id, not a stale draft.
            const stored = freshCampaignStore.getState().draft;
            expect(stored.id).toBe(saved.id);
            expect(stored.name).toBe("Summer sale");
            expect(stored.rewardToken).toBe(REWARD_TOKEN);
            expect(stored.expiresAt).toBe(draft.expiresAt);

            expect(createCampaign).not.toHaveBeenCalled();
        });
    });

    describe("create", () => {
        test("persists the submitted draft with the returned id", async ({
            freshCampaignStore,
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(createCampaign).mockResolvedValue(mockCampaign);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });
            await result.current.mutateAsync(draft);

            expect(createCampaign).toHaveBeenCalledTimes(1);

            // rewardToken (UI-only) survives — it is not derived from the
            // response, which has no rewards yet.
            const stored = freshCampaignStore.getState().draft;
            expect(stored.id).toBe("created-99");
            expect(stored.name).toBe("Summer sale");
            expect(stored.rewardToken).toBe(REWARD_TOKEN);
            expect(stored.expiresAt).toBe(draft.expiresAt);
        });
    });

    describe("update", () => {
        test("persists the submitted draft", async ({
            freshCampaignStore,
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(updateCampaign).mockResolvedValue(mockCampaign);

            const withId: CampaignDraft = {
                ...draft,
                id: "existing-1",
                name: "Edited name",
                rule: {
                    ...draft.rule,
                    rewards: [
                        {
                            recipient: "referrer",
                            type: "token",
                            amountType: "fixed",
                            amount: 5,
                        },
                    ],
                },
            };

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });
            await result.current.mutateAsync(withId);

            expect(updateCampaign).toHaveBeenCalledTimes(1);
            const stored = freshCampaignStore.getState().draft;
            expect(stored.id).toBe("existing-1");
            expect(stored.name).toBe("Edited name");
        });

        test("sends the products-step scope even with no rewards yet", async ({
            freshCampaignStore,
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(updateCampaign).mockResolvedValue(mockCampaign);

            const scoped = productsFormToDraft(
                {
                    ...DEFAULT_PRODUCTS_FORM,
                    mode: "specific",
                    field: "sku",
                    operator: "in",
                    values: ["SHOE-42"],
                },
                { ...draft, id: "existing-1" }
            );
            expect(scoped.rule.rewards).toHaveLength(0);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });
            await result.current.mutateAsync(scoped);

            expect(updateCampaign).toHaveBeenCalledWith(
                expect.objectContaining({
                    campaignId: "existing-1",
                    rule: expect.objectContaining({
                        productScope: [
                            {
                                field: "sku",
                                operator: "in",
                                value: ["SHOE-42"],
                            },
                        ],
                    }),
                })
            );
            expect(
                freshCampaignStore.getState().draft.rule.productScope
            ).toEqual(scoped.rule.productScope);
        });

        test("sends the start date set before the reward step", async ({
            freshCampaignStore,
            queryWrapper,
        }: TestContext) => {
            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(updateCampaign).mockResolvedValue(mockCampaign);

            const withStartDate: CampaignDraft = {
                ...draft,
                id: "existing-1",
                rule: setStartDate(draft.rule, "2024-06-01T00:00:00.000Z"),
            };

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });
            await result.current.mutateAsync(withStartDate);

            const [sent] = vi.mocked(updateCampaign).mock.calls[0] ?? [];
            const startCondition = {
                field: "time.timestamp",
                operator: "gte",
                value: Math.floor(
                    new Date("2024-06-01T00:00:00.000Z").getTime() / 1000
                ),
            };
            expect(sent?.rule?.conditions).toContainEqual(startCondition);
            expect(
                freshCampaignStore.getState().draft.rule.conditions
            ).toContainEqual(startCondition);
        });
    });
});
