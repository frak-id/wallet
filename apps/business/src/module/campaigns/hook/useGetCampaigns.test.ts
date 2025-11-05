import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetCampaigns } from "./useGetCampaigns";

// Mock the getMyCampaigns action
vi.mock("@/context/campaigns/action/getCampaigns", () => ({
    getMyCampaigns: vi.fn(),
}));

// Mock demo mode atom
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: vi.fn(() => false),
}));

describe("useGetCampaigns", () => {
    describe("successful fetch in live mode", () => {
        test("should fetch campaigns successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(false);

            const mockCampaigns = [
                {
                    _id: "507f1f77bcf86cd799439011",
                    title: "Test Campaign 1",
                    productId: createMockAddress("product"),
                    creator: createMockAddress("creator"),
                    state: { key: "draft" },
                    actions: {
                        canEdit: true,
                        canDelete: true,
                        canToggleRunningStatus: false,
                    },
                },
                {
                    _id: "507f1f77bcf86cd799439012",
                    title: "Test Campaign 2",
                    productId: createMockAddress("product"),
                    creator: createMockAddress("creator"),
                    state: { key: "draft" },
                    actions: {
                        canEdit: true,
                        canDelete: true,
                        canToggleRunningStatus: false,
                    },
                },
            ];

            vi.mocked(getMyCampaigns).mockResolvedValue(mockCampaigns as any);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockCampaigns);
            expect(getMyCampaigns).toHaveBeenCalled();
        });

        test("should return empty array when no campaigns exist", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(getMyCampaigns).mockResolvedValue([]);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual([]);
        });
    });

    describe("successful fetch in demo mode", () => {
        test("should fetch campaigns in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(true);

            const mockDemoCampaigns = [
                {
                    _id: "demo1",
                    title: "Demo Campaign",
                    productId: createMockAddress("product"),
                    creator: createMockAddress("creator"),
                    state: { key: "draft" },
                    actions: {
                        canEdit: true,
                        canDelete: true,
                        canToggleRunningStatus: false,
                    },
                },
            ];

            vi.mocked(getMyCampaigns).mockResolvedValue(
                mockDemoCampaigns as any
            );

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockDemoCampaigns);
        });
    });

    describe("query key changes", () => {
        test("should use different query key for demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            // Start with live mode
            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(getMyCampaigns).mockResolvedValue([]);

            const { result: result1 } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            // Switch to demo mode
            vi.mocked(useIsDemoMode).mockReturnValue(true);

            const { result: result2 } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result2.current.isSuccess).toBe(true);
            });

            // Both should have succeeded but with different query keys
            expect(result1.current.isSuccess).toBe(true);
            expect(result2.current.isSuccess).toBe(true);
        });
    });

    describe("error handling", () => {
        test("should handle errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(getMyCampaigns).mockRejectedValue(
                new Error("Failed to fetch campaigns")
            );

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
            expect((result.current.error as Error).message).toBe(
                "Failed to fetch campaigns"
            );
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(getMyCampaigns).mockRejectedValue(
                new Error("Network error")
            );

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.data).toBeUndefined();
        });
    });

    describe("loading states", () => {
        test("should show loading state initially", async ({
            queryWrapper,
        }: TestContext) => {
            const { getMyCampaigns } = await import(
                "@/context/campaigns/action/getCampaigns"
            );
            const { useIsDemoMode } = await import(
                "@/module/common/atoms/demoMode"
            );

            vi.mocked(useIsDemoMode).mockReturnValue(false);
            vi.mocked(getMyCampaigns).mockImplementation(
                () =>
                    new Promise((resolve) => setTimeout(() => resolve([]), 100))
            );

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            // Initially should be loading
            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
        });
    });
});
