import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mock,
} from "vitest";
import type { Hex } from "viem";
import { dbMock } from "../../../../test/mock/common";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { OracleProofService } from "./proofService";

describe("OracleProofService", () => {
    let service: OracleProofService;

    const mockMerkleTreeRepository: MerkleTreeRepository = {
        getMerkleProof: vi.fn(() =>
            Promise.resolve({
                proof: ["0x123", "0x456"] as Hex[],
                leaf: "0xabc" as Hex,
            })
        ),
        getMerkleRoot: vi.fn(() => Promise.resolve("0xroot" as Hex)),
        invalidateProductTrees: vi.fn(() => {}),
    } as unknown as MerkleTreeRepository;

    const mockProductId =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockPurchaseId =
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex;

    beforeAll(() => {

        service = new OracleProofService(mockMerkleTreeRepository);
    });

    beforeEach(() => {
        // Reset db mock before each test
        dbMock.__reset();
        // Reset merkle tree repository mock
        mockMerkleTreeRepository.getMerkleProof = vi.fn(() =>
            Promise.resolve({
                proof: ["0x123", "0x456"] as Hex[],
                leaf: "0xabc" as Hex,
            })
        );
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("getPurchaseProof", () => {
        it("should return purchase-not-found when purchase doesn't exist", async () => {
            // Mock database query to return empty array (default behavior)
            dbMock.__setSelectResponse(() => Promise.resolve([]));

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

            dbMock.__setSelectResponse(() => Promise.resolve([mockPurchase]));

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
            dbMock.__setSelectResponse(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve([mockPurchase]);
                }
                return Promise.resolve([mockOracle]);
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
            dbMock.__setSelectResponse(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve([mockPurchase]);
                }
                return Promise.resolve([mockOracle]);
            });

            mockMerkleTreeRepository.getMerkleProof = vi.fn(() =>
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
            dbMock.__setSelectResponse(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve([mockPurchase]);
                }
                return Promise.resolve([mockOracle]);
            });

            mockMerkleTreeRepository.getMerkleProof = vi.fn(() =>
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

            dbMock.__setSelectResponse(() => Promise.resolve([mockPurchase]));

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

            dbMock.__setSelectResponse(() => Promise.resolve([mockPurchase]));

            const result = await service.getPurchaseStatus({
                productId: mockProductId,
                selector: {
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

            dbMock.__setSelectResponse(() =>
                Promise.resolve([{ product_oracle_purchase: mockPurchase }])
            );

            const result = await service.getPurchaseStatus({
                productId: mockProductId,
                selector: {
                    externalPurchaseId: "ext-purchase-123",
                },
            });

            expect(result).toEqual(mockPurchase);
        });

        it("should return undefined when purchase is not found", async () => {
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            const result = await service.getPurchaseStatus({
                productId: mockProductId,
                selector: {
                    purchaseId: "non-existent" as Hex,
                },
            });

            expect(result).toBeUndefined();
        });
    });
});
