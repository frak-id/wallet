/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrakClient } from "../types/client";
import type { WalletStatusReturnType } from "../types/rpc/walletStatus";
import { watchWalletStatus } from "./watchWalletStatus";

describe("watchWalletStatus", () => {
    let mockClient: FrakClient;
    let mockSessionStorage: { [key: string]: string };

    beforeEach(() => {
        // Mock sessionStorage
        mockSessionStorage = {};
        Object.defineProperty(window, "sessionStorage", {
            value: {
                getItem: (key: string) => mockSessionStorage[key],
                setItem: (key: string, value: string) => {
                    mockSessionStorage[key] = value;
                },
                removeItem: (key: string) => {
                    delete mockSessionStorage[key];
                },
            },
        });

        // Create mock client
        mockClient = {
            request: vi.fn(),
            listenerRequest: vi.fn(),
        } as unknown as FrakClient;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("without callback", () => {
        it("should make a single request and return the result", async () => {
            const mockResponse: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x123",
                interactionToken: "test-token",
                interactionSession: {
                    startTimestamp: 123,
                    endTimestamp: 456,
                },
            };

            vi.mocked(mockClient.request).mockResolvedValueOnce(mockResponse);

            const result = await watchWalletStatus(mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_listenToWalletStatus",
            });
            expect(result).toEqual(mockResponse);
            expect(mockSessionStorage["frak-wallet-interaction-token"]).toBe(
                "test-token"
            );
        });

        it("should remove interaction token when not present in response", async () => {
            const mockResponse: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x123",
                interactionSession: {
                    startTimestamp: 123,
                    endTimestamp: 456,
                },
            };

            mockSessionStorage["frak-wallet-interaction-token"] = "old-token";
            vi.mocked(mockClient.request).mockResolvedValueOnce(mockResponse);

            await watchWalletStatus(mockClient);

            expect(
                mockSessionStorage["frak.interaction-token"]
            ).toBeUndefined();
        });
    });

    describe("with callback", () => {
        it("should set up listener and handle status updates", async () => {
            const mockCallback = vi.fn();
            const initialStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x123",
                interactionToken: "initial-token",
                interactionSession: {
                    startTimestamp: 123,
                    endTimestamp: 456,
                },
            };

            vi.mocked(mockClient.listenerRequest).mockImplementationOnce(
                async (_, callback) => {
                    if (callback) {
                        callback(initialStatus);
                    }
                }
            );

            const result = await watchWalletStatus(mockClient, mockCallback);

            expect(mockClient.listenerRequest).toHaveBeenCalledWith(
                { method: "frak_listenToWalletStatus" },
                expect.any(Function)
            );
            expect(mockCallback).toHaveBeenCalledWith(initialStatus);
            expect(result).toEqual(initialStatus);
            expect(mockSessionStorage["frak-wallet-interaction-token"]).toBe(
                "initial-token"
            );
        });

        it("should handle multiple status updates", async () => {
            const mockCallback = vi.fn();
            const statuses: WalletStatusReturnType[] = [
                {
                    wallet: "0x123",
                    key: "connected",
                    interactionToken: "token1",
                    interactionSession: {
                        startTimestamp: 123,
                        endTimestamp: 456,
                    },
                },
                {
                    wallet: "0x456",
                    key: "connected",
                    interactionToken: "token2",
                    interactionSession: {
                        startTimestamp: 789,
                        endTimestamp: 1011,
                    },
                },
            ];

            vi.mocked(mockClient.listenerRequest).mockImplementationOnce(
                async (_, callback) => {
                    if (callback) {
                        for (const status of statuses) {
                            callback(status);
                        }
                    }
                }
            );

            const result = await watchWalletStatus(mockClient, mockCallback);

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenNthCalledWith(1, statuses[0]);
            expect(mockCallback).toHaveBeenNthCalledWith(2, statuses[1]);
            expect(result).toEqual(statuses[0]); // Should resolve with first status
            expect(mockSessionStorage["frak-wallet-interaction-token"]).toBe(
                "token2"
            );
        });
    });
});
