import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../tests/vitest-fixtures";

vi.mock("../utils/clientId", () => ({
    getClientId: vi.fn().mockReturnValue("test-client-id"),
}));

vi.mock("../utils/merchantId", () => ({
    fetchMerchantId: vi.fn().mockResolvedValue(undefined),
}));

import { getClientId } from "../utils/clientId";
import { fetchMerchantId } from "../utils/merchantId";
import { trackPurchaseStatus } from "./trackPurchaseStatus";

describe.sequential("trackPurchaseStatus", () => {
    const TRACK_PURCHASE_URL = "https://backend.frak.id/user/track/purchase";

    let mockSessionStorage: {
        getItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
    };
    let mockLocalStorage: {
        getItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
    };
    let fetchSpy: ReturnType<typeof vi.fn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    function setupStorage(values: {
        interactionToken?: string | null;
        merchantId?: string | null;
        clientId?: string | null;
    }) {
        mockSessionStorage.getItem.mockImplementation((key: string) => {
            if (key === "frak-wallet-interaction-token") {
                return values.interactionToken ?? null;
            }
            if (key === "frak-merchant-id") {
                return values.merchantId ?? null;
            }
            return null;
        });

        mockLocalStorage.getItem.mockImplementation((key: string) => {
            if (key === "frak-client-id") {
                return values.clientId ?? null;
            }
            return null;
        });
    }

    function getTrackingRequests() {
        return fetchSpy.mock.calls.filter(
            ([url]) => url === TRACK_PURCHASE_URL
        );
    }

    function getLastTrackingRequest() {
        return getTrackingRequests().at(-1);
    }

    beforeEach(() => {
        mockSessionStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };

        mockLocalStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };

        Object.defineProperty(window, "sessionStorage", {
            value: mockSessionStorage,
            writable: true,
            configurable: true,
        });

        Object.defineProperty(window, "localStorage", {
            value: mockLocalStorage,
            writable: true,
            configurable: true,
        });

        setupStorage({
            interactionToken: "token-123",
            merchantId: null,
            clientId: "test-client-id",
        });

        vi.mocked(getClientId).mockReturnValue("test-client-id");
        vi.mocked(fetchMerchantId).mockResolvedValue(undefined);

        fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        });
        global.fetch = fetchSpy as typeof fetch;

        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        vi.clearAllMocks();
    });

    describe("successful tracking", () => {
        test("should send POST request with correct parameters including merchantId", async () => {
            const callCountBefore = getTrackingRequests().length;

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
                merchantId: "merchant-explicit",
            });

            expect(getTrackingRequests().length).toBe(callCountBefore + 1);
            expect(getLastTrackingRequest()).toEqual([
                TRACK_PURCHASE_URL,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-wallet-sdk-auth": "token-123",
                        "x-frak-client-id": "test-client-id",
                    },
                    body: JSON.stringify({
                        customerId: "cust-456",
                        orderId: "order-789",
                        token: "purchase-token",
                        merchantId: "merchant-explicit",
                    }),
                },
            ]);
        });

        test("should include x-frak-client-id header", async () => {
            setupStorage({
                interactionToken: null,
                merchantId: null,
                clientId: "test-client-id",
            });

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "merchant-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                headers: Record<string, string>;
            };
            expect(requestInit.headers).toEqual({
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-frak-client-id": "test-client-id",
            });
        });

        test("should include x-wallet-sdk-auth header when interaction token exists", async () => {
            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "merchant-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                headers: Record<string, string>;
            };
            expect(requestInit.headers).toEqual({
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-wallet-sdk-auth": "token-123",
                "x-frak-client-id": "test-client-id",
            });
        });

        test("should handle numeric customerId and orderId", async () => {
            await trackPurchaseStatus({
                customerId: 12345,
                orderId: 67890,
                token: "purchase-token",
                merchantId: "merchant-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                body: string;
            };
            expect(requestInit.body).toBe(
                JSON.stringify({
                    customerId: 12345,
                    orderId: 67890,
                    token: "purchase-token",
                    merchantId: "merchant-1",
                })
            );
        });

        test("should use new endpoint URL /user/track/purchase", async () => {
            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "merchant-1",
            });

            expect(getLastTrackingRequest()?.[0]).toBe(TRACK_PURCHASE_URL);
        });
    });

    describe("merchantId resolution", () => {
        test("should resolve merchantId from explicit param first", async () => {
            setupStorage({
                interactionToken: "token-123",
                merchantId: "session-merchant-id",
                clientId: "test-client-id",
            });
            vi.mocked(fetchMerchantId).mockResolvedValue("fetched-merchant-id");
            const merchantLookupCallsBefore =
                vi.mocked(fetchMerchantId).mock.calls.length;

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "explicit-merchant-id",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                body: string;
            };
            expect(requestInit.body).toBe(
                JSON.stringify({
                    customerId: "cust-1",
                    orderId: "order-1",
                    token: "token-1",
                    merchantId: "explicit-merchant-id",
                })
            );
            expect(vi.mocked(fetchMerchantId).mock.calls.length).toBe(
                merchantLookupCallsBefore
            );
        });

        test("should fall back to sessionStorage for merchantId", async () => {
            setupStorage({
                interactionToken: "token-123",
                merchantId: "session-merchant-id",
                clientId: "test-client-id",
            });
            const merchantLookupCallsBefore =
                vi.mocked(fetchMerchantId).mock.calls.length;

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                body: string;
            };
            expect(requestInit.body).toBe(
                JSON.stringify({
                    customerId: "cust-1",
                    orderId: "order-1",
                    token: "token-1",
                    merchantId: "session-merchant-id",
                })
            );
            expect(vi.mocked(fetchMerchantId).mock.calls.length).toBe(
                merchantLookupCallsBefore
            );
        });

        test("should fall back to fetchMerchantId when no explicit or sessionStorage", async () => {
            setupStorage({
                interactionToken: "token-123",
                merchantId: null,
                clientId: "test-client-id",
            });
            vi.mocked(fetchMerchantId).mockResolvedValue("fetched-merchant-id");

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                body: string;
            };
            expect(requestInit.body).toBe(
                JSON.stringify({
                    customerId: "cust-1",
                    orderId: "order-1",
                    token: "token-1",
                    merchantId: "fetched-merchant-id",
                })
            );
        });

        test("should warn and skip when no merchantId available", async () => {
            setupStorage({
                interactionToken: "token-123",
                merchantId: null,
                clientId: "test-client-id",
            });
            vi.mocked(fetchMerchantId).mockResolvedValue(undefined);
            const callCountBefore = getTrackingRequests().length;

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[Frak] No merchant id found, skipping purchase check"
            );
            expect(getTrackingRequests().length).toBe(callCountBefore);
        });
    });

    describe("anonymous user support", () => {
        test("should send request with only x-frak-client-id when no interaction token", async () => {
            setupStorage({
                interactionToken: null,
                merchantId: null,
                clientId: "test-client-id",
            });

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "merchant-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                headers: Record<string, string>;
            };
            expect(requestInit.headers).toEqual({
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-frak-client-id": "test-client-id",
            });
        });

        test("should send request with both headers when both available", async () => {
            setupStorage({
                interactionToken: "token-123",
                merchantId: null,
                clientId: "test-client-id",
            });

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
                merchantId: "merchant-1",
            });

            const requestInit = getLastTrackingRequest()?.[1] as {
                headers: Record<string, string>;
            };
            expect(requestInit.headers).toEqual({
                Accept: "application/json",
                "Content-Type": "application/json",
                "x-wallet-sdk-auth": "token-123",
                "x-frak-client-id": "test-client-id",
            });
        });

        test("should skip when no identity available", async () => {
            setupStorage({
                interactionToken: null,
                merchantId: "merchant-1",
                clientId: null,
            });
            vi.mocked(getClientId).mockReturnValue("");
            const callCountBefore = getTrackingRequests().length;

            await trackPurchaseStatus({
                customerId: "cust-1",
                orderId: "order-1",
                token: "token-1",
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[Frak] No identity found, skipping purchase check"
            );
            expect(getTrackingRequests().length).toBe(callCountBefore);
        });
    });

    describe("missing identity", () => {
        test("should warn when no identity sources available", async () => {
            setupStorage({
                interactionToken: null,
                merchantId: "merchant-1",
                clientId: null,
            });
            vi.mocked(getClientId).mockReturnValue("");
            const callCountBefore = getTrackingRequests().length;

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
            });

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[Frak] No identity found, skipping purchase check"
            );
            expect(getTrackingRequests().length).toBe(callCountBefore);
        });
    });

    describe("non-browser environment", () => {
        test("should warn and skip when window is undefined", async () => {
            const savedWindow = globalThis.window;
            Reflect.deleteProperty(globalThis, "window");
            const callCountBefore = getTrackingRequests().length;

            try {
                await trackPurchaseStatus({
                    customerId: "cust-1",
                    orderId: "order-1",
                    token: "token-1",
                    merchantId: "merchant-1",
                });
            } finally {
                Object.defineProperty(globalThis, "window", {
                    value: savedWindow,
                    writable: true,
                    configurable: true,
                });
            }

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[Frak] No window found, can't track purchase"
            );
            expect(getTrackingRequests().length).toBe(callCountBefore);
        });
    });

    describe("network errors", () => {
        test("should handle fetch rejection", async () => {
            vi.mocked(getClientId).mockReturnValue("test-client-id");
            setupStorage({
                interactionToken: "token-123",
                merchantId: null,
                clientId: "test-client-id",
            });
            fetchSpy.mockRejectedValueOnce(new Error("Network error"));

            await expect(
                trackPurchaseStatus({
                    customerId: "cust-456",
                    orderId: "order-789",
                    token: "purchase-token",
                    merchantId: "merchant-1",
                })
            ).rejects.toThrow("Network error");
        });

        test("should handle fetch with error response", async () => {
            fetchSpy.mockResolvedValue({
                ok: false,
                status: 500,
            });

            await trackPurchaseStatus({
                customerId: "cust-456",
                orderId: "order-789",
                token: "purchase-token",
                merchantId: "merchant-1",
            });

            expect(fetchSpy).toHaveBeenCalled();
        });
    });
});
