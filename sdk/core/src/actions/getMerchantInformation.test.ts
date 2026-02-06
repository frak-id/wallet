import type { Address, Hex } from "viem";
import { describe, expect, it, vi } from "../../tests/vitest-fixtures";
import type { FrakClient, GetMerchantInformationReturnType } from "../types";
import { getMerchantInformation } from "./getMerchantInformation";

describe("getMerchantInformation", () => {
    describe("success cases", () => {
        it("should call client.request with correct method", async () => {
            const mockResponse: GetMerchantInformationReturnType = {
                id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
                onChainMetadata: {
                    name: "Test Merchant",
                    domain: "example.com",
                },
                rewards: [],
            };

            const mockClient = {
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            await getMerchantInformation(mockClient);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_getMerchantInformation",
            });
        });

        it("should return merchant information", async () => {
            const mockResponse: GetMerchantInformationReturnType = {
                id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
                onChainMetadata: {
                    name: "Test Merchant",
                    domain: "example.com",
                },
                rewards: [],
            };

            const mockClient = {
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const result = await getMerchantInformation(mockClient);

            expect(result).toEqual(mockResponse);
        });

        it("should return merchant information with rewards", async () => {
            const mockResponse: GetMerchantInformationReturnType = {
                id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
                onChainMetadata: {
                    name: "Test Merchant",
                    domain: "example.com",
                },
                maxReferrer: {
                    amount: 100,
                    eurAmount: 10,
                    usdAmount: 12,
                    gbpAmount: 9,
                },
                maxReferee: {
                    amount: 50,
                    eurAmount: 5,
                    usdAmount: 6,
                    gbpAmount: 4.5,
                },
                rewards: [
                    {
                        token: "0x1234567890123456789012345678901234567890" as Address,
                        campaign:
                            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                        interactionTypeKey: "referral",
                        referrer: {
                            amount: 10,
                            eurAmount: 1,
                            usdAmount: 1.2,
                            gbpAmount: 0.9,
                        },
                        referee: {
                            amount: 5,
                            eurAmount: 0.5,
                            usdAmount: 0.6,
                            gbpAmount: 0.45,
                        },
                    },
                ],
            };

            const mockClient = {
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const result = await getMerchantInformation(mockClient);

            expect(result).toEqual(mockResponse);
            expect(result.rewards).toHaveLength(1);
            expect(result.maxReferrer).toBeDefined();
            expect(result.maxReferee).toBeDefined();
        });
    });

    describe("error handling", () => {
        it("should propagate errors from client.request", async () => {
            const error = new Error("RPC request failed");
            const mockClient = {
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            await expect(getMerchantInformation(mockClient)).rejects.toThrow(
                "RPC request failed"
            );
        });

        it("should handle network timeout errors", async () => {
            const error = new Error("Request timeout");
            const mockClient = {
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            await expect(getMerchantInformation(mockClient)).rejects.toThrow(
                "Request timeout"
            );
        });
    });
});
