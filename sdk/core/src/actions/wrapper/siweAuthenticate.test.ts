import { beforeEach, vi } from "vitest";

vi.mock("../displayModal", () => ({
    displayModal: vi.fn(),
}));

vi.mock("viem/siwe", () => ({
    generateSiweNonce: vi.fn(() => "mock-nonce-123456"),
}));

import type { Address, Hex } from "viem";
import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { FrakClient } from "../../types";
import { siweAuthenticate } from "./siweAuthenticate";

describe("siweAuthenticate", () => {
    const mockClient = {
        config: {
            domain: "example.com",
            metadata: {
                name: "Test App",
            },
        },
        request: vi.fn(),
    } as unknown as FrakClient;

    const mockClientWithoutDomain = {
        config: {
            metadata: {
                name: "Test App",
            },
        },
        request: vi.fn(),
    } as unknown as FrakClient;

    beforeEach(() => {
        vi.stubGlobal("window", {
            location: {
                host: "window.example.com",
            },
        });
    });

    describe("basic usage", () => {
        it("should call displayModal with SIWE params", async () => {
            const { displayModal } = await import("../displayModal");

            const mockResponse = {
                login: {
                    wallet: "0x1234567890123456789012345678901234567890" as Address,
                },
                siweAuthenticate: {
                    message: "Sign in to Test App",
                    signature: "0xsignature" as Hex,
                },
            };
            vi.mocked(displayModal).mockResolvedValue(mockResponse as any);

            await siweAuthenticate(mockClient, {});

            expect(displayModal).toHaveBeenCalledWith(mockClient, {
                metadata: undefined,
                steps: {
                    login: {},
                    siweAuthenticate: {
                        siwe: expect.objectContaining({
                            domain: "example.com",
                            nonce: "mock-nonce-123456",
                            uri: "https://example.com",
                            version: "1",
                        }),
                    },
                },
            });
        });

        it("should return SIWE authentication result", async () => {
            const { displayModal } = await import("../displayModal");

            const mockSiweResult = {
                message: "I confirm that I want to use my Frak wallet",
                signature:
                    "0xsig1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            };
            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: mockSiweResult,
            } as any);

            const result = await siweAuthenticate(mockClient, {});

            expect(result).toEqual(mockSiweResult);
        });
    });

    describe("SIWE parameter handling", () => {
        it("should use default statement when not provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClient, {});

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                statement:
                                    "I confirm that I want to use my Frak wallet on: Test App",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should use custom statement when provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClient, {
                siwe: { statement: "Custom sign in message" },
            });

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                statement: "Custom sign in message",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should use custom nonce when provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClient, {
                siwe: { nonce: "custom-nonce" },
            });

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                nonce: "custom-nonce",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should use window.location.host when domain not in config", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClientWithoutDomain, {});

            expect(displayModal).toHaveBeenCalledWith(
                mockClientWithoutDomain,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                domain: "window.example.com",
                                uri: "https://window.example.com",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should use custom uri when provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClient, {
                siwe: { uri: "https://custom-uri.com" },
            });

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                uri: "https://custom-uri.com",
                            }),
                        }),
                    }),
                })
            );
        });

        it("should use custom version when provided", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            await siweAuthenticate(mockClient, {
                siwe: { version: "2" as any },
            });

            expect(displayModal).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({
                    steps: expect.objectContaining({
                        siweAuthenticate: expect.objectContaining({
                            siwe: expect.objectContaining({
                                version: "2",
                            }),
                        }),
                    }),
                })
            );
        });
    });

    describe("with metadata", () => {
        it("should pass metadata to displayModal", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockResolvedValue({
                login: {},
                siweAuthenticate: { message: "", signature: "0x" as Hex },
            } as any);

            const metadata = {
                header: {
                    title: "Sign In",
                },
                context: "Sign in to access your account",
            };

            await siweAuthenticate(mockClient, { metadata });

            expect(displayModal).toHaveBeenCalledWith(mockClient, {
                metadata,
                steps: expect.any(Object),
            });
        });
    });

    describe("error handling", () => {
        it("should propagate errors from displayModal", async () => {
            const { displayModal } = await import("../displayModal");

            vi.mocked(displayModal).mockRejectedValue(
                new Error("SIWE authentication rejected")
            );

            await expect(siweAuthenticate(mockClient, {})).rejects.toThrow(
                "SIWE authentication rejected"
            );
        });
    });
});
