import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import { setupFrakWebhook } from "./backendMerchant";

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
