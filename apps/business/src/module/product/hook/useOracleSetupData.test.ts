import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useOracleSetupData } from "./useOracleSetupData";

// Mock viem actions
vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

// Mock business API
vi.mock("@frak-labs/client/server", () => ({
    businessApi: {
        product: vi.fn(() => ({
            oracleWebhook: {
                status: {
                    get: vi.fn(),
                },
            },
        })),
    },
}));

// Mock useGetAdminWallet
vi.mock("@/module/common/hook/useGetAdminWallet", () => ({
    useGetAdminWallet: vi.fn(),
}));

describe("useOracleSetupData", () => {
    const mockProductId = createMockAddress("product") as Hex;
    const mockOracleUpdater = createMockAddress("oracle-updater");

    describe("with oracle updater available", () => {
        test("should fetch oracle setup data successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { businessApi } = await import("@frak-labs/client/server");
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            const mockWebhookStatus = {
                setup: true,
                url: "https://webhook.example.com",
            };

            vi.mocked(businessApi.product).mockReturnValue({
                oracleWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: mockWebhookStatus,
                        }),
                    },
                },
            } as any);

            vi.mocked(readContract).mockResolvedValue(true);

            const { result } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual({
                oracleUpdater: mockOracleUpdater,
                isOracleUpdaterAllowed: true,
                isWebhookSetup: true,
                webhookStatus: mockWebhookStatus,
            });
        });

        test("should handle oracle updater not allowed", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { businessApi } = await import("@frak-labs/client/server");
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(businessApi.product).mockReturnValue({
                oracleWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: { setup: false },
                        }),
                    },
                },
            } as any);

            vi.mocked(readContract).mockResolvedValue(false);

            const { result } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.isOracleUpdaterAllowed).toBe(false);
            expect(result.current.data?.isWebhookSetup).toBe(false);
        });
    });

    describe("query disabled when no oracle updater", () => {
        test("should be disabled when oracle updater is undefined", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: undefined,
            } as any);

            const { result } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should return null when oracle updater becomes unavailable", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            // Initially has oracle updater
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            const { result, rerender } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            // Then updater becomes unavailable
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: undefined,
            } as any);

            rerender();

            // Query should be disabled
            expect(result.current.isPending).toBe(true);
        });
    });

    describe("error handling", () => {
        test("should handle webhook API errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { businessApi } = await import("@frak-labs/client/server");
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(businessApi.product).mockReturnValue({
                oracleWebhook: {
                    status: {
                        get: vi.fn().mockRejectedValue(new Error("API error")),
                    },
                },
            } as any);

            vi.mocked(readContract).mockResolvedValue(true);

            const { result } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });

        test("should handle blockchain read errors", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { businessApi } = await import("@frak-labs/client/server");
            const { useGetAdminWallet } = await import(
                "@/module/common/hook/useGetAdminWallet"
            );

            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(businessApi.product).mockReturnValue({
                oracleWebhook: {
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: { setup: false },
                        }),
                    },
                },
            } as any);

            vi.mocked(readContract).mockRejectedValue(
                new Error("Blockchain error")
            );

            const { result } = renderHook(
                () => useOracleSetupData({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });
    });
});
