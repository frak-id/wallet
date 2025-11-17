import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { dbMock } from "../../../../test/mock/common";
import { ArchiveRepository } from "./ArchiveRepository";

describe("ArchiveRepository", () => {
    let repository: ArchiveRepository;

    beforeEach(() => {
        dbMock.__reset();
        repository = new ArchiveRepository();
    });

    afterEach(() => {
        mock.restore();
    });

    describe("archiveInteraction", () => {
        it("should archive a single interaction with transaction", async () => {
            const interaction = {
                id: 1,
                wallet: "0x123" as `0x${string}`,
                productId: "0xabc" as `0x${string}`,
                typeDenominator: "0xdef" as `0x${string}`,
                interactionData: "0x456" as `0x${string}`,
                signature: "0x789" as `0x${string}`,
                status: "failed" as const,
                failureReason: "Test failure",
                retryCount: 5,
                lastRetryAt: new Date(),
                nextRetryAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                lockedAt: null,
            };

            const transactionMock = dbMock.__getTransactionMock();
            const deleteMock = dbMock.__getDeleteExecuteMock();
            dbMock.__setInsertResponse(() => Promise.resolve([]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            await repository.archiveInteraction(interaction, "max_retries");

            expect(transactionMock).toHaveBeenCalledTimes(1);
            expect(deleteMock).toHaveBeenCalled();
        });

        it("should handle interaction without signature", async () => {
            const interaction = {
                id: 1,
                wallet: "0x123" as `0x${string}`,
                productId: "0xabc" as `0x${string}`,
                typeDenominator: "0xdef" as `0x${string}`,
                interactionData: "0x456" as `0x${string}`,
                signature: null,
                status: "no_session" as const,
                failureReason: null,
                retryCount: 0,
                lastRetryAt: null,
                nextRetryAt: null,
                createdAt: new Date(),
                updatedAt: null,
                lockedAt: null,
            };

            const transactionMock = dbMock.__getTransactionMock();
            dbMock.__setInsertResponse(() => Promise.resolve([]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            await repository.archiveInteraction(interaction, "expired");

            expect(transactionMock).toHaveBeenCalledTimes(1);
        });

        it("should support all archive reasons", async () => {
            const interaction = {
                id: 1,
                wallet: "0x123" as `0x${string}`,
                productId: "0xabc" as `0x${string}`,
                typeDenominator: "0xdef" as `0x${string}`,
                interactionData: "0x456" as `0x${string}`,
                signature: null,
                status: "pending" as const,
                failureReason: null,
                retryCount: 0,
                lastRetryAt: null,
                nextRetryAt: null,
                createdAt: new Date(),
                updatedAt: null,
                lockedAt: null,
            };

            dbMock.__setInsertResponse(() => Promise.resolve([]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            const reasons: ("max_retries" | "expired" | "manual")[] = [
                "max_retries",
                "expired",
                "manual",
            ];

            for (const reason of reasons) {
                dbMock.__reset();
                await repository.archiveInteraction(interaction, reason);
                expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
            }
        });
    });

    describe("archiveInteractions", () => {
        it("should archive multiple interactions in a single transaction", async () => {
            const interactions = [
                {
                    id: 1,
                    wallet: "0x123" as `0x${string}`,
                    productId: "0xabc" as `0x${string}`,
                    typeDenominator: "0xdef" as `0x${string}`,
                    interactionData: "0x456" as `0x${string}`,
                    signature: "0x111" as `0x${string}`,
                    status: "failed" as const,
                    failureReason: "Failure 1",
                    retryCount: 3,
                    lastRetryAt: new Date(),
                    nextRetryAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lockedAt: null,
                },
                {
                    id: 2,
                    wallet: "0x456" as `0x${string}`,
                    productId: "0xdef" as `0x${string}`,
                    typeDenominator: "0x123" as `0x${string}`,
                    interactionData: "0x789" as `0x${string}`,
                    signature: null,
                    status: "no_session" as const,
                    failureReason: "Failure 2",
                    retryCount: 10,
                    lastRetryAt: new Date(),
                    nextRetryAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lockedAt: null,
                },
            ];

            const transactionMock = dbMock.__getTransactionMock();
            const deleteMock = dbMock.__getDeleteExecuteMock();
            dbMock.__setInsertResponse(() => Promise.resolve([]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            await repository.archiveInteractions(interactions, "max_retries");

            // Should use only 1 transaction for bulk operation
            expect(transactionMock).toHaveBeenCalledTimes(1);
            expect(deleteMock).toHaveBeenCalled();
        });

        it("should handle empty array gracefully", async () => {
            const transactionMock = dbMock.__getTransactionMock();

            await repository.archiveInteractions([], "max_retries");

            // Should not start transaction for empty array
            expect(transactionMock).not.toHaveBeenCalled();
        });

        it("should handle large batches efficiently", async () => {
            const interactions = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                wallet: `0x${i.toString(16).padStart(40, "0")}` as `0x${string}`,
                productId: "0xabc" as `0x${string}`,
                typeDenominator: "0xdef" as `0x${string}`,
                interactionData: "0x456" as `0x${string}`,
                signature: null,
                status: "failed" as const,
                failureReason: `Failure ${i}`,
                retryCount: i,
                lastRetryAt: new Date(),
                nextRetryAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                lockedAt: null,
            }));

            const transactionMock = dbMock.__getTransactionMock();
            dbMock.__setInsertResponse(() => Promise.resolve([]));
            dbMock.__setDeleteResponse(() => Promise.resolve([]));

            await repository.archiveInteractions(interactions, "max_retries");

            // Should still use only 1 transaction even for 100 interactions
            expect(transactionMock).toHaveBeenCalledTimes(1);
        });
    });
});
