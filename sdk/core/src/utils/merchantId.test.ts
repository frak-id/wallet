import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearMerchantIdCache,
    fetchMerchantId,
    resolveMerchantId,
} from "./merchantId";

// Mock the backendUrl module
vi.mock("./backendUrl", () => ({
    getBackendUrl: vi.fn((walletUrl?: string) => {
        if (walletUrl?.includes("localhost")) {
            return "http://localhost:3030";
        }
        return "https://backend.frak.id";
    }),
}));

describe("merchantId", () => {
    beforeEach(() => {
        // Clear cache before each test (also clears sessionStorage)
        clearMerchantIdCache();
        window.sessionStorage.clear();
        // Clear all mocks
        vi.clearAllMocks();
        // Mock console methods to avoid noise in test output
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("fetchMerchantId", () => {
        it("should fetch merchantId from backend when not cached", async () => {
            const mockResponse = {
                merchantId: "merchant-123",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await fetchMerchantId("shop.example.com");

            expect(result).toBe("merchant-123");
            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=shop.example.com"
            );
        });

        it("should return cached merchantId on subsequent calls", async () => {
            const mockResponse = {
                merchantId: "merchant-456",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            // First call
            const result1 = await fetchMerchantId("shop.example.com");
            expect(result1).toBe("merchant-456");

            // Second call should use cache
            const result2 = await fetchMerchantId("shop.example.com");
            expect(result2).toBe("merchant-456");

            // Fetch should only be called once
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("should deduplicate concurrent requests", async () => {
            const mockResponse = {
                merchantId: "merchant-789",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            // Start multiple concurrent requests
            const [result1, result2, result3] = await Promise.all([
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
            ]);

            expect(result1).toBe("merchant-789");
            expect(result2).toBe("merchant-789");
            expect(result3).toBe("merchant-789");

            // Fetch should only be called once despite concurrent requests
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("should use window.location.hostname as fallback when domain not provided", async () => {
            const mockResponse = {
                merchantId: "merchant-default",
                name: "Test Merchant",
                domain: "example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            // Mock window.location.hostname
            Object.defineProperty(window, "location", {
                value: {
                    hostname: "example.com",
                },
                writable: true,
            });

            const result = await fetchMerchantId();

            expect(result).toBe("merchant-default");
            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=example.com"
            );
        });

        it("should return undefined when domain is empty and no hostname available", async () => {
            global.fetch = vi.fn();

            const result = await fetchMerchantId("");

            expect(result).toBeUndefined();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should handle fetch errors gracefully", async () => {
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error("Network error"));

            const result = await fetchMerchantId("shop.example.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Failed to fetch merchant config:",
                expect.any(Error)
            );
        });

        it("should handle non-ok response status", async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await fetchMerchantId("nonexistent.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Merchant lookup failed for domain nonexistent.com: 404"
            );
        });

        it("should handle 500 server error", async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await fetchMerchantId("shop.example.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Merchant lookup failed for domain shop.example.com: 500"
            );
        });

        it("should handle invalid JSON response", async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error("Invalid JSON");
                },
            });

            const result = await fetchMerchantId("shop.example.com");

            expect(result).toBeUndefined();
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak SDK] Failed to fetch merchant config:",
                expect.any(Error)
            );
        });

        it("should use custom walletUrl to derive backend URL", async () => {
            const mockResponse = {
                merchantId: "merchant-local",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await fetchMerchantId(
                "shop.example.com",
                "http://localhost:3000"
            );

            expect(result).toBe("merchant-local");
            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:3030/user/merchant/resolve?domain=shop.example.com"
            );
        });

        it("should encode domain in URL query parameter", async () => {
            const mockResponse = {
                merchantId: "merchant-encoded",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const domainWithSpecialChars = "shop.example.com?test=1&foo=bar";
            await fetchMerchantId(domainWithSpecialChars);

            expect(global.fetch).toHaveBeenCalledWith(
                "https://backend.frak.id/user/merchant/resolve?domain=shop.example.com%3Ftest%3D1%26foo%3Dbar"
            );
        });

        it("should cache merchantId from response", async () => {
            const mockResponse = {
                merchantId: "merchant-cached",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result1 = await fetchMerchantId("shop.example.com");
            expect(result1).toBe("merchant-cached");

            // Clear fetch mock and call again
            global.fetch = vi.fn();
            const result2 = await fetchMerchantId("shop.example.com");

            // Should return cached value without calling fetch
            expect(result2).toBe("merchant-cached");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should persist merchantId to sessionStorage after fetch", async () => {
            const mockResponse = {
                merchantId: "merchant-persisted",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await fetchMerchantId("shop.example.com");

            expect(window.sessionStorage.getItem("frak-merchant-id")).toBe(
                "merchant-persisted"
            );
        });

        it("should restore merchantId from sessionStorage when in-memory cache is cleared", async () => {
            const mockResponse = {
                merchantId: "merchant-storage",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            // First call populates both caches
            const result1 = await fetchMerchantId("shop.example.com");
            expect(result1).toBe("merchant-storage");
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Clear only in-memory cache (not sessionStorage)
            vi.clearAllMocks();
            global.fetch = vi.fn();

            // Manually clear in-memory but keep sessionStorage
            // We do this by calling the internal clear then restoring sessionStorage
            const stored = window.sessionStorage.getItem("frak-merchant-id");
            clearMerchantIdCache();
            window.sessionStorage.setItem("frak-merchant-id", stored!);

            // Second call should restore from sessionStorage without fetch
            const result2 = await fetchMerchantId("shop.example.com");
            expect(result2).toBe("merchant-storage");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should not write to sessionStorage when fetch fails", async () => {
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error("Network error"));

            await fetchMerchantId("shop.example.com");

            expect(
                window.sessionStorage.getItem("frak-merchant-id")
            ).toBeNull();
        });
    });

    describe("clearMerchantIdCache", () => {
        it("should clear the cached merchantId", async () => {
            const mockResponse = {
                merchantId: "merchant-clear-test",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            });

            // First fetch
            const result1 = await fetchMerchantId("shop.example.com");
            expect(result1).toBe("merchant-clear-test");
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Clear cache
            clearMerchantIdCache();

            // Second fetch should call API again
            const result2 = await fetchMerchantId("shop.example.com");
            expect(result2).toBe("merchant-clear-test");
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it("should allow re-fetching after cache clear", async () => {
            const mockResponse1 = {
                merchantId: "merchant-first",
                name: "Test Merchant",
                domain: "shop1.example.com",
            };

            const mockResponse2 = {
                merchantId: "merchant-second",
                name: "Test Merchant",
                domain: "shop2.example.com",
            };

            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse1,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse2,
                });

            const result1 = await fetchMerchantId("shop1.example.com");
            expect(result1).toBe("merchant-first");

            clearMerchantIdCache();

            const result2 = await fetchMerchantId("shop2.example.com");
            expect(result2).toBe("merchant-second");
        });

        it("should clear sessionStorage when clearing cache", async () => {
            const mockResponse = {
                merchantId: "merchant-session-clear",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await fetchMerchantId("shop.example.com");
            expect(window.sessionStorage.getItem("frak-merchant-id")).toBe(
                "merchant-session-clear"
            );

            clearMerchantIdCache();

            expect(
                window.sessionStorage.getItem("frak-merchant-id")
            ).toBeNull();
        });
    });

    describe("resolveMerchantId", () => {
        it("should return merchantId from config if available", async () => {
            global.fetch = vi.fn();

            const config = {
                metadata: {
                    merchantId: "config-merchant-123",
                },
            };

            const result = await resolveMerchantId(config);

            expect(result).toBe("config-merchant-123");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should fetch merchantId from backend if not in config", async () => {
            const mockResponse = {
                merchantId: "fetched-merchant-456",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: {
                    hostname: "shop.example.com",
                },
                writable: true,
            });

            const config = {
                metadata: {},
            };

            const result = await resolveMerchantId(config);

            expect(result).toBe("fetched-merchant-456");
            expect(global.fetch).toHaveBeenCalled();
        });

        it("should return undefined when config has no merchantId and fetch fails", async () => {
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error("Network error"));

            const config = {
                metadata: {},
            };

            const result = await resolveMerchantId(config);

            expect(result).toBeUndefined();
        });

        it("should prioritize config merchantId over fetched value", async () => {
            global.fetch = vi.fn();

            const config = {
                metadata: {
                    merchantId: "config-priority",
                },
            };

            const result = await resolveMerchantId(config);

            expect(result).toBe("config-priority");
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should use walletUrl parameter when fetching", async () => {
            const mockResponse = {
                merchantId: "merchant-with-wallet-url",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: {
                    hostname: "shop.example.com",
                },
                writable: true,
            });

            const config = {
                metadata: {},
            };

            const result = await resolveMerchantId(
                config,
                "http://localhost:3000"
            );

            expect(result).toBe("merchant-with-wallet-url");
            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:3030/user/merchant/resolve?domain=shop.example.com"
            );
        });

        it("should handle config without metadata property", async () => {
            const mockResponse = {
                merchantId: "merchant-no-metadata",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: {
                    hostname: "shop.example.com",
                },
                writable: true,
            });

            const config = {};

            const result = await resolveMerchantId(config);

            expect(result).toBe("merchant-no-metadata");
        });

        it("should cache result from fetch in resolveMerchantId", async () => {
            const mockResponse = {
                merchantId: "merchant-cached-resolve",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            Object.defineProperty(window, "location", {
                value: {
                    hostname: "shop.example.com",
                },
                writable: true,
            });

            const config = {
                metadata: {},
            };

            // First call
            const result1 = await resolveMerchantId(config);
            expect(result1).toBe("merchant-cached-resolve");

            // Second call should use cache
            global.fetch = vi.fn();
            const result2 = await resolveMerchantId(config);
            expect(result2).toBe("merchant-cached-resolve");
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe("integration scenarios", () => {
        it("should handle multiple different domains", async () => {
            const mockResponse1 = {
                merchantId: "merchant-domain1",
                name: "Merchant 1",
                domain: "shop1.example.com",
            };

            const mockResponse2 = {
                merchantId: "merchant-domain2",
                name: "Merchant 2",
                domain: "shop2.example.com",
            };

            global.fetch = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse1,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponse2,
                });

            const result1 = await fetchMerchantId("shop1.example.com");
            expect(result1).toBe("merchant-domain1");

            clearMerchantIdCache();

            const result2 = await fetchMerchantId("shop2.example.com");
            expect(result2).toBe("merchant-domain2");

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it("should handle rapid successive calls with cache", async () => {
            const mockResponse = {
                merchantId: "merchant-rapid",
                name: "Test Merchant",
                domain: "shop.example.com",
            };

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const results = await Promise.all([
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
                fetchMerchantId("shop.example.com"),
            ]);

            expect(results).toEqual([
                "merchant-rapid",
                "merchant-rapid",
                "merchant-rapid",
                "merchant-rapid",
                "merchant-rapid",
            ]);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });
});
