import type { Hex } from "viem";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { dbMock } from "../../../../test/mock/common";
import { OracleWebhookService } from "./hookService";

describe("OracleWebhookService", () => {
    let service: OracleWebhookService;

    const mockPurchase = {
        oracleId: 1,
        purchaseId:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
        externalId: "external-123",
        externalCustomerId: "customer-456",
        totalPrice: "99.99",
        currencyCode: "USD",
        status: "confirmed" as const,
    };

    const mockPurchaseItems = [
        {
            purchaseId: mockPurchase.purchaseId,
            externalId: "item-1",
            price: "49.99",
            name: "Test Product 1",
            title: "Test Product 1 Title",
            imageUrl: "https://example.com/image1.jpg",
            quantity: 1,
        },
        {
            purchaseId: mockPurchase.purchaseId,
            externalId: "item-2",
            price: "49.99",
            name: "Test Product 2",
            title: "Test Product 2 Title",
            imageUrl: "https://example.com/image2.jpg",
            quantity: 2,
        },
    ];

    beforeAll(() => {
        service = new OracleWebhookService();
    });

    beforeEach(() => {
        dbMock.__reset();
        dbMock.__setInsertResponse(() => Promise.resolve([{ purchaseId: 1 }]));
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("upsertPurchase", () => {
        it("should successfully upsert purchase with items", async () => {
            const result = await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: mockPurchaseItems,
            });

            expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
            expect(result).toBeUndefined(); // Method doesn't return anything
        });

        it("should handle purchase without items", async () => {
            const result = await service.upsertPurchase({
                purchase: mockPurchase,
                purchaseItems: [],
            });

            expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it("should handle purchase with purchase token", async () => {
            const purchaseWithToken = {
                ...mockPurchase,
                purchaseToken: "token-123",
            };

            const result = await service.upsertPurchase({
                purchase: purchaseWithToken,
                purchaseItems: mockPurchaseItems,
            });

            expect(dbMock.__getTransactionMock()).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it("should handle different purchase statuses", async () => {
            const statusesToTest = [
                "pending",
                "confirmed",
                "cancelled",
                "refunded",
            ] as const;

            for (const status of statusesToTest) {
                const purchaseWithStatus = {
                    ...mockPurchase,
                    status,
                };

                const result = await service.upsertPurchase({
                    purchase: purchaseWithStatus,
                    purchaseItems: [],
                });

                expect(result).toBeUndefined();
            }
        });
    });
});
