import type { Hex, LocalAccount } from "viem";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    adminWalletsRepositoryMocks,
    dbMock,
} from "../../../../test/mock/common";
import { viemActionsMocks } from "../../../../test/mock/viem";
import type { MerkleTreeRepository } from "../repositories/MerkleTreeRepository";
import { UpdateOracleService } from "./updateService";

describe("UpdateOracleService", () => {
    let service: UpdateOracleService;

    const mockMerkleTreeRepository: MerkleTreeRepository = {
        getMerkleProof: vi.fn(() => Promise.resolve(null)),
        getMerkleRoot: vi.fn(() => Promise.resolve("0xnewroot" as Hex)),
        invalidateProductTrees: vi.fn(() => {}),
    } as unknown as MerkleTreeRepository;

    const mockProductId = "0x1234567890abcdef1234567890abcdef" as Hex;
    const mockOracleUpdater = {
        address: "0xoracleupdater" as const,
        signMessage: vi.fn(() => Promise.resolve("0x" as Hex)),
        signTransaction: vi.fn(() => Promise.resolve("0x" as Hex)),
        signTypedData: vi.fn(() => Promise.resolve("0x" as Hex)),
        publicKey: "0x" as Hex,
        source: "privateKey",
        type: "local",
    } as LocalAccount;

    beforeAll(() => {
        // Mock adminWalletsRepository
        adminWalletsRepositoryMocks.getKeySpecificAccount.mockResolvedValue(
            mockOracleUpdater
        );

        service = new UpdateOracleService(mockMerkleTreeRepository);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        // Reset all mocks before each test
        dbMock.__reset();
        viemActionsMocks.simulateContract.mockReset();
        viemActionsMocks.writeContract.mockReset();
        viemActionsMocks.waitForTransactionReceipt.mockReset();
        viemActionsMocks.readContract.mockReset();
    });

    describe("updateEmptyLeafs", () => {
        it("should return empty set when no purchases need leaf updates", async () => {
            // Mock query to return empty array
            dbMock.__setFindManyResponse(() => Promise.resolve([]));

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

            dbMock.__setFindManyResponse(() => Promise.resolve(mockPurchases));
            dbMock.__setUpdateResponse(() => Promise.resolve());

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1, 2]));
            expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
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

            dbMock.__setFindManyResponse(() => Promise.resolve(mockPurchases));
            dbMock.__setUpdateResponse(() => Promise.resolve());

            const result = await service.updateEmptyLeafs();

            expect(result).toEqual(new Set([1]));
            expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
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
            // Mock that returns an array
            const mockProducts = [
                { productId: mockProductId },
                { productId: "0xother" as Hex },
            ];

            dbMock.__setSelectResponse(
                vi.fn(() => Promise.resolve(mockProducts))
            );

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
            dbMock.__setUpdateResponse(() => Promise.resolve());

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
            expect(dbMock.__getUpdateMock()).toHaveBeenCalled();
        });

        it("should skip blockchain update when merkle root is already current", async () => {
            const productIds = [mockProductId];

            // Mock database update
            dbMock.__setUpdateResponse(() => Promise.resolve());

            // Mock blockchain calls to return same root
            mockMerkleTreeRepository.getMerkleRoot = vi.fn(() =>
                Promise.resolve("0xsameroot" as Hex)
            );
            viemActionsMocks.readContract.mockResolvedValue("0xsameroot");

            await service.updateProductsMerkleRoot({ productIds });

            expect(viemActionsMocks.simulateContract).not.toHaveBeenCalled();
            expect(mockMerkleTreeRepository.getMerkleRoot).toHaveBeenCalled();
            expect(dbMock.__getUpdateMock()).toHaveBeenCalled();
        });

        it("should handle blockchain update failure gracefully", async () => {
            const productIds = [mockProductId];

            // Mock database update
            dbMock.__setUpdateResponse(() => Promise.resolve());

            // Mock blockchain calls to fail
            viemActionsMocks.readContract.mockResolvedValue("0xoldroot");
            viemActionsMocks.simulateContract.mockRejectedValue(
                new Error("Blockchain error")
            );

            await service.updateProductsMerkleRoot({ productIds });

            // Should still update database even if blockchain fails
            expect(dbMock.__getUpdateMock()).toHaveBeenCalled();
            expect(mockMerkleTreeRepository.getMerkleRoot).toHaveBeenCalled();
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
