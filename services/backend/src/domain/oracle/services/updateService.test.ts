import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Hex, LocalAccount } from "viem";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { UpdateOracleService } from "./updateService";

describe("UpdateOracleService", () => {
    let service: UpdateOracleService;
    let mockOracleDb: any;
    let mockMerkleRepository: MerkleTreeRepository;

    const mockProductId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;
    const mockMerkleRoot = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef" as Hex;
    const mockTxHash = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba" as Hex;

    const mockPurchasesWithoutLeafs = [
        {
            id: 1,
            purchaseId: "purchase-1",
            oracleId: 1,
            status: "confirmed" as const,
        },
        {
            id: 2,
            purchaseId: "purchase-2",
            oracleId: 2,
            status: "cancelled" as const,
        },
    ];

    const mockOracleAccount = {
        address: "0x1234567890abcdef1234567890abcdef12345678",
    } as LocalAccount;

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    mock.module("@backend-common", () => ({
        log: {
            debug: mock(() => {}),
            info: mock(() => {}),
            error: mock(() => {}),
        },
        adminWalletsRepository: {
            getKeySpecificAccount: mock(() => Promise.resolve(mockOracleAccount)),
        },
        viemClient: {},
    }));

    mock.module("@frak-labs/app-essentials", () => ({
        addresses: {
            purchaseOracle: "0x1234567890abcdef1234567890abcdef12345678",
        },
    }));

    mock.module("viem", () => ({
        encodePacked: mock((types: any[], values: any[]) => {
            return `0x${values[0].toString(16)}${values[1].toString().padStart(2, "0")}` as Hex;
        }),
    }));

    mock.module("viem/actions", () => ({
        readContract: mock(() => Promise.resolve("0xdifferentroot")),
        simulateContract: mock(() => Promise.resolve({ 
            request: { 
                address: "0x1234567890abcdef1234567890abcdef12345678",
                functionName: "updateMerkleRoot",
                args: [BigInt(mockProductId), mockMerkleRoot],
            }
        })),
        writeContract: mock(() => Promise.resolve(mockTxHash)),
        waitForTransactionReceipt: mock(() => Promise.resolve({ 
            status: "success",
            transactionHash: mockTxHash,
        })),
    }));

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        const mockExecute = mock(() => Promise.resolve());
        const mockWhere = mock(() => ({ execute: mockExecute }));
        const mockSet = mock(() => ({ where: mockWhere }));
        const mockUpdate = mock(() => ({ set: mockSet }));
        const mockSelect = mock(() => ({ 
            from: mock(() => ({ 
                where: mock(() => Promise.resolve([{ productId: mockProductId }])) 
            }))
        }));
        const mockTransaction = mock((fn: any) => fn({
            update: mockUpdate,
        }));

        mockOracleDb = {
            query: {
                purchaseStatusTable: {
                    findMany: mock(() => Promise.resolve(mockPurchasesWithoutLeafs)),
                },
            },
            transaction: mockTransaction,
            select: mockSelect,
            update: mockUpdate,
        };

        mockMerkleRepository = {
            invalidateProductTrees: mock(() => {}),
            getMerkleRoot: mock(() => Promise.resolve(mockMerkleRoot)),
        } as unknown as MerkleTreeRepository;

        service = new UpdateOracleService(mockOracleDb, mockMerkleRepository);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("updateEmptyLeafs", () => {
        it("should update purchases without leafs and return oracle IDs", async () => {
            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1, 2]));
            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle empty purchase list", async () => {
            mockOracleDb.query.purchaseStatusTable.findMany = mock(() => Promise.resolve([]));

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set());
            expect(mockOracleDb.transaction).not.toHaveBeenCalled();
        });

        it("should correctly map purchase statuses to blockchain statuses", async () => {
            const purchasesWithDifferentStatuses = [
                { id: 1, purchaseId: "p1", oracleId: 1, status: "confirmed" },
                { id: 2, purchaseId: "p2", oracleId: 1, status: "cancelled" },
                { id: 3, purchaseId: "p3", oracleId: 1, status: "refunded" },
                { id: 4, purchaseId: "p4", oracleId: 1, status: "pending" },
            ];

            mockOracleDb.query.purchaseStatusTable.findMany = mock(() => 
                Promise.resolve(purchasesWithDifferentStatuses)
            );

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1]));
            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle transaction errors", async () => {
            mockOracleDb.transaction = mock(() => Promise.reject(new Error("Transaction failed")));

            await expect(service.updateEmptyLeafs()).rejects.toThrow("Transaction failed");
        });
    });

    describe("invalidateOracleTree", () => {
        it("should invalidate trees for given oracle IDs", async () => {
            const oracleIds = new Set([1, 2]);
            const result = await service.invalidateOracleTree({ oracleIds });

            expect(result).toEqual([mockProductId]);
            expect(mockMerkleRepository.invalidateProductTrees).toHaveBeenCalledWith({
                productIds: [mockProductId],
            });
        });

        it("should return empty array for empty oracle IDs", async () => {
            const result = await service.invalidateOracleTree({ oracleIds: new Set() });

            expect(result).toEqual([]);
            expect(mockMerkleRepository.invalidateProductTrees).not.toHaveBeenCalled();
        });

        it("should handle database errors", async () => {
            mockOracleDb.select = mock(() => ({
                from: mock(() => ({
                    where: mock(() => Promise.reject(new Error("Database error"))),
                })),
            }));

            const oracleIds = new Set([1, 2]);
            await expect(service.invalidateOracleTree({ oracleIds })).rejects.toThrow("Database error");
        });
    });

    describe("updateProductsMerkleRoot", () => {
        it("should update merkle roots for all products", async () => {
            const productIds = [mockProductId];

            await service.updateProductsMerkleRoot({ productIds });

            expect(mockMerkleRepository.getMerkleRoot).toHaveBeenCalledWith({
                productId: mockProductId,
            });
            expect(mockOracleDb.update).toHaveBeenCalledTimes(2); // Once for unsync, once for sync
        });

        it("should handle empty product list", async () => {
            await service.updateProductsMerkleRoot({ productIds: [] });

            expect(mockMerkleRepository.getMerkleRoot).not.toHaveBeenCalled();
            expect(mockOracleDb.update).not.toHaveBeenCalled();
        });

        it("should handle blockchain update failure", async () => {
            const { simulateContract } = await import("viem/actions");
            (simulateContract as any).mockRejectedValue(new Error("Simulation failed"));

            const productIds = [mockProductId];
            await service.updateProductsMerkleRoot({ productIds });

            // Should still update database but not mark as synced
            expect(mockOracleDb.update).toHaveBeenCalledTimes(1); // Only the initial unsync update
        });

        it("should skip update when merkle root is already current", async () => {
            const { readContract } = await import("viem/actions");
            (readContract as any).mockResolvedValue(mockMerkleRoot); // Same as current root

            const productIds = [mockProductId];
            await service.updateProductsMerkleRoot({ productIds });

            // Should still update database initially but skip blockchain transaction
            expect(mockOracleDb.update).toHaveBeenCalledTimes(2); // Still both updates
        });
    });

    describe("safeMerkleeRootBlockchainUpdate", () => {
        it("should successfully update merkle root on blockchain", async () => {
            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: mockMerkleRoot,
                oracleUpdater: mockOracleAccount,
            });

            expect(result).toEqual({
                isSuccess: true,
                txHash: mockTxHash,
            });
        });

        it("should return success without transaction when root is already current", async () => {
            const { readContract } = await import("viem/actions");
            (readContract as any).mockResolvedValue(mockMerkleRoot); // Same as target root

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: mockMerkleRoot,
                oracleUpdater: mockOracleAccount,
            });

            expect(result).toEqual({
                isSuccess: true,
            });
        });

        it("should handle simulation errors", async () => {
            const { simulateContract } = await import("viem/actions");
            (simulateContract as any).mockRejectedValue(new Error("Simulation failed"));

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: mockMerkleRoot,
                oracleUpdater: mockOracleAccount,
            });

            expect(result).toEqual({
                isSuccess: false,
            });
        });

        it("should handle write contract errors", async () => {
            const { writeContract } = await import("viem/actions");
            (writeContract as any).mockRejectedValue(new Error("Write failed"));

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: mockMerkleRoot,
                oracleUpdater: mockOracleAccount,
            });

            expect(result).toEqual({
                isSuccess: false,
            });
        });

        it("should handle transaction receipt errors", async () => {
            const { waitForTransactionReceipt } = await import("viem/actions");
            (waitForTransactionReceipt as any).mockRejectedValue(new Error("Receipt failed"));

            const result = await service.safeMerkleeRootBlockchainUpdate({
                productId: mockProductId,
                merkleRoot: mockMerkleRoot,
                oracleUpdater: mockOracleAccount,
            });

            expect(result).toEqual({
                isSuccess: false,
            });
        });
    });

    describe("integration flow", () => {
        it("should complete full update flow", async () => {
            // Step 1: Update empty leafs
            const oracleIds = await service.updateEmptyLeafs();
            expect(oracleIds.size).toBeGreaterThan(0);

            // Step 2: Invalidate oracle trees
            const productIds = await service.invalidateOracleTree({ oracleIds });
            expect(productIds.length).toBeGreaterThan(0);

            // Step 3: Update products merkle root
            await service.updateProductsMerkleRoot({ productIds });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
            expect(mockMerkleRepository.invalidateProductTrees).toHaveBeenCalled();
            expect(mockMerkleRepository.getMerkleRoot).toHaveBeenCalled();
        });
    });
});