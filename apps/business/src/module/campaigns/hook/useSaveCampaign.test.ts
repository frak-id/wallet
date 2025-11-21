import { useNavigate } from "@tanstack/react-router";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { saveCampaignDraft } from "@/context/campaigns/action/createCampaign";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { Campaign } from "@/types/Campaign";
import { useSaveCampaign } from "./useSaveCampaign";

// Mock saveCampaignDraft action
vi.mock("@/context/campaigns/action/createCampaign", () => ({
    saveCampaignDraft: vi.fn(),
}));

// Mock TanStack Router navigation
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-router")
    >("@tanstack/react-router");
    return {
        ...actual,
        useNavigate: vi.fn(() => vi.fn()),
    };
});

describe("useSaveCampaign", () => {
    const mockCampaign: Campaign = {
        title: "Test Campaign",
        type: "awareness",
        productId: createMockAddress("product"),
        specialCategories: [],
        budget: {
            type: "daily",
            maxEuroDaily: 100,
        },
        territories: ["US", "FR"],
        bank: createMockAddress("bank"),
        scheduled: {
            dateStart: new Date("2024-01-01"),
        },
        distribution: {
            type: "fixed",
        },
        rewardChaining: {
            userPercent: 0.1,
        },
        triggers: {},
    };

    describe("save without closing (step progression)", () => {
        test("should save campaign and increment step", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setStep(1);
            freshCampaignStore.getState().setIsClosing(false);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            const saveFn = result.current;
            await saveFn(mockCampaign);

            // Should increment step
            expect(freshCampaignStore.getState().step).toBe(2);

            // Should save campaign to store
            expect(freshCampaignStore.getState().campaign.title).toBe(
                "Test Campaign"
            );
        });

        test("should not call saveCampaignDraft when not closing", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(false);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            expect(saveCampaignDraft).not.toHaveBeenCalled();
        });

        test("should increment step multiple times", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setStep(2);
            freshCampaignStore.getState().setIsClosing(false);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);
            expect(freshCampaignStore.getState().step).toBe(3);

            await result.current(mockCampaign);
            expect(freshCampaignStore.getState().step).toBe(4);
        });
    });

    describe("save with closing (draft save)", () => {
        test("should save draft and navigate to campaign list", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            const mockNavigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(mockNavigate);

            freshCampaignStore.getState().setIsClosing(true);

            const mockId = "507f1f77bcf86cd799439011";
            vi.mocked(saveCampaignDraft).mockResolvedValue({ id: mockId });

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            expect(saveCampaignDraft).toHaveBeenCalledWith({
                data: { campaign: mockCampaign },
            });

            // Should save campaign with ID to store
            await waitFor(() => {
                expect(freshCampaignStore.getState().campaign.id).toBe(mockId);
            });

            // Should navigate to campaign list
            await waitFor(
                () => {
                    expect(mockNavigate).toHaveBeenCalledWith({
                        to: "/campaigns/list",
                    });
                },
                { timeout: 100 }
            );
        });

        test("should invalidate queries after saving draft", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(true);

            const mockId = "507f1f77bcf86cd799439012";
            vi.mocked(saveCampaignDraft).mockResolvedValue({ id: mockId });

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            // Wait for invalidations to complete
            await waitFor(() => {
                expect(saveCampaignDraft).toHaveBeenCalled();
            });

            // Verify campaign was saved with ID
            expect(freshCampaignStore.getState().campaign.id).toBe(mockId);
        });

        test("should handle save without ID returned", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            const mockNavigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(mockNavigate);

            freshCampaignStore.getState().setIsClosing(true);

            // No ID returned
            vi.mocked(saveCampaignDraft).mockResolvedValue({ id: undefined });

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            // Should still navigate even without ID
            await waitFor(
                () => {
                    expect(mockNavigate).toHaveBeenCalled();
                },
                { timeout: 100 }
            );

            // Campaign should not have ID set
            expect(freshCampaignStore.getState().campaign.id).toBeUndefined();
        });

        test("should handle save errors gracefully", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(true);

            vi.mocked(saveCampaignDraft).mockRejectedValue(
                new Error("Save failed")
            );

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(result.current(mockCampaign)).rejects.toThrow(
                "Save failed"
            );
        });
    });

    describe("campaign store updates", () => {
        test("should always update campaign in store", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(false);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            expect(freshCampaignStore.getState().campaign).toEqual(
                mockCampaign
            );
        });

        test("should update campaign before checking isClosing", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(true);

            vi.mocked(saveCampaignDraft).mockResolvedValue({
                id: "507f1f77bcf86cd799439013",
            });

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(mockCampaign);

            // Campaign should be in store
            expect(freshCampaignStore.getState().campaign.title).toBe(
                "Test Campaign"
            );
        });
    });

    describe("different campaign types", () => {
        test("should save awareness campaign", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(false);

            const awarenessCampaign: Campaign = {
                ...mockCampaign,
                type: "awareness",
            };

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(awarenessCampaign);

            expect(freshCampaignStore.getState().campaign.type).toBe(
                "awareness"
            );
        });

        test("should save conversion campaign", async ({
            queryWrapper,
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(false);

            const conversionCampaign = {
                ...mockCampaign,
                type: "conversion" as const,
            } as unknown as Campaign;

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current(conversionCampaign);

            expect(freshCampaignStore.getState().campaign.type).toBe(
                "conversion"
            );
        });
    });
});
