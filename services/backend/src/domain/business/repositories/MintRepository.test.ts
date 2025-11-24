import type { ProductTypesKey } from "@frak-labs/core-sdk";
import type { Address, Hex, LocalAccount } from "viem";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminWalletsRepositoryMocks } from "../../../../test/mock/common";
import { viemActionsMocks } from "../../../../test/mock/viem";
import { MintRepository } from "./MintRepository";

describe("MintRepository", () => {
    let mintRepository: MintRepository;
    const mockProductId = 12345678901234567890n;
    const mockOwner = "0x1234567890abcdef1234567890abcdef12345678" as Address;
    const mockMinter = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
    };
    const mockTxHash =
        "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as Hex;
    const mockBankAddress =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
    const mockInteractionAddress =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

    beforeEach(() => {
        // Reset all mocks
        viemActionsMocks.readContract.mockReset();
        viemActionsMocks.simulateContract.mockReset();
        viemActionsMocks.writeContract.mockReset();
        viemActionsMocks.waitForTransactionReceipt.mockReset();
        viemActionsMocks.getTransactionCount.mockReset();

        // Mock app-essentials module
        vi.mock("@frak-labs/app-essentials", () => ({
            addresses: {
                productRegistry: "0xproductregistry" as Address,
                productInteractionManager: "0xinteractionmanager" as Address,
                campaignBankFactory: "0xcampaignbankfactory" as Address,
                mUSDToken: "0xmusdtoken" as Address,
            },
            isRunningInProd: false,
            stringToBytes32: vi.fn((str: string) => `0x${str.padEnd(64, "0")}`),
            getTokenAddressForStablecoin: vi.fn((_currency: string) => {
                // Return a mock token address based on currency
                return "0xmocktokenaddress" as Address;
            }),
        }));

        // Change the admin wallet repository mock
        adminWalletsRepositoryMocks.getKeySpecificAccount.mockResolvedValue(
            mockMinter as LocalAccount
        );
        adminWalletsRepositoryMocks.getMutexForAccount.mockReturnValue({
            runExclusive: vi.fn(async (fn: () => Promise<unknown>) => fn()),
        });

        // Mock some default viem actions
        viemActionsMocks.getTransactionCount.mockResolvedValue(1);
        viemActionsMocks.writeContract.mockResolvedValue(mockTxHash);
        viemActionsMocks.waitForTransactionReceipt.mockResolvedValue({
            hash: mockTxHash,
            confirmations: 4,
        });

        mintRepository = new MintRepository();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("precomputeProductId", () => {
        it("should compute product ID from domain", () => {
            const domain = "example.com";
            const result = mintRepository.precomputeProductId(domain);

            expect(typeof result).toBe("bigint");
            expect(result).toBeGreaterThan(0n);
        });

        it("should normalize domain by removing www prefix", () => {
            const result1 =
                mintRepository.precomputeProductId("www.example.com");
            const result2 = mintRepository.precomputeProductId("example.com");

            expect(result1).toBe(result2);
        });

        it("should generate different IDs for different domains", () => {
            const result1 = mintRepository.precomputeProductId("example.com");
            const result2 = mintRepository.precomputeProductId("test.com");

            expect(result1).not.toBe(result2);
        });
    });

    describe("isExistingProduct", () => {
        it("should return true when product exists", async () => {
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 1n,
            });

            const result =
                await mintRepository.isExistingProduct(mockProductId);

            expect(result).toBe(true);
            expect(viemActionsMocks.readContract).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    functionName: "getMetadata",
                    args: [mockProductId],
                })
            );
        });

        it("should return false when product does not exist", async () => {
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            const result =
                await mintRepository.isExistingProduct(mockProductId);

            expect(result).toBe(false);
        });

        it("should return false when readContract throws", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Contract error")
            );

            const result =
                await mintRepository.isExistingProduct(mockProductId);

            expect(result).toBe(false);
        });
    });

    describe("mintProduct", () => {
        const mintParams = {
            name: "Test Product",
            domain: "example.com",
            productTypes: ["press", "webshop"] as ProductTypesKey[],
            owner: mockOwner,
            currency: "usd" as const,
        };

        beforeEach(() => {
            // Mock successful product existence check (product doesn't exist)
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Compute the expected product ID for the test domain
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Mock successful mint simulation
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });
        });

        it("should successfully mint a product with all deployments", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );
            const result = await mintRepository.mintProduct(mintParams);

            expect(result).toEqual({
                productId: expectedProductId,
                mintTxHash: mockTxHash,
                interactionResult: {
                    txHash: mockTxHash,
                    interactionContract: mockInteractionAddress,
                },
                bankResult: {
                    txHash: mockTxHash,
                    bank: mockBankAddress,
                },
            });

            expect(
                adminWalletsRepositoryMocks.getKeySpecificAccount
            ).toHaveBeenCalledWith({
                key: "minter",
            });
            expect(viemActionsMocks.simulateContract).toHaveBeenCalledTimes(3);
            expect(viemActionsMocks.writeContract).toHaveBeenCalledTimes(3); // mint + interaction + bank
            expect(
                viemActionsMocks.waitForTransactionReceipt
            ).toHaveBeenCalledTimes(2); // mint + interaction
        });

        it("should throw error when product already exists", async () => {
            // Mock that product already exists
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 1n,
            });

            await expect(
                mintRepository.mintProduct(mintParams)
            ).rejects.toThrow(
                "The product Test Product already exists for the domain example.com"
            );
        });

        it("should throw error when mint simulation returns wrong product ID", async () => {
            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock that product doesn't exist
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            viemActionsMocks.simulateContract.mockResolvedValueOnce({
                request: { to: "0xproductregistry" },
                result: 999n, // Wrong product ID
            });

            await expect(
                mintRepository.mintProduct(mintParams)
            ).rejects.toThrow("Invalid product id");
        });
        it("should handle interaction contract deployment failure gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Mock interaction contract deployment to fail
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: "0x0000000000000000000000000000000000000000" as Address, // Zero address indicates failure
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeUndefined();
        });
        it("should handle bank deployment failure gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Mock bank deployment to fail
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: "0x0000000000000000000000000000000000000000" as Address, // Zero address indicates failure
                });

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.bankResult).toBeUndefined();
        });

        it("should handle interaction contract deployment error gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Mock interaction contract deployment to throw error
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockRejectedValueOnce(
                    new Error("Interaction deployment failed")
                )
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeUndefined();
            expect(result.bankResult).toBeDefined();
        });

        it("should handle mocked bank deployment error gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();
            viemActionsMocks.writeContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Set up default write contract behavior
            viemActionsMocks.writeContract.mockResolvedValue(mockTxHash);

            // Mock bank deployment to throw error after interaction succeeds
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            // Make the bank deployment writeContract throw
            viemActionsMocks.writeContract
                .mockResolvedValueOnce(mockTxHash) // mint
                .mockResolvedValueOnce(mockTxHash) // interaction
                .mockRejectedValueOnce(new Error("Bank deployment failed")); // bank deployment fails

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeDefined();
            expect(result.bankResult).toBeUndefined();
        });
    });

    describe("mintProduct in production", () => {
        beforeEach(() => {
            // Mock production environment
            vi.mock("@frak-labs/app-essentials", () => ({
                addresses: {
                    productRegistry: "0xproductregistry" as Address,
                    productInteractionManager:
                        "0xinteractionmanager" as Address,
                    campaignBankFactory: "0xcampaignbankfactory" as Address,
                    mUSDToken: "0xmusdtoken" as Address,
                    usdcToken: "0xusdc" as Address,
                },
                isRunningInProd: true,
                stringToBytes32: vi.fn(
                    (str: string) => `0x${str.padEnd(64, "0")}`
                ),
                getTokenAddressForStablecoin: vi.fn(() => "0xusdc" as Address),
            }));

            // Re-create repository to pick up new mocks
            mintRepository = new MintRepository();
        });

        it("should deploy USDC bank in production", async () => {
            const mintParams = {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"] as ProductTypesKey[],
                owner: mockOwner,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Mock successful operations
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });
            const result = await mintRepository.mintProduct(mintParams);

            expect(result.bankResult).toEqual({
                txHash: mockTxHash,
                bank: mockBankAddress,
            });

            // Should call simulateContract with USDC address instead of mUSD
            expect(viemActionsMocks.simulateContract).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    args: [expectedProductId, "0xusdc"],
                })
            );
        });

        it("should handle production bank deployment simulation failure", async () => {
            const mintParams = {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"] as ProductTypesKey[],
                owner: mockOwner,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Mock bank deployment simulation to return zero address
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: "0x0000000000000000000000000000000000000000" as Address, // Zero address indicates failure
                });

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeDefined();
            expect(result.bankResult).toBeUndefined();
        });

        it("should handle production bank deployment error gracefully", async () => {
            const mintParams = {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"] as ProductTypesKey[],
                owner: mockOwner,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Reset mocks for this specific test
            viemActionsMocks.simulateContract.mockReset();

            // Mock successful product existence check
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            // Mock bank deployment to throw error
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockRejectedValueOnce(new Error("Bank deployment failed"));

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeDefined();
            expect(result.bankResult).toBeUndefined();
        });
    });
    describe("encodeProductTypesMask", () => {
        it("should encode single product type", () => {
            // Access private method for testing
            const result = (
                mintRepository as unknown as {
                    encodeProductTypesMask: (
                        types: ProductTypesKey[]
                    ) => bigint;
                }
            ).encodeProductTypesMask(["press"]);
            expect(result).toBe(1n << 2n);
        });

        it("should encode multiple product types", () => {
            const result = (
                mintRepository as unknown as {
                    encodeProductTypesMask: (
                        types: ProductTypesKey[]
                    ) => bigint;
                }
            ).encodeProductTypesMask(["press", "webshop"]);
            expect(result).toBe((1n << 2n) | (1n << 3n));
        });

        it("should handle empty array", () => {
            const result = (
                mintRepository as unknown as {
                    encodeProductTypesMask: (
                        types: ProductTypesKey[]
                    ) => bigint;
                }
            ).encodeProductTypesMask([]);
            expect(result).toBe(0n);
        });
    });

    describe("multi-currency support", () => {
        const mintParamsWithCurrency = {
            name: "Test Product",
            domain: "example.com",
            productTypes: ["press", "webshop"] as ProductTypesKey[],
            owner: mockOwner,
            currency: "eur" as const,
        };

        beforeEach(() => {
            // Mock successful product existence check (product doesn't exist)
            viemActionsMocks.readContract.mockResolvedValue({
                productTypes: 0n,
            });

            const expectedProductId = mintRepository.precomputeProductId(
                mintParamsWithCurrency.domain
            );

            // Mock successful mint simulation
            viemActionsMocks.simulateContract.mockResolvedValue({
                request: { to: "0xproductregistry" },
                result: expectedProductId,
            });

            // Reset mocks for each test
            viemActionsMocks.simulateContract.mockReset();
            viemActionsMocks.writeContract.mockReset();
            viemActionsMocks.waitForTransactionReceipt.mockReset();

            // Set default mock values
            viemActionsMocks.writeContract.mockResolvedValue(mockTxHash);
            viemActionsMocks.waitForTransactionReceipt.mockResolvedValue({
                hash: mockTxHash,
                confirmations: 4,
            });
        });

        it("should mint product with EUR currency", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParamsWithCurrency.domain
            );

            // Mock successful operations
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            const result = await mintRepository.mintProduct(
                mintParamsWithCurrency
            );

            expect(result.productId).toBeDefined();
            expect(result.mintTxHash).toBe(mockTxHash);
            expect(result.bankResult?.bank).toBe(mockBankAddress);
        });

        it("should mint product with GBP currency", async () => {
            const gbpParams = {
                ...mintParamsWithCurrency,
                currency: "gbp" as const,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                gbpParams.domain
            );

            // Mock successful operations
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            const result = await mintRepository.mintProduct(gbpParams);

            expect(result.productId).toBeDefined();
            expect(result.mintTxHash).toBe(mockTxHash);
            expect(result.bankResult?.bank).toBe(mockBankAddress);
        });

        it("should mint product with USD currency", async () => {
            const usdParams = {
                ...mintParamsWithCurrency,
                currency: "usd" as const,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                usdParams.domain
            );

            // Mock successful operations
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: mockInteractionAddress,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xcampaignbankfactory" },
                    result: mockBankAddress,
                });

            const result = await mintRepository.mintProduct(usdParams);

            expect(result.productId).toBeDefined();
            expect(result.mintTxHash).toBe(mockTxHash);
            expect(result.bankResult?.bank).toBe(mockBankAddress);
        });
    });
});
