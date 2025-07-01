import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import type { Address, Hex, LocalAccount } from "viem";
import { mockAll } from "../../../../test/mock";
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
        "0xbankbankbankbankbankbankbankbankbankbank" as Address;
    const mockInteractionAddress =
        "0xinteractioninteractioninteractioninteract" as Address;

    beforeEach(() => {
        mockAll();

        // Change the admin wallet repository mock
        adminWalletsRepositoryMocks.getKeySpecificAccount.mockResolvedValue(
            mockMinter as LocalAccount
        );

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
        mock.restore();
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
            viemActionsMocks.simulateContract.mockResolvedValue({
                request: { to: "0xproductregistry" },
                result: expectedProductId,
            });

            // Mock successful interaction contract deployment
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

        // todo: to fix
        it.todo(
            "should successfully mint a product with all deployments",
            async () => {
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
                expect(viemActionsMocks.simulateContract).toHaveBeenCalledTimes(
                    3
                );
                expect(viemActionsMocks.writeContract).toHaveBeenCalledTimes(4); // mint + interaction + bank + mint tokens
                expect(
                    viemActionsMocks.waitForTransactionReceipt
                ).toHaveBeenCalledTimes(2); // mint + interaction
            }
        );

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

        // todo: The `simulateContract` override is not working as expected, we need to fix it
        it.todo(
            "should throw error when mint simulation returns wrong product ID",
            async () => {
                viemActionsMocks.simulateContract.mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: 999n, // Wrong product ID
                });

                expect(mintRepository.mintProduct(mintParams)).rejects.toThrow(
                    "Invalid product id"
                );
            }
        );

        it("should handle interaction contract deployment failure gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

            // Mock interaction contract deployment to fail
            viemActionsMocks.simulateContract
                .mockResolvedValueOnce({
                    request: { to: "0xproductregistry" },
                    result: expectedProductId,
                })
                .mockResolvedValueOnce({
                    request: { to: "0xinteractionmanager" },
                    result: "0x0000000000000000000000000000000000000000" as Address, // Zero address indicates failure
                });

            const result = await mintRepository.mintProduct(mintParams);

            expect(result.interactionResult).toBeUndefined();
        });

        it("should handle bank deployment failure gracefully", async () => {
            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );

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
    });

    describe("mintProduct in production", () => {
        beforeEach(() => {
            // Mock production environment
            mock.module("@frak-labs/app-essentials", () => ({
                addresses: {
                    productRegistry: "0xproductregistry" as Address,
                    productInteractionManager:
                        "0xinteractionmanager" as Address,
                    campaignBankFactory: "0xcampaignbankfactory" as Address,
                    mUSDToken: "0xmusdtoken" as Address,
                },
                isRunningInProd: true,
                stringToBytes32: mock(
                    (str: string) => `0x${str.padEnd(64, "0")}`
                ),
            }));

            // Re-create repository to pick up new mocks
            mintRepository = new MintRepository();
        });

        // todo: to fix
        it.todo("should deploy USDC bank in production", async () => {
            const mintParams = {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"] as ProductTypesKey[],
                owner: mockOwner,
            };

            const expectedProductId = mintRepository.precomputeProductId(
                mintParams.domain
            );
            console.log("expectedProductId", expectedProductId);

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

            // Mock successful deployments
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

        it("should mint product with EUR currency", async () => {
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
            const result = await mintRepository.mintProduct(usdParams);

            expect(result.productId).toBeDefined();
            expect(result.mintTxHash).toBe(mockTxHash);
            expect(result.bankResult?.bank).toBe(mockBankAddress);
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

            // Mock successful deployments
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

        it("should mint product with EUR currency", async () => {
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
            const result = await mintRepository.mintProduct(usdParams);

            expect(result.productId).toBeDefined();
            expect(result.mintTxHash).toBe(mockTxHash);
            expect(result.bankResult?.bank).toBe(mockBankAddress);
        });
    });
});
