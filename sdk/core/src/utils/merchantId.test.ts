import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from "vitest";
import {
    clearMerchantIdCache,
    fetchMerchantId,
    resolveMerchantId,
} from "./merchantId";

describe("merchantId", () => {
    let fetchMock: Mock;

    beforeEach(() => {
        clearMerchantIdCache();
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("fetchMerchantId", () => {
        it("should fetch merchantId from backend", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        merchantId: "test-merchant-id",
                        productId: "0x123",
                        name: "Test Merchant",
                        domain: "example.com",
                    }),
            });

            const result = await fetchMerchantId("example.com");

            expect(result).toBe("test-merchant-id");
            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining(
                    "/user/merchant/resolve?domain=example.com"
                )
            );
        });

        it("should cache merchantId for subsequent calls", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        merchantId: "cached-merchant-id",
                    }),
            });

            const result1 = await fetchMerchantId("example.com");
            const result2 = await fetchMerchantId("example.com");

            expect(result1).toBe("cached-merchant-id");
            expect(result2).toBe("cached-merchant-id");
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("should return undefined on failed fetch", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await fetchMerchantId("unknown.com");

            expect(result).toBeUndefined();
        });

        it("should handle network errors gracefully", async () => {
            fetchMock.mockRejectedValueOnce(new Error("Network error"));

            const result = await fetchMerchantId("example.com");

            expect(result).toBeUndefined();
        });

        it("should deduplicate concurrent requests", async () => {
            let resolvePromise: (value: unknown) => void;
            const slowPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });

            fetchMock.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        slowPromise.then(() =>
                            resolve({
                                ok: true,
                                json: () =>
                                    Promise.resolve({
                                        merchantId: "deduped-merchant-id",
                                    }),
                            })
                        );
                    })
            );

            const promise1 = fetchMerchantId("example.com");
            const promise2 = fetchMerchantId("example.com");

            // Resolve the slow promise
            resolvePromise!(undefined);

            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1).toBe("deduped-merchant-id");
            expect(result2).toBe("deduped-merchant-id");
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("resolveMerchantId", () => {
        it("should return merchantId from config if available", async () => {
            const config = {
                metadata: { merchantId: "config-merchant-id" },
            };

            const result = await resolveMerchantId(config);

            expect(result).toBe("config-merchant-id");
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("should fetch merchantId if not in config", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        merchantId: "fetched-merchant-id",
                    }),
            });

            const config = { metadata: {} };
            const result = await resolveMerchantId(config);

            expect(result).toBe("fetched-merchant-id");
            expect(fetchMock).toHaveBeenCalled();
        });

        it("should return undefined if neither config nor fetch provides merchantId", async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const config = { metadata: {} };
            const result = await resolveMerchantId(config);

            expect(result).toBeUndefined();
        });
    });

    describe("clearMerchantIdCache", () => {
        it("should clear the cache", async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        merchantId: "merchant-id",
                    }),
            });

            await fetchMerchantId("example.com");
            expect(fetchMock).toHaveBeenCalledTimes(1);

            clearMerchantIdCache();

            await fetchMerchantId("example.com");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });
    });
});
