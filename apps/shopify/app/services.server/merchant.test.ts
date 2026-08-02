import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

// Mock dependencies before importing the module under test
vi.mock("./shop", () => ({
    shopInfo: vi.fn(),
}));

vi.mock("./metafields", () => ({
    getMerchantIdMetafield: vi.fn(),
    writeMerchantIdMetafield: vi.fn(),
    getWalletUrlMetafield: vi.fn(),
    getBackendUrlMetafield: vi.fn(),
    writeEnvMetafields: vi.fn(),
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
    ensureEnvMetafields,
    resolveMerchantId,
    resolveMerchantInfo,
} from "./merchant";
import {
    getBackendUrlMetafield,
    getMerchantIdMetafield,
    getWalletUrlMetafield,
    writeEnvMetafields,
    writeMerchantIdMetafield,
} from "./metafields";
import { shopInfo } from "./shop";

const mockContext = {} as AuthenticatedContext;

const mockShop = {
    normalizedDomain: "test-shop.myshopify.com",
    // Same as normalizedDomain (no custom primary domain): the backend
    // resolve short-circuits to a single fetch on this path (§1.1/C1).
    myshopifyDomain: "test-shop.myshopify.com",
    name: "Test Shop",
    currency: "eur",
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

    it("should fall back to the metafield value when the backend is unreachable", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "metafield-merchant-id"
        );
        // Backend unreachable (network error) — the metafield mirror is the
        // graceful fallback.
        backendGet.mockRejectedValue(new Error("Network error"));

        const result = await resolveMerchantId(mockContext);

        expect(result).toBe("metafield-merchant-id");
        expect(backendGet).toHaveBeenCalled();
        expect(getMerchantIdMetafield).toHaveBeenCalledWith(mockContext);
    });

    it("should NOT fall back to the metafield on an authoritative 404", async () => {
        // A stale metafield must never resurrect after the backend says the
        // shop isn't registered (e.g. after a local backend DB reseed).
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "stale-merchant-id"
        );
        backendGet.mockResolvedValue({
            data: null,
            error: { status: 404, value: { error: "Merchant not found" } },
        });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBeNull();
        // Not-found short-circuits before the metafield is ever read.
        expect(getMerchantIdMetafield).not.toHaveBeenCalled();
    });

    it("should prefer the backend id over a stale metafield value", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "stale-merchant-id"
        );
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        const result = await resolveMerchantId(mockContext);

        expect(result).toBe("merchant-abc");
        // The stale mirror is reconciled to the authoritative backend id.
        await vi.waitFor(() =>
            expect(writeMerchantIdMetafield).toHaveBeenCalledWith(
                mockContext,
                "merchant-abc"
            )
        );
    });

    it("should populate LRU cache after a metafield fallback", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValue(
            "metafield-merchant-id"
        );
        backendGet.mockRejectedValue(new Error("Network error"));

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

    it("should sync merchantId to metafield after backend resolve", async () => {
        backendGet.mockResolvedValue({ data: mockMerchantInfo, error: null });

        await resolveMerchantId(mockContext);

        // syncMerchantIdMetafield is fire-and-forget (reads current, writes on
        // drift) — wait for the write to land.
        await vi.waitFor(() =>
            expect(writeMerchantIdMetafield).toHaveBeenCalledWith(
                mockContext,
                "merchant-abc"
            )
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

describe("ensureEnvMetafields", () => {
    let shopCounter = 0;
    const savedWalletUrl = process.env.FRAK_WALLET_URL;
    const savedPublicBackendUrl = process.env.PUBLIC_BACKEND_URL;
    const savedBackendUrl = process.env.BACKEND_URL;

    beforeEach(() => {
        vi.clearAllMocks();
        // The sync is memoised per shop for 30 minutes, so each case needs
        // its own shop or every one after the first would be a no-op.
        shopCounter += 1;
        vi.mocked(shopInfo).mockResolvedValue({
            ...mockShop,
            normalizedDomain: `shop-${shopCounter}.myshopify.com`,
        } as never);
        process.env.FRAK_WALLET_URL = "https://wallet-dev.frak.id";
        process.env.PUBLIC_BACKEND_URL = "https://backend.gcp-dev.frak.id";
    });

    afterAll(() => {
        process.env.FRAK_WALLET_URL = savedWalletUrl;
        process.env.PUBLIC_BACKEND_URL = savedPublicBackendUrl;
        process.env.BACKEND_URL = savedBackendUrl;
    });

    it("backfills a shop that predates the backend metafield", async () => {
        // The rollout case: wallet_url already synced, backend_url absent.
        // Left alone the storefront would pair a dev wallet with prod backend.
        vi.mocked(getWalletUrlMetafield).mockResolvedValue(
            "https://wallet-dev.frak.id"
        );
        vi.mocked(getBackendUrlMetafield).mockResolvedValue(null);

        await ensureEnvMetafields(mockContext);

        expect(writeEnvMetafields).toHaveBeenCalledWith(mockContext, {
            walletUrl: "https://wallet-dev.frak.id",
            backendUrl: "https://backend.gcp-dev.frak.id",
        });
    });

    it("writes both origins in a single call so no half-pair can be left", async () => {
        vi.mocked(getWalletUrlMetafield).mockResolvedValue("https://stale");
        vi.mocked(getBackendUrlMetafield).mockResolvedValue("https://stale");

        await ensureEnvMetafields(mockContext);

        expect(writeEnvMetafields).toHaveBeenCalledTimes(1);
    });

    it("writes nothing when both already match", async () => {
        vi.mocked(getWalletUrlMetafield).mockResolvedValue(
            "https://wallet-dev.frak.id"
        );
        vi.mocked(getBackendUrlMetafield).mockResolvedValue(
            "https://backend.gcp-dev.frak.id"
        );

        await ensureEnvMetafields(mockContext);

        expect(writeEnvMetafields).not.toHaveBeenCalled();
    });

    it("stays unsynced after a failed write so the next admin load retries", async () => {
        vi.mocked(getWalletUrlMetafield).mockResolvedValue(null);
        vi.mocked(getBackendUrlMetafield).mockResolvedValue(null);
        vi.mocked(writeEnvMetafields).mockRejectedValueOnce(
            new Error("rate limited")
        );

        await expect(ensureEnvMetafields(mockContext)).resolves.toBeUndefined();

        vi.mocked(writeEnvMetafields).mockResolvedValue({
            success: true,
            userErrors: [],
        });
        await ensureEnvMetafields(mockContext);

        expect(writeEnvMetafields).toHaveBeenCalledTimes(2);
    });

    it("does nothing when the deployment states only one origin", async () => {
        process.env.PUBLIC_BACKEND_URL = "";
        process.env.BACKEND_URL = "";

        await ensureEnvMetafields(mockContext);

        expect(writeEnvMetafields).not.toHaveBeenCalled();
    });
});
