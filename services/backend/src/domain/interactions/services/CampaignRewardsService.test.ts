import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Address, Hex } from "viem";
import {
    indexerApiMocks,
    pricingRepositoryMocks,
} from "../../../../test/mock/common";
import { viemActionsMocks } from "../../../../test/mock/viem";
import type { CampaignDataRepository } from "../repositories/CampaignDataRepository";
import { CampaignRewardsService } from "./CampaignRewardsService";

describe("CampaignRewardsService", () => {
    let service: CampaignRewardsService;

    const mockCampaignDataRepository = {
        getRewardsFromStorage: mock(() =>
            Promise.resolve([
                {
                    interactionTypeKey: "press.created",
                    triggerData: { baseReward: BigInt("1000000000000000000") },
                },
            ])
        ),
        getChainingConfig: mock(() =>
            Promise.resolve({
                deperditionLevel: 0.8,
                userPercent: 0.5,
            })
        ),
        getType: mock(() => Promise.resolve("frak.campaign.affiliation-fixed")),
    };

    const mockProductId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

    beforeEach(() => {
        service = new CampaignRewardsService(
            mockCampaignDataRepository as unknown as CampaignDataRepository
        );
    });

    afterAll(() => {
        mock.restore();
    });

    describe("getActiveRewardsForProduct", () => {
        it("should return undefined when no campaigns are found", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({ campaigns: [], tokens: [] })
                ),
            });

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when no campaigns are attached", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: false,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [
                            {
                                address:
                                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                name: "Test Token",
                                symbol: "TEST",
                                decimals: 18,
                            },
                        ],
                    })
                ),
            });

            viemActionsMocks.multicall.mockResolvedValue([false]);

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when no campaigns are active", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: true,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [
                            {
                                address:
                                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                name: "Test Token",
                                symbol: "TEST",
                                decimals: 18,
                            },
                        ],
                    })
                ),
            });

            // Mock multicall to return false for active campaigns
            viemActionsMocks.multicall.mockResolvedValue([false]);

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should return active rewards when campaigns are active and have valid tokens", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: true,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [
                            {
                                address:
                                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                name: "Test Token",
                                symbol: "TEST",
                                decimals: 18,
                            },
                        ],
                    })
                ),
            });

            // Mock multicall to return true for active campaigns
            viemActionsMocks.multicall.mockResolvedValue([true]);

            // Mock pricing repository
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue({
                eur: 1.2,
                usd: 1.0,
                gbp: 0.8,
            });

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0]).toMatchObject({
                campaign: "0x1234567890abcdef1234567890abcdef12345678",
                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                interactionTypeKey: "press.created",
                referrer: {
                    amount: 0.5,
                    eurAmount: 0.6,
                    usdAmount: 0.5,
                    gbpAmount: 0.4,
                },
                referee: {
                    amount: 0.5,
                    eurAmount: 0.6,
                    usdAmount: 0.5,
                    gbpAmount: 0.4,
                },
                triggerData: {
                    baseReward: 1,
                },
            });
        });

        it("should handle campaigns without valid tokens", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: true,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [], // No tokens
                    })
                ),
            });

            // Mock multicall to return true for active campaigns
            viemActionsMocks.multicall.mockResolvedValue([true]);

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toEqual([]);
        });

        it("should handle campaigns without valid token prices", async () => {
            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: true,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [
                            {
                                address:
                                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                name: "Test Token",
                                symbol: "TEST",
                                decimals: 18,
                            },
                        ],
                    })
                ),
            });

            // Mock multicall to return true for active campaigns
            viemActionsMocks.multicall.mockResolvedValue([true]);

            // Mock pricing repository to return undefined
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue(undefined);

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toEqual([]);
        });

        it("should handle range trigger data correctly", async () => {
            mockCampaignDataRepository.getRewardsFromStorage.mockResolvedValue([
                {
                    interactionTypeKey: "press.created",
                    triggerData: {
                        startReward: BigInt("500000000000000000"),
                        endReward: BigInt("2000000000000000000"),
                        betaPercent: BigInt("8000"), // 0.8 in basis points
                    },
                },
            ]);

            const serviceWithRangeData = new CampaignRewardsService(
                mockCampaignDataRepository as unknown as CampaignDataRepository
            );

            indexerApiMocks.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address:
                                    "0x1234567890abcdef1234567890abcdef12345678" as Address,
                                token: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                attached: true,
                                lastUpdateBlock: "12345",
                            },
                        ],
                        tokens: [
                            {
                                address:
                                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                                name: "Test Token",
                                symbol: "TEST",
                                decimals: 18,
                            },
                        ],
                    })
                ),
            });

            viemActionsMocks.multicall.mockResolvedValue([true]);
            pricingRepositoryMocks.getTokenPrice.mockResolvedValue({
                eur: 1.2,
                usd: 1.0,
                gbp: 0.8,
            });

            const result =
                await serviceWithRangeData.getActiveRewardsForProduct({
                    productId: mockProductId,
                });

            expect(result).toBeDefined();
            expect(result?.[0]?.triggerData).toMatchObject({
                startReward: 0.5,
                endReward: 2,
                beta: 0.8,
            });
        });
    });
});
