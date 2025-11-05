import { businessApi } from "@frak-labs/client/server";
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
            wallet: createMockAddress("sdk-wallet"),
            status: "connected",
        },
    })),
}));

const mockProductId = createMockAddress("product") as Hex;
const mockWallet = createMockAddress("wallet");

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
                    roles: "0x1" as `0x${string}`,
                    isOwner: true,
                    isAdministrator: true,
                    isInteractionManager: true,
                    isCampaignManager: true,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x0" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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

            expect(result.current.roles).toBe("0x0");
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdministrator).toBe(false);
        });

        test("should handle partial roles (campaign manager only)", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock response with only campaign manager role
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: "0x8" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: true,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x2" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: true,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                error: { status: 400, value: "Network error" },
                response: {} as Response,
                status: 400,
                headers: {},
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
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x0" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x0" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x2" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: true,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
            const productId1 = createMockAddress("product1") as Hex;
            const productId2 = createMockAddress("product2") as Hex;

            // Mock first product response
            vi.mocked(businessApi.roles.get).mockResolvedValueOnce({
                data: {
                    roles: "0x1" as `0x${string}`,
                    isOwner: true,
                    isAdministrator: true,
                    isInteractionManager: true,
                    isCampaignManager: true,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
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
                    roles: "0x0" as `0x${string}`,
                    isOwner: false,
                    isAdministrator: false,
                    isInteractionManager: false,
                    isCampaignManager: false,
                },
                error: null,
                response: {} as Response,
                status: 200,
                headers: {},
            });

            // Change productId
            rerender({ productId: productId2 });

            await waitFor(() => {
                expect(result.current.isOwner).toBe(false);
            });
        });
    });
});
