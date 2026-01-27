import { useNavigate } from "@tanstack/react-router";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import {
    createCampaign,
    updateCampaign,
} from "@/context/campaigns/action/createCampaign";
import { campaignStore } from "@/stores/campaignStore";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useSaveCampaign } from "./useSaveCampaign";

// Mock server functions
vi.mock("@/context/campaigns/action/createCampaign", () => ({
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
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

// Mock campaign store
vi.mock("@/stores/campaignStore", () => ({
    campaignStore: {
        getState: vi.fn(() => ({
            reset: vi.fn(),
        })),
    },
}));

const mockCampaignResponse = {
    id: "campaign-123",
    merchantId: "merchant-456",
    name: "Test Campaign",
    status: "draft" as const,
    priority: 0,
    rule: {
        trigger: "purchase" as const,
        conditions: [],
        rewards: [],
    },
    metadata: null,
    budgetConfig: null,
    budgetUsed: null,
    expiresAt: null,
    publishedAt: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
};

describe("useSaveCampaign", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("create campaign", () => {
        test("should create campaign when no campaignId provided", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(createCampaign).mockResolvedValue(mockCampaignResponse);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                name: "Test Campaign",
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [],
                },
            });

            expect(createCampaign).toHaveBeenCalledWith({
                data: {
                    merchantId: "merchant-456",
                    name: "Test Campaign",
                    rule: {
                        trigger: "purchase",
                        conditions: [],
                        rewards: [],
                    },
                },
            });
            expect(updateCampaign).not.toHaveBeenCalled();
        });
    });

    describe("update campaign", () => {
        test("should update campaign when campaignId provided", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(updateCampaign).mockResolvedValue({
                ...mockCampaignResponse,
                name: "Updated Campaign",
            });

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                campaignId: "campaign-123",
                name: "Updated Campaign",
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [],
                },
            });

            expect(updateCampaign).toHaveBeenCalledWith({
                data: {
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                    name: "Updated Campaign",
                    rule: {
                        trigger: "purchase",
                        conditions: [],
                        rewards: [],
                    },
                },
            });
            expect(createCampaign).not.toHaveBeenCalled();
        });
    });

    describe("onSuccess behavior", () => {
        test("should reset store and navigate on success", async ({
            queryWrapper,
        }: TestContext) => {
            const mockNavigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(mockNavigate);

            const mockReset = vi.fn();
            vi.mocked(campaignStore.getState).mockReturnValue({
                reset: mockReset,
            } as any);

            vi.mocked(createCampaign).mockResolvedValue(mockCampaignResponse);

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                merchantId: "merchant-456",
                name: "Test Campaign",
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [],
                },
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(mockReset).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/campaigns/list",
            });
        });
    });

    describe("error handling", () => {
        test("should handle create errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(createCampaign).mockRejectedValue(
                new Error("Failed to create campaign")
            );

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    merchantId: "merchant-456",
                    name: "Test Campaign",
                    rule: {
                        trigger: "purchase",
                        conditions: [],
                        rewards: [],
                    },
                })
            ).rejects.toThrow("Failed to create campaign");
        });

        test("should handle update errors", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(updateCampaign).mockRejectedValue(
                new Error("Failed to update campaign")
            );

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    merchantId: "merchant-456",
                    campaignId: "campaign-123",
                    name: "Updated Campaign",
                    rule: {
                        trigger: "purchase",
                        conditions: [],
                        rewards: [],
                    },
                })
            ).rejects.toThrow("Failed to update campaign");
        });
    });

    describe("mutation state", () => {
        test("should track mutation loading state", async ({
            queryWrapper,
        }: TestContext) => {
            vi.mocked(createCampaign).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(mockCampaignResponse), 100)
                    )
            );

            const { result } = renderHook(() => useSaveCampaign(), {
                wrapper: queryWrapper.wrapper,
            });

            expect(result.current.isPending).toBe(false);

            const mutationPromise = result.current.mutateAsync({
                merchantId: "merchant-456",
                name: "Test Campaign",
                rule: {
                    trigger: "purchase",
                    conditions: [],
                    rewards: [],
                },
            });

            await waitFor(() => {
                expect(result.current.isPending).toBe(true);
            });

            await mutationPromise;

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });
});
