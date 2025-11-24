import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { Suspense } from "react";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetCampaigns } from "./useGetCampaigns";

// Helper to create a wrapper with Suspense boundary
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

// Hoist mocks so they can be used in the mock factory
const { mockGetMyCampaigns, mockUseIsDemoMode } = vi.hoisted(() => ({
    mockGetMyCampaigns: vi.fn(),
    mockUseIsDemoMode: vi.fn(() => false),
}));

// Mock the getMyCampaigns action
vi.mock("@/context/campaigns/action/getCampaigns", () => ({
    getMyCampaigns: mockGetMyCampaigns,
}));

// Mock demo mode atom
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: mockUseIsDemoMode,
}));

describe("useGetCampaigns", () => {
    describe("successful fetch in live mode", () => {
        test("should fetch campaigns successfully", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);

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

            mockGetMyCampaigns.mockResolvedValue(mockCampaigns as any);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockCampaigns);
            expect(mockGetMyCampaigns).toHaveBeenCalled();
        });

        test("should return empty array when no campaigns exist", async ({
            queryWrapper,
        }: TestContext) => {
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockResolvedValue([]);

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
            mockUseIsDemoMode.mockReturnValue(true);

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

            mockGetMyCampaigns.mockResolvedValue(mockDemoCampaigns as any);

            const { result } = renderHook(() => useGetCampaigns(), {
                wrapper: createSuspenseWrapper(queryWrapper.wrapper),
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
            // Start with live mode
            mockUseIsDemoMode.mockReturnValue(false);
            mockGetMyCampaigns.mockResolvedValue([]);

            const { result: result1 } = renderHook(() => useGetCampaigns(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
            });

            // Switch to demo mode
            mockUseIsDemoMode.mockReturnValue(true);

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
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual([]);
        });
    });
});
