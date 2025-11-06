/**
 * Tests for sendInteraction action
 * Tests sending user interactions via RPC
 */

import type { Hex } from "viem";
import { vi } from "vitest";

// Mock computeProductId - must be before imports
vi.mock("../utils/computeProductId", () => ({
    computeProductId: vi.fn(
        () =>
            "0xcomputed1234567890123456789012345678901234567890123456789012" as Hex
    ),
}));

import { describe, expect, it } from "../../tests/vitest-fixtures";
import type {
    FrakClient,
    PreparedInteraction,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../types";
import { sendInteraction } from "./sendInteraction";

describe("sendInteraction", () => {
    const mockInteraction: PreparedInteraction = {
        interactionData: "0xdata" as Hex,
        handlerTypeDenominator: "0x01" as Hex,
    };

    describe("with productId provided", () => {
        it("should use provided productId", async () => {
            const mockResponse: SendInteractionReturnType = {
                delegationId: "delegation-123",
            };

            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                productId:
                    "0xprovidedid567890123456789012345678901234567890123456789012" as Hex,
                interaction: mockInteraction,
            };

            await sendInteraction(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_sendInteraction",
                params: [
                    "0xprovidedid567890123456789012345678901234567890123456789012",
                    mockInteraction,
                    undefined,
                ],
            });
        });

        it("should return delegationId", async () => {
            const mockResponse: SendInteractionReturnType = {
                delegationId: "delegation-456",
            };

            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                productId:
                    "0xprovidedid567890123456789012345678901234567890123456789012" as Hex,
                interaction: mockInteraction,
            };

            const result = await sendInteraction(mockClient, params);

            expect(result).toEqual(mockResponse);
            expect(result.delegationId).toBe("delegation-456");
        });

        it("should include validation signature when provided", async () => {
            const mockResponse: SendInteractionReturnType = {
                delegationId: "delegation-789",
            };

            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                productId:
                    "0xprovidedid567890123456789012345678901234567890123456789012" as Hex,
                interaction: mockInteraction,
                validation: "0xsignature1234567890" as Hex,
            };

            await sendInteraction(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_sendInteraction",
                params: [
                    "0xprovidedid567890123456789012345678901234567890123456789012",
                    mockInteraction,
                    "0xsignature1234567890",
                ],
            });
        });
    });

    describe("without productId provided", () => {
        it("should compute productId from client.config", async () => {
            const { computeProductId } = await import(
                "../utils/computeProductId"
            );

            const mockResponse: SendInteractionReturnType = {
                delegationId: "delegation-computed",
            };

            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                interaction: mockInteraction,
            };

            await sendInteraction(mockClient, params);

            expect(computeProductId).toHaveBeenCalledWith(mockClient.config);
            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_sendInteraction",
                params: [
                    "0xcomputed1234567890123456789012345678901234567890123456789012",
                    mockInteraction,
                    undefined,
                ],
            });
        });

        it("should work with different interaction types", async () => {
            const mockResponse: SendInteractionReturnType = {
                delegationId: "delegation-different",
            };

            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const differentInteraction: PreparedInteraction = {
                interactionData: "0xdifferentdata" as Hex,
                handlerTypeDenominator: "0x02" as Hex,
            };

            const params: SendInteractionParamsType = {
                interaction: differentInteraction,
            };

            const result = await sendInteraction(mockClient, params);

            expect(result).toEqual(mockResponse);
        });
    });

    describe("error handling", () => {
        it("should propagate errors from client.request", async () => {
            const error = new Error("Send interaction failed");
            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                productId:
                    "0xprovidedid567890123456789012345678901234567890123456789012" as Hex,
                interaction: mockInteraction,
            };

            await expect(sendInteraction(mockClient, params)).rejects.toThrow(
                "Send interaction failed"
            );
        });

        it("should handle network errors", async () => {
            const error = new Error("Network timeout");
            const mockClient = {
                config: {
                    domain: "example.com",
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: SendInteractionParamsType = {
                interaction: mockInteraction,
            };

            await expect(sendInteraction(mockClient, params)).rejects.toThrow(
                "Network timeout"
            );
        });
    });
});
