import { vi } from "vitest";

// Mock Deferred before imports
vi.mock("@frak-labs/frame-connector", () => ({
    Deferred: class {
        promise: Promise<any>;
        resolve: (value: any) => void;
        reject: (reason?: unknown) => void;

        constructor() {
            let resolveFunc: (value: any) => void;
            let rejectFunc: (reason?: unknown) => void;
            this.promise = new Promise((resolve, reject) => {
                resolveFunc = resolve;
                rejectFunc = reject;
            });
            this.resolve = resolveFunc!;
            this.reject = rejectFunc!;
        }
    },
}));

import type { Address } from "viem";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "../../tests/vitest-fixtures";
import type { FrakClient, WalletStatusReturnType } from "../types";
import { watchWalletStatus } from "./watchWalletStatus";

describe("watchWalletStatus", () => {
    let mockSessionStorage: {
        getItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
    };

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
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("without callback", () => {
        it("should make one-shot request", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-123",
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            const result = await watchWalletStatus(mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_listenToWalletStatus",
            });
            expect(result).toEqual(mockStatus);
        });

        it("should save interaction token to sessionStorage", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-abc",
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient);

            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token",
                "token-abc"
            );
        });

        it("should remove interaction token when not present", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "not-connected",
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient);

            expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token"
            );
        });

        it("should update OpenPanel global properties", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient);

            expect(
                mockClient.openPanel?.setGlobalProperties
            ).toHaveBeenCalledWith({
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            });
        });

        it("should set wallet to null when not connected", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "not-connected",
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient);

            expect(
                mockClient.openPanel?.setGlobalProperties
            ).toHaveBeenCalledWith({
                wallet: null,
            });
        });

        it("should work without openPanel", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const mockClient = {
                config: { metadata: { name: "Test" } },
                request: vi.fn().mockResolvedValue(mockStatus),
            } as unknown as FrakClient;

            const result = await watchWalletStatus(mockClient);

            expect(result).toEqual(mockStatus);
        });
    });

    describe("with callback", () => {
        it("should setup listener request", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    // Simulate status update
                    setTimeout(() => callback(mockStatus), 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            const resultPromise = watchWalletStatus(mockClient, mockCallback);

            expect(mockClient.listenerRequest).toHaveBeenCalled();

            await resultPromise;
        });

        it("should call callback with status updates", async () => {
            const mockStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-123",
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    setTimeout(() => callback(mockStatus), 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(mockStatus);
        });

        it("should resolve promise with first status", async () => {
            const firstStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const secondStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    setTimeout(() => {
                        callback(firstStatus);
                        callback(secondStatus);
                    }, 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            const result = await watchWalletStatus(mockClient, mockCallback);

            expect(result).toEqual(firstStatus);
            expect(mockCallback).toHaveBeenCalledTimes(2);
        });

        it("should handle side effects for each status update", async () => {
            const firstStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-1",
            };

            const secondStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-2",
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    setTimeout(() => {
                        callback(firstStatus);
                        callback(secondStatus);
                    }, 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient, mockCallback);

            // Both tokens should be saved
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token",
                "token-1"
            );
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token",
                "token-2"
            );
        });

        it("should save and remove interaction token based on status", async () => {
            const connectedStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1234567890123456789012345678901234567890" as Address,
                interactionToken: "token-123",
            };

            const disconnectedStatus: WalletStatusReturnType = {
                key: "not-connected",
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    setTimeout(() => {
                        callback(connectedStatus);
                        callback(disconnectedStatus);
                    }, 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient, mockCallback);

            expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token",
                "token-123"
            );
            expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
                "frak-wallet-interaction-token"
            );
        });

        it("should update OpenPanel properties with each status", async () => {
            const firstStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x1111111111111111111111111111111111111111" as Address,
            };

            const secondStatus: WalletStatusReturnType = {
                key: "connected",
                wallet: "0x2222222222222222222222222222222222222222" as Address,
            };

            const mockCallback = vi.fn();
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback) => {
                    setTimeout(() => {
                        callback(firstStatus);
                        callback(secondStatus);
                    }, 0);
                }),
                openPanel: {
                    setGlobalProperties: vi.fn(),
                },
            } as unknown as FrakClient;

            await watchWalletStatus(mockClient, mockCallback);

            expect(
                mockClient.openPanel?.setGlobalProperties
            ).toHaveBeenCalledWith({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            expect(
                mockClient.openPanel?.setGlobalProperties
            ).toHaveBeenCalledWith({
                wallet: "0x2222222222222222222222222222222222222222",
            });
        });

        it("rejects when the listener fails before the first status", async () => {
            const failure = new Error("not connected");
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, _callback, onError) => {
                    setTimeout(() => onError(failure), 0);
                }),
            } as unknown as FrakClient;

            await expect(watchWalletStatus(mockClient, vi.fn())).rejects.toBe(
                failure
            );
        });

        it("keeps the first status when the listener fails afterwards", async () => {
            const status: WalletStatusReturnType = { key: "not-connected" };
            const mockClient = {
                config: { metadata: { name: "Test" } },
                listenerRequest: vi.fn((_params, callback, onError) => {
                    setTimeout(() => {
                        callback(status);
                        onError(new Error("late failure"));
                    }, 0);
                }),
            } as unknown as FrakClient;

            await expect(
                watchWalletStatus(mockClient, vi.fn())
            ).resolves.toEqual(status);
        });
    });
});
