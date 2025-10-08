import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mock,
} from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Hex, LocalAccount } from "viem";
import { mockAll } from "../../../../test/mock";
import { adminWalletsRepositoryMocks } from "../../../../test/mock/common";
import { viemActionsMocks } from "../../../../test/mock/viem";
import {
    productOracleTable,
    purchaseItemTable,
    purchaseStatusTable,
} from "../db/schema";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { UpdateOracleService } from "./updateService";

describe("UpdateOracleService", () => {
    const db = drizzle.mock({
        schema: { purchaseStatusTable, productOracleTable, purchaseItemTable },
    });
    let service: UpdateOracleService;

    const mockMerkleTreeRepository: MerkleTreeRepository = {
        getMerkleProof: mock(() => Promise.resolve(null)),
        getMerkleRoot: mock(() => Promise.resolve("0xnewroot" as Hex)),
        invalidateProductTrees: mock(() => {}),
    } as unknown as MerkleTreeRepository;

    const mockProductId = "0x1234567890abcdef1234567890abcdef" as Hex;
    const mockOracleUpdater = {
        address: "0xoracleupdater" as const,
        signMessage: mock(() => Promise.resolve("0x" as Hex)),
        signTransaction: mock(() => Promise.resolve("0x" as Hex)),
        signTypedData: mock(() => Promise.resolve("0x" as Hex)),
        publicKey: "0x" as Hex,
        source: "privateKey",
        type: "local",
    } as LocalAccount;

    beforeAll(() => {
        mockAll();

        // Mock adminWalletsRepository
        adminWalletsRepositoryMocks.getKeySpecificAccount.mockResolvedValue(
            mockOracleUpdater
        );

        service = new UpdateOracleService(mockMerkleTreeRepository);
    });

    afterAll(() => {
        mock.restore();
    });

    beforeEach(() => {
        // Reset all mocks before each test
        viemActionsMocks.simulateContract.mockReset();
        viemActionsMocks.writeContract.mockReset();
        viemActionsMocks.waitForTransactionReceipt.mockReset();
        viemActionsMocks.readContract.mockReset();
    });

    describe("updateEmptyLeafs", () => {
        it("should return empty set when no purchases need leaf updates", async () => {
            // Mock query to return empty array
            const mockQuery = {
                purchaseStatusTable: {
                    findMany: mock(() => Promise.resolve([])),
                },
            };
            Object.assign(db, { query: mockQuery });

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set());
        });

        it("should generate leafs for purchases with different statuses", async () => {
            const mockPurchases = [
                {
                    id: 1,
                    oracleId: 1,
                    purchaseId:
                        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    status: "confirmed" as const,
                },
                {
                    id: 2,
                    oracleId: 1,
                    purchaseId:
                        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                    status: "cancelled" as const,
                },
                {
                    id: 3,
                    oracleId: 2,
                    purchaseId:
                        "0x5678567856785678567856785678567856785678567856785678567856785678",
                    status: "refunded" as const,
                },
            ];

            const mockQuery = {
                purchaseStatusTable: {
                    findMany: mock(() => Promise.resolve(mockPurchases)),
                },
            };
            Object.assign(db, { query: mockQuery });

            // Mock database transaction
            const mockUpdate = mock(() => ({
                set: mock(() => ({
                    where: mock(() => Promise.resolve()),
                })),
            }));
            const mockTransaction = mock(
                async (callback: (trx: unknown) => unknown) => {
                    const mockTrx = {
                        update: mock(() => mockUpdate()),
                    };
                    return await callback(mockTrx);
                }
            );
            Object.assign(db, { transaction: mockTransaction });

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1, 2]));
            expect(db.transaction).toHaveBeenCalled();
        });

        it("should handle pending status as blockchain status 0", async () => {
            const mockPurchases = [
                {
                    id: 1,
                    oracleId: 1,
                    purchaseId:
                        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    status: "pending" as const,
                },
            ];

            const mockQuery = {
                purchaseStatusTable: {
                    findMany: mock(() => Promise.resolve(mockPurchases)),
                },
            };
            Object.assign(db, { query: mockQuery });

            const mockTransaction = mock(
                async (callback: (trx: unknown) => unknown) => {
                    const mockTrx = {
                        update: mock(() => ({
                            set: mock(() => ({
                                where: mock(() => Promise.resolve()),
                            })),
                        })),
                    };
                    return await callback(mockTrx);
                }
            );
            Object.assign(db, { transaction: mockTransaction });

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1]));
        });
    });

    describe("invalidateOracleTree", () => {
        it("should return empty array when no oracle ids provided", async () => {
            const result = await service.invalidateOracleTree({
                oracleIds: new Set(),
            });

            expect(result).toEqual([]);
        });

        it("should invalidate trees for provided oracle ids", async () => {
            const mockProducts = [
                { productId: mockProductId },
                { productId: "0xother" as Hex },
            ];

            Object.assign(db, {
                select: mock(() => ({
                    from: mock(() => ({
                        where: mock(() => Promise.resolve(mockProducts)),
                    })),
                })),
            });

            const result = await service.invalidateOracleTree({
                oracleIds: new Set([1, 2]),
            });

            expect(result).toEqual([mockProductId, "0xother"]);
            expect(
                mockMerkleTreeRepository.invalidateProductTrees
            ).toHaveBeenCalledWith({
                productIds: [mockProductId, "0xother"],
            });
        });
    });

    describe("updateProductsMerkleRoot", () => {
        it("should update merkle root for each product", async () => {
            const productIds = [
                mockProductId,
                "0x1234567890abcdef1234567890abcdef" as Hex,
            ];

            // Mock database update
            const mockUpdate = mock(() => ({
                set: mock(() => ({
                    where: mock(() => Promise.resolve()),
                })),
            }));
            Object.assign(db, {
                update: mock(() => mockUpdate()),
            });

            // Mock blockchain calls
            viemActionsMocks.readContract.mockResolvedValue("0xoldroot");
            viemActionsMocks.simulateContract.mockResolvedValue({
                request: {},
            });
            viemActionsMocks.writeContract.mockResolvedValue("0xtxhash" as Hex);
            viemActionsMocks.waitForTransactionReceipt.mockResolvedValue({});

            await service.updateProductsMerkleRoot({ productIds });

            expect(
                mockMerkleTreeRepository.getMerkleRoot
            ).toHaveBeenCalledTimes(2);
            expect(db.update).toHaveBeenCalled();
        });

        it("should skip blockchain update when merkle root is already current", async () => {
            const productIds = [mockProductId];

            // Mock database update
            const mockUpdate = mock(() => ({
                set: mock(() => ({
                    where: mock(() => Promise.resolve()),
                })),
            }));
            Object.assign(db, {
                update: mock(() => mockUpdate()),
            });

            // Mock blockchain calls to return same root
            mockMerkleTreeRepository.getMerkleRoot = mock(() =>
                Promise.resolve("0xsameroot" as Hex)
            );
            viemActionsMocks.readContract.mockResolvedValue("0xsameroot");

            await service.updateProductsMerkleRoot({ productIds });

            expect(viemActionsMocks.simulateContract).not.toHaveBeenCalled();
        });

        it("should handle blockchain update failure gracefully", async () => {
            const productIds = [mockProductId];

            // Mock database update
            const mockUpdate = mock(() => ({
                set: mock(() => ({
                    where: mock(() => Promise.resolve()),
                })),
            }));
            Object.assign(db, {
                update: mock(() => mockUpdate()),
            });

            // Mock blockchain calls to fail
            viemActionsMocks.readContract.mockResolvedValue("0xoldroot");
            viemActionsMocks.simulateContract.mockRejectedValue(
                new Error("Blockchain error")
            );

            await service.updateProductsMerkleRoot({ productIds });

            // Should still update database even if blockchain fails
            expect(db.update).toHaveBeenCalled();
        });
    });

    describe("safeMerkleeRootBlockchainUpdate", () => {
        it("should return success without transaction when root is already current", async () => {
            viemActionsMocks.readContract.mockResolvedValue("0xsameroot");

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: "0xsameroot" as Hex,
                oracleUpdater: mockOracleUpdater,
            });

            expect(result).toEqual({ isSuccess: true });
            expect(viemActionsMocks.simulateContract).not.toHaveBeenCalled();
        });

        it("should successfully update merkle root on blockchain", async () => {
            viemActionsMocks.readContract.mockResolvedValue("0xoldroot");
            viemActionsMocks.simulateContract.mockResolvedValue({
                request: {},
            });
            viemActionsMocks.writeContract.mockResolvedValue("0xtxhash" as Hex);
            viemActionsMocks.waitForTransactionReceipt.mockResolvedValue({});

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: "0xnewroot" as Hex,
                oracleUpdater: mockOracleUpdater,
            });

            expect(result).toEqual({ isSuccess: true, txHash: "0xtxhash" });
            expect(viemActionsMocks.writeContract).toHaveBeenCalled();
            expect(
                viemActionsMocks.waitForTransactionReceipt
            ).toHaveBeenCalled();
        });

        it("should handle blockchain transaction failure", async () => {
            viemActionsMocks.readContract.mockResolvedValue("0xoldroot");
            viemActionsMocks.simulateContract.mockRejectedValue(
                new Error("Transaction failed")
            );

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: "0xnewroot" as Hex,
                oracleUpdater: mockOracleUpdater,
            });

            expect(result).toEqual({ isSuccess: false });
        });
    });
});
