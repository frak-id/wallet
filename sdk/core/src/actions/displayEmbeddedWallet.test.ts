/**
 * Tests for displayEmbeddedWallet action
 * Tests displaying embedded wallet via RPC
 */

import type { Address } from "viem";
import { describe, expect, it, vi } from "../../tests/vitest-fixtures";
import type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    FrakClient,
} from "../types";
import { displayEmbeddedWallet } from "./displayEmbeddedWallet";

describe("displayEmbeddedWallet", () => {
    describe("success cases", () => {
        it("should call client.request with correct method and params", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {
                loggedIn: {
                    action: {
                        key: "sharing",
                    },
                },
            };

            const mockResponse: DisplayEmbeddedWalletResultType = {
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            await displayEmbeddedWallet(mockClient, mockParams);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayEmbeddedWallet",
                params: [mockParams, { name: "Test App" }],
            });
        });

        it("should return wallet address", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {
                loggedIn: {
                    action: {
                        key: "sharing",
                    },
                },
            };

            const mockResponse: DisplayEmbeddedWalletResultType = {
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const result = await displayEmbeddedWallet(mockClient, mockParams);

            expect(result).toEqual(mockResponse);
            expect(result.wallet).toBe(
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            );
        });

        it("should handle loggedOut view params", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {
                loggedOut: {
                    metadata: {
                        text: "Login to get rewards",
                    },
                },
            };

            const mockResponse: DisplayEmbeddedWalletResultType = {
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                        logoUrl: "https://example.com/logo.png",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            await displayEmbeddedWallet(mockClient, mockParams);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayEmbeddedWallet",
                params: [
                    mockParams,
                    {
                        name: "Test App",
                        logoUrl: "https://example.com/logo.png",
                    },
                ],
            });
        });

        it("should handle referred action", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {
                loggedIn: {
                    action: {
                        key: "referred",
                    },
                },
            };

            const mockResponse: DisplayEmbeddedWalletResultType = {
                wallet: "0x1234567890123456789012345678901234567890" as Address,
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const result = await displayEmbeddedWallet(mockClient, mockParams);

            expect(result).toEqual(mockResponse);
        });

        it("should pass client metadata to request", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {};

            const mockMetadata = {
                name: "My App",
                logoUrl: "https://example.com/logo.png",
                css: "body { color: red; }",
                lang: "fr" as const,
            };

            const mockClient = {
                config: {
                    metadata: mockMetadata,
                },
                request: vi.fn().mockResolvedValue({
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                }),
            } as unknown as FrakClient;

            await displayEmbeddedWallet(mockClient, mockParams);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayEmbeddedWallet",
                params: [mockParams, mockMetadata],
            });
        });
    });

    describe("error handling", () => {
        it("should propagate errors from client.request", async () => {
            const mockParams: DisplayEmbeddedWalletParamsType = {
                loggedIn: {
                    action: {
                        key: "sharing",
                    },
                },
            };

            const error = new Error("Display failed");
            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            await expect(
                displayEmbeddedWallet(mockClient, mockParams)
            ).rejects.toThrow("Display failed");
        });
    });
});
