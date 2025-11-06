/**
 * Tests for displayModal action
 * Tests modal display via RPC with various step configurations
 */

import type { Address } from "viem";
import { describe, expect, it, vi } from "../../tests/vitest-fixtures";
import type {
    DisplayModalParamsType,
    FrakClient,
    ModalStepTypes,
} from "../types";
import { displayModal } from "./displayModal";

describe("displayModal", () => {
    describe("basic modal display", () => {
        it("should call client.request with correct method and params", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [params.steps, params.metadata, { name: "Test App" }],
            });
        });

        it("should return modal results", async () => {
            const mockResponse = {
                login: {
                    wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: false },
                },
            };

            const result = await displayModal(mockClient, params);

            expect(result).toEqual(mockResponse);
        });
    });

    describe("modal with multiple steps", () => {
        it("should handle login + openSession steps", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                openSession: {
                    startTimestamp: 1234567890,
                    endTimestamp: 1234567900,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                    openSession: {},
                },
            };

            const result = await displayModal(mockClient, params);

            expect(result).toEqual(mockResponse);
        });

        it("should handle full modal flow", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                openSession: {
                    startTimestamp: 1234567890,
                    endTimestamp: 1234567900,
                },
                sendTransaction: {
                    hash: "0xtxhash" as `0x${string}`,
                },
                final: {},
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

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                    openSession: {},
                    sendTransaction: {
                        tx: [
                            {
                                to: "0xdeadbeef" as Address,
                                data: "0xdata" as `0x${string}`,
                            },
                        ],
                    },
                    final: {
                        action: { key: "reward" },
                    },
                },
            };

            const result = await displayModal(mockClient, params);

            expect(result).toEqual(mockResponse);
        });
    });

    describe("modal with metadata", () => {
        it("should pass metadata to request", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                },
                metadata: {
                    header: {
                        title: "My Custom Title",
                        icon: "https://example.com/icon.png",
                    },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [
                    params.steps,
                    {
                        header: {
                            title: "My Custom Title",
                            icon: "https://example.com/icon.png",
                        },
                    },
                    { name: "Test App" },
                ],
            });
        });

        it("should work without metadata", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [params.steps, undefined, { name: "Test App" }],
            });
        });
    });

    describe("modal with SSO metadata", () => {
        it("should handle SSO metadata in login step", async () => {
            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: {
                        allowSso: true,
                        ssoMetadata: {
                            logoUrl: "https://example.com/logo.png",
                            homepageLink: "https://example.com",
                        },
                    },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [params.steps, undefined, { name: "Test App" }],
            });
        });
    });

    describe("modal with sharing action", () => {
        it("should handle sharing final action", async () => {
            const mockResponse = {
                final: {},
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    final: {
                        action: {
                            key: "sharing",
                            options: {
                                popupTitle: "Share the app",
                                text: "Discover my app",
                                link: "https://example.com",
                            },
                        },
                    },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [params.steps, undefined, { name: "Test App" }],
            });
        });

        it("should handle reward final action", async () => {
            const mockResponse = {
                final: {},
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    final: {
                        action: { key: "reward" },
                        autoSkip: true,
                    },
                },
            };

            await displayModal(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_displayModal",
                params: [params.steps, undefined, { name: "Test App" }],
            });
        });
    });

    describe("error handling", () => {
        it("should propagate errors from client.request", async () => {
            const error = new Error("Modal display failed");
            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    login: { allowSso: true },
                },
            };

            await expect(displayModal(mockClient, params)).rejects.toThrow(
                "Modal display failed"
            );
        });

        it("should handle network errors", async () => {
            const error = new Error("Network timeout");
            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: DisplayModalParamsType<ModalStepTypes[]> = {
                steps: {
                    openSession: {},
                },
            };

            await expect(displayModal(mockClient, params)).rejects.toThrow(
                "Network timeout"
            );
        });
    });
});
