import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import {
    useHasRoleOnMerchant,
    useHasRoleOnProduct,
} from "./useHasRoleOnProduct";

// Mock the business API
vi.mock("@/context/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn(() => ({
            get: vi.fn(),
        })),
    },
}));

const mockMerchantId = "mock-merchant-id";
const mockProductId = createMockAddress("product") as Hex;

describe("useHasRoleOnMerchant", () => {
    describe("default state", () => {
        test("should return default roles when loading", ({
            queryWrapper,
        }: TestContext) => {
            // Mock API to never resolve (simulating loading state)
            const mockGet = vi.fn(
                () =>
                    new Promise(() => {
                        /* never resolves */
                    })
            );
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            const { result } = renderHook(
                () => useHasRoleOnMerchant({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            // Should have default values
            expect(result.current.role).toBe("none");
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.hasAccess).toBe(false);
            expect(result.current.rolesReady).toBe(false);
        });
    });

    describe("with owner role", () => {
        test("should return owner access when merchant role is owner", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response with owner role
            const mockGet = vi.fn().mockResolvedValueOnce({
                data: {
                    id: mockMerchantId,
                    role: "owner",
                },
                error: null,
            });
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            const { result } = renderHook(
                () => useHasRoleOnMerchant({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.role).toBe("owner");
            expect(result.current.isOwner).toBe(true);
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.hasAccess).toBe(true);
            // Legacy fields
            expect(result.current.isAdministrator).toBe(true);
            expect(result.current.isInteractionManager).toBe(true);
            expect(result.current.isCampaignManager).toBe(true);
        });
    });

    describe("with admin role", () => {
        test("should return admin access when merchant role is admin", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response with admin role
            const mockGet = vi.fn().mockResolvedValueOnce({
                data: {
                    id: mockMerchantId,
                    role: "admin",
                },
                error: null,
            });
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            const { result } = renderHook(
                () => useHasRoleOnMerchant({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.role).toBe("admin");
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdmin).toBe(true);
            expect(result.current.hasAccess).toBe(true);
            // Legacy fields
            expect(result.current.isAdministrator).toBe(true);
            expect(result.current.isInteractionManager).toBe(true);
            expect(result.current.isCampaignManager).toBe(true);
        });
    });

    describe("with no role", () => {
        test("should return no access when merchant role is none", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock successful API response with no role
            const mockGet = vi.fn().mockResolvedValueOnce({
                data: {
                    id: mockMerchantId,
                    role: "none",
                },
                error: null,
            });
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            const { result } = renderHook(
                () => useHasRoleOnMerchant({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.role).toBe("none");
            expect(result.current.isOwner).toBe(false);
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.hasAccess).toBe(false);
            // Legacy fields
            expect(result.current.isAdministrator).toBe(false);
            expect(result.current.isInteractionManager).toBe(false);
            expect(result.current.isCampaignManager).toBe(false);
        });
    });

    describe("error handling", () => {
        test("should return default access on API error", async ({
            queryWrapper,
        }: TestContext) => {
            // Mock API error
            const mockGet = vi.fn().mockResolvedValueOnce({
                data: null,
                error: "Network error",
            });
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            const { result } = renderHook(
                () => useHasRoleOnMerchant({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.rolesReady).toBe(true);
            });

            expect(result.current.role).toBe("none");
            expect(result.current.hasAccess).toBe(false);
        });
    });

    describe("disabled query", () => {
        test("should not fetch when merchantId is empty", ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn();
            vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
                get: mockGet,
            } as any);

            renderHook(() => useHasRoleOnMerchant({ merchantId: "" }), {
                wrapper: queryWrapper.wrapper,
            });

            // Query should not be called when merchantId is empty
            expect(mockGet).not.toHaveBeenCalled();
        });
    });
});

describe("useHasRoleOnProduct (deprecated stub)", () => {
    test("should return static admin access", () => {
        const { result } = renderHook(() =>
            useHasRoleOnProduct({ productId: mockProductId })
        );

        expect(result.current.rolesReady).toBe(true);
        expect(result.current.role).toBe("admin");
        expect(result.current.isOwner).toBe(true);
        expect(result.current.hasAccess).toBe(true);
        expect(result.current.isAdministrator).toBe(true);
        expect(result.current.isInteractionManager).toBe(true);
        expect(result.current.isCampaignManager).toBe(true);
    });

    test("should provide a noop refresh function", async () => {
        const { result } = renderHook(() =>
            useHasRoleOnProduct({ productId: mockProductId })
        );

        // Should not throw
        await expect(result.current.refresh()).resolves.toBeUndefined();
    });
});
