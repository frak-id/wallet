/**
 * Tests for trackPurchaseStatus action
 * Tests webhook registration for purchase tracking
 */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import { trackPurchaseStatus } from "./trackPurchaseStatus";

describe("trackPurchaseStatus", () => {
    let mockSessionStorage: {
        getItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
    };
    let fetchSpy: any;
    let consoleWarnSpy: any;

    beforeEach(() => {
        // Mock sessionStorage
        mockSessionStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };
        Object.defineProperty(window, "sessionStorage", {
            value: mockSessionStorage,
            writable: true,
            configurable: true,
        });

        // Mock fetch
        fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        });
        global.fetch = fetchSpy;

        // Mock console.warn
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.clearAllMocks();
        consoleWarnSpy.mockRestore();
    });

    describe("successful tracking", () => {
        it("should send POST request with correct parameters", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                "https://backend.frak.id/interactions/listenForPurchase",
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": "token-123",
                    },
                    body: JSON.stringify({
                        customerId: "cust-456",
                        orderId: "order-789",
                        token: "purchase-token",
                    }),
                }
            );
        });

        it("should read interaction token from sessionStorage", async () => {
            mockSessionStorage.getItem.mockReturnValue("my-token");

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(mockSessionStorage.getItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token"
            );
            expect(fetchSpy).toHaveBeenCalled();
        });

        it("should handle numeric customerId", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: 12345,
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        customerId: 12345,
                        orderId: "order-789",
                        token: "purchase-token",
                    }),
                })
            );
        });

        it("should handle numeric orderId", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: 67890,
                token: "purchase-token",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        customerId: "cust-456",
                        orderId: 67890,
                        token: "purchase-token",
                    }),
                })
            );
        });

        it("should handle both numeric customerId and orderId", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: 12345,
                orderId: 67890,
                token: "purchase-token",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        customerId: 12345,
                        orderId: 67890,
                        token: "purchase-token",
                    }),
                })
            );
        });
    });

    describe("missing interaction token", () => {
        it("should warn when no interaction token found", async () => {
            mockSessionStorage.getItem.mockReturnValue(null);

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[Frak] No frak session found, skipping purchase check"
            );
        });

        it("should not send request when no interaction token", async () => {
            mockSessionStorage.getItem.mockReturnValue(null);

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("should not send request when interaction token is empty string", async () => {
            mockSessionStorage.getItem.mockReturnValue("");

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe("network errors", () => {
        it("should handle fetch rejection", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");
            fetchSpy.mockRejectedValue(new Error("Network error"));

            await expect(
                trackPurchaseStatus({
                    customerId: "cust-456",
                    orderId: "order-789",
                    token: "purchase-token",
                })
            ).rejects.toThrow("Network error");
        });

        it("should handle fetch with error response", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");
            fetchSpy.mockResolvedValue({
                ok: false,
                status: 500,
            });

            // Function doesn't check response, so it should complete
            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(fetchSpy).toHaveBeenCalled();
        });
    });

    describe("request format", () => {
        it("should include correct headers", async () => {
            mockSessionStorage.getItem.mockReturnValue("my-auth-token");

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": "my-auth-token",
                    },
                })
            );
        });

        it("should use POST method", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: "POST",
                })
            );
        });

        it("should target correct backend URL", async () => {
            mockSessionStorage.getItem.mockReturnValue("token-123");

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(fetchSpy).toHaveBeenCalledWith(
                "https://backend.frak.id/interactions/listenForPurchase",
                expect.any(Object)
            );
        });
    });
});
