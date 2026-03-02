import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

// Mock dependencies before importing the module under test
vi.mock("./shop", () => ({
    shopInfo: vi.fn(),
}));

vi.mock("./metafields", () => ({
    getMerchantIdMetafield: vi.fn(),
    writeMerchantIdMetafield: vi.fn(),
}));

vi.mock("../utils/backendApi", () => ({
    backendApi: {
        user: {
            merchant: {
                resolve: {
                    get: vi.fn(),
                },
            },
        },
    },
}));

import { backendApi } from "../utils/backendApi";
import {
    clearMerchantCache,
    resolveMerchantId,
    resolveMerchantInfo,
} from "./merchant";
import { getMerchantIdMetafield, writeMerchantIdMetafield } from "./metafields";
import { shopInfo } from "./shop";

const mockContext = {} as AuthenticatedContext;

const mockShop = {
    normalizedDomain: "test-shop.myshopify.com",
    name: "Test Shop",
    currency: "usd",
    productId: "gid://shopify/Product/123",
};

// productId must be a hex address per the backend type
const mockMerchantInfo = {
    merchantId: "merchant-abc",
    productId: "0xdeadbeef" as `0x${string}`,
    name: "Test Shop",
    domain: "test-shop.myshopify.com",
};

// Bypass strict treaty types on the mock — the mock factory returns vi.fn()
// but TypeScript sees the full treaty type. Cast through any to call mock methods.
const backendGet = (backendApi as any).user.merchant.resolve.get as ReturnType<
    typeof vi.fn
>;

describe("resolveMerchantId", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(shopInfo).mockResolvedValue(mockShop as any);
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(null);
        vi.mocked(writeMerchantIdMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
        backendGet.mockResolvedValue({ data: null, error: null });
        // Ensure caches are clean before each test
        await clearMerchantCache(mockContext);
    });

    it("should return cached value when LRU cache has entry", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const first = await resolveMerchantId(mockContext);
        expect(first).toBe("merchant-abc");

        // Reset mocks — second call must NOT hit metafield or backend
        vi.mocked(getMerchantIdMetafield).mockClear();
        backendGet.mockClear();

        const second = await resolveMerchantId(mockContext);
        expect(second).toBe("merchant-abc");
        expect(getMerchantIdMetafield).not.toHaveBeenCalled();
        expect(backendGet).not.toHaveBeenCalled();
    });

    it("should return metafield value when cache misses but metafield exists", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "metafield-merchant-id"
        );

        const result = await resolveMerchantId(mockContext);

        expect(result).toBe("metafield-merchant-id");
        expect(getMerchantIdMetafield).toHaveBeenCalledWith(mockContext);
        expect(backendGet).not.toHaveBeenCalled();
    });

    it("should populate LRU cache after metafield hit", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "metafield-merchant-id"
        );

        await resolveMerchantId(mockContext);

        // Clear metafield mock — next call should use cache, not metafield
        vi.mocked(getMerchantIdMetafield).mockClear();
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(null);

        const second = await resolveMerchantId(mockContext);
        expect(second).toBe("metafield-merchant-id");
        expect(getMerchantIdMetafield).not.toHaveBeenCalled();
    });

    it("should fetch from backend API when both cache and metafield miss", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBe("merchant-abc");
        expect(backendGet).toHaveBeenCalledWith({
            query: { domain: "test-shop.myshopify.com" },
        });
    });

    it("should write merchantId to metafield after backend resolve", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        await resolveMerchantId(mockContext);

        // writeMerchantIdMetafield is fire-and-forget; flush microtasks
        await Promise.resolve();
        expect(writeMerchantIdMetafield).toHaveBeenCalledWith(
            mockContext,
            "merchant-abc"
        );
    });

    it("should populate both merchantIdCache and merchantInfoCache after backend resolve", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        await resolveMerchantId(mockContext);

        // merchantInfoCache should now be populated — resolveMerchantInfo should not call backend
        backendGet.mockClear();

        const info = await resolveMerchantInfo(mockContext);
        expect(info).toEqual(mockMerchantInfo);
        expect(backendGet).not.toHaveBeenCalled();
    });

    it("should return null when backend API returns error", async () => {
        backendGet.mockResolvedValue({
            data: null,
            error: { status: 404, value: { error: "Merchant not found" } },
        });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBeNull();
    });

    it("should return null when backend API returns no data", async () => {
        backendGet.mockResolvedValue({ data: null, error: null });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBeNull();
    });

    it("should handle metafield read failure gracefully and fall through to backend", async () => {
        vi.mocked(getMerchantIdMetafield).mockRejectedValue(
            new Error("GraphQL error")
        );
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBe("merchant-abc");
        expect(backendGet).toHaveBeenCalled();
    });

    it("should return null when backend API throws", async () => {
        backendGet.mockRejectedValue(new Error("Network error"));

        const result = await resolveMerchantId(mockContext);

        expect(result).toBeNull();
    });
});

describe("resolveMerchantInfo", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(shopInfo).mockResolvedValue(mockShop as any);
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(null);
        vi.mocked(writeMerchantIdMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
        backendGet.mockResolvedValue({ data: null, error: null });
        await clearMerchantCache(mockContext);
    });

    it("should return cached info when available", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const first = await resolveMerchantInfo(mockContext);
        expect(first).toEqual(mockMerchantInfo);

        backendGet.mockClear();

        const second = await resolveMerchantInfo(mockContext);
        expect(second).toEqual(mockMerchantInfo);
        expect(backendGet).not.toHaveBeenCalled();
    });

    it("should fetch from backend and cache when cache misses", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const result = await resolveMerchantInfo(mockContext);

        expect(result).toEqual(mockMerchantInfo);
        expect(backendGet).toHaveBeenCalledWith({
            query: { domain: "test-shop.myshopify.com" },
        });
    });

    it("should populate merchantIdCache as side effect", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        await resolveMerchantInfo(mockContext);

        // merchantIdCache should be populated — resolveMerchantId should skip metafield + backend
        vi.mocked(getMerchantIdMetafield).mockClear();
        backendGet.mockClear();

        const merchantId = await resolveMerchantId(mockContext);
        expect(merchantId).toBe("merchant-abc");
        expect(getMerchantIdMetafield).not.toHaveBeenCalled();
        expect(backendGet).not.toHaveBeenCalled();
    });

    it("should return null when backend fails", async () => {
        backendGet.mockResolvedValue({
            data: null,
            error: { status: 404, value: { error: "Merchant not found" } },
        });

        const result = await resolveMerchantInfo(mockContext);

        expect(result).toBeNull();
    });

    it("should return null when backend throws", async () => {
        backendGet.mockRejectedValue(new Error("Timeout"));

        const result = await resolveMerchantInfo(mockContext);

        expect(result).toBeNull();
    });
});

describe("clearMerchantCache", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(shopInfo).mockResolvedValue(mockShop as any);
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(null);
        vi.mocked(writeMerchantIdMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
        backendGet.mockResolvedValue({ data: null, error: null });
        await clearMerchantCache(mockContext);
    });

    it("should clear both caches for the shop domain", async () => {
        // Populate both caches
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });
        await resolveMerchantId(mockContext);
        await resolveMerchantInfo(mockContext);

        // Clear caches
        await clearMerchantCache(mockContext);

        // Both caches should be empty — backend will be called again
        backendGet.mockClear();
        backendGet.mockResolvedValue({ data: null, error: null });

        const merchantId = await resolveMerchantId(mockContext);
        const merchantInfo = await resolveMerchantInfo(mockContext);

        expect(merchantId).toBeNull();
        expect(merchantInfo).toBeNull();
        expect(backendGet).toHaveBeenCalledTimes(2);
    });

    it("should cause next resolveMerchantId call to re-fetch", async () => {
        // First: populate cache
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });
        const first = await resolveMerchantId(mockContext);
        expect(first).toBe("merchant-abc");

        // Clear cache
        await clearMerchantCache(mockContext);

        // Second: backend now returns different data
        const updatedInfo = {
            ...mockMerchantInfo,
            merchantId: "merchant-updated",
        };
        backendGet.mockResolvedValue({ data: updatedInfo, error: null });

        const second = await resolveMerchantId(mockContext);
        expect(second).toBe("merchant-updated");
        expect(backendGet).toHaveBeenCalledTimes(2);
    });
});
