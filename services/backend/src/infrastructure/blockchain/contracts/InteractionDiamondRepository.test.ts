import { addresses } from "@frak-labs/app-essentials";
import type { Address, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { viemActionsMocks } from "../../../../test/mock";
import { InteractionDiamondRepository } from "./InteractionDiamondRepository";

describe("InteractionDiamondRepository", () => {
    let repository: InteractionDiamondRepository;
    const mockProductId = "0x123" as Hex;
    const mockDiamondAddress =
        "0x1234567890abcdef1234567890abcdef12345678" as Address;

    beforeEach(() => {
        repository = new InteractionDiamondRepository();
        vi.clearAllMocks();
    });

    describe("getDiamondContract", () => {
        it("should return diamond address for a valid product ID", async () => {
            viemActionsMocks.readContract.mockResolvedValue(mockDiamondAddress);

            const result = await repository.getDiamondContract(mockProductId);

            expect(result).toBe(mockDiamondAddress);
            expect(viemActionsMocks.readContract).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    address: addresses.productInteractionManager,
                    functionName: "getInteractionContract",
                    args: [BigInt(mockProductId)],
                })
            );
        });

        it("should cache the diamond address for subsequent calls", async () => {
            viemActionsMocks.readContract.mockResolvedValue(mockDiamondAddress);

            // First call
            const result1 = await repository.getDiamondContract(mockProductId);
            expect(result1).toBe(mockDiamondAddress);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await repository.getDiamondContract(mockProductId);
            expect(result2).toBe(mockDiamondAddress);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);
        });

        it("should return different addresses for different product IDs", async () => {
            const productId1 = "0x123" as Hex;
            const productId2 = "0x456" as Hex;
            const address1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const address2 =
                "0x2222222222222222222222222222222222222222" as Address;

            viemActionsMocks.readContract
                .mockResolvedValueOnce(address1)
                .mockResolvedValueOnce(address2);

            const result1 = await repository.getDiamondContract(productId1);
            const result2 = await repository.getDiamondContract(productId2);

            expect(result1).toBe(address1);
            expect(result2).toBe(address2);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(2);
        });

        it("should return undefined when contract read fails", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Contract read failed")
            );

            const result = await repository.getDiamondContract(mockProductId);

            expect(result).toBeUndefined();
        });

        it("should cache undefined result when contract read fails", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Contract read failed")
            );

            // First call
            const result1 = await repository.getDiamondContract(mockProductId);
            expect(result1).toBeUndefined();
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);

            // Second call should use cached undefined
            const result2 = await repository.getDiamondContract(mockProductId);
            expect(result2).toBeUndefined();
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);
        });

        it("should handle zero address return", async () => {
            const zeroAddress =
                "0x0000000000000000000000000000000000000000" as Address;
            viemActionsMocks.readContract.mockResolvedValue(zeroAddress);

            const result = await repository.getDiamondContract(mockProductId);

            expect(result).toBe(zeroAddress);
        });

        it("should handle network errors gracefully", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Network timeout")
            );

            const result = await repository.getDiamondContract(mockProductId);

            expect(result).toBeUndefined();
        });

        it("should handle RPC errors gracefully", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("RPC error: execution reverted")
            );

            const result = await repository.getDiamondContract(mockProductId);

            expect(result).toBeUndefined();
        });

        it("should convert product ID to BigInt correctly", async () => {
            const hexProductId = "0xff" as Hex;
            viemActionsMocks.readContract.mockResolvedValue(mockDiamondAddress);

            await repository.getDiamondContract(hexProductId);

            expect(viemActionsMocks.readContract).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    args: [255n], // 0xff = 255
                })
            );
        });

        it("should handle large product IDs", async () => {
            const largeProductId = "0xffffffffffffffff" as Hex;
            viemActionsMocks.readContract.mockResolvedValue(mockDiamondAddress);

            const result = await repository.getDiamondContract(largeProductId);

            expect(result).toBe(mockDiamondAddress);
            expect(viemActionsMocks.readContract).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    args: [BigInt(largeProductId)],
                })
            );
        });
    });

    describe("cache TTL behavior", () => {
        it("should cache results with TTL", async () => {
            viemActionsMocks.readContract.mockResolvedValue(mockDiamondAddress);

            // First call
            await repository.getDiamondContract(mockProductId);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);

            // Immediate second call should use cache
            await repository.getDiamondContract(mockProductId);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);
        });
    });
});
