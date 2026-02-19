import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useMyMerchants } from "./useMyMerchants";

// Hoist mocks so they can be used in the mock factory
const { mockMerchantMyGet, mockUseIsDemoMode } = vi.hoisted(() => ({
    mockMerchantMyGet: vi.fn(),
    mockUseIsDemoMode: vi.fn(() => false),
}));

// Mock the backend API
vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: {
            my: {
                get: mockMerchantMyGet,
            },
        },
    },
}));

// Mock demo mode atom
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: mockUseIsDemoMode,
}));

// Mock the auth store for demo mode check in queryOptions
vi.mock("@/stores/authStore", () => ({
    useAuthStore: {
        getState: () => ({ token: "real-token" }),
    },
}));

describe("useMyMerchants", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("successful fetch", () => {
        test("should fetch owned and admin merchants", async ({
            queryWrapper,
        }: TestContext) => {
            mockMerchantMyGet.mockResolvedValue({
                data: {
                    owned: [
                        {
                            id: "merchant-1",
                            name: "Owned Merchant",
                            domain: "owned.com",
                        },
                    ],
                    adminOf: [
                        {
                            id: "merchant-2",
                            name: "Admin Merchant",
                            domain: "admin.com",
                        },
                    ],
                },
                error: null,
            });

            const { result } = renderHook(() => useMyMerchants(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.merchants).toHaveLength(2);
            });

            expect(result.current.isEmpty).toBe(false);
            expect(result.current.owned).toHaveLength(1);
            expect(result.current.adminOf).toHaveLength(1);
            expect(result.current.merchants[0].name).toBe("Owned Merchant");
            expect(result.current.merchants[1].name).toBe("Admin Merchant");
        });

        test("should return isEmpty true when no merchants exist", async ({
            queryWrapper,
        }: TestContext) => {
            mockMerchantMyGet.mockResolvedValue({
                data: { owned: [], adminOf: [] },
                error: null,
            });

            const { result } = renderHook(() => useMyMerchants(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.merchants).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(true);
            expect(result.current.merchants).toHaveLength(0);
            expect(result.current.owned).toHaveLength(0);
            expect(result.current.adminOf).toHaveLength(0);
        });

        test("should combine owned and admin into flat merchants array", async ({
            queryWrapper,
        }: TestContext) => {
            mockMerchantMyGet.mockResolvedValue({
                data: {
                    owned: [
                        { id: "m1", name: "M1", domain: "m1.com" },
                        { id: "m2", name: "M2", domain: "m2.com" },
                    ],
                    adminOf: [{ id: "m3", name: "M3", domain: "m3.com" }],
                },
                error: null,
            });

            const { result } = renderHook(() => useMyMerchants(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.merchants).toHaveLength(3);
            });

            expect(result.current.merchants.map((m) => m.id)).toEqual([
                "m1",
                "m2",
                "m3",
            ]);
        });
    });

    describe("isEmpty calculation", () => {
        test("should be false when only owned merchants exist", async ({
            queryWrapper,
        }: TestContext) => {
            mockMerchantMyGet.mockResolvedValue({
                data: {
                    owned: [{ id: "m1", name: "M1", domain: "m1.com" }],
                    adminOf: [],
                },
                error: null,
            });

            const { result } = renderHook(() => useMyMerchants(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.merchants).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
        });

        test("should be false when only admin merchants exist", async ({
            queryWrapper,
        }: TestContext) => {
            mockMerchantMyGet.mockResolvedValue({
                data: {
                    owned: [],
                    adminOf: [{ id: "m1", name: "M1", domain: "m1.com" }],
                },
                error: null,
            });

            const { result } = renderHook(() => useMyMerchants(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.merchants).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
        });
    });
});
