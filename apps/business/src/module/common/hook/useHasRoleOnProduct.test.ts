import { businessApi } from "@frak-labs/client/server";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { vi } from "vitest";
import { describe, expect, type TestContext, test } from "@/tests/fixtures";
import { useHasRoleOnProduct } from "./useHasRoleOnProduct";

// Mock the business API
vi.mock("@frak-labs/client/server", () => ({
    businessApi: {
        roles: {
            get: vi.fn(),
        },
    },
}));

// Mock the Frak SDK wallet status hook
vi.mock("@frak-labs/react-sdk", () => ({
    useWalletStatus: vi.fn(() => ({
        data: {
            wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
            status: "connected",
        },
    })),
}));

const mockProductId =
    "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
const mockWallet = "0x1111111111111111111111111111111111111111" as Address;

describe("useHasRoleOnProduct", () => {
    describe("default state", () => {
        test("should return default roles when no data", ({
            queryWrapper,
        }: TestContext) => {
            // Mock API to never resolve (simulating loading state)
            vi.mocked(businessApi.roles.get).mockImplementation(
                () =>
                    new Promise(() => {
                        /* never resolves */
                    })
            );

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            // Should have default values
            expect(result.current.roles).toBe(0n);
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdministrator).toBe(false);
            expect(result.current.isInteractionManager).toBe(false);
            expect(result.current.isCampaignManager).toBe(false);
            expect(result.current.rolesReady).toBe(false);
        });
    });

    describe("with explicit wallet", () => {
        test("should fetch roles for specific wallet", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response with owner role
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 1n,
                    isOwner: true,
                    isAdministrator: true,
                    isInteractionManager: true,
                    isCampaignManager: true,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.isOwner).toBe(true);
            expect(result.current.isAdministrator).toBe(true);
            expect(result.current.isInteractionManager).toBe(true);
            expect(result.current.isCampaignManager).toBe(true);
        });

        test("should handle wallet with no roles", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response with no roles
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 0n,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.roles).toBe(0n);
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdministrator).toBe(false);
        });

        test("should handle partial roles (campaign manager only)", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response with only campaign manager role
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 8n,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: true,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.isCampaignManager).toBe(true);
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdministrator).toBe(false);
            expect(result.current.isInteractionManager).toBe(false);
        });
    });

    describe("with Frak wallet (no explicit wallet)", () => {
        test("should use Frak wallet when no wallet provided", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 2n,
                    isOwner: false,
                    isAdministrator: true,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        // No wallet parameter - should use Frak wallet
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.isAdministrator).toBe(true);
            expect(result.current.isOwner).toBe(false);
        });
    });

    describe("error handling", () => {
        test("should return default roles on API error", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock API error
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: null,
                error: "Network error",
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            // Should fall back to default roles
            expect(result.current.roles).toBe(0n);
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdministrator).toBe(false);
        });

        test("should handle undefined data gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response with undefined data
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: undefined as any,
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            // Should use default roles
            expect(result.current.roles).toBe(0n);
        });
    });

    describe("refresh functionality", () => {
        test("should provide refresh function", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock initial response
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 0n,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.refresh).toBeDefined();
            expect(typeof result.current.refresh).toBe("function");
        });

        test("should refetch roles when refresh is called", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock initial response with no roles
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 0n,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            const { result } = renderHook(
                () =>
                    useHasRoleOnProduct({
                        productId: mockProductId,
                        wallet: mockWallet,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.isAdministrator).toBe(false);

            // Mock updated response with admin role
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 2n,
                    isOwner: false,
                    isAdministrator: true,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            // Call refresh
            await result.current.refresh();

            await waitFor(() => {
                expect(result.current.isAdministrator).toBe(true);
            });
        });
    });

    describe("query key changes", () => {
        test("should refetch when productId changes", async ({
            queryWrapper,
        }: TestContext) => {
            const productId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
            const productId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

            // Mock first product response
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 1n,
                    isOwner: true,
                    isAdministrator: true,
                    isInteractionManager: true,
                    isCampaignManager: true,
                },
                error: null,
            });

            const { result, rerender } = renderHook(
                ({ productId }) =>
                    useHasRoleOnProduct({
                        productId,
                        wallet: mockWallet,
                    }),
                {
                    wrapper: queryWrapper.wrapper,
                    initialProps: { productId: productId1 },
                }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.isOwner).toBe(true);

            // Mock second product response (no roles)
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: 0n,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
            });

            // Change productId
            rerender({ productId: productId2 });

            await waitFor(() => {
                expect(result.current.isOwner).toBe(false);
            });
        });
    });
});
