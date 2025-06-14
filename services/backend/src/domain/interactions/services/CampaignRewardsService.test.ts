import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Address, Hex } from "viem";
import { setupAllMocks, resetAllMocks, clearAllMocks, mocks } from "../../../../test/mocks";
import type { CampaignDataRepository } from "../repositories/CampaignDataRepository";
import { CampaignRewardsService } from "./CampaignRewardsService";

describe("CampaignRewardsService", () => {
    let service: CampaignRewardsService;
    let mockCampaignDataRepository: CampaignDataRepository;

    const mockProductId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockCampaignAddress = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockTokenAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeAll(() => {
        setupAllMocks();
    });

    afterAll(() => {
        clearAllMocks();
    });

    beforeEach(() => {
        resetAllMocks();
        
        // Setup test-specific mock implementations
        mocks.viem.multicall.mockImplementation(() => Promise.resolve([true]));
        mocks.viem.concatHex.mockImplementation((values: string[]) => values.join("") as any);
        mocks.viem.formatUnits.mockImplementation(() => "1.0");
        mocks.viem.keccak256.mockImplementation(() => "0x123456789abcdef" as Hex);
        
        mocks.backendCommon.indexerApi.get.mockImplementation(() => ({
            json: mock(() =>
                Promise.resolve({
                    campaigns: [
                        {
                            address: mockCampaignAddress,
                            token: mockTokenAddress,
                            attached: true,
                            lastUpdateBlock: "1000000",
                        },
                    ],
                    tokens: [
                        {
                            address: mockTokenAddress,
                            decimals: 18,
                            symbol: "TEST",
                            name: "Test Token",
                        },
                    ],
                })
            ),
        }));
        
        mocks.backendCommon.pricingRepository.getTokenPrice.mockImplementation(() =>
            Promise.resolve({
                eur: 1.0,
                usd: 1.1,
                gbp: 0.9,
            })
        );

        mockCampaignDataRepository = {
            getRewardsFromStorage: mock(() =>
                Promise.resolve([
                    {
                        interactionTypeKey: "read" as any,
                        triggerData: {
                            baseReward: BigInt("1000000000000000000"), // 1.0 in wei
                        },
                    },
                ])
            ),
            getChainingConfig: mock(() =>
                Promise.resolve({
                    userPercent: 0.3, // 30% for referee, 70% for referrer
                })
            ),
        } as unknown as CampaignDataRepository;

        service = new CampaignRewardsService(mockCampaignDataRepository);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("getActiveRewardsForProduct", () => {
        it("should return active rewards for a valid product", async () => {
            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0]).toEqual({
                campaign: mockCampaignAddress,
                token: mockTokenAddress,
                interactionTypeKey: "read",
                referrer: {
                    amount: 0.7,
                    eurAmount: 0.7,
                    usdAmount: 0.77,
                    gbpAmount: 0.63,
                },
                referee: {
                    amount: 0.3,
                    eurAmount: 0.3,
                    usdAmount: 0.33,
                    gbpAmount: 0.27,
                },
                triggerData: {
                    baseReward: 1.0,
                },
            });
        });

        it("should return undefined when no campaigns exist", async () => {
            mocks.backendCommon.indexerApi.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [],
                        tokens: [],
                    })
                ),
            });

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when no campaigns are attached", async () => {
            mocks.backendCommon.indexerApi.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address: mockCampaignAddress,
                                token: mockTokenAddress,
                                attached: false, // Not attached
                                lastUpdateBlock: "1000000",
                            },
                        ],
                        tokens: [
                            {
                                address: mockTokenAddress,
                                decimals: 18,
                                symbol: "TEST",
                                name: "Test Token",
                            },
                        ],
                    })
                ),
            });

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should return undefined when no campaigns are active", async () => {
            mocks.viem.multicall.mockReturnValue(Promise.resolve([false]));

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toBeUndefined();
        });

        it("should handle missing token", async () => {
            mocks.backendCommon.indexerApi.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address: mockCampaignAddress,
                                token: "0xdifferenttoken1234567890abcdef12345678" as Address,
                                attached: true,
                                lastUpdateBlock: "1000000",
                            },
                        ],
                        tokens: [
                            {
                                address: mockTokenAddress, // Different from campaign token
                                decimals: 18,
                                symbol: "TEST",
                                name: "Test Token",
                            },
                        ],
                    })
                ),
            });

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toEqual([]); // Should return empty array, not undefined
        });

        it("should handle missing token price", async () => {
            mocks.backendCommon.pricingRepository.getTokenPrice.mockImplementation(() => Promise.resolve(null));

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toEqual([]); // Should return empty array when no price available
        });

        it("should handle range-based trigger data", async () => {
            mockCampaignDataRepository.getRewardsFromStorage = mock(() =>
                Promise.resolve([
                    {
                        interactionTypeKey: "purchase" as any,
                        triggerData: {
                            startReward: BigInt("500000000000000000"), // 0.5 in wei
                            endReward: BigInt("2000000000000000000"), // 2.0 in wei
                            betaPercent: BigInt("5000"), // 50% in basis points (4 decimals)
                        },
                    },
                ])
            );

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result?.[0]?.triggerData).toEqual({
                startReward: 1.0,
                endReward: 1.0,
                beta: 1.0,
            });
        });

        it("should use cache for subsequent calls", async () => {
            // Clear previous calls from other tests
            mocks.backendCommon.indexerApi.get.mockClear();
            
            // First call
            await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            // Second call
            await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            // Should only call API once due to caching
            expect(mocks.backendCommon.indexerApi.get).toHaveBeenCalledTimes(1);
        });

        it("should cache active campaign results", async () => {
            // First call
            await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            mocks.viem.multicall.mockReset();

            // Second call with same campaigns (cache hit)
            await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            // Should not have been called again since cached
            expect(mocks.viem.multicall).toHaveBeenCalledTimes(0);
        });

        it("should handle multiple campaigns", async () => {
            mocks.backendCommon.indexerApi.get.mockReset();
            mocks.backendCommon.indexerApi.get.mockReturnValue({
                json: mock(() =>
                    Promise.resolve({
                        campaigns: [
                            {
                                address: mockCampaignAddress,
                                token: mockTokenAddress,
                                attached: true,
                                lastUpdateBlock: "1000000",
                            },
                            {
                                address: "0x9876543210fedcba9876543210fedcba98765432" as Address,
                                token: mockTokenAddress,
                                attached: true,
                                lastUpdateBlock: "1000001",
                            },
                        ],
                        tokens: [
                            {
                                address: mockTokenAddress,
                                decimals: 18,
                                symbol: "TEST",
                                name: "Test Token",
                            },
                        ],
                    })
                ),
            });

            mocks.viem.multicall.mockReturnValue(Promise.resolve([true, true]));

            mockCampaignDataRepository.getRewardsFromStorage = mock(() =>
                Promise.resolve([
                    {
                        interactionTypeKey: "read" as any,
                        triggerData: {
                            baseReward: BigInt("1000000000000000000"),
                        },
                    },
                ])
            );

            const result = await service.getActiveRewardsForProduct({
                productId: mockProductId,
            });

            expect(result).toHaveLength(2);
        });
    });
});