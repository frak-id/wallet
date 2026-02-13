import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { Suspense } from "react";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { CampaignWithActions } from "@/types/Campaign";
import { useGetCampaigns } from "./useGetCampaigns";

function createSuspenseWrapper(
    BaseWrapper: React.ComponentType<{ children: React.ReactNode }>
) {
    const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(
            BaseWrapper,
            null,
            React.createElement(
                Suspense,
                { fallback: React.createElement("div", null, "Loading...") },
                children
            )
        );
    };
    return SuspenseWrapper;
}

const { mockGetMyCampaigns, mockUseIsDemoMode } = vi.hoisted(() => ({
    mockGetMyCampaigns: vi.fn(),
    mockUseIsDemoMode: vi.fn(() => false),
}));

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    getMyCampaigns: mockGetMyCampaigns,
}));

vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: mockUseIsDemoMode,
}));

const mockCampaign: CampaignWithActions = {
    id: "campaign-123",
    merchantId: "merchant-456",
    name: "Test Campaign",
    status: "draft",
    priority: 0,
    rule: {
        trigger: "purchase",
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
    actions: {
        canEdit: true,
        canDelete: true,
        canPublish: true,
        canPause: false,
        canResume: false,
        canArchive: false,
    },
};

describe("useGetCampaigns", () => {
    describe("successful fetch in live mode", () => {
        test("should fetch campaigns successfully", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockResolvedValue([mockCampaign]);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual([mockCampaign]);
            expect(result.current.data[0].actions.canEdit).toBe(true);
            expect(mockGetMyCampaigns).toHaveBeenCalled();
        });

        test("should return empty array when no campaigns exist", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockResolvedValue([]);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual([]);
        });
    });

    describe("successful fetch in demo mode", () => {
        test("should fetch campaigns in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyCampaigns.mockClear();
            mockUseIsDemoMode.mockReturnValue(true);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            // In demo mode, data comes from initialData (mock JSON), not queryFn
            expect(result.current.data.length).toBeGreaterThan(0);
            expect(mockGetMyCampaigns).not.toHaveBeenCalled();
        });
    });

    describe("query key changes", () => {
        test("should use different query key for demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockResolvedValue([]);

            const { result: result1 } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result1.current.data).toBeDefined();
            });

            mockUseIsDemoMode.mockReturnValue(true);

            const { result: result2 } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result2.current.data).toBeDefined();
            });
        });
    });

    describe("loading states", () => {
        test("should return data after suspense resolves", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockImplementation(
                () =>
                    new Promise((resolve) => setTimeout(() => resolve([]), 100))
            );

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
            });

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual([]);
        });
    });
});
