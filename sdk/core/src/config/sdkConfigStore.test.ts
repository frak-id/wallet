import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdkConfigStore } from "./sdkConfigStore";

vi.mock("./backendUrl", () => ({
    getBackendUrl: vi.fn((walletUrl?: string) => {
        if (walletUrl?.includes("localhost")) {
            return "http://localhost:3030";
        }
        return "https://backend.frak.id";
    }),
}));

describe("sdkConfigStore", () => {
    beforeEach(() => {
        sdkConfigStore.clearCache();
        window.sessionStorage.clear();
        window.localStorage.clear();
        window.__frakSdkConfig = undefined;
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("sdkConfigStore.resolve", () => {
        it("should fetch from backend when not cached", async () => {
            const mockResponse = {
                merchantId: "merchant-123",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await sdkConfigStore.resolve("shop.example.com");

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=shop.example.com"
            );
        });

        it("should return cached response on subsequent calls", async () => {
            const mockResponse = {
                merchantId: "merchant-456",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result1 = await sdkConfigStore.resolve("shop.example.com");
            expect(result1).toEqual(mockResponse);

            const result2 = await sdkConfigStore.resolve("shop.example.com");
            expect(result2).toEqual(mockResponse);

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("should deduplicate concurrent requests", async () => {
            const mockResponse = {
                merchantId: "merchant-789",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const [result1, result2, result3] = await Promise.all([
                sdkConfigStore.resolve("shop.example.com"),
                sdkConfigStore.resolve("shop.example.com"),
                sdkConfigStore.resolve("shop.example.com"),
            ]);

            expect(result1).toEqual(mockResponse);
            expect(result2).toEqual(mockResponse);
            expect(result3).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("should use window.location.hostname when domain not provided", async () => {
            const mockResponse = {
                merchantId: "merchant-default",
                name: "Test",
                domain: "example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: { hostname: "example.com" },
                writable: true,
            });

            const result = await sdkConfigStore.resolve();

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=example.com"
            );
        });

        it("should return undefined when domain is empty", async () => {
            global.fetch = vi.fn();

            const result = await sdkConfigStore.resolve("");

            expect(result).toBeUndefined();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should handle fetch errors gracefully", async () => {
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error("Network error"));

            const result = await sdkConfigStore.resolve("shop.example.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Failed to fetch merchant config:",
                expect.any(Error)
            );
        });

        it("should handle non-ok response (404, 500)", async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await sdkConfigStore.resolve("nonexistent.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Merchant lookup failed for domain nonexistent.com: 404"
            );
        });

        it("should use custom walletUrl to derive backend URL", async () => {
            const mockResponse = {
                merchantId: "merchant-local",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await sdkConfigStore.resolve(
                "shop.example.com",
                "http://localhost:3000"
            );

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:3030/user/merchant/resolve?domain=shop.example.com"
            );
        });

        it("should encode domain in URL query parameter", async () => {
            const mockResponse = {
                merchantId: "merchant-encoded",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const domainWithSpecialChars = "shop.example.com?test=1&foo=bar";
            await sdkConfigStore.resolve(domainWithSpecialChars);

            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=shop.example.com%3Ftest%3D1%26foo%3Dbar"
            );
        });

        it("should write merchantId to sessionStorage as 'frak-merchant-id'", async () => {
            const mockResponse = {
                merchantId: "merchant-persisted",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await sdkConfigStore.resolve("shop.example.com");

            expect(window.sessionStorage.getItem("frak-merchant-id")).toBe(
                "merchant-persisted"
            );
        });

        it("should pass lang parameter to backend when provided", async () => {
            const mockResponse = {
                merchantId: "merchant-lang",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await sdkConfigStore.resolve("shop.example.com", undefined, "fr");

            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=shop.example.com&lang=fr"
            );
        });
    });

    describe("sdkConfigStore.getMerchantId", () => {
        it("should return merchantId from resolved config", () => {
            window.__frakSdkConfig = {
                isResolved: true,
                merchantId: "config-merchant-123",
            };

            const result = sdkConfigStore.getMerchantId();

            expect(result).toBe("config-merchant-123");
        });

        it("should fall back to sessionStorage", () => {
            window.__frakSdkConfig = {
                isResolved: false,
                merchantId: "",
            };
            window.sessionStorage.setItem(
                "frak-merchant-id",
                "session-merchant-456"
            );

            const result = sdkConfigStore.getMerchantId();

            expect(result).toBe("session-merchant-456");
        });

        it("should return undefined when nothing cached", () => {
            window.__frakSdkConfig = {
                isResolved: false,
                merchantId: "",
            };

            const result = sdkConfigStore.getMerchantId();

            expect(result).toBeUndefined();
        });
    });

    describe("sdkConfigStore.resolveMerchantId", () => {
        it("should return merchantId from store without fetch", async () => {
            window.__frakSdkConfig = {
                isResolved: true,
                merchantId: "store-merchant-123",
            };
            global.fetch = vi.fn();

            const result = await sdkConfigStore.resolveMerchantId();

            expect(result).toBe("store-merchant-123");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should return merchantId from sessionStorage without fetch", async () => {
            window.__frakSdkConfig = {
                isResolved: false,
                merchantId: "",
            };
            window.sessionStorage.setItem(
                "frak-merchant-id",
                "session-merchant-789"
            );
            global.fetch = vi.fn();

            const result = await sdkConfigStore.resolveMerchantId();

            expect(result).toBe("session-merchant-789");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should fetch from backend as last resort", async () => {
            const mockResponse = {
                merchantId: "fetched-merchant-456",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: { hostname: "shop.example.com" },
                writable: true,
            });

            const result = await sdkConfigStore.resolveMerchantId();

            expect(result).toBe("fetched-merchant-456");
            expect(global.fetch).toHaveBeenCalled();
        });

        it("should return undefined when fetch fails", async () => {
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error("Network error"));

            Object.defineProperty(window, "location", {
                value: { hostname: "shop.example.com" },
                writable: true,
            });

            const result = await sdkConfigStore.resolveMerchantId();

            expect(result).toBeUndefined();
        });
    });

    describe("sdkConfigStore.clearCache", () => {
        it("should clear all caches and allow re-fetching", async () => {
            const mockResponse = {
                merchantId: "merchant-clear-test",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            });

            const result1 = await sdkConfigStore.resolve("shop.example.com");
            expect(result1).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledTimes(1);

            sdkConfigStore.clearCache();

            const result2 = await sdkConfigStore.resolve("shop.example.com");
            expect(result2).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it("should clear sessionStorage frak-merchant-id", async () => {
            const mockResponse = {
                merchantId: "merchant-session-clear",
                name: "Test",
                domain: "shop.example.com",
                allowedDomains: [],
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await sdkConfigStore.resolve("shop.example.com");
            expect(window.sessionStorage.getItem("frak-merchant-id")).toBe(
                "merchant-session-clear"
            );

            sdkConfigStore.clearCache();

            expect(
                window.sessionStorage.getItem("frak-merchant-id")
            ).toBeNull();
        });
    });
});
