import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { Suspense } from "react";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { vi } from "vitest";
import { decodeProductTypesMask } from "@/module/product/utils/productTypes";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useProductMetadata } from "./useProductMetadata";

// Mock viem actions
vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

// Mock viem client
vi.mock("@/context/blockchain/provider", () => ({
    viemClient: {},
}));

// Mock product types decoder
vi.mock("@/module/product/utils/productTypes", () => ({
    decodeProductTypesMask: vi.fn((mask: bigint) => {
        // Simple mock implementation
        if (mask === 1n) return ["webshop"];
        if (mask === 2n) return ["press"];
        if (mask === 3n) return ["webshop", "press"];
        return ["dapp"];
    }),
}));

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

describe("useProductMetadata", () => {
    const mockProductId =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

    describe("demo mode", () => {
        test("should return mock data for known product in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            // Clear all queries to ensure no stale data
            queryWrapper.client.clear();

            // Set demo mode to true BEFORE rendering the hook
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            // Verify the store value is correct
            expect(freshDemoModeStore.getState().isDemoMode).toBe(true);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual({
                name: "E-Commerce Store",
                domain: "shop.example.com",
                productTypes: ["webshop"],
                productTypes_raw: 0n,
            });
        });

        test("should return default mock data for unknown product in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const unknownProductId =
                "0x9999999999999999999999999999999999999999999999999999999999999999" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: unknownProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual({
                name: "Demo Product",
                domain: "demo.example.com",
                productTypes: ["webshop"],
                productTypes_raw: 0n,
            });
        });

        test("should return digital media platform metadata in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const mediaProductId =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: mediaProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toEqual({
                name: "Digital Media Platform",
                domain: "media.example.com",
                productTypes: ["press"],
                productTypes_raw: 0n,
            });
        });

        test("should handle multiple product types in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const multiTypeProductId =
                "0x0000000000000000000000000000000000000000000000000000000000000010" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: multiTypeProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data.productTypes).toEqual([
                "webshop",
                "press",
            ]);
        });
    });

    describe("live mode", () => {
        test("should fetch metadata from blockchain in live mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            const mockMetadata = {
                name: new Uint8Array([
                    84, 101, 115, 116, 32, 80, 114, 111, 100,
                ]), // "Test Prod"
                domain: "test.example.com",
                productTypes: 1n,
            };

            vi.mocked(readContract).mockResolvedValue(mockMetadata as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(readContract).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    functionName: "getMetadata",
                    args: [BigInt(mockProductId)],
                })
            );

            // Hook spreads metadata and adds decoded productTypes
            expect(result.current.data).toHaveProperty("name");
            expect(result.current.data).toHaveProperty(
                "domain",
                "test.example.com"
            );
            expect(result.current.data).toHaveProperty("productTypes");
            expect(result.current.data.productTypes).toEqual(["webshop"]);
        });

        test("should decode product types correctly in live mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            const mockMetadata = {
                name: new Uint8Array([80, 114, 101, 115, 115]), // "Press"
                domain: "news.example.com",
                productTypes: 2n,
            };

            vi.mocked(readContract).mockResolvedValue(mockMetadata as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(decodeProductTypesMask).toHaveBeenCalledWith(2n);
            expect(result.current.data.productTypes).toEqual(["press"]);
        });

        test("should handle multiple product types in live mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            const mockMetadata = {
                name: new Uint8Array([77, 105, 120, 101, 100]), // "Mixed"
                domain: "mixed.example.com",
                productTypes: 3n, // Multiple types
            };

            vi.mocked(readContract).mockResolvedValue(mockMetadata as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data.productTypes).toEqual([
                "webshop",
                "press",
            ]);
        });
    });

    describe("edge cases", () => {
        test("should handle blockchain errors gracefully", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            vi.mocked(readContract).mockRejectedValue(
                new Error("Contract read failed")
            );

            // useSuspenseQuery throws errors instead of returning them
            // We expect the renderHook to throw when the query fails
            expect(() => {
                renderHook(
                    () => useProductMetadata({ productId: mockProductId }),
                    { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
                );
            }).toThrow();
        });
    });

    describe("query key changes", () => {
        test("should use different query key for demo vs live mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();

            // Test in demo mode first
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const { result: demoResult } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(demoResult.current.data).toBeDefined();
            });

            // Switch to live mode
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            vi.mocked(readContract).mockResolvedValue({
                name: new Uint8Array([76, 105, 118, 101]), // "Live"
                domain: "live.example.com",
                productTypes: 1n,
            } as any);

            const { result: liveResult } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(liveResult.current.data).toBeDefined();
            });

            // Both should have data but fetched independently
            expect(demoResult.current.data).toBeDefined();
            expect(liveResult.current.data).toBeDefined();
        });

        test("should use different query key for different productIds", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const productId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
            const productId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

            const { result: result1 } = renderHook(
                () => useProductMetadata({ productId: productId1 }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            const { result: result2 } = renderHook(
                () => useProductMetadata({ productId: productId2 }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result1.current.data).toBeDefined();
                expect(result2.current.data).toBeDefined();
            });

            // Different products should have different data
            expect(result1.current.data.name).toBe("E-Commerce Store");
            expect(result2.current.data.name).toBe("Digital Media Platform");
        });
    });

    describe("data structure", () => {
        test("should have correct data structure in demo mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(true, queryWrapper.client);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toHaveProperty("name");
            expect(result.current.data).toHaveProperty("domain");
            expect(result.current.data).toHaveProperty("productTypes");

            expect(typeof result.current.data.name).toBe("string");
            expect(typeof result.current.data.domain).toBe("string");
            expect(Array.isArray(result.current.data.productTypes)).toBe(true);
        });

        test("should have correct data structure in live mode", async ({
            queryWrapper,
            freshDemoModeStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshDemoModeStore
                .getState()
                .setDemoMode(false, queryWrapper.client);

            vi.mocked(readContract).mockResolvedValue({
                name: new Uint8Array([84, 101, 115, 116]), // "Test"
                domain: "test.com",
                productTypes: 1n,
            } as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: createSuspenseWrapper(queryWrapper.wrapper) }
            );

            await waitFor(() => {
                expect(result.current.data).toBeDefined();
            });

            expect(result.current.data).toHaveProperty("name");
            expect(result.current.data).toHaveProperty("domain");
            expect(result.current.data).toHaveProperty("productTypes");
        });
    });
});
