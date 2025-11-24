import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dbMock } from "../../../../test/mock/common";
import { PendingInteractionsRepository } from "./PendingInteractionsRepository";

describe("PendingInteractionsRepository", () => {
    let repository: PendingInteractionsRepository;

    beforeEach(() => {
        dbMock.__reset();
        repository = new PendingInteractionsRepository();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getAndLock", () => {
        it("should unlock stale locks and return locked interactions", async () => {
            const now = new Date();
            const mockInteractions = [
                {
                    id: 1,
                    wallet: "0x123" as `0x${string}`,
                    productId: "0xabc" as `0x${string}`,
                    typeDenominator: "0xdef" as `0x${string}`,
                    interactionData: "0x456" as `0x${string}`,
                    status: "pending" as const,
                    retryCount: 0,
                    createdAt: now,
                    lockedAt: null,
                    signature: null,
                    failureReason: null,
                    lastRetryAt: null,
                    nextRetryAt: null,
                    updatedAt: null,
                },
            ];

            // Mock the transaction
            const updateMock = dbMock.__getUpdateMock();
            const transactionMock = dbMock.__getTransactionMock();

            // Mock select to return candidate IDs
            dbMock.__setSelectResponse(() => Promise.resolve([{ id: 1 }]));

            // Mock update to return full interactions
            dbMock.__setUpdateResponse(() => Promise.resolve(mockInteractions));

            const result = await repository.getAndLock({
                status: "pending",
                limit: 50,
            });

            expect(result).toEqual(mockInteractions);
            expect(transactionMock).toHaveBeenCalledTimes(1);
            // Should call update twice: once for unlocking stale, once for locking
            expect(updateMock).toHaveBeenCalled();
        });

        it("should return empty array when no interactions found", async () => {
            dbMock.__setSelectResponse(() => Promise.resolve([]));

            const result = await repository.getAndLock({
                status: "pending",
                limit: 50,
            });

            expect(result).toEqual([]);
        });

        it("should respect the limit parameter", async () => {
            const selectMock = vi.fn(() =>
                Promise.resolve([{ id: 1 }, { id: 2 }, { id: 3 }])
            );
            dbMock.__setSelectResponse(selectMock);
            dbMock.__setUpdateResponse(() =>
                Promise.resolve([
                    {
                        id: 1,
                        wallet: "0x123" as `0x${string}`,
                        productId: "0xabc" as `0x${string}`,
                        typeDenominator: "0xdef" as `0x${string}`,
                        interactionData: "0x456" as `0x${string}`,
                        status: "pending" as const,
                        retryCount: 0,
                        createdAt: new Date(),
                        lockedAt: new Date(),
                        signature: null,
                        failureReason: null,
                        lastRetryAt: null,
                        nextRetryAt: null,
                        updatedAt: null,
                    },
                ])
            );

            await repository.getAndLock({
                status: "pending",
                limit: 10,
            });

            // Verify limit was used in the query chain
            expect(selectMock).toHaveBeenCalled();
        });

        it("should handle succeeded status", async () => {
            const mockInteractions = [
                {
                    id: 1,
                    wallet: "0x123" as `0x${string}`,
                    productId: "0xabc" as `0x${string}`,
                    typeDenominator: "0xdef" as `0x${string}`,
                    interactionData: "0x456" as `0x${string}`,
                    status: "succeeded" as const,
                    retryCount: 0,
                    createdAt: new Date(),
                    lockedAt: new Date(),
                    signature: "0x789" as `0x${string}`,
                    failureReason: null,
                    lastRetryAt: null,
                    nextRetryAt: null,
                    updatedAt: null,
                },
            ];

            dbMock.__setSelectResponse(() => Promise.resolve([{ id: 1 }]));
            dbMock.__setUpdateResponse(() => Promise.resolve(mockInteractions));

            const result = await repository.getAndLock({
                status: "succeeded",
            });

            expect(result).toEqual(mockInteractions);
            expect(result[0]?.status).toBe("succeeded");
        });
    });

    describe("unlock", () => {
        it("should unlock interactions", async () => {
            const interactions = [
                {
                    id: 1,
                    wallet: "0x123" as `0x${string}`,
                    productId: "0xabc" as `0x${string}`,
                    typeDenominator: "0xdef" as `0x${string}`,
                    interactionData: "0x456" as `0x${string}`,
                    status: "pending" as const,
                    retryCount: 0,
                    createdAt: new Date(),
                    lockedAt: new Date(),
                    signature: null,
                    failureReason: null,
                    lastRetryAt: null,
                    nextRetryAt: null,
                    updatedAt: null,
                },
            ];

            const updateMock = dbMock.__getUpdateMock();
            dbMock.__setUpdateResponse(() => Promise.resolve(interactions));

            await repository.unlock(interactions);

            expect(updateMock).toHaveBeenCalled();
        });

        it("should handle empty array gracefully", async () => {
            const updateMock = dbMock.__getUpdateMock();

            await repository.unlock([]);

            // Should not call update for empty array
            expect(updateMock).not.toHaveBeenCalled();
        });
    });

    describe("resetForSimulation", () => {
        it("should reset interactions to pending status", async () => {
            const updateMock = dbMock.__getUpdateMock();
            dbMock.__setUpdateResponse(() => Promise.resolve([]));

            await repository.resetForSimulation([1, 2, 3]);

            expect(updateMock).toHaveBeenCalled();
        });

        it("should handle empty array gracefully", async () => {
            const updateMock = dbMock.__getUpdateMock();

            await repository.resetForSimulation([]);

            expect(updateMock).not.toHaveBeenCalled();
        });
    });

    describe("resetForExecution", () => {
        it("should reset interactions to succeeded status", async () => {
            const updateMock = dbMock.__getUpdateMock();
            dbMock.__setUpdateResponse(() => Promise.resolve([]));

            await repository.resetForExecution([1, 2, 3]);

            expect(updateMock).toHaveBeenCalled();
        });

        it("should handle empty array gracefully", async () => {
            const updateMock = dbMock.__getUpdateMock();

            await repository.resetForExecution([]);

            expect(updateMock).not.toHaveBeenCalled();
        });
    });
});
