import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
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

// Mock demo mode store
vi.mock("@/stores/demoModeStore", () => ({
    demoModeStore: vi.fn((selector: any) => {
        const state = { isDemoMode: false };
        return selector(state);
    }),
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

describe("useProductMetadata", () => {
    const mockProductId =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

    describe("demo mode", () => {
        test("should return mock data for known product in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
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
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const unknownProductId =
                "0x9999999999999999999999999999999999999999999999999999999999999999" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: unknownProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
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
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const mediaProductId =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: mediaProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
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
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const multiTypeProductId =
                "0x0000000000000000000000000000000000000000000000000000000000000010" as Hex;

            const { result } = renderHook(
                () => useProductMetadata({ productId: multiTypeProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.productTypes).toEqual([
                "webshop",
                "press",
            ]);
        });
    });

    describe("live mode", () => {
        test("should fetch metadata from blockchain in live mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

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
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
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
            expect(result.current.data?.productTypes).toEqual(["webshop"]);
        });

        test("should decode product types correctly in live mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { demoModeStore } = await import("@/stores/demoModeStore");
            const { decodeProductTypesMask } = await import(
                "@/module/product/utils/productTypes"
            );

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            const mockMetadata = {
                name: new Uint8Array([80, 114, 101, 115, 115]), // "Press"
                domain: "news.example.com",
                productTypes: 2n,
            };

            vi.mocked(readContract).mockResolvedValue(mockMetadata as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(decodeProductTypesMask).toHaveBeenCalledWith(2n);
            expect(result.current.data?.productTypes).toEqual(["press"]);
        });

        test("should handle multiple product types in live mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            const mockMetadata = {
                name: new Uint8Array([77, 105, 120, 101, 100]), // "Mixed"
                domain: "mixed.example.com",
                productTypes: 3n, // Multiple types
            };

            vi.mocked(readContract).mockResolvedValue(mockMetadata as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.productTypes).toEqual([
                "webshop",
                "press",
            ]);
        });
    });

    describe("edge cases", () => {
        test("should not fetch when productId is undefined", ({
            queryWrapper,
        }: TestContext) => {
            const { result } = renderHook(
                () => useProductMetadata({ productId: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should return undefined when productId is not provided", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const { result } = renderHook(
                () => useProductMetadata({ productId: undefined }),
                { wrapper: queryWrapper.wrapper }
            );

            // Query should be disabled
            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should handle blockchain errors gracefully", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(readContract).mockRejectedValue(
                new Error("Contract read failed")
            );

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBeInstanceOf(Error);
            expect((result.current.error as Error).message).toBe(
                "Contract read failed"
            );
        });
    });

    describe("query key changes", () => {
        test("should use different query key for demo vs live mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            // Test in demo mode first
            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const { result: demoResult } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(demoResult.current.isSuccess).toBe(true);
            });

            // Switch to live mode
            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            const { readContract } = await import("viem/actions");
            vi.mocked(readContract).mockResolvedValue({
                name: new Uint8Array([76, 105, 118, 101]), // "Live"
                domain: "live.example.com",
                productTypes: 1n,
            } as any);

            const { result: liveResult } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(liveResult.current.isSuccess).toBe(true);
            });

            // Both should be successful but fetched independently
            expect(demoResult.current.isSuccess).toBe(true);
            expect(liveResult.current.isSuccess).toBe(true);
        });

        test("should use different query key for different productIds", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const productId1 =
                "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
            const productId2 =
                "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

            const { result: result1 } = renderHook(
                () => useProductMetadata({ productId: productId1 }),
                { wrapper: queryWrapper.wrapper }
            );

            const { result: result2 } = renderHook(
                () => useProductMetadata({ productId: productId2 }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result1.current.isSuccess).toBe(true);
                expect(result2.current.isSuccess).toBe(true);
            });

            // Different products should have different data
            expect(result1.current.data?.name).toBe("E-Commerce Store");
            expect(result2.current.data?.name).toBe("Digital Media Platform");
        });
    });

    describe("data structure", () => {
        test("should have correct data structure in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveProperty("name");
            expect(result.current.data).toHaveProperty("domain");
            expect(result.current.data).toHaveProperty("productTypes");

            expect(typeof result.current.data?.name).toBe("string");
            expect(typeof result.current.data?.domain).toBe("string");
            expect(Array.isArray(result.current.data?.productTypes)).toBe(true);
        });

        test("should have correct data structure in live mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { readContract } = await import("viem/actions");
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(readContract).mockResolvedValue({
                name: new Uint8Array([84, 101, 115, 116]), // "Test"
                domain: "test.com",
                productTypes: 1n,
            } as any);

            const { result } = renderHook(
                () => useProductMetadata({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveProperty("name");
            expect(result.current.data).toHaveProperty("domain");
            expect(result.current.data).toHaveProperty("productTypes");
        });
    });
});
