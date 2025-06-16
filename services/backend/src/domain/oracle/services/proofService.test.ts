import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Hex } from "viem";
import { mockAll } from "../../../../test/mock";
import { productOracleTable, purchaseStatusTable } from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { OracleProofService } from "./proofService";

describe("OracleProofService", () => {
    const db = drizzle.mock({
        schema: { purchaseStatusTable, productOracleTable },
    });
    let service: OracleProofService;

    const mockMerkleTreeRepository: MerkleTreeRepository = {
        getMerkleProof: mock(() =>
            Promise.resolve({
                proof: ["0x123", "0x456"] as Hex[],
                leaf: "0xabc" as Hex,
            })
        ),
        getMerkleRoot: mock(() => Promise.resolve("0xroot" as Hex)),
        invalidateProductTrees: mock(() => {}),
    } as unknown as MerkleTreeRepository;

    const mockProductId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockPurchaseId =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex;

    beforeAll(() => {
        mockAll();

        service = new OracleProofService(db, mockMerkleTreeRepository);
    });

    afterAll(() => {
        mock.restore();
    });

    describe("getPurchaseProof", () => {
        it("should return purchase-not-found when purchase doesn't exist", async () => {
            // Mock database query to return empty array
            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([])),
                        })),
                        innerJoin: mock(() => ({
                            where: mock(() => ({
                                limit: mock(() => Promise.resolve([])),
                            })),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: "non-existent",
            });

            expect(result).toEqual({ status: "purchase-not-found" });
        });

        it("should return purchase-not-processed when purchase has no leaf", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockPurchase])),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({ status: "purchase-not-processed" });
        });

        it("should return oracle-not-synced when oracle is not synced", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockOracle = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "signature-key",
                platform: "shopify" as const,
                merkleRoot: "0xroot" as Hex,
                synced: false,
                createdAt: new Date(),
            };

            let callCount = 0;
            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => {
                                callCount++;
                                if (callCount === 1) {
                                    return Promise.resolve([mockPurchase]);
                                }
                                return Promise.resolve([mockOracle]);
                            }),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({ status: "oracle-not-synced" });
        });

        it("should return no-proof-found when merkle proof is not available", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockOracle = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "signature-key",
                platform: "shopify" as const,
                merkleRoot: "0xroot" as Hex,
                synced: true,
                createdAt: new Date(),
            };

            let callCount = 0;
            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => {
                                callCount++;
                                if (callCount === 1) {
                                    return Promise.resolve([mockPurchase]);
                                }
                                return Promise.resolve([mockOracle]);
                            }),
                        })),
                    })),
                })),
            });

            mockMerkleTreeRepository.getMerkleProof = mock(() =>
                Promise.resolve(null)
            );

            const result = await service.getPurchaseProof({
                productId: mockProductId,
                purchaseId: mockPurchaseId,
            });

            expect(result).toEqual({ status: "no-proof-found" });
        });

        it("should return success with proof when everything is valid", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockOracle = {
                id: 1,
                productId: mockProductId,
                hookSignatureKey: "signature-key",
                platform: "shopify" as const,
                merkleRoot: "0xroot" as Hex,
                synced: true,
                createdAt: new Date(),
            };

            const mockProof = {
                proof: ["0x123", "0x456"] as Hex[],
                leaf: "0xabc" as Hex,
            };

            let callCount = 0;
            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => {
                                callCount++;
                                if (callCount === 1) {
                                    return Promise.resolve([mockPurchase]);
                                }
                                return Promise.resolve([mockOracle]);
                            }),
                        })),
                    })),
                })),
            });

            mockMerkleTreeRepository.getMerkleProof = mock(() =>
                Promise.resolve(mockProof)
            );

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
    });

    describe("getPurchaseStatus", () => {
        it("should find purchase by token and external id", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                purchaseToken: "token-123",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockPurchase])),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseStatus({
                selector: {
                    token: "token-123",
                    externalId: "ext-123",
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should find purchase by hex purchase id", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([mockPurchase])),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseStatus({
                selector: {
                    productId: mockProductId,
                    purchaseId: mockPurchaseId,
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should find purchase by external purchase id with join", async () => {
            const mockPurchase = {
                id: 1,
                oracleId: 1,
                purchaseId: mockPurchaseId,
                externalId: "ext-123",
                externalCustomerId: "customer-456",
                totalPrice: "99.99",
                currencyCode: "USD",
                status: "confirmed" as const,
                leaf: "0xleaf" as Hex,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        innerJoin: mock(() => ({
                            where: mock(() => ({
                                limit: mock(() =>
                                    Promise.resolve([
                                        {
                                            product_oracle_purchase:
                                                mockPurchase,
                                        },
                                    ])
                                ),
                            })),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseStatus({
                selector: {
                    productId: mockProductId,
                    purchaseId: "ext-123", // Non-hex external ID
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should return undefined when purchase is not found", async () => {
            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => Promise.resolve([])),
                        })),
                        innerJoin: mock(() => ({
                            where: mock(() => ({
                                limit: mock(() => Promise.resolve([])),
                            })),
                        })),
                    })),
                })),
            });

            const result = await service.getPurchaseStatus({
                selector: {
                    productId: mockProductId,
                    purchaseId: "non-existent",
                },
            });

            expect(result).toBeUndefined();
        });
    });
});
