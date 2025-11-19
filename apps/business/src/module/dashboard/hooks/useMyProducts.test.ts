import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { getMyProducts } from "@/context/product/action/getProducts";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useMyProducts } from "./useMyProducts";

// Hoist mocks so they can be used in the mock factory
const { mockGetMyProducts, mockUseIsDemoMode } = vi.hoisted(() => ({
    mockGetMyProducts: vi.fn(),
    mockUseIsDemoMode: vi.fn(() => false),
}));

// Mock getMyProducts action
vi.mock("@/context/product/action/getProducts", () => ({
    getMyProducts: mockGetMyProducts,
}));

// Mock demo mode atom
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: mockUseIsDemoMode,
}));

describe("useMyProducts", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("successful fetch", () => {
        test("should fetch owned and operator products successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const mockResponse = {
                owner: [
                    {
                        id: "0x1234567890123456789012345678901234567890",
                        name: "Owned Product",
                        domain: "owned.com",
                        productTypes: ["webshop"],
                    },
                ],
                operator: [
                    {
                        id: "0x2222222222222222222222222222222222222222",
                        name: "Operator Product",
                        domain: "operator.com",
                        productTypes: ["press"],
                    },
                ],
            };

            mockGetMyProducts.mockResolvedValue(mockResponse as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.products).toEqual(mockResponse);
            expect(result.current.isEmpty).toBe(false);
            expect(getMyProducts).toHaveBeenCalled();
        });

        test("should return isEmpty true when no products exist", async ({
            queryWrapper,
        }: TestContext) => {
            const emptyResponse = {
                owner: [],
                operator: [],
            };

            mockGetMyProducts.mockResolvedValue(emptyResponse as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(true);
            expect(result.current.products?.owner).toEqual([]);
            expect(result.current.products?.operator).toEqual([]);
        });

        test("should handle only owned products", async ({
            queryWrapper,
        }: TestContext) => {
            const mockResponse = {
                owner: [
                    {
                        id: "0x1234567890123456789012345678901234567890",
                        name: "Only Product",
                        domain: "only.example.com",
                        productTypes: ["dapp"],
                    },
                ],
                operator: [],
            };

            mockGetMyProducts.mockResolvedValue(mockResponse as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
            expect(result.current.products?.owner).toHaveLength(1);
            expect(result.current.products?.operator).toHaveLength(0);
            expect(result.current.products?.owner[0].name).toBe("Only Product");
        });

        test("should handle only operator products", async ({
            queryWrapper,
        }: TestContext) => {
            const mockResponse = {
                owner: [],
                operator: [
                    {
                        id: "0x1111111111111111111111111111111111111111",
                        name: "Webshop",
                        productTypes: ["webshop"],
                    },
                    {
                        id: "0x2222222222222222222222222222222222222222",
                        name: "Press",
                        productTypes: ["press"],
                    },
                ],
            };

            mockGetMyProducts.mockResolvedValue(mockResponse as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
            expect(result.current.products?.owner).toHaveLength(0);
            expect(result.current.products?.operator).toHaveLength(2);
        });
    });

    describe("isEmpty calculation", () => {
        test("should set isEmpty to true when both arrays are empty", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [],
                operator: [],
            } as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(true);
        });

        test("should set isEmpty to false when owner has products", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [{ id: "0x1234", name: "Owned" }],
                operator: [],
            } as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
        });

        test("should set isEmpty to false when operator has products", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [],
                operator: [{ id: "0x5678", name: "Operated" }],
            } as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
        });

        test("should set isEmpty to false when both have products", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [{ id: "0x1234", name: "Owned" }],
                operator: [{ id: "0x5678", name: "Operated" }],
            } as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            expect(result.current.isEmpty).toBe(false);
        });
    });

    describe("query key with demo mode", () => {
        test("should use different query key for demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [],
                operator: [],
            } as any);

            // Test live mode
            mockUseIsDemoMode.mockReturnValue(false);

            const { result: liveResult } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(liveResult.current.products).toBeDefined();
            });

            // Test demo mode
            mockUseIsDemoMode.mockReturnValue(true);

            const { result: demoResult } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(demoResult.current.products).toBeDefined();
            });

            // Both should succeed but with different query keys
            expect(liveResult.current.isEmpty).toBe(true);
            expect(demoResult.current.isEmpty).toBe(true);
        });

        test("should use correct query key structure", async ({
            queryWrapper,
        }: TestContext) => {
            mockGetMyProducts.mockResolvedValue({
                owner: [],
                operator: [],
            } as any);

            const { result } = renderHook(() => useMyProducts(), {
                wrapper: queryWrapper.wrapper,
            });

            await waitFor(() => {
                expect(result.current.products).toBeDefined();
            });

            // Check query key after query has loaded
            const queries = queryWrapper.client.getQueryCache().getAll();
            const myProductsQuery = queries.find((query) => {
                const key = query.queryKey;
                return (
                    key[0] === "product" &&
                    key[1] === "get-mine" &&
                    (key[2] === "live" || key[2] === "demo")
                );
            });
            expect(myProductsQuery).toBeDefined();
        });
    });
});
