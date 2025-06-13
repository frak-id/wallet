import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Hex } from "viem";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { OracleProofService } from "./proofService";

describe("OracleProofService", () => {
    let service: OracleProofService;
    let mockOracleDb: any;
    let mockMerkleRepository: MerkleTreeRepository;

    const mockProductId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockPurchaseId = "test-purchase-id";
    const mockToken = "test-token-123";
    const mockExternalId = "external-123";
    const mockLeaf = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef" as Hex;

    const mockPurchase = {
        id: 1,
        purchaseId: mockPurchaseId,
        oracleId: 1,
        leaf: mockLeaf,
        status: "confirmed" as const,
        totalPrice: 1999,
        currencyCode: "USD",
    };

    const mockOracle = {
        id: 1,
        productId: mockProductId,
        synced: true,
        merkleRoot: "0x123456789abcdef" as Hex,
    };

    const mockProof = {
        leaf: mockLeaf,
        proof: ["0xproof1", "0xproof2"] as Hex[],
        index: 0,
    };

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        const mockLimit = mock(() => Promise.resolve([mockPurchase]));
        const mockWhere = mock(() => ({ limit: mockLimit }));
        const mockInnerJoin = mock(() => ({ where: mockWhere, limit: mockLimit }));
        const mockFrom = mock(() => ({ 
            where: mockWhere, 
            limit: mockLimit,
            innerJoin: mockInnerJoin,
        }));
        const mockSelect = mock(() => ({ from: mockFrom }));

        // Mock for oracle query
        const mockOracleLimit = mock(() => Promise.resolve([mockOracle]));
        const mockOracleWhere = mock(() => ({ limit: mockOracleLimit }));
        const mockOracleFrom = mock(() => ({ where: mockOracleWhere }));
        const mockOracleSelect = mock(() => ({ from: mockOracleFrom }));

        mockOracleDb = {
            select: mock()
                .mockReturnValueOnce({ from: mockFrom }) // First call for purchase
                .mockReturnValue({ from: mockOracleFrom }), // Subsequent calls for oracle
        };

        mockMerkleRepository = {
            getMerkleProof: mock(() => Promise.resolve(mockProof)),
        } as unknown as MerkleTreeRepository;

        service = new OracleProofService(mockOracleDb, mockMerkleRepository);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("getPurchaseProof", () => {
        it("should return successful proof for valid purchase with product/purchase ID", async () => {
            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({
                status: "success",
                proof: mockProof,
                purchase: mockPurchase,
                oracle: mockOracle,
            });
        });

        it("should return successful proof for valid purchase with token/external ID", async () => {
            const result = await service.getPurchaseProof({
                token: mockToken,
                externalId: mockExternalId,
            });

            expect(result).toEqual({
                status: "success",
                proof: mockProof,
                purchase: mockPurchase,
                oracle: mockOracle,
            });
        });

        it("should return purchase-not-found when purchase doesn't exist", async () => {
            mockOracleDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => ({
                        limit: mock(() => Promise.resolve([])), // Empty result
                    })),
                })),
            }));

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: "non-existent",
            });

            expect(result).toEqual({
                status: "purchase-not-found",
            });
        });

        it("should return purchase-not-processed when leaf is null", async () => {
            const purchaseWithoutLeaf = { ...mockPurchase, leaf: null };
            mockOracleDb.select = mock()
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([purchaseWithoutLeaf])),
                        })),
                    })),
                });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({
                status: "purchase-not-processed",
            });
        });

        it("should return purchase-not-found when oracle doesn't exist", async () => {
            mockOracleDb.select = mock()
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockPurchase])),
                        })),
                    })),
                })
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([])), // No oracle found
                        })),
                    })),
                });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({
                status: "purchase-not-found",
            });
        });

        it("should return oracle-not-synced when oracle is not synced", async () => {
            const unsyncedOracle = { ...mockOracle, synced: false };
            mockOracleDb.select = mock()
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockPurchase])),
                        })),
                    })),
                })
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([unsyncedOracle])),
                        })),
                    })),
                });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({
                status: "oracle-not-synced",
            });
        });

        it("should return no-proof-found when merkle proof is not available", async () => {
            mockMerkleRepository.getMerkleProof = mock(() => Promise.resolve(null));

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({
                status: "no-proof-found",
            });
        });

        it("should handle hex purchase ID", async () => {
            const hexPurchaseId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: hexPurchaseId,
            });

            expect(result.status).toBe("success");
            expect(mockOracleDb.select).toHaveBeenCalled();
        });

        it("should handle external purchase ID with product join", async () => {
            const externalPurchaseId = "external-purchase-123";
            
            // Mock the join query result
            mockOracleDb.select = mock()
                .mockReturnValueOnce({
                    from: mock(() => ({
                        innerJoin: mock(() => ({
                            where: mock(() => ({
                                limit: mock(() => Promise.resolve([
                                    { product_oracle_purchase: mockPurchase }
                                ])),
                            })),
                        })),
                    })),
                })
                .mockReturnValueOnce({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockOracle])),
                        })),
                    })),
                });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: externalPurchaseId,
            });

            expect(result.status).toBe("success");
        });
    });

    describe("getPurchaseStatus", () => {
        it("should get purchase by token and external ID", async () => {
            const result = await service.getPurchaseStatus({
                selector: {
                    token: mockToken,
                    externalId: mockExternalId,
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should get purchase by product ID and hex purchase ID", async () => {
            const hexPurchaseId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

            const result = await service.getPurchaseStatus({
                selector: {
                    productId: mockProductId,
                    purchaseId: hexPurchaseId,
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should get purchase by product ID and external purchase ID", async () => {
            const externalPurchaseId = "external-purchase-123";
            
            mockOracleDb.select = mock(() => ({
                from: mock(() => ({
                    innerJoin: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([
                                { product_oracle_purchase: mockPurchase }
                            ])),
                        })),
                    })),
                })),
            }));

            const result = await service.getPurchaseStatus({
                selector: {
                    productId: mockProductId,
                    purchaseId: externalPurchaseId,
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should return undefined when no purchase found", async () => {
            mockOracleDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => ({
                        limit: mock(() => Promise.resolve([])),
                    })),
                })),
            }));

            const result = await service.getPurchaseStatus({
                selector: {
                    token: "non-existent-token",
                    externalId: "non-existent-id",
                },
            });

            expect(result).toBeUndefined();
        });
    });
});