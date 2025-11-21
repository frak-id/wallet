import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";
import { mockProductOracle } from "@/tests/mocks/backendApi";
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
vi.mock("@/context/api/backendClient", () => ({
    authenticatedBackendApi: {
        product: vi.fn(),
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
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            const mockWebhookStatus = {
                setup: true,
                url: "https://webhook.example.com",
            };

            vi.mocked(authenticatedBackendApi.product).mockReturnValue(
                mockProductOracle({
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: mockWebhookStatus,
                        }),
                    },
                })
            );

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
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(authenticatedBackendApi.product).mockReturnValue(
                mockProductOracle({
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: { setup: false },
                        }),
                    },
                })
            );

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
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(authenticatedBackendApi.product).mockReturnValue(
                mockProductOracle({
                    status: {
                        get: vi.fn().mockRejectedValue(new Error("API error")),
                    },
                })
            );

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
            vi.mocked(useGetAdminWallet).mockReturnValue({
                data: mockOracleUpdater,
            } as any);

            vi.mocked(authenticatedBackendApi.product).mockReturnValue(
                mockProductOracle({
                    status: {
                        get: vi.fn().mockResolvedValue({
                            data: { setup: false },
                        }),
                    },
                })
            );

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
