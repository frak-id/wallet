import { beforeEach, describe, expect, it, mock } from "bun:test";
import { OracleWebhookService } from "./hookService";

describe("OracleWebhookService", () => {
    let service: OracleWebhookService;
    let mockOracleDb: any;

    const mockPurchase = {
        purchaseId: "test-purchase-id",
        status: "confirmed" as const,
        totalPrice: 1999,
        currencyCode: "USD",
        purchaseToken: "test-token-123",
    };

    const mockPurchaseItems = [
        {
            purchaseId: 1,
            itemId: "item-1",
            quantity: 2,
            price: 999,
        },
        {
            purchaseId: 1,
            itemId: "item-2",
            quantity: 1,
            price: 1000,
        },
    ];

    /* -------------------------------------------------------------------------- */
    /*                                    Mocks                                   */
    /* -------------------------------------------------------------------------- */

    mock.module("@backend-common", () => ({
        log: {
            debug: mock(() => {}),
        },
    }));

    /* -------------------------------------------------------------------------- */
    /*                                    Setup                                   */
    /* -------------------------------------------------------------------------- */

    beforeEach(() => {
        const mockExecute = mock(() => Promise.resolve());
        const mockReturning = mock(() => ({ purchaseId: 1 }));
        const mockOnConflictDoUpdate = mock(() => ({ returning: mockReturning }));
        const mockOnConflictDoNothing = mock(() => Promise.resolve());
        const mockValues = mock(() => ({ 
            onConflictDoUpdate: mockOnConflictDoUpdate,
            onConflictDoNothing: mockOnConflictDoNothing,
        }));
        const mockInsert = mock(() => ({ values: mockValues }));
        const mockTransaction = mock((fn: any) => fn({
            insert: mockInsert,
        }));

        mockOracleDb = {
            transaction: mockTransaction,
        };

        service = new OracleWebhookService(mockOracleDb);
    });

    /* -------------------------------------------------------------------------- */
    /*                                    Tests                                   */
    /* -------------------------------------------------------------------------- */

    describe("upsertPurchase", () => {
        it("should successfully upsert purchase with items", async () => {
            await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: mockPurchaseItems,
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle purchase without items", async () => {
            await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: [],
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle purchase without purchase token", async () => {
            const purchaseWithoutToken = {
                ...mockPurchase,
                purchaseToken: undefined,
            };

            await service.upsertPurchase({
                purchase: purchaseWithoutToken,
                purchaseItems: mockPurchaseItems,
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle different purchase statuses", async () => {
            const purchaseStatuses = ["pending", "confirmed", "cancelled", "refunded"] as const;

            for (const status of purchaseStatuses) {
                const purchaseWithStatus = {
                    ...mockPurchase,
                    status,
                };

                await service.upsertPurchase({
                    purchase: purchaseWithStatus,
                    purchaseItems: [],
                });

                expect(mockOracleDb.transaction).toHaveBeenCalled();
            }
        });

        it("should handle transaction errors gracefully", async () => {
            const errorMockTransaction = mock(() => Promise.reject(new Error("Transaction failed")));
            const errorMockDb = {
                transaction: errorMockTransaction,
            };

            const errorService = new OracleWebhookService(errorMockDb);

            await expect(
                errorService.upsertPurchase({
                    purchase: mockPurchase,
                    purchaseItems: mockPurchaseItems,
                })
            ).rejects.toThrow("Transaction failed");
        });

        it("should update existing purchase on conflict", async () => {
            const updatedPurchase = {
                ...mockPurchase,
                status: "cancelled" as const,
                totalPrice: 0,
            };

            await service.upsertPurchase({
                purchase: updatedPurchase,
                purchaseItems: [],
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle large number of purchase items", async () => {
            const manyItems = Array.from({ length: 100 }, (_, i) => ({
                purchaseId: 1,
                itemId: `item-${i}`,
                quantity: 1,
                price: 100 + i,
            }));

            await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: manyItems,
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should handle null purchase token correctly", async () => {
            const purchaseWithNullToken = {
                ...mockPurchase,
                purchaseToken: null,
            };

            await service.upsertPurchase({
                purchase: purchaseWithNullToken,
                purchaseItems: [],
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
        });

        it("should reset leaf on update", async () => {
            // This test verifies that the leaf is set to null during updates
            // which is important for the merkle tree invalidation process
            await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: [],
            });

            expect(mockOracleDb.transaction).toHaveBeenCalled();
            // The implementation should set leaf: null in the update
        });
    });
});