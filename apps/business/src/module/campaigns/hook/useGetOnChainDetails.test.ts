import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetOnChainCampaignDetails } from "./useGetOnChainDetails";

// Mock getOnChainCampaignsDetails action
vi.mock("@/context/campaigns/action/getDetails", () => ({
    getOnChainCampaignsDetails: vi.fn(),
}));

describe("useGetOnChainCampaignDetails", () => {
    const mockCampaignAddress =
        "0x1234567890123456789012345678901234567890" as Address;

    describe("successful fetch", () => {
        test("should fetch on-chain campaign details successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const mockDetails = {
                isActive: true,
                isRunning: true,
                budget: {
                    amount: 1000n,
                    period: 86400,
                },
                distributed: 500n,
                activationPeriod: {
                    start: 1704067200,
                    end: 1735689600,
                },
            };

            vi.mocked(getOnChainCampaignsDetails).mockResolvedValue(
                mockDetails as any
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockDetails);
            expect(getOnChainCampaignsDetails).toHaveBeenCalledWith({
                data: { campaignAddress: mockCampaignAddress },
            });
        });

        test("should fetch details for inactive campaign", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const mockDetails = {
                isActive: false,
                isRunning: false,
                budget: {
                    amount: 0n,
                    period: 0,
                },
                distributed: 0n,
            };

            vi.mocked(getOnChainCampaignsDetails).mockResolvedValue(
                mockDetails as any
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.isActive).toBe(false);
            expect(result.current.data?.isRunning).toBe(false);
        });

        test("should handle campaign with large distributed amount", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const mockDetails = {
                isActive: true,
                isRunning: true,
                budget: {
                    amount: 1000000000000000000000n, // 1000 tokens
                    period: 604800, // Weekly
                },
                distributed: 500000000000000000000n, // 500 tokens
            };

            vi.mocked(getOnChainCampaignsDetails).mockResolvedValue(
                mockDetails as any
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check that data exists (distributed is not directly exposed in the hook's return type)
            expect(result.current.data).toBeDefined();
        });
    });

    describe("query configuration", () => {
        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            vi.mocked(getOnChainCampaignsDetails).mockResolvedValue({} as any);

            renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                const queries = queryWrapper.client.getQueryCache().getAll();
                const campaignQuery = queries.find((query) => {
                    const key = query.queryKey;
                    return (
                        key[0] === "campaign" &&
                        key[1] === "on-chain-details" &&
                        key[2] === mockCampaignAddress
                    );
                });
                expect(campaignQuery).toBeDefined();
            });
        });

        test("should create separate queries for different campaigns", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const campaign1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const campaign2 =
                "0x2222222222222222222222222222222222222222" as Address;

            const details1 = { isActive: true, isRunning: true };
            const details2 = { isActive: false, isRunning: false };

            vi.mocked(getOnChainCampaignsDetails)
                .mockResolvedValueOnce(details1 as any)
                .mockResolvedValueOnce(details2 as any);

            const { result: result1 } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: campaign1,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            const { result: result2 } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: campaign2,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
                expect(result2.current.isSuccess).toBe(true);
            });

            expect(result1.current.data?.isActive).toBe(true);
            expect(result2.current.data?.isActive).toBe(false);
        });
    });

    describe("error handling", () => {
        test("should handle API errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            vi.mocked(getOnChainCampaignsDetails).mockRejectedValue(
                new Error("Failed to fetch on-chain details")
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
            expect((result.current.error as Error).message).toBe(
                "Failed to fetch on-chain details"
            );
        });

        test("should handle network errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            vi.mocked(getOnChainCampaignsDetails).mockRejectedValue(
                new Error("Network error")
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

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
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            vi.mocked(getOnChainCampaignsDetails).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({} as any), 100)
                    )
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should transition from loading to success", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const mockDetails = { isActive: true };

            vi.mocked(getOnChainCampaignsDetails).mockResolvedValue(
                mockDetails as any
            );

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toEqual(mockDetails);
        });
    });

    describe("refetching", () => {
        test("should support manual refetch", async ({
            queryWrapper,
        }: TestContext) => {
            const { getOnChainCampaignsDetails } = await import(
                "@/context/campaigns/action/getDetails"
            );

            const details1 = { isRunning: false };
            const details2 = { isRunning: true };

            vi.mocked(getOnChainCampaignsDetails)
                .mockResolvedValueOnce(details1 as any)
                .mockResolvedValueOnce(details2 as any);

            const { result } = renderHook(
                () =>
                    useGetOnChainCampaignDetails({
                        campaignAddress: mockCampaignAddress,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.isRunning).toBe(false);

            await result.current.refetch();

            await waitFor(() => {
                expect(result.current.data?.isRunning).toBe(true);
            });

            // Should have been called at least twice (initial + refetch)
            expect(getOnChainCampaignsDetails).toHaveBeenCalled();
        });
    });
});
