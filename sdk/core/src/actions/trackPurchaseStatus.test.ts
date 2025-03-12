/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackPurchaseStatus } from "./trackPurchaseStatus";

describe("trackPurchaseStatus", () => {
    // Mock fetch API
    const mockFetch = vi.fn();

    // Store original implementations
    const originalConsoleWarn = console.warn;
    const originalFetch = global.fetch;
    const originalSessionStorage = window.sessionStorage;

    beforeEach(() => {
        // Reset mocks
        vi.resetAllMocks();

        // Mock console.warn
        console.warn = vi.fn();

        // Mock fetch
        global.fetch = mockFetch;
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
    });

    afterEach(() => {
        // Restore original implementations
        console.warn = originalConsoleWarn;
        global.fetch = originalFetch;

        // Restore sessionStorage behavior
        Object.defineProperty(window, "sessionStorage", {
            value: originalSessionStorage,
            writable: true,
        });
    });

    it("should warn and return early when window is undefined", async () => {
        // Save window
        const originalWindow = global.window;

        try {
            // Mock window as undefined
            // @ts-expect-error - Intentionally setting window to undefined for test
            global.window = undefined;

            // Execute
            await trackPurchaseStatus({
                customerId: "customer123",
                orderId: "order456",
                token: "token789",
            });

            // Verify
            expect(console.warn).toHaveBeenCalledWith(
                "[Frak] No window found, can't track purchase"
            );
            expect(mockFetch).not.toHaveBeenCalled();
        } finally {
            // Restore window
            global.window = originalWindow;
        }
    });

    it("should warn and return early when interaction token is not available", async () => {
        // Mock sessionStorage with no token
        Object.defineProperty(window, "sessionStorage", {
            value: {
                getItem: vi.fn().mockReturnValue(null),
            },
            writable: true,
        });

        // Execute
        await trackPurchaseStatus({
            customerId: "customer123",
            orderId: "order456",
            token: "token789",
        });

        // Verify
        expect(console.warn).toHaveBeenCalledWith(
            "[Frak] No frak session found, skipping purchase check"
        );
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should make a fetch request with the correct parameters when token is available", async () => {
        // Mock sessionStorage with token
        const mockToken = "mock-interaction-token";
        Object.defineProperty(window, "sessionStorage", {
            value: {
                getItem: vi.fn().mockImplementation((key) => {
                    if (key === "frak-wallet-interaction-token") {
                        return mockToken;
                    }
                    return null;
                }),
            },
            writable: true,
        });

        // Test data
        const purchaseData = {
            customerId: "customer123",
            orderId: "order456",
            token: "token789",
        };

        // Execute
        await trackPurchaseStatus(purchaseData);

        // Verify
        expect(mockFetch).toHaveBeenCalledWith(
            "https://backend.frak.id/interactions/listenForPurchase",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "x-wallet-sdk-auth": mockToken,
                },
                body: JSON.stringify(purchaseData),
            }
        );
    });

    it("should work with numeric customer ID and order ID", async () => {
        // Mock sessionStorage with token
        const mockToken = "mock-interaction-token";
        Object.defineProperty(window, "sessionStorage", {
            value: {
                getItem: vi.fn().mockReturnValue(mockToken),
            },
            writable: true,
        });

        // Test data with numeric IDs
        const purchaseData = {
            customerId: 123,
            orderId: 456,
            token: "token789",
        };

        // Execute
        await trackPurchaseStatus(purchaseData);

        // Verify
        expect(mockFetch).toHaveBeenCalledWith(
            "https://backend.frak.id/interactions/listenForPurchase",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "x-wallet-sdk-auth": mockToken,
                },
                body: JSON.stringify(purchaseData),
            }
        );
    });
});
