import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import {
    getFrakWebookStatus,
    getMerchantBankStatus,
    getMerchantCampaignStats,
    getMerchantCampaigns,
    setupFrakWebhook,
} from "./backendMerchant";

// Mock the merchant module
vi.mock("./merchant", () => ({
    resolveMerchantId: vi.fn(),
}));

// Mock the backendApi module
vi.mock("../utils/backendApi", () => ({
    backendApi: {
        business: {
            merchant: vi.fn(),
        },
    },
}));

import { backendApi } from "../utils/backendApi";
import { resolveMerchantId } from "./merchant";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, headers?: Record<string, string>): Request {
    return new Request(url, headers ? { headers } : undefined);
}

// ---------------------------------------------------------------------------
// setupFrakWebhook
// ---------------------------------------------------------------------------

describe("setupFrakWebhook", () => {
    const mockContext = {} as AuthenticatedContext;
    const mockRequest = new Request("https://test.myshopify.com/app", {
        headers: { authorization: "Bearer test-token" },
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return success when merchant resolves and API succeeds", async () => {
        const mockPost = vi.fn().mockResolvedValue({ data: {}, error: null });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const result = await setupFrakWebhook(mockContext, mockRequest);

        expect(result).toEqual({ success: true, userErrors: [] });
        expect(resolveMerchantId).toHaveBeenCalledWith(mockContext);
        expect(backendApi.business.merchant).toHaveBeenCalledWith({
            merchantId: "merchant-123",
        });
        expect(mockPost).toHaveBeenCalledWith(
            {
                hookSignatureKey: "SHOPIFY_SECRET",
                platform: "shopify",
            },
            {
                headers: { "X-Shopify-Session-Token": "test-token" },
            }
        );
    });

    it("should return error when merchant not found", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await setupFrakWebhook(mockContext, mockRequest);

        expect(result).toEqual({
            success: false,
            userErrors: [{ message: "Merchant not found" }],
        });
        expect(backendApi.business.merchant).not.toHaveBeenCalled();
    });

    it("should return error when API returns error object", async () => {
        const mockPost = vi.fn().mockResolvedValue({
            data: null,
            error: "Webhook setup failed",
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const result = await setupFrakWebhook(mockContext, mockRequest);

        expect(result).toEqual({
            success: false,
            userErrors: [{ message: "Webhook setup failed" }],
        });
    });

    it("should return error when API throws exception", async () => {
        const mockPost = vi.fn().mockRejectedValue(new Error("Network error"));
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const result = await setupFrakWebhook(mockContext, mockRequest);

        expect(result).toEqual({
            success: false,
            userErrors: [{ message: "Network error" }],
        });
    });

    it("should handle error as Error instance", async () => {
        const mockPost = vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Custom error message"),
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const result = await setupFrakWebhook(mockContext, mockRequest);

        expect(result).toEqual({
            success: false,
            userErrors: [{ message: "Custom error message" }],
        });
    });

    it("should extract session token from Authorization header", async () => {
        const mockPost = vi.fn().mockResolvedValue({ data: {}, error: null });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const requestWithAuth = new Request("https://test.myshopify.com/app", {
            headers: { authorization: "Bearer my-session-token" },
        });

        await setupFrakWebhook(mockContext, requestWithAuth);

        expect(mockPost).toHaveBeenCalledWith(expect.any(Object), {
            headers: { "X-Shopify-Session-Token": "my-session-token" },
        });
    });

    it("should handle request without authorization header", async () => {
        const mockPost = vi.fn().mockResolvedValue({ data: {}, error: null });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-123");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { post: mockPost },
        } as any);

        const requestNoAuth = new Request("https://test.myshopify.com/app");

        await setupFrakWebhook(mockContext, requestNoAuth);

        expect(mockPost).toHaveBeenCalledWith(expect.any(Object), {
            headers: undefined,
        });
    });
});

// ---------------------------------------------------------------------------
// getMerchantCampaigns
// ---------------------------------------------------------------------------

describe("getMerchantCampaigns", () => {
    const mockContext = {} as AuthenticatedContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return null when merchant not found", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
        expect(backendApi.business.merchant).not.toHaveBeenCalled();
    });

    it("should return campaigns when API succeeds", async () => {
        const mockCampaigns = [{ id: "c1", title: "Campaign 1" }];
        const mockGet = vi.fn().mockResolvedValue({
            data: { campaigns: mockCampaigns },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-abc");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        const result = await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app", {
                authorization: "Bearer my-token",
            })
        );

        expect(result).toEqual(mockCampaigns);
        expect(backendApi.business.merchant).toHaveBeenCalledWith({
            merchantId: "merchant-abc",
        });
        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "my-token" },
        });
    });

    it("should return null when API returns error", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
            error: { status: 500 },
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-abc-err");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        const result = await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should return null when API throws exception", async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error("Network failure"));
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-abc-throw");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        const result = await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should pass no headers when request has no token", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { campaigns: [] },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-abc-noheader");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(mockGet).toHaveBeenCalledWith({ headers: undefined });
    });

    it("should extract token from id_token query param when no Authorization header", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { campaigns: [] },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-abc-idtoken");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app?id_token=query-token")
        );

        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "query-token" },
        });
    });

    it("should prefer Authorization header over id_token query param", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { campaigns: [] },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue(
            "merchant-abc-bothtoken"
        );
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { get: mockGet, stats: { get: vi.fn() } },
        } as any);

        await getMerchantCampaigns(
            mockContext,
            makeRequest("https://test.myshopify.com/app?id_token=query-token", {
                authorization: "Bearer header-token",
            })
        );

        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "header-token" },
        });
    });
});

// ---------------------------------------------------------------------------
// getMerchantBankStatus
// ---------------------------------------------------------------------------

describe("getMerchantBankStatus", () => {
    const mockContext = {} as AuthenticatedContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return null when merchant not found", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
        expect(backendApi.business.merchant).not.toHaveBeenCalled();
    });

    it("should return bank status when API succeeds", async () => {
        const mockBankStatus = { balance: "1000", address: "0xabc" };
        const mockGet = vi.fn().mockResolvedValue({
            data: mockBankStatus,
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-xyz");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            bank: { get: mockGet },
        } as any);

        const result = await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app", {
                authorization: "Bearer bank-token",
            })
        );

        expect(result).toEqual(mockBankStatus);
        expect(backendApi.business.merchant).toHaveBeenCalledWith({
            merchantId: "merchant-xyz",
        });
        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "bank-token" },
        });
    });

    it("should return null when API returns error", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
            error: { status: 403 },
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-xyz-err");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            bank: { get: mockGet },
        } as any);

        const result = await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should return null when API throws exception", async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error("Timeout"));
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-xyz-throw");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            bank: { get: mockGet },
        } as any);

        const result = await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should pass no headers when request has no token", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { balance: "0" },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-xyz-noheader");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            bank: { get: mockGet },
        } as any);

        await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(mockGet).toHaveBeenCalledWith({ headers: undefined });
    });

    it("should extract token from id_token query param when no Authorization header", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { balance: "0" },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-xyz-idtoken");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            bank: { get: mockGet },
        } as any);

        await getMerchantBankStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app?id_token=param-token")
        );

        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "param-token" },
        });
    });
});

// ---------------------------------------------------------------------------
// getMerchantCampaignStats
// ---------------------------------------------------------------------------

describe("getMerchantCampaignStats", () => {
    const mockContext = {} as AuthenticatedContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return null when merchant not found", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await getMerchantCampaignStats(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
        expect(backendApi.business.merchant).not.toHaveBeenCalled();
    });

    it("should return stats when API succeeds", async () => {
        const mockStats = [{ campaignId: "c1", clicks: 42 }];
        const mockGet = vi.fn().mockResolvedValue({
            data: { stats: mockStats },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-stats");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { stats: { get: mockGet }, get: vi.fn() },
        } as any);

        const result = await getMerchantCampaignStats(
            mockContext,
            makeRequest("https://test.myshopify.com/app", {
                authorization: "Bearer stats-token",
            })
        );

        expect(result).toEqual(mockStats);
        expect(backendApi.business.merchant).toHaveBeenCalledWith({
            merchantId: "merchant-stats",
        });
        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "stats-token" },
        });
    });

    it("should return null when API returns error", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
            error: { status: 500 },
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-stats");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { stats: { get: mockGet }, get: vi.fn() },
        } as any);

        const result = await getMerchantCampaignStats(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should return null when API throws exception", async () => {
        const mockGet = vi
            .fn()
            .mockRejectedValue(new Error("Connection refused"));
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-stats");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { stats: { get: mockGet }, get: vi.fn() },
        } as any);

        const result = await getMerchantCampaignStats(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toBeNull();
    });

    it("should pass no headers when request has no token", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { stats: [] },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-stats");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { stats: { get: mockGet }, get: vi.fn() },
        } as any);

        await getMerchantCampaignStats(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(mockGet).toHaveBeenCalledWith({ headers: undefined });
    });

    it("should extract token from id_token query param when no Authorization header", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { stats: [] },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-stats");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            campaigns: { stats: { get: mockGet }, get: vi.fn() },
        } as any);

        await getMerchantCampaignStats(
            mockContext,
            makeRequest(
                "https://test.myshopify.com/app?id_token=stats-param-token"
            )
        );

        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "stats-param-token" },
        });
    });
});

// ---------------------------------------------------------------------------
// getFrakWebookStatus
// ---------------------------------------------------------------------------

describe("getFrakWebookStatus", () => {
    const mockContext = {} as AuthenticatedContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return setup:false when merchant not found", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toEqual({ userErrors: [], setup: false });
        expect(backendApi.business.merchant).not.toHaveBeenCalled();
    });

    it("should return setup:true when API returns setup:true", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { setup: true, platform: "shopify", webhookSigninKey: "key", stats: {} },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const result = await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app", {
                authorization: "Bearer wh-token",
            })
        );

        expect(result).toEqual({ userErrors: [], setup: true });
        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "wh-token" },
        });
    });

    it("should return setup:false when API returns setup:false", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: { setup: false },
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const result = await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toEqual({ userErrors: [], setup: false });
    });

    it("should return setup:false with userErrors when API returns error", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: null,
            error: { status: 500, message: "Internal error" },
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const result = await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toEqual({
            userErrors: [{ message: "Error fetching frak webhook status" }],
            setup: false,
        });
    });

    it("should return setup:false with userErrors when API throws exception", async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error("Network error"));
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        const result = await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(result).toEqual({
            userErrors: [{ message: "Error fetching frak webhook status" }],
            setup: false,
        });
    });

    it("should pass no headers when request has no token", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        await getFrakWebookStatus(
            mockContext,
            makeRequest("https://test.myshopify.com/app")
        );

        expect(mockGet).toHaveBeenCalledWith({ headers: undefined });
    });

    it("should extract token from id_token query param when no Authorization header", async () => {
        const mockGet = vi.fn().mockResolvedValue({
            data: [{ id: "wh1" }],
            error: null,
        });
        vi.mocked(resolveMerchantId).mockResolvedValue("merchant-wh");
        vi.mocked(backendApi.business.merchant).mockReturnValue({
            webhooks: { get: mockGet },
        } as any);

        await getFrakWebookStatus(
            mockContext,
            makeRequest(
                "https://test.myshopify.com/app?id_token=wh-param-token"
            )
        );

        expect(mockGet).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "wh-param-token" },
        });
    });
});
